import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('status-bar')
export class StatusBar extends LitElement {
  @property({ type: Number })
  executionTimeMS: number = 0;

  @property({ type: Number })
  resultCount: number = 0;

  @property({ type: String })
  slot1Content: string = '';
  @property({ type: Boolean })
  slot1Visible: boolean = false;

  @property({ type: String })
  slot2Content: string = '';
  @property({ type: Boolean })
  slot2Visible: boolean = false;

  @property({ type: String })
  slot3Content: string = '';
  @property({ type: Boolean })
  slot3Visible: boolean = false;

  @property({ type: String })
  slot4Content: string = '';
  @property({ type: Boolean })
  slot4Visible: boolean = false;

  @property({ type: String })
  slot5Content: string = '';
  @property({ type: Boolean })
  slot5Visible: boolean = false;

  @property({ type: String })
  slot6Content: string = '';
  @property({ type: Boolean })
  slot6Visible: boolean = false;

  @property({ type: String })
  slot7Content: string = '';
  @property({ type: Boolean })
  slot7Visible: boolean = false;

  @property({ type: String })
  slot8Content: string = '';
  @property({ type: Boolean })
  slot8Visible: boolean = false;

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  /**
   * Format execution time from milliseconds to M:S:MS:ms format
   * Takes the 'executionTime' field from server response (in milliseconds)
   */
  private formatExecutionTime(timeInMS: number): string {
    if (timeInMS === 0) {
      return '';
    }

    // Convert milliseconds to different units
    const totalMicroseconds = timeInMS * 1000; // Convert to microseconds
    
    // Calculate each unit
    const minutes = Math.floor(timeInMS / 60000);
    const seconds = Math.floor((timeInMS % 60000) / 1000);
    const milliseconds = Math.floor(timeInMS % 1000);
    const microseconds = Math.floor((timeInMS % 1) * 1000);

    // Format as M:S:MS:ms with leading zeros where appropriate
    return `${minutes}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}:${microseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Format result count for display
   */
  private formatResultCount(count: number): string {
    if (count === 0) {
      return '';
    }
    
    // Format with commas for thousands
    return count.toLocaleString();
  }

  /**
   * Update a specific slot with content
   */
  updateSlot(slotId: string, content: string, visible: boolean = true) {
    switch(slotId) {
      case 'slot1': this.slot1Content = content; this.slot1Visible = visible; break;
      case 'slot2': this.slot2Content = content; this.slot2Visible = visible; break;
      case 'slot3': this.slot3Content = content; this.slot3Visible = visible; break;
      case 'slot4': this.slot4Content = content; this.slot4Visible = visible; break;
      case 'slot5': this.slot5Content = content; this.slot5Visible = visible; break;
      case 'slot6': this.slot6Content = content; this.slot6Visible = visible; break;
      case 'slot7': this.slot7Content = content; this.slot7Visible = visible; break;
      case 'slot8': this.slot8Content = content; this.slot8Visible = visible; break;
    }
  }

  /**
   * Clear a specific slot
   */
  clearSlot(slotId: string) {
    this.updateSlot(slotId, '', false);
  }

  /**
   * Clear all slots
   */
  clearAllSlots() {
    this.slot1Content = ''; this.slot1Visible = false;
    this.slot2Content = ''; this.slot2Visible = false;
    this.slot3Content = ''; this.slot3Visible = false;
    this.slot4Content = ''; this.slot4Visible = false;
    this.slot5Content = ''; this.slot5Visible = false;
    this.slot6Content = ''; this.slot6Visible = false;
    this.slot7Content = ''; this.slot7Visible = false;
    this.slot8Content = ''; this.slot8Visible = false;
  }


  render() {
    const formattedTime = this.formatExecutionTime(this.executionTimeMS);
    const formattedCount = this.formatResultCount(this.resultCount);

    return html`
      <div class="status-bar bg-gray-800 text-gray-200 text-xs border-t border-gray-600 h-6 flex items-center justify-between px-2">
        <!-- Left side slots -->
        <div class="flex items-center space-x-4">
          ${this.slot1Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot1Content}</span>
            </div>
          ` : html``}
          ${this.slot2Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot2Content}</span>
            </div>
          ` : html``}
          ${this.slot3Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot3Content}</span>
            </div>
          ` : html``}
          ${this.slot4Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot4Content}</span>
            </div>
          ` : html``}
          ${this.slot5Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot5Content}</span>
            </div>
          ` : html``}
          ${this.slot6Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot6Content}</span>
            </div>
          ` : html``}
          ${this.slot7Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot7Content}</span>
            </div>
          ` : html``}
          ${this.slot8Visible ? html`
            <div class="status-slot flex items-center">
              <span>${this.slot8Content}</span>
            </div>
          ` : html``}
        </div>
        
        <!-- Right side - Result count and Execution time -->
        <div class="flex items-center space-x-4">
          ${this.resultCount > 0 ? html`
            <div class="status-slot flex items-center text-blue-400 font-mono">
              <span>📊 ${formattedCount} results</span>
            </div>
          ` : html``}
          ${this.executionTimeMS > 0 ? html`
            <div class="status-slot flex items-center text-green-400 font-mono">
              <span>⏱️ ${formattedTime}</span>
            </div>
          ` : html``}
        </div>
      </div>
    `;
  }

  static styles = css`
    .status-bar {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
    }
    
    .status-slot {
      min-width: 0;
      flex-shrink: 0;
    }
    
    .status-slot span {
      display: inline-block;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* Hover effect for slots */
    .status-slot:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      padding: 1px 4px;
      margin: -1px -4px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'status-bar': StatusBar;
  }
}