import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DiagramModel } from './diagram-model';
import { DiagramDataService } from './diagram-data-service';
import { DiagramViewport } from './diagram-viewport';
import { DiagramLayoutEngine } from './diagram-layout-engine';
import { DiagramRenderer } from './diagram-renderer';
import { DiagramEffects } from './diagram-effects';
import { DiagramInteraction } from './diagram-interaction';
import { ConnectionManager } from '../../services/connection-manager';
import type { Vec2 } from './types';

@customElement('schema-diagram')
export class SchemaDiagram extends LitElement {
  // Disable Shadow DOM for Tailwind compatibility
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  connectionId = '';

  @property({ type: String })
  databaseName = '';

  @property({ type: Boolean })
  isActive = false;

  @state() private loading = false;
  @state() private loadError: string | null = null;
  @state() private isEmpty = false;

  // Subsystems
  private model = new DiagramModel();
  private dataService = new DiagramDataService();
  private viewport = new DiagramViewport();
  private layoutEngine = new DiagramLayoutEngine();
  private renderer = new DiagramRenderer();
  private effects = new DiagramEffects();
  private interaction = new DiagramInteraction();

  // Canvas
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private resizeObserver!: ResizeObserver;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;

  // Track which data is currently loaded to avoid redundant loads
  private loadedConnectionId = '';
  private loadedDatabaseName = '';

  // Connection status listener cleanup
  private _onConnectionStatusChanged: ((conn: unknown) => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────

  firstUpdated() {
    this.initCanvas();
    this.maybeLoadSchema();

    // Listen for connection status changes so restored tabs auto-load
    // once the connection is re-established.
    // Use a short delay to let refreshConnectionMetadata finish populating
    // databases before we try to load the schema.
    const cm = ConnectionManager.getInstance();
    this._onConnectionStatusChanged = () => {
      if (!this.loadedConnectionId && this.connectionId) {
        const conn = cm.getConnection(this.connectionId);
        // Wait until the connection has databases populated
        if (conn?.status === 'connected' && conn.databases && conn.databases.length > 0) {
          this.maybeLoadSchema();
        }
      }
    };
    cm.on('connectionStatusChanged', this._onConnectionStatusChanged);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (changedProperties.has('connectionId') || changedProperties.has('databaseName')) {
      this.maybeLoadSchema();
    }

    if (changedProperties.has('isActive')) {
      if (this.isActive) {
        this.startAnimationLoop();
        // Resize in case container changed while inactive
        requestAnimationFrame(() => this.handleResize());
      } else {
        this.stopAnimationLoop();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAnimationLoop();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.removeCanvasListeners();
    if (this._onConnectionStatusChanged) {
      ConnectionManager.getInstance().off('connectionStatusChanged', this._onConnectionStatusChanged);
      this._onConnectionStatusChanged = null;
    }
  }

  // ── Canvas setup ───────────────────────────────────────────────────

  private initCanvas(): void {
    this.canvas = this.querySelector('canvas') as HTMLCanvasElement;
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.setupCanvasListeners();
    this.handleResize();

    // ResizeObserver
    const container = this.canvas.parentElement;
    if (container) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
    }
  }

  private handleResize(): void {
    if (!this.canvas || !this.ctx) return;

    const container = this.canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.viewport.setCanvasSize(rect.width, rect.height);
    this.model.markDirty();
  }

  // ── Canvas event listeners ─────────────────────────────────────────

  private _onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const screenPos = this.getCanvasMousePos(e);
    this.interaction.handleMouseDown(
      screenPos,
      e.button,
      e.shiftKey,
      this.model,
      this.viewport,
      this.renderer,
    );
    this.model.markDirty();
  };

  private _onMouseMove = (e: MouseEvent) => {
    const screenPos = this.getCanvasMousePos(e);
    this.interaction.handleMouseMove(screenPos, this.model, this.viewport, this.renderer);

    // Update cursor
    const worldPos = this.viewport.screenToWorld(screenPos);
    const mode = this.interaction.getMode();
    if (mode === 'panning') {
      this.canvas.style.cursor = 'grabbing';
    } else if (mode === 'nodeDragging') {
      this.canvas.style.cursor = 'move';
    } else {
      const hitNode = this.renderer.hitTestNode(worldPos, this.model);
      this.canvas.style.cursor = hitNode ? 'pointer' : 'default';
    }

    this.model.markDirty();
  };

  private _onMouseUp = () => {
    this.interaction.handleMouseUp(this.model);
    this.model.markDirty();
  };

  private _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const screenPos = this.getCanvasMousePos(e);
    this.interaction.handleWheel(screenPos, e.deltaY, this.viewport);
    this.model.markDirty();
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    const handled = this.interaction.handleKeyDown(
      e.key,
      e.metaKey,
      e.ctrlKey,
      this.model,
      this.viewport,
    );
    if (handled) {
      e.preventDefault();
      this.model.markDirty();
    }
  };

  private _onKeyUp = (e: KeyboardEvent) => {
    this.interaction.handleKeyUp(e.key);
  };

  private _onContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // prevent browser context menu on canvas
  };

  private setupCanvasListeners(): void {
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    // Keyboard: listen on the component itself (needs tabindex)
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('keyup', this._onKeyUp);
  }

  private removeCanvasListeners(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('keyup', this._onKeyUp);
  }

  private getCanvasMousePos(e: MouseEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Data loading ───────────────────────────────────────────────────

  private async maybeLoadSchema(): Promise<void> {
    if (!this.connectionId) return;

    const cm = ConnectionManager.getInstance();
    const conn = cm.getConnection(this.connectionId);

    // Connection doesn't exist or isn't connected yet (e.g. restored tab on app launch)
    if (!conn || conn.status !== 'connected') return;

    // If no database name provided, try to resolve from the connection
    if (!this.databaseName) {
      if (conn.currentDatabase) {
        this.databaseName = conn.currentDatabase;
      } else if (conn.databases && conn.databases.length > 0) {
        this.databaseName = conn.databases[0];
      } else {
        return; // No database available
      }
    }

    if (
      this.connectionId === this.loadedConnectionId &&
      this.databaseName === this.loadedDatabaseName
    ) {
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.isEmpty = false;

    try {
      await this.dataService.loadSchema(this.connectionId, this.databaseName, this.model);

      this.loadedConnectionId = this.connectionId;
      this.loadedDatabaseName = this.databaseName;

      if (this.model.nodeCount === 0) {
        this.isEmpty = true;
        this.loading = false;
        return;
      }

      // Initialize layout
      const nodes = this.model.getNodes();
      this.layoutEngine.setCenter(0, 0);
      this.layoutEngine.initializePositions(nodes);

      // Fit to view after a few layout ticks
      requestAnimationFrame(() => {
        // Run some layout ticks synchronously for immediate visual
        const edges = this.model.getEdges();
        for (let i = 0; i < 50; i++) {
          if (!this.layoutEngine.tick(nodes, edges)) break;
        }
        const bounds = this.model.getBounds();
        if (bounds) this.viewport.fitBounds(bounds);
        this.model.markDirty();
      });

      if (this.isActive) this.startAnimationLoop();
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'Failed to load schema';
    } finally {
      this.loading = false;
    }
  }

  // ── Animation loop ─────────────────────────────────────────────────

  private startAnimationLoop(): void {
    if (this.animFrameId !== null) return;
    this.lastFrameTime = performance.now();
    this.animFrameId = requestAnimationFrame((t) => this.animationFrame(t));
  }

  private stopAnimationLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private animationFrame(timestamp: number): void {
    const deltaTime = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // cap at 100ms
    this.lastFrameTime = timestamp;

    let needsRender = this.model.dirty;

    // 1. Layout tick
    if (this.layoutEngine.isActive()) {
      const stillActive = this.layoutEngine.tick(this.model.getNodes(), this.model.getEdges());
      if (stillActive) needsRender = true;
    }

    // 2. Effects update
    const visibleRect = this.viewport.getVisibleWorldRect();
    this.effects.update(deltaTime, this.model.getEdges(), visibleRect);
    needsRender = true; // effects always animate (grid pulse, particles)

    // 3. Pan inertia
    const vel = this.interaction.getPanVelocity();
    if (vel.x !== 0 || vel.y !== 0) {
      const moving = this.viewport.applyInertia(vel);
      if (moving) needsRender = true;
    }

    // 4. Render
    if (needsRender && this.ctx && this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = this.canvas.width / dpr;
      const canvasHeight = this.canvas.height / dpr;

      this.renderer.render(
        this.ctx,
        this.model,
        this.viewport,
        this.effects,
        this.interaction.getSelectionBox(),
        canvasWidth,
        canvasHeight,
        dpr,
      );
      this.model.clearDirty();
    }

    // Continue loop if active
    if (this.isActive) {
      this.animFrameId = requestAnimationFrame((t) => this.animationFrame(t));
    } else {
      this.animFrameId = null;
    }
  }

  // ── Template ───────────────────────────────────────────────────────

  render() {
    return html`
      <div class="h-full w-full relative" tabindex="0" style="outline: none;">
        <div class="h-full w-full">
          <canvas class="block w-full h-full" style="background: #0f0f1a;"></canvas>
        </div>

        ${this.loading ? html`
          <div class="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
            <div class="flex flex-col items-center gap-3">
              <span class="loading loading-spinner loading-lg text-primary"></span>
              <span class="text-sm text-indigo-300">Loading schema...</span>
            </div>
          </div>
        ` : ''}

        ${this.loadError ? html`
          <div class="absolute inset-0 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3 text-center p-6">
              <i class="fa-solid fa-triangle-exclamation text-3xl text-feedback-error"></i>
              <span class="text-sm text-feedback-error">${this.loadError}</span>
              <button class="btn btn-sm btn-ghost text-indigo-300" @click=${() => { this.loadedConnectionId = ''; this.maybeLoadSchema(); }}>
                <i class="fa-solid fa-rotate-right mr-1"></i> Retry
              </button>
            </div>
          </div>
        ` : ''}

        ${this.isEmpty && !this.loading ? html`
          <div class="absolute inset-0 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3 text-center p-6">
              <i class="fa-solid fa-diagram-project text-4xl text-indigo-400/30"></i>
              <span class="text-sm text-indigo-300/50">No bundles found</span>
              <span class="text-xs text-indigo-300/30">Create bundles to see the schema diagram</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
