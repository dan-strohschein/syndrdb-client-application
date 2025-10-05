import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

// Global drag state management
class DragDropManager {
    private static instance: DragDropManager;
    private isDragging = false;
    private currentDraggable: Element | null = null;
    private activeDropzones: Set<DroppableComponent> = new Set();
    private hoveredDropzone: DroppableComponent | null = null;

    static getInstance(): DragDropManager {
        if (!DragDropManager.instance) {
            DragDropManager.instance = new DragDropManager();
        }
        return DragDropManager.instance;
    }

    registerDropzone(dropzone: DroppableComponent) {
        this.activeDropzones.add(dropzone);
    }

    unregisterDropzone(dropzone: DroppableComponent) {
        this.activeDropzones.delete(dropzone);
        if (this.hoveredDropzone === dropzone) {
            this.hoveredDropzone = null;
        }
    }

    startDrag(draggable: Element) {
        this.isDragging = true;
        this.currentDraggable = draggable;
        console.log('🎯 DragDropManager: Drag started', { draggable, activeDropzones: this.activeDropzones.size });
    }

    updateDragPosition(clientX: number, clientY: number) {
        if (!this.isDragging) return;

        // Find the dropzone under the mouse cursor
        const elementUnderMouse = document.elementFromPoint(clientX, clientY);
        const dropzoneUnderMouse = this.findDropzoneAncestor(elementUnderMouse);

        // Update hover states
        if (dropzoneUnderMouse !== this.hoveredDropzone) {
            // Remove hover from previous dropzone
            if (this.hoveredDropzone) {
                this.hoveredDropzone.setHoverState(false);
            }

            // Add hover to new dropzone
            if (dropzoneUnderMouse) {
                dropzoneUnderMouse.setHoverState(true);
            }

            this.hoveredDropzone = dropzoneUnderMouse;
        }
    }

    endDrag(clientX: number, clientY: number): boolean {
        if (!this.isDragging) return false;

        const wasDropped = this.hoveredDropzone !== null;
        
        // Handle drop if over a dropzone
        if (this.hoveredDropzone && this.currentDraggable) {
            console.log('🎯 DragDropManager: Handling drop', { 
                dropzone: this.hoveredDropzone, 
                draggable: this.currentDraggable 
            });
            this.hoveredDropzone.handleDrop(this.currentDraggable, clientX, clientY);
        }

        // Clean up
        if (this.hoveredDropzone) {
            this.hoveredDropzone.setHoverState(false);
        }

        this.isDragging = false;
        this.currentDraggable = null;
        this.hoveredDropzone = null;

        return wasDropped;
    }

    private findDropzoneAncestor(element: Element | null): DroppableComponent | null {
        while (element) {
            if (element instanceof DroppableComponent) {
                return element;
            }
            element = element.parentElement;
        }
        return null;
    }

    getDragStatus() {
        return {
            isDragging: this.isDragging,
            currentDraggable: this.currentDraggable,
            hoveredDropzone: this.hoveredDropzone
        };
    }
}

@customElement('droppable-component')
export class DroppableComponent extends LitElement {
    @property({ type: Function })
    onDrop?: (draggable: Element, dropX: number, dropY: number) => string | Promise<string>;

    @property({ type: String })
    dropEffect: string = 'copy'; // 'copy', 'move', 'link', 'none'

    @property({ type: Boolean })
    acceptAll: boolean = true;

    @property({ type: Array })
    acceptTypes: string[] = []; // CSS selectors or tag names to accept

    @state()
    private isHovered = false;

    private dragDropManager = DragDropManager.getInstance();

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.dragDropManager.registerDropzone(this);
        console.log('🎯 Droppable registered:', this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.dragDropManager.unregisterDropzone(this);
        console.log('🎯 Droppable unregistered:', this);
    }

    setHoverState(hovered: boolean) {
        if (this.isHovered !== hovered) {
            this.isHovered = hovered;
            console.log('🎯 Dropzone hover state changed:', { hovered, element: this });
            this.requestUpdate();
        }
    }

    async handleDrop(draggable: Element, dropX: number, dropY: number) {
        console.log('🎯 Handling drop in droppable:', { draggable, dropX, dropY });

        // Check if we accept this draggable
        if (!this.acceptsDraggable(draggable)) {
            console.log('🎯 Draggable not accepted by this dropzone');
            return;
        }

        // Get the drop data from the draggable
        let dropData = '';
        if (draggable instanceof Element && 'getDropData' in draggable && typeof draggable.getDropData === 'function') {
            dropData = (draggable as any).getDropData();
        } else {
            // Fallback to text content
            dropData = draggable.textContent?.trim() || '';
        }

        // Execute the drop handler if provided
        if (this.onDrop) {
            try {
                const result = await this.onDrop(draggable, dropX, dropY);
                console.log('🎯 Drop handler result:', result);
                
                // Dispatch drop event with the result
                this.dispatchEvent(new CustomEvent('drop-completed', {
                    detail: {
                        draggable,
                        dropX,
                        dropY,
                        result,
                        dropData,
                        dropzone: this
                    },
                    bubbles: true,
                    composed: true
                }));
            } catch (error) {
                console.error('🎯 Error in drop handler:', error);
                
                // Dispatch error event
                this.dispatchEvent(new CustomEvent('drop-error', {
                    detail: {
                        draggable,
                        dropX,
                        dropY,
                        error,
                        dropData,
                        dropzone: this
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        } else {
            // Default behavior - just dispatch the drop event with data
            this.dispatchEvent(new CustomEvent('drop-completed', {
                detail: {
                    draggable,
                    dropX,
                    dropY,
                    result: dropData, // Use drop data as the result
                    dropData,
                    dropzone: this
                },
                bubbles: true,
                composed: true
            }));
        }
    }

    private acceptsDraggable(draggable: Element): boolean {
        if (this.acceptAll) {
            return true;
        }

        // Check against acceptTypes
        for (const type of this.acceptTypes) {
            if (draggable.matches(type) || draggable.tagName.toLowerCase() === type.toLowerCase()) {
                return true;
            }
        }

        return false;
    }

    render() {
        const hoverClass = this.isHovered ? 'border-green-400 border-2 border-dashed bg-green-50' : '';
        
        return html`
            <div class="droppable-container transition-all duration-200 ${hoverClass}">
                <slot></slot>
            </div>
        `;
    }
}

// Enhance the existing DraggableComponent to work with the manager
declare global {
    interface Window {
        dragDropManager: DragDropManager;
    }
}

// Make the manager globally accessible
window.dragDropManager = DragDropManager.getInstance();

// Export the manager for use in enhanced draggable component
export { DragDropManager };