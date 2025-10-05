import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DragDropManager } from './droppable.js';

@customElement('draggable-component')
export class DraggableComponent extends LitElement {
    @property({ type: Function })
    onDragStart?: (draggable: Element) => void;

    @property({ type: Function })
    onDragEnd?: (draggable: Element, wasDropped: boolean) => void;

    @property({ type: Function })
    getDropDataHandler?: (draggable: Element) => string;

    @property({ type: String })
    dragData?: string;

    @state()
    private isDragging = false;

    @state()
    private dragGhost: HTMLElement | null = null;

    @state()
    private dragOffset = { x: 0, y: 0 };

    private dragContainer: HTMLElement | null = null;
    private originalChildren: HTMLElement[] = [];
    private dragDropManager = DragDropManager.getInstance();

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        this.cleanupDragGhost();
    }

    private handleMouseDown = (event: MouseEvent) => {
        // Only start dragging on left mouse button
        if (event.button !== 0) return;

        // Prevent text selection and other default behaviors
        event.preventDefault();
        
        this.isDragging = true;
        
        // Calculate offset from mouse to element's top-left corner
        const rect = this.getBoundingClientRect();
        this.dragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        // Create the drag ghost
        this.createDragGhost(event.clientX, event.clientY);
        
        // Add dragging class for potential styling
        this.classList.add('dragging');
        
        // Notify the drag drop manager
        this.dragDropManager.startDrag(this);
        
        // Call optional drag start handler
        if (this.onDragStart) {
            this.onDragStart(this);
        }
        
        console.log('🖱️ Drag started at:', { x: event.clientX, y: event.clientY });
    };

    private handleMouseMove = (event: MouseEvent) => {
        if (!this.isDragging || !this.dragGhost) return;

        // Update ghost position to follow mouse
        const x = event.clientX - this.dragOffset.x;
        const y = event.clientY - this.dragOffset.y;
        
        this.dragGhost.style.left = `${x}px`;
        this.dragGhost.style.top = `${y}px`;
        
        // Update drag drop manager with current position
        this.dragDropManager.updateDragPosition(event.clientX, event.clientY);
    };

    private handleMouseUp = (event: MouseEvent) => {
        if (!this.isDragging) return;

        console.log('🖱️ Drag ended at:', { x: event.clientX, y: event.clientY });
        
        // End drag in manager and check if it was dropped
        const wasDropped = this.dragDropManager.endDrag(event.clientX, event.clientY);
        
        this.isDragging = false;
        this.classList.remove('dragging');
        this.cleanupDragGhost();
        
        // Call optional drag end handler
        if (this.onDragEnd) {
            this.onDragEnd(this, wasDropped);
        }
    };

    private createDragGhost(mouseX: number, mouseY: number) {
        // Create a container for the ghost
        this.dragContainer = document.createElement('div');
        this.dragContainer.className = 'drag-ghost-container';
        this.dragContainer.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.3;
            left: ${mouseX - this.dragOffset.x}px;
            top: ${mouseY - this.dragOffset.y}px;
        `;

        // Clone all children of this draggable component
        const children = Array.from(this.children) as HTMLElement[];
        children.forEach(child => {
            const clone = child.cloneNode(true) as HTMLElement;
            
            // Ensure the clone maintains its styling
            const computedStyle = window.getComputedStyle(child);
            clone.style.cssText = computedStyle.cssText;
            
            // Copy over any important classes
            clone.className = child.className;
            
            this.dragContainer!.appendChild(clone);
        });

        // Add to document body
        document.body.appendChild(this.dragContainer);
        this.dragGhost = this.dragContainer;

        console.log('👻 Drag ghost created with', children.length, 'children');
    }

    private cleanupDragGhost() {
        if (this.dragGhost && this.dragGhost.parentNode) {
            this.dragGhost.parentNode.removeChild(this.dragGhost);
        }
        this.dragGhost = null;
        this.dragContainer = null;
        console.log('👻 Drag ghost cleaned up');
    }

    /**
     * Get the data to be transferred when this draggable is dropped
     */
    getDropData(): string {
        console.log("DEBUG DEBUG DEBUG :: Dropping the data!")
        
        if (this.getDropDataHandler) {
            return this.getDropDataHandler(this);
        }
        
        // Default behavior: return text content of the draggable
        return this.dragData?.trim() || '';
    }

    render() {
        return html`
            <div class="draggable-content cursor-move select-none ${this.isDragging ? 'opacity-50' : ''}">
                <slot></slot>
            </div>
        `;
    }
}
