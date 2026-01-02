import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Line Numbers Component
 * Displays line numbers for the code editor with synchronized scrolling
 * Features yellow text on dark gray background matching VS Code style
 */
@customElement('line-numbers')
export class LineNumbers extends LitElement {
  
  @property({ type: Number })
  totalLines: number = 1;
  
  @property({ type: Number })
  lineHeight: number = 20;
  
  @property({ type: Number })
  scrollTop: number = 0;
  
  @property({ type: Number })
  visibleHeight: number = 400;
  
  @property({ type: Number })
  fontSize: number = 14;

  // Disable Shadow DOM to allow global Tailwind CSS and coordinate with parent
  createRenderRoot() {
    return this;
  }

  /**
   * Calculate which line numbers are currently visible
   */
  private getVisibleLines(): { start: number; end: number; lines: number[] } {
    const startLine = Math.floor(this.scrollTop / this.lineHeight);
    const visibleLineCount = Math.ceil(this.visibleHeight / this.lineHeight) + 2; // +2 for buffer
    const endLine = Math.min(startLine + visibleLineCount, this.totalLines);
    
    const lines = [];
    for (let i = Math.max(0, startLine); i < endLine; i++) {
      lines.push(i + 1); // Line numbers are 1-based
    }
    
    return { start: startLine, end: endLine, lines };
  }

  /**
   * Calculate the top offset for a specific line number
   */
  private getLineTopOffset(lineIndex: number): number {
    return (lineIndex * this.lineHeight) - this.scrollTop;
  }

  /**
   * Get the width needed for line numbers based on total lines
   */
  private getRequiredWidth(): number {
    const maxDigits = this.totalLines.toString().length;
    return Math.max(60, 20 + (maxDigits * 8)); // Base width + digit width
  }

  render() {
    const visibleLines = this.getVisibleLines();
    const width = this.getRequiredWidth();
    
    return html`
      <div 
        class="line-numbers-container"
        style="
          width: ${width}px;
          height: ${this.visibleHeight}px;
          background-color: #1a1a1a;
          border-right: 1px solid #333;
          position: relative;
          overflow: hidden;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: ${this.fontSize}px;
          line-height: ${this.lineHeight}px;
          user-select: none;
          flex-shrink: 0;
        "
      >
        ${visibleLines.lines.map(lineNum => {
          const topOffset = this.getLineTopOffset(lineNum - 1);
          return html`
            <div 
              class="line-number"
              style="
                position: absolute;
                top: ${topOffset}px;
                right: 8px;
                height: ${this.lineHeight}px;
                color: #ffc107;
                text-align: right;
                padding-right: 8px;
                width: ${width - 16}px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                font-weight: 400;
              "
            >
              ${lineNum}
            </div>
          `;
        })}
      </div>
    `;
  }
}