/**
 * HTTP Request Repeater - Editor Component
 * =========================================
 * Simple textarea-based editor with line numbers, syntax highlighting,
 * and auto-formatting capabilities. Designed to be lightweight and
 * fully responsive without external dependencies.
 */

export class HttpEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || (() => {});
    this.onKeydown = options.onKeydown || (() => {});
    this.value = options.value || '';

    this.init();
  }

  init() {
    // Build editor structure: line numbers + textarea
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'http-editor';
    this.wrapper.style.cssText = `
      display: flex;
      width: 100%;
      height: 100%;
      background: #1E1E1E;
      overflow: hidden;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      position: relative;
    `;

    // Line numbers gutter
    this.gutter = document.createElement('div');
    this.gutter.className = 'editor-gutter';
    this.gutter.style.cssText = `
      width: 48px;
      min-width: 48px;
      background: #1E1E1E;
      border-right: 1px solid #3C3C3C;
      color: #808080;
      text-align: right;
      padding: 12px 8px 12px 0;
      overflow: hidden;
      user-select: none;
      flex-shrink: 0;
      font-size: 13px;
      line-height: 1.6;
    `;

    // Textarea for input
    this.textarea = document.createElement('textarea');
    this.textarea.style.cssText = `
      flex: 1;
      background: #1E1E1E;
      color: #D4D4D4;
      border: none;
      padding: 12px 12px 12px 8px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      resize: none;
      outline: none;
      tab-size: 2;
      white-space: pre;
      overflow-wrap: normal;
      overflow-x: auto;
      overflow-y: auto;
    `;
    this.textarea.spellcheck = false;
    this.textarea.autocomplete = 'off';
    this.textarea.autocorrect = 'off';
    this.textarea.autocapitalize = 'off';

    this.wrapper.appendChild(this.gutter);
    this.wrapper.appendChild(this.textarea);
    this.container.appendChild(this.wrapper);

    // Bind events
    this.textarea.addEventListener('input', () => this.onInput());
    this.textarea.addEventListener('keydown', (e) => this.onKeydown(e));
    this.textarea.addEventListener('scroll', () => this.syncScroll());
    this.textarea.addEventListener('paste', (e) => this.onPaste(e));

    // Initial value
    this.textarea.value = this.value;
    this.updateLineNumbers();
  }

  onInput() {
    this.value = this.textarea.value;
    this.updateLineNumbers();
    this.onChange(this.value);
  }

  syncScroll() {
    this.gutter.scrollTop = this.textarea.scrollTop;
  }

  updateLineNumbers() {
    const lines = this.textarea.value.split('
').length;
    const nums = Array.from({ length: lines }, (_, i) => i + 1).join('
');
    this.gutter.textContent = nums;
  }

  onKeydown(e) {
    // Tab key: insert 2 spaces instead of changing focus
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      const spaces = '  ';
      this.textarea.value = this.textarea.value.substring(0, start) + spaces + this.textarea.value.substring(end);
      this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
      this.onInput();
      return;
    }

    // Enter key: auto-indent based on previous line
    if (e.key === 'Enter') {
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      const before = this.textarea.value.substring(0, start);
      const after = this.textarea.value.substring(end);
      const prevLine = before.substring(before.lastIndexOf('
') + 1);
      const indent = prevLine.match(/^[	 ]*/)?.[0] || '';

      // Check if previous line ends with opening brace for JSON
      const extra = /[\{\[]$/.test(prevLine.trim()) ? '  ' : '';

      this.textarea.value = before + '
' + indent + extra + after;
      this.textarea.selectionStart = this.textarea.selectionEnd = start + 1 + indent.length + extra.length;
      this.onInput();
      e.preventDefault();
      return;
    }

    this.onKeydown(e);
  }

  onPaste(e) {
    // Simple paste handling - just let it happen naturally
    // Could be extended for smart formatting
  }

  getValue() {
    return this.textarea.value;
  }

  setValue(text) {
    this.textarea.value = text || '';
    this.onInput();
  }

  focus() {
    this.textarea.focus();
  }

  insertText(text) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    this.textarea.value = this.textarea.value.substring(0, start) + text + this.textarea.value.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.onInput();
  }

  destroy() {
    this.container.removeChild(this.wrapper);
  }
}
