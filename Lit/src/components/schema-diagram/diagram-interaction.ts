import type { Vec2, Rect, InteractionState, InteractionMode } from './types';
import { DiagramModel } from './diagram-model';
import { DiagramViewport } from './diagram-viewport';
import { DiagramRenderer } from './diagram-renderer';

const INERTIA_TRACK_COUNT = 5;
const PAN_INERTIA_DECEL = 0.92;

/**
 * Mouse/keyboard interaction state machine for the schema diagram.
 * States: idle -> panning | nodeDragging | boxSelecting
 */
export class DiagramInteraction {
  private state: InteractionState = {
    mode: 'idle',
    dragStartWorld: null,
    dragStartScreen: null,
    dragNodeId: null,
    panVelocity: { x: 0, y: 0 },
    boxSelectStart: null,
    boxSelectEnd: null,
    lastMouseMoves: [],
    spaceHeld: false,
  };

  getMode(): InteractionMode {
    return this.state.mode;
  }

  getPanVelocity(): Vec2 {
    return this.state.panVelocity;
  }

  getSelectionBox(): Rect | null {
    if (this.state.mode !== 'boxSelecting' || !this.state.boxSelectStart || !this.state.boxSelectEnd) {
      return null;
    }
    const s = this.state.boxSelectStart;
    const e = this.state.boxSelectEnd;
    return {
      x: Math.min(s.x, e.x),
      y: Math.min(s.y, e.y),
      width: Math.abs(e.x - s.x),
      height: Math.abs(e.y - s.y),
    };
  }

  // ── Mouse events ───────────────────────────────────────────────────

  handleMouseDown(
    screenPos: Vec2,
    button: number,
    shiftKey: boolean,
    model: DiagramModel,
    viewport: DiagramViewport,
    renderer: DiagramRenderer,
  ): void {
    const worldPos = viewport.screenToWorld(screenPos);

    // Right-click, middle-click, or space+left-click => pan
    if (button === 2 || button === 1 || (button === 0 && this.state.spaceHeld)) {
      this.state.mode = 'panning';
      this.state.dragStartScreen = { ...screenPos };
      this.state.panVelocity = { x: 0, y: 0 };
      this.state.lastMouseMoves = [{ pos: { ...screenPos }, time: performance.now() }];
      return;
    }

    if (button !== 0) return;

    // Left-click: check if we hit a node
    const hitNodeId = renderer.hitTestNode(worldPos, model);

    if (hitNodeId) {
      // Select the node
      if (!shiftKey) {
        const node = model.getNode(hitNodeId);
        if (!node?.selected) {
          model.selectNode(hitNodeId, true, true);
        }
      } else {
        const node = model.getNode(hitNodeId);
        model.selectNode(hitNodeId, !node?.selected, false);
      }

      // Start node drag
      this.state.mode = 'nodeDragging';
      this.state.dragNodeId = hitNodeId;
      this.state.dragStartWorld = { ...worldPos };
      return;
    }

    // Left-click on empty space: start box select (or deselect)
    if (!shiftKey) {
      model.deselectAll();
    }

    this.state.mode = 'boxSelecting';
    this.state.boxSelectStart = { ...worldPos };
    this.state.boxSelectEnd = { ...worldPos };
  }

  handleMouseMove(
    screenPos: Vec2,
    model: DiagramModel,
    viewport: DiagramViewport,
    renderer: DiagramRenderer,
  ): void {
    const worldPos = viewport.screenToWorld(screenPos);

    switch (this.state.mode) {
      case 'panning': {
        if (!this.state.dragStartScreen) break;
        const dx = screenPos.x - this.state.dragStartScreen.x;
        const dy = screenPos.y - this.state.dragStartScreen.y;
        viewport.pan(dx, dy);
        this.state.dragStartScreen = { ...screenPos };

        // Track for inertia
        this.state.lastMouseMoves.push({ pos: { ...screenPos }, time: performance.now() });
        if (this.state.lastMouseMoves.length > INERTIA_TRACK_COUNT) {
          this.state.lastMouseMoves.shift();
        }
        break;
      }

      case 'nodeDragging': {
        if (!this.state.dragStartWorld || !this.state.dragNodeId) break;

        const dx = worldPos.x - this.state.dragStartWorld.x;
        const dy = worldPos.y - this.state.dragStartWorld.y;

        // Move all selected nodes
        const selected = model.getSelectedNodes();
        for (const node of selected) {
          model.setNodePosition(node.id, {
            x: node.position.x + dx,
            y: node.position.y + dy,
          });
        }

        // Pin the dragged node
        model.pinNode(this.state.dragNodeId, true);

        this.state.dragStartWorld = { ...worldPos };
        break;
      }

      case 'boxSelecting': {
        this.state.boxSelectEnd = { ...worldPos };

        // Select nodes within the box
        const box = this.getSelectionBox();
        if (box) {
          for (const node of model.getNodes()) {
            const inBox =
              node.position.x + node.size.x >= box.x &&
              node.position.x <= box.x + box.width &&
              node.position.y + node.size.y >= box.y &&
              node.position.y <= box.y + box.height;
            model.selectNode(node.id, inBox, false);
          }
        }
        break;
      }

      case 'idle': {
        // Hover detection
        const hitNodeId = renderer.hitTestNode(worldPos, model);
        model.setHoveredNode(hitNodeId);
        break;
      }
    }
  }

  handleMouseUp(model: DiagramModel): void {
    if (this.state.mode === 'panning') {
      // Calculate inertia from recent moves
      const moves = this.state.lastMouseMoves;
      if (moves.length >= 2) {
        const last = moves[moves.length - 1];
        const prev = moves[Math.max(0, moves.length - 3)];
        const dt = (last.time - prev.time) / 1000;
        if (dt > 0 && dt < 0.15) {
          this.state.panVelocity = {
            x: (last.pos.x - prev.pos.x) / dt * 0.016,  // convert to per-frame
            y: (last.pos.y - prev.pos.y) / dt * 0.016,
          };
        }
      }
    }

    this.state.mode = 'idle';
    this.state.dragStartWorld = null;
    this.state.dragStartScreen = null;
    this.state.dragNodeId = null;
    this.state.boxSelectStart = null;
    this.state.boxSelectEnd = null;
    this.state.lastMouseMoves = [];
  }

  handleWheel(
    screenPos: Vec2,
    deltaY: number,
    viewport: DiagramViewport,
  ): void {
    viewport.zoomAtPoint(screenPos, deltaY);
  }

  // ── Keyboard events ────────────────────────────────────────────────

  handleKeyDown(
    key: string,
    metaKey: boolean,
    ctrlKey: boolean,
    model: DiagramModel,
    viewport: DiagramViewport,
  ): boolean {
    const mod = metaKey || ctrlKey;

    if (key === ' ') {
      this.state.spaceHeld = true;
      return true;
    }

    if (key === 'Escape') {
      model.deselectAll();
      return true;
    }

    // Cmd/Ctrl+0: fit all
    if (mod && key === '0') {
      const bounds = model.getBounds();
      if (bounds) viewport.fitBounds(bounds);
      return true;
    }

    // Cmd/Ctrl+ +/-: zoom in/out
    if (mod && (key === '=' || key === '+')) {
      viewport.setZoom(viewport.getZoom() * 1.25);
      return true;
    }
    if (mod && key === '-') {
      viewport.setZoom(viewport.getZoom() / 1.25);
      return true;
    }

    return false;
  }

  handleKeyUp(key: string): void {
    if (key === ' ') {
      this.state.spaceHeld = false;
    }
  }
}
