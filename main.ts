import { Plugin, MarkdownView, Notice } from 'obsidian';

export default class RainbowLinkPlugin extends Plugin {

    onload() {
        // 1. 注册命令
        // 改动：Colorize: red -> Colorize link red (更符合句子习惯)
        this.addCommand({
            id: 'set-link-red',
            name: 'Colorize link red 🔴',
            callback: () => this.executeRainbow('red')
        });

        this.addCommand({
            id: 'set-link-green',
            name: 'Colorize link green 🟢',
            callback: () => this.executeRainbow('green')
        });

        this.addCommand({
            id: 'set-link-blue',
            name: 'Colorize link blue 🔵',
            callback: () => this.executeRainbow('blue')
        });

        this.addCommand({
            id: 'set-link-high',
            name: 'Colorize link highlight 🟡',
            callback: () => this.executeRainbow('high')
        });
    }

    async executeRainbow(colorTag: string) {
        let mode = "none";
        let targetObj: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = null;
        let selectionText = "";

        // 1. 侦探阶段
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        
        if (editor && editor.getSelection()) {
            mode = "editor";
            selectionText = editor.getSelection();
        }

        if (mode === "none") {
            const activeEl = document.activeElement;
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
            // 🔴 关键修复在这里：把 OR 改成了 or
            new Notice("⚠️ No selection found!\nPlease select text or hover over a link.");
            return;
        }

        // 2. 加工阶段
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

        // 3. 执行阶段
        if (mode === "editor" && editor) {
            editor.replaceSelection(newLink);

        } else if (mode === "input" && targetObj) {
            const inputEl = targetObj as HTMLInputElement; 
            inputEl.focus();
            
            const start = inputEl.selectionStart || 0;
            const end = inputEl.selectionEnd || 0;
            const originalText = inputEl.value;

            inputEl.value = originalText.substring(0, start) + newLink + originalText.substring(end);
            inputEl.selectionStart = start + newLink.length;
            inputEl.selectionEnd = start + newLink.length;
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