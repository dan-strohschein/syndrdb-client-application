import type { Vec2, Rect, Camera, LODLevel } from './types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const INERTIA_FRICTION = 0.92;
const INERTIA_STOP_THRESHOLD = 0.5;

/**
 * Pan/zoom camera for the schema diagram canvas.
 * Manages world ↔ screen coordinate transforms and level-of-detail.
 */
export class DiagramViewport {
  private camera: Camera = { offset: { x: 0, y: 0 }, zoom: 1.0 };
  private canvasWidth = 0;
  private canvasHeight = 0;

  /** Update the canvas dimensions (CSS pixels). */
  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  getCamera(): Camera {
    return this.camera;
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  getOffset(): Vec2 {
    return this.camera.offset;
  }

  // ── Coordinate transforms ──────────────────────────────────────────

  /** Convert a world-space point to screen-space. */
  worldToScreen(world: Vec2): Vec2 {
    return {
      x: (world.x + this.camera.offset.x) * this.camera.zoom,
      y: (world.y + this.camera.offset.y) * this.camera.zoom,
    };
  }

  /** Convert a screen-space point to world-space. */
  screenToWorld(screen: Vec2): Vec2 {
    return {
      x: screen.x / this.camera.zoom - this.camera.offset.x,
      y: screen.y / this.camera.zoom - this.camera.offset.y,
    };
  }

  // ── Pan ────────────────────────────────────────────────────────────

  /** Pan by a screen-space delta. */
  pan(dx: number, dy: number): void {
    this.camera.offset.x += dx / this.camera.zoom;
    this.camera.offset.y += dy / this.camera.zoom;
  }

  // ── Zoom ───────────────────────────────────────────────────────────

  /**
   * Zoom centered on a screen point.
   * Keeps the world point under the cursor stationary.
   */
  zoomAtPoint(screenPoint: Vec2, delta: number): void {
    const worldBefore = this.screenToWorld(screenPoint);

    // Exponential zoom for smooth feel
    const factor = Math.pow(1.001, -delta);
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.zoom * factor));

    // Adjust offset so worldBefore stays under screenPoint
    this.camera.offset.x = screenPoint.x / this.camera.zoom - worldBefore.x;
    this.camera.offset.y = screenPoint.y / this.camera.zoom - worldBefore.y;
  }

  /** Set zoom to an absolute value, centered on the canvas. */
  setZoom(zoom: number): void {
    const center: Vec2 = { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
    const worldBefore = this.screenToWorld(center);
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.camera.offset.x = center.x / this.camera.zoom - worldBefore.x;
    this.camera.offset.y = center.y / this.camera.zoom - worldBefore.y;
  }

  // ── Fit ────────────────────────────────────────────────────────────

  /** Fit a world-space bounding box into the viewport with padding. */
  fitBounds(worldRect: Rect, padding = 60): void {
    if (worldRect.width <= 0 || worldRect.height <= 0) return;

    const availW = this.canvasWidth - padding * 2;
    const availH = this.canvasHeight - padding * 2;
    if (availW <= 0 || availH <= 0) return;

    const scaleX = availW / worldRect.width;
    const scaleY = availH / worldRect.height;
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

    // Center the rect in the viewport
    const centerX = worldRect.x + worldRect.width / 2;
    const centerY = worldRect.y + worldRect.height / 2;
    this.camera.offset.x = this.canvasWidth / (2 * this.camera.zoom) - centerX;
    this.camera.offset.y = this.canvasHeight / (2 * this.camera.zoom) - centerY;
  }

  // ── Inertia ────────────────────────────────────────────────────────

  /**
   * Apply friction to a velocity vector. Returns true if still moving.
   */
  applyInertia(velocity: Vec2): boolean {
    velocity.x *= INERTIA_FRICTION;
    velocity.y *= INERTIA_FRICTION;

    if (Math.abs(velocity.x) < INERTIA_STOP_THRESHOLD && Math.abs(velocity.y) < INERTIA_STOP_THRESHOLD) {
      velocity.x = 0;
      velocity.y = 0;
      return false;
    }

    this.pan(velocity.x, velocity.y);
    return true;
  }

  // ── LOD ────────────────────────────────────────────────────────────

  getLODLevel(): LODLevel {
    if (this.camera.zoom < 0.3) return 'minimal';
    if (this.camera.zoom < 0.7) return 'summary';
    return 'full';
  }

  // ── Visible rect ───────────────────────────────────────────────────

  /** Get the world-space rectangle currently visible in the viewport. */
  getVisibleWorldRect(): Rect {
    const topLeft = this.screenToWorld({ x: 0, y: 0 });
    const bottomRight = this.screenToWorld({ x: this.canvasWidth, y: this.canvasHeight });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  getCanvasWidth(): number {
    return this.canvasWidth;
  }

  getCanvasHeight(): number {
    return this.canvasHeight;
  }
}
