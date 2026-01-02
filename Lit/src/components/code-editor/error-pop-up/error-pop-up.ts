import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Error Pop-Up Component
 * Displays error details when hovering over invalid tokens or statements
 * Follows VSCode error popover patterns with proper sizing and positioning
 */
@customElement('error-pop-up')
export class ErrorPopUp extends LitElement {
  
  @property({ type: Boolean })
  visible: boolean = false;
  
  @property({ type: Number })
  x: number = 0;
  
  @property({ type: Number })
  y: number = 0;
  
  @property({ type: String })
  errorMessage: string = '';
  
  @state()
  private isHoveringPopover: boolean = false;

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.visible) {
      this.visible = false;
      this.requestUpdate();
      // Notify parent that popover was dismissed
      this.dispatchEvent(new CustomEvent('popover-dismissed', { bubbles: true }));
    }
  }

  /**
   * Show the popover at specified coordinates
   * @param x - X coordinate for popover positioning
   * @param y - Y coordinate for popover positioning
   * @param message - Error message to display
   */
  show(x: number, y: number, message: string = ''): void {
    this.x = x;
    this.y = y;
    this.errorMessage = message;
    this.visible = true;
    this.requestUpdate();
  }

  /**
   * Hide the popover
   */
  hide(): void {
    // Only hide if not hovering over the popover itself
    if (!this.isHoveringPopover) {
      this.visible = false;
      this.requestUpdate();
    }
  }

  /**
   * Handle mouse enter on popover to keep it visible
   */
  private handlePopoverMouseEnter(): void {
    
    this.isHoveringPopover = true;
    // Dispatch event to notify parent that we're hovering over popover
    const event = new CustomEvent('popover-mouse-enter', { bubbles: true });
   
    this.dispatchEvent(event);
  }

  /**
   * Handle mouse leave on popover to allow hiding
   */
  private handlePopoverMouseLeave(event: MouseEvent): void {
    const relatedTarget = event.relatedTarget as HTMLElement;
    
    this.isHoveringPopover = false;
    
    // Don't hide immediately - let the parent handle the hide delay
    // Just dispatch the event to notify parent
    const event2 = new CustomEvent('popover-mouse-leave', { bubbles: true });
    this.dispatchEvent(event2);
  }

  /**
   * Calculate popover dimensions based on viewport and position relative to token
   */
  private getPopoverStyle(): string {
    if (!this.visible) {
      //return 'display: none;';
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate width (25% min, 70% max of viewport)
    const minWidth = Math.max(250, viewportWidth * 0.25);
    const maxWidth = viewportWidth * 0.70;
    const width = Math.min(maxWidth, Math.max(minWidth, 400)); // Default to 400px if in range
    
    // Calculate height (15% of viewport for both min and max as specified)
    const height = viewportHeight * 0.15;
    
    // Position popover with bottom-left corner at top-left corner of token
    // The x,y coordinates passed represent the token's top-left corner
    let left = this.x;
    let top = this.y - height; // Bottom edge of popover at top edge of token
    
    // Adjust if popover would go off-screen horizontally
    if (left + width > viewportWidth) {
      left = viewportWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    // Adjust if popover would go off-screen vertically (show below token instead)
    if (top < 10) {
      top = this.y + 25; // Position below token with small gap
    }
    
    return `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
      background: #424242;
      border: 1px solid #616161;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.2s ease-in-out;
    `;
  }

  render() {
    return html`
      <div 
        class="error-popover"
        style="${this.getPopoverStyle()}; visibility: ${this.visible ? 'visible' : 'hidden'}; pointer-events: ${this.visible ? 'auto' : 'none'};"
        @mouseenter="${this.handlePopoverMouseEnter}"
        @mouseleave="${this.handlePopoverMouseLeave}"
      >
        <div style="
          padding: 12px 16px;
          height: 100%;
          overflow-y: auto;
          background: inherit;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 13px;
          color: white;
          line-height: 1.4;
        "
        >
          ${this.errorMessage ? html`
            <div style="font-weight: 500;">
              ${this.errorMessage.split('\n').map(line => html`<div style="margin-bottom: 4px;">${line}</div>`)}
            </div>
          ` : html`
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
              color: #bdbdbd;
              font-style: italic;
            ">
              Error details will appear here
            </div>
          `}
        </div>
      </div>
    `;
  }
}