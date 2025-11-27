import { Plugin, MarkdownView, Notice } from 'obsidian';

export default class RainbowLinkPlugin extends Plugin {

    // 修复 [1]: 去掉了 async
    onload() {
        // 修复 [2]: 去掉了 console.log

        // 修复 [3]: 使用句子大小写 (Sentence case)
        this.addCommand({
            id: 'set-link-red',
            name: 'Colorize: red 🔴', // Set Link Red -> Colorize: red
            callback: () => this.executeRainbow('red')
        });

        this.addCommand({
            id: 'set-link-green',
            name: 'Colorize: green 🟢',
            callback: () => this.executeRainbow('green')
        });

        this.addCommand({
            id: 'set-link-blue',
            name: 'Colorize: blue 🔵',
            callback: () => this.executeRainbow('blue')
        });

        this.addCommand({
            id: 'set-link-high',
            name: 'Colorize: highlight 🟡',
            callback: () => this.executeRainbow('high')
        });
    }

    async executeRainbow(colorTag: string) {
        let mode = "none";
        // 修复 [4]: 去掉了 any，指定了具体类型
        let targetObj: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = null;
        let selectionText = "";

        // ---------------------------------------------------------
        // 1. 侦探阶段
        // ---------------------------------------------------------

        // 修复 [5]: activeLeaf 已弃用，改用 getActiveViewOfType
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        
        if (editor && editor.getSelection()) {
            mode = "editor";
            selectionText = editor.getSelection();
        }

        // B. 看板输入框模式
        if (mode === "none") {
            const activeEl = document.activeElement;
            // 修复 [6]: 移除了不必要的断言，直接检查 instance
            if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
                if (activeEl.value) {
                    const start = activeEl.selectionStart;
                    const end = activeEl.selectionEnd;
                    if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                        mode = "input";
                        targetObj = activeEl;
                        selectionText = activeEl.value.substring(start, end);
                    }
                }
            }
        }

        // C. 悬停模式
        if (mode === "none") {
            const hoverEl = document.querySelector('a.internal-link:hover');
            if (hoverEl instanceof HTMLElement) {
                mode = "hover";
                targetObj = hoverEl;
                const href = hoverEl.getAttribute('data-href');
                const text = hoverEl.innerText;
                if (href) {
                    selectionText = `[[${href}|${text}]]`;
                }
            }
        }

        if (mode === "none") {
            new Notice("⚠️ No selection found!\nPlease select text OR hover over a link.");
            return;
        }

        // ---------------------------------------------------------
        // 2. 加工阶段
        // ---------------------------------------------------------
        
        let linkTarget = selectionText;
        let alias = selectionText;

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

        linkTarget = linkTarget.replace(/#(red|green|blue|high)/g, "");
        const newLink = `[[${linkTarget}#${colorTag}|${alias}]]`;

        // ---------------------------------------------------------
        // 3. 执行阶段
        // ---------------------------------------------------------

        if (mode === "editor" && editor) {
            editor.replaceSelection(newLink);

        } else if (mode === "input" && targetObj) {
            // 修复 [7]: execCommand 已弃用，改用原生值替换
            // 这是一个针对 Kanban 输入框的兼容性写法
            const inputEl = targetObj as HTMLInputElement; 
            inputEl.focus();
            
            const start = inputEl.selectionStart || 0;
            const end = inputEl.selectionEnd || 0;
            const originalText = inputEl.value;

            // 手动拼接新字符串
            inputEl.value = originalText.substring(0, start) + newLink + originalText.substring(end);

            // 恢复光标位置
            inputEl.selectionStart = start + newLink.length;
            inputEl.selectionEnd = start + newLink.length;

            // 关键：手动触发 Input 事件，通知 Obsidian 保存更改
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));

        } else if (mode === "hover") {
            const file = this.app.workspace.getActiveFile();
            if (!file) { new Notice("Cannot find active file."); return; }

            await this.app.vault.process(file, (data) => {
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const escapedTarget = escapeRegExp(linkTarget);
                const regex = new RegExp(`\\[\\[${escapedTarget}(#[a-zA-Z0-9]+)?(\\|.*?)?\\]\\]`, 'g');
                
                new Notice(`Link colored: ${colorTag}`);
                return data.replace(regex, newLink);
            });
        }
    }
}