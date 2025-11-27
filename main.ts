import { Plugin, MarkdownView, Notice } from 'obsidian';

export default class RainbowLinkPlugin extends Plugin {

    async onload() {
        console.log('Rainbow Link Plugin loaded');

        // 注册4个核心命令
        // 用户安装后，需要在 设置->快捷键 里搜索这些名字，绑定 Alt+1/2/3/4

        this.addCommand({
            id: 'set-link-red',
            name: 'Colorize: Red 🔴',
            callback: () => this.executeRainbow('red')
        });

        this.addCommand({
            id: 'set-link-green',
            name: 'Colorize: Green 🟢',
            callback: () => this.executeRainbow('green')
        });

        this.addCommand({
            id: 'set-link-blue',
            name: 'Colorize: Blue 🔵',
            callback: () => this.executeRainbow('blue')
        });

        this.addCommand({
            id: 'set-link-high',
            name: 'Colorize: Highlight 🟡',
            callback: () => this.executeRainbow('high')
        });
    }

    // === 核心逻辑：全能处理器 (Editor + Kanban Input + Hover) ===
    async executeRainbow(colorTag: string) {
        let mode = "none";
        let targetObj: any = null;
        let selectionText = "";

        // ---------------------------------------------------------
        // 1. 侦探阶段：判断用户在哪里操作
        // ---------------------------------------------------------

        // A. 尝试获取标准编辑器 (普通笔记编辑模式)
        const activeLeaf = this.app.workspace.activeLeaf;
        const editor = activeLeaf?.view instanceof MarkdownView ? (activeLeaf.view as MarkdownView).editor : null;
        
        if (editor && editor.getSelection()) {
            mode = "editor";
            selectionText = editor.getSelection();
        }

        // B. 如果没找到，尝试获取活动输入框 (Kanban 编辑模式)
        if (mode === "none") {
            const activeEl = document.activeElement as HTMLInputElement;
            // 只要是输入框且有文字被选中
            if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT") && activeEl.value) {
                const start = activeEl.selectionStart;
                const end = activeEl.selectionEnd;
                if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                    mode = "input";
                    targetObj = activeEl;
                    selectionText = activeEl.value.substring(start, end);
                }
            }
        }

        // C. 如果还没找到，尝试获取鼠标悬停的链接 (预览模式 / Kanban 查看模式)
        if (mode === "none") {
            const hoverEl = document.querySelector('a.internal-link:hover') as HTMLElement;
            if (hoverEl) {
                mode = "hover";
                targetObj = hoverEl;
                const href = hoverEl.getAttribute('data-href');
                const text = hoverEl.innerText;
                if (href) {
                    // 构造伪装的 wiki link 字符串
                    selectionText = `[[${href}|${text}]]`;
                }
            }
        }

        // 🛑 如果三个模式都没命中
        if (mode === "none") {
            new Notice("⚠️ No target found!\nPlease select text OR hover over a link.");
            return;
        }

        // ---------------------------------------------------------
        // 2. 加工阶段：生成带有颜色的新链接字符串
        // ---------------------------------------------------------
        
        let linkTarget = selectionText;
        let alias = selectionText;

        // 简单的解析逻辑，剥离 [[ ]]
        if (selectionText.includes('[[')) {
            let content = selectionText.replace(/^\[\[|\]\]$/g, '');
            if (content.includes('|')) {
                const parts = content.split('|');
                linkTarget = parts[0];
                alias = parts.slice(1).join('|');
            } else {
                linkTarget = content;
                alias = content;
            }
        }

        // 清洗旧颜色标签 (防止 [[Note#red#blue]])
        linkTarget = linkTarget.replace(/#(red|green|blue|high)/g, "");
        
        // 生成最终的新代码
        const newLink = `[[${linkTarget}#${colorTag}|${alias}]]`;

        // ---------------------------------------------------------
        // 3. 执行阶段：根据模式写入
        // ---------------------------------------------------------

        if (mode === "editor" && editor) {
            // 📝 场景：普通笔记编辑
            editor.replaceSelection(newLink);

        } else if (mode === "input" && targetObj) {
            // 📝 场景：Kanban 输入框
            targetObj.focus();
            // 使用 execCommand 模拟用户粘贴，保留撤销历史
            document.execCommand("insertText", false, newLink);

        } else if (mode === "hover") {
            // 👁️ 场景：预览模式 / Kanban 查看模式 (隔山打牛)
            const file = this.app.workspace.getActiveFile();
            if (!file) { new Notice("Cannot find active file."); return; }

            await this.app.vault.process(file, (data) => {
                // 正则转义
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const escapedTarget = escapeRegExp(linkTarget);
                
                // 宽容匹配：找到文件里对应的那个链接
                // 匹配 [[Filename (可能有的#old)? (可能有的|Alias)? ]]
                const regex = new RegExp(`\\[\\[${escapedTarget}(#[a-zA-Z0-9]+)?(\\|.*?)?\\]\\]`, 'g');
                
                new Notice(`Link marked as ${colorTag}`);
                return data.replace(regex, newLink);
            });
        }
    }
}