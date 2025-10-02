import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('status-bar')
export class StatusBar extends LitElement {
  @property({ type: Number })
  executionTimeMS: number = 0;

  @property({ type: Number })
  resultCount: number = 0;

  @state()
  private slots: Array<{ id: string; content: string; visible: boolean }> = [
    { id: 'slot1', content: '', visible: false },
    { id: 'slot2', content: '', visible: false },
    { id: 'slot3', content: '', visible: false },
    { id: 'slot4', content: '', visible: false },
    { id: 'slot5', content: '', visible: false },
    { id: 'slot6', content: '', visible: false },
    { id: 'slot7', content: '', visible: false },
    { id: 'slot8', content: '', visible: false },
    { id: 'result-count', content: '', visible: true }, // Result count slot
    { id: 'execution-time', content: '', visible: true }, // Rightmost slot for execution time
  ];

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
    const slotIndex = this.slots.findIndex(slot => slot.id === slotId);
    if (slotIndex !== -1) {
      this.slots[slotIndex] = { ...this.slots[slotIndex], content, visible };
      this.requestUpdate();
    }
  }

  /**
   * Clear a specific slot
   */
  clearSlot(slotId: string) {
    this.updateSlot(slotId, '', false);
  }

  /**
   * Clear all slots except execution time
   */
  clearAllSlots() {
    this.slots = this.slots.map(slot => ({
      ...slot,
      content: slot.id === 'execution-time' ? slot.content : '',
      visible: slot.id === 'execution-time' ? slot.visible : false
    }));
    this.requestUpdate();
  }

  /**
   * Handle execution time and result count updates
   */
  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('executionTimeMS')) {
      const formattedTime = this.formatExecutionTime(this.executionTimeMS);
      this.updateSlot('execution-time', formattedTime ? `⏱️ ${formattedTime}` : '', formattedTime !== '');
    }
    
    if (changedProperties.has('resultCount')) {
      const formattedCount = this.formatResultCount(this.resultCount);
      this.updateSlot('result-count', formattedCount ? `� ${formattedCount} results` : '', formattedCount !== '');
    }
  }

  render() {
    return html`
      <div class="status-bar bg-gray-800 text-gray-200 text-xs border-t border-gray-600 h-6 flex items-center justify-between px-2">
        <!-- Left side slots -->
        <div class="flex items-center space-x-4">
          ${this.slots.slice(0, 9).map(slot => 
            slot.visible ? html`
              <div class="status-slot flex items-center">
                <span>${slot.content}</span>
              </div>
            ` : html``
          )}
        </div>
        
        <!-- Right side - Result count and Execution time slots -->
        <div class="flex items-center space-x-4">
          ${this.slots.find(slot => slot.id === 'result-count')?.visible ? html`
            <div class="status-slot flex items-center text-blue-400 font-mono">
              <span>${this.slots.find(slot => slot.id === 'result-count')?.content}</span>
            </div>
          ` : html``}
          ${this.slots.find(slot => slot.id === 'execution-time')?.visible ? html`
            <div class="status-slot flex items-center text-green-400 font-mono">
              <span>${this.slots.find(slot => slot.id === 'execution-time')?.content}</span>
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