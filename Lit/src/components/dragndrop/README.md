# Draggable Component

A foundational draggable component system for the SyndrDB Client Application.

## Overview

The `draggable-component` creates a 70% transparent copy of its children at the exact mouse position when the user clicks and holds. This provides visual feedback during drag operations while keeping the original element in place.

## Features

### 🖱️ **Click and Hold Dragging**
- Starts dragging on left mouse button down
- Creates transparent ghost copy at exact mouse position
- Follows mouse movement until button release

### 👻 **Visual Ghost Copy**
- Creates a 70% transparent copy (`opacity: 0.3`) of all children
- Positioned at `position: fixed` with `z-index: 9999`
- Maintains original styling and structure of children
- Automatically cleaned up when drag ends

### 🎨 **Original Element Feedback**
- Original element becomes 50% transparent during drag
- Adds `dragging` CSS class for custom styling
- `cursor: move` and `select-none` for better UX

### 🧩 **Universal Compatibility**
- Works with any child elements (text, buttons, complex components)
- Preserves computed styles in ghost copy
- No restrictions on child content or structure

## Usage

### Basic Example
```html
<draggable-component>
  <div class="card">
    <h3>Draggable Card</h3>
    <p>Click and hold to drag!</p>
  </div>
</draggable-component>
```

### Complex Components
```html
<draggable-component>
  <div class="complex-widget">
    <img src="icon.png" alt="Icon">
    <span>Multi-element content</span>
    <button>Even buttons!</button>
  </div>
</draggable-component>
```

### Multiple Children
```html
<draggable-component>
  <h2>Title</h2>
  <p>Description</p>
  <div class="actions">
    <button>Action 1</button>
    <button>Action 2</button>
  </div>
</draggable-component>
```

## Component Names

Two component names are available:
- `<draggable-component>` - New, descriptive name
- `<draggable>` - Backwards compatibility alias

## Events & Lifecycle

### Mouse Events
- **`mousedown`**: Initiates drag, creates ghost, calculates offset
- **`mousemove`**: Updates ghost position (during drag only)
- **`mouseup`**: Ends drag, cleans up ghost, removes classes

### CSS Classes
- **`.dragging`**: Added to original element during drag
- **`.draggable-content`**: Container class with `cursor-move` and `select-none`

## Implementation Details

### Ghost Creation
1. Creates a fixed-position container div
2. Clones all children using `cloneNode(true)`
3. Copies computed styles to maintain appearance
4. Positions at mouse coordinates minus drag offset
5. Sets 70% transparency (`opacity: 0.3`)

### Mouse Offset Calculation
```typescript
const rect = this.getBoundingClientRect();
this.dragOffset = {
  x: event.clientX - rect.left,
  y: event.clientY - rect.top
};
```

### Position Updates
```typescript
const x = event.clientX - this.dragOffset.x;
const y = event.clientY - this.dragOffset.y;
dragGhost.style.left = `${x}px`;
dragGhost.style.top = `${y}px`;
```

## Demo Component

A comprehensive demo is available at `<draggable-demo>` which shows:
- Simple text cards
- Complex multi-element components  
- Buttons and interactive elements
- List items
- Usage instructions

## CSS Styling

### Default Styles
```css
.draggable-content {
  cursor: move;
  user-select: none;
}

.dragging {
  opacity: 0.5;
}

.drag-ghost-container {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.3;
}
```

### Custom Styling
You can add custom styles for the dragging state:
```css
draggable-component.dragging {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}
```

## Browser Compatibility

- ✅ Modern browsers with ES2022 support
- ✅ Mouse-based dragging
- ✅ Fixed positioning support
- ✅ Clone node support

## Technical Notes

### Memory Management
- Ghost elements are automatically cleaned up
- Event listeners properly removed on disconnect
- No memory leaks in drag operations

### Performance
- Minimal DOM manipulation during drag
- Efficient position updates using transform
- No unnecessary re-renders during movement

### Accessibility
- Maintains semantic structure in ghost copy
- Preserves ARIA attributes and roles
- Keyboard navigation not affected

## Future Enhancements

Potential areas for extension:
- **Drop Zones**: Add drop target validation
- **Touch Support**: Extend for mobile/tablet
- **Drag Constraints**: Limit movement to specific areas
- **Visual Feedback**: Enhanced animations and transitions
- **Data Transfer**: Implement drag-and-drop data exchange
- **Multi-Select**: Support dragging multiple items

## Integration with SyndrDB Client

This component provides the foundation for:
- 📁 File/folder dragging in connection tree
- 📋 Query tab reordering
- 🎛️ Component layout customization
- 📊 Data visualization interactions
- 🔧 Tool palette interactions