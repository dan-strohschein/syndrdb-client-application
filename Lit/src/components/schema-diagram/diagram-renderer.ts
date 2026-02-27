import type {
  DiagramNode,
  DiagramEdge,
  DiagramField,
  Vec2,
  Rect,
  LODLevel,
  DiagramTheme,
  RelationshipCardinality,
} from './types';
import { DEFAULT_DIAGRAM_THEME } from './types';
import { DiagramModel } from './diagram-model';
import { DiagramViewport } from './diagram-viewport';
import { DiagramEffects, cubicBezierPoint } from './diagram-effects';

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 12;
const NODE_CORNER_RADIUS = 8;
const NODE_HEADER_HEIGHT = 32;
const NODE_FIELD_ROW_HEIGHT = 22;
const NODE_PADDING_X = 12;
const EDGE_HIT_TOLERANCE = 8;

/**
 * Canvas 2D rendering pipeline for the schema diagram.
 * Render order: background -> grid -> edges -> particles -> selection box -> nodes -> minimap -> zoom indicator.
 */
export class DiagramRenderer {
  private theme: DiagramTheme = DEFAULT_DIAGRAM_THEME;

  setTheme(theme: Partial<DiagramTheme>): void {
    this.theme = { ...DEFAULT_DIAGRAM_THEME, ...theme };
  }

  /**
   * Full render pass.
   */
  render(
    ctx: CanvasRenderingContext2D,
    model: DiagramModel,
    viewport: DiagramViewport,
    effects: DiagramEffects,
    selectionBox: Rect | null,
    canvasWidth: number,
    canvasHeight: number,
    dpr: number,
  ): void {
    const lod = viewport.getLODLevel();
    const zoom = viewport.getZoom();
    const visibleRect = viewport.getVisibleWorldRect();

    // 1. Background
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Apply camera transform
    const cam = viewport.getCamera();
    ctx.translate(cam.offset.x * cam.zoom, cam.offset.y * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);

    // 3. Grid
    effects.drawGrid(ctx, visibleRect, zoom, this.theme.gridDot, this.theme.gridDotPulse);

    // 4. Edges
    const edges = model.getEdges();
    const nodes = model.getNodes();
    const nodeMap = new Map<string, DiagramNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    for (const edge of edges) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) continue;
      if (!this.isRectVisible(source, visibleRect) && !this.isRectVisible(target, visibleRect)) continue;

      this.drawEdge(ctx, edge, source, target, lod);

      // 5. Particles on this edge
      if (lod !== 'minimal') {
        const bezier = this.getEdgeBezierPoints(source, target);
        const particles = effects.getParticlesForEdge(edge.id);
        const edgeColor = this.getEdgeColor(edge.relationshipType);
        for (const p of particles) {
          effects.drawParticle(ctx, p.t, p.opacity, bezier.p0, bezier.p1, bezier.p2, bezier.p3, edgeColor);
        }
      }
    }

    // 6. Selection box
    if (selectionBox) {
      ctx.strokeStyle = this.theme.selectionBox;
      ctx.fillStyle = this.theme.selectionBoxFill;
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.setLineDash([]);
    }

    // 7. Nodes
    for (const node of nodes) {
      if (!this.isRectVisible(node, visibleRect)) continue;
      this.drawNode(ctx, node, lod, zoom, effects.getGlowIntensity());
    }

    // Restore to screen-space for overlays
    ctx.restore();

    // 8. Minimap
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawMinimap(ctx, model, viewport, canvasWidth, canvasHeight);

    // 9. Zoom indicator
    this.drawZoomIndicator(ctx, zoom, canvasWidth, canvasHeight);
    ctx.restore();
  }

  // ── Node rendering ─────────────────────────────────────────────────

  private drawNode(
    ctx: CanvasRenderingContext2D,
    node: DiagramNode,
    lod: LODLevel,
    zoom: number,
    glowIntensity: number,
  ): void {
    const { position, size, selected, hovered, bundleName, fields } = node;

    ctx.save();

    // Glow effect for selected/hovered
    if (selected || hovered) {
      const glowColor = selected ? this.theme.nodeGlowSelected : this.theme.nodeGlowHovered;
      const intensity = selected ? 15 + glowIntensity * 10 : 8 + glowIntensity * 6;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = intensity;
    }

    // Background (glassmorphism: dark semi-transparent)
    ctx.fillStyle = this.theme.nodeBackground;
    ctx.strokeStyle = selected ? this.theme.nodeGlowSelected : this.theme.nodeBorder;
    ctx.lineWidth = selected ? 2 : 1;
    this.roundRect(ctx, position.x, position.y, size.x, size.y, NODE_CORNER_RADIUS);
    ctx.fill();
    ctx.stroke();

    // Reset shadow after card outline
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (lod === 'minimal') {
      // Just the colored rectangle is enough
      ctx.restore();
      return;
    }

    // Header bar
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(position.x + NODE_CORNER_RADIUS, position.y);
    ctx.lineTo(position.x + size.x - NODE_CORNER_RADIUS, position.y);
    ctx.arcTo(position.x + size.x, position.y, position.x + size.x, position.y + NODE_CORNER_RADIUS, NODE_CORNER_RADIUS);
    ctx.lineTo(position.x + size.x, position.y + NODE_HEADER_HEIGHT);
    ctx.lineTo(position.x, position.y + NODE_HEADER_HEIGHT);
    ctx.lineTo(position.x, position.y + NODE_CORNER_RADIUS);
    ctx.arcTo(position.x, position.y, position.x + NODE_CORNER_RADIUS, position.y, NODE_CORNER_RADIUS);
    ctx.closePath();
    ctx.fillStyle = this.theme.nodeHeaderBackground;
    ctx.fill();
    ctx.restore();

    // Bundle name
    ctx.fillStyle = this.theme.nodeHeaderText;
    ctx.font = 'bold 12px "Inter", "SF Pro Display", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const nameX = position.x + NODE_PADDING_X;
    const nameY = position.y + NODE_HEADER_HEIGHT / 2;
    ctx.fillText(bundleName, nameX, nameY);

    // Document count badge (if available)
    if (node.documentCount !== undefined && lod === 'full') {
      const countText = `${node.documentCount}`;
      const countWidth = ctx.measureText(countText).width + 10;
      const badgeX = position.x + size.x - countWidth - 8;
      const badgeY = position.y + NODE_HEADER_HEIGHT / 2 - 8;
      ctx.fillStyle = 'rgba(99,102,241,0.25)';
      this.roundRect(ctx, badgeX, badgeY, countWidth, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#a5b4fc';
      ctx.font = '10px "Inter", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(countText, badgeX + 5, badgeY + 8);
    }

    if (lod === 'summary') {
      // Show "N fields" badge
      ctx.fillStyle = this.theme.nodeFieldTypeText;
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(`${fields.length} fields`, nameX, position.y + NODE_HEADER_HEIGHT + 8);
      ctx.restore();
      return;
    }

    // Full LOD: render field rows
    const fieldStartY = position.y + NODE_HEADER_HEIGHT + 4;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const rowY = fieldStartY + i * NODE_FIELD_ROW_HEIGHT;
      const textY = rowY + NODE_FIELD_ROW_HEIGHT / 2;

      // Constraint icons
      let iconX = nameX;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textBaseline = 'middle';

      if (field.name === 'DocumentID') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('[PK]', iconX, textY);
        iconX += ctx.measureText('[PK]').width + 3;
      }
      if (field.isRequired) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('[!]', iconX, textY);
        iconX += ctx.measureText('[!]').width + 3;
      }
      if (field.isUnique) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('[U]', iconX, textY);
        iconX += ctx.measureText('[U]').width + 3;
      }

      // Relationship indicators
      if (field.isRelationshipSource || field.isRelationshipTarget) {
        ctx.fillStyle = '#c084fc';
        const arrow = field.isRelationshipSource ? '\u2192' : '\u2190';
        ctx.fillText(arrow, iconX, textY);
        iconX += 12;
      }

      // Field name
      ctx.fillStyle = this.theme.nodeFieldText;
      ctx.font = '11px "Monaco", "Cascadia Code", monospace';
      ctx.fillText(field.name, iconX, textY);

      // Type pill
      const typeText = field.type;
      const typeX = position.x + size.x - NODE_PADDING_X - ctx.measureText(typeText).width - 8;
      ctx.fillStyle = 'rgba(129,140,248,0.15)';
      const pillWidth = ctx.measureText(typeText).width + 8;
      this.roundRect(ctx, typeX, rowY + 3, pillWidth, NODE_FIELD_ROW_HEIGHT - 6, 4);
      ctx.fill();
      ctx.fillStyle = this.theme.nodeFieldTypeText;
      ctx.font = '10px "Monaco", "Cascadia Code", monospace';
      ctx.fillText(typeText, typeX + 4, textY);
    }

    ctx.restore();
  }

  // ── Edge rendering ─────────────────────────────────────────────────

  private drawEdge(
    ctx: CanvasRenderingContext2D,
    edge: DiagramEdge,
    source: DiagramNode,
    target: DiagramNode,
    lod: LODLevel,
  ): void {
    const bezier = this.getEdgeBezierPoints(source, target);
    const color = this.getEdgeColor(edge.relationshipType);

    ctx.save();

    // Glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(bezier.p0.x, bezier.p0.y);
    ctx.bezierCurveTo(bezier.p1.x, bezier.p1.y, bezier.p2.x, bezier.p2.y, bezier.p3.x, bezier.p3.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Cardinality labels at endpoints (full LOD only)
    if (lod === 'full') {
      const labels = this.getCardinalityLabels(edge.relationshipType);
      ctx.font = '10px "Inter", system-ui, sans-serif';
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';

      // Source label
      const srcLabelPos = cubicBezierPoint(0.08, bezier.p0, bezier.p1, bezier.p2, bezier.p3);
      ctx.fillText(labels.source, srcLabelPos.x + 4, srcLabelPos.y - 8);

      // Target label
      const tgtLabelPos = cubicBezierPoint(0.92, bezier.p0, bezier.p1, bezier.p2, bezier.p3);
      ctx.fillText(labels.target, tgtLabelPos.x + 4, tgtLabelPos.y - 8);

      // Relationship name at midpoint
      if (edge.name) {
        const midPos = cubicBezierPoint(0.5, bezier.p0, bezier.p1, bezier.p2, bezier.p3);
        ctx.font = '9px "Inter", system-ui, sans-serif';
        ctx.globalAlpha = 0.7;
        ctx.fillText(edge.name, midPos.x + 4, midPos.y - 10);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  getEdgeBezierPoints(source: DiagramNode, target: DiagramNode): { p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 } {
    // Connect from right side of source to left side of target
    const p0: Vec2 = { x: source.position.x + source.size.x, y: source.position.y + source.size.y / 2 };
    const p3: Vec2 = { x: target.position.x, y: target.position.y + target.size.y / 2 };

    // If target is to the left of source, swap sides
    if (p3.x < p0.x - 50) {
      p0.x = source.position.x;
      p3.x = target.position.x + target.size.x;
    }

    const dx = Math.abs(p3.x - p0.x);
    const controlOffset = Math.max(60, dx * 0.4);

    const p1: Vec2 = { x: p0.x + controlOffset, y: p0.y };
    const p2: Vec2 = { x: p3.x - controlOffset, y: p3.y };

    // If we swapped sides, adjust control points
    if (p3.x > p0.x + target.size.x) {
      // Normal case — keep as is
    } else {
      p1.x = p0.x - controlOffset;
      p2.x = p3.x + controlOffset;
    }

    return { p0, p1, p2, p3 };
  }

  private getEdgeColor(type: RelationshipCardinality): string {
    switch (type) {
      case '1:1': return this.theme.edgeOneToOne;
      case '1:N': return this.theme.edgeOneToMany;
      case 'M:N': return this.theme.edgeManyToMany;
    }
  }

  private getCardinalityLabels(type: RelationshipCardinality): { source: string; target: string } {
    switch (type) {
      case '1:1': return { source: '1', target: '1' };
      case '1:N': return { source: '1', target: 'N' };
      case 'M:N': return { source: 'M', target: 'N' };
    }
  }

  // ── Minimap ────────────────────────────────────────────────────────

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    model: DiagramModel,
    viewport: DiagramViewport,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const bounds = model.getBounds();
    if (!bounds) return;

    const mmX = canvasWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
    const mmY = canvasHeight - MINIMAP_HEIGHT - MINIMAP_PADDING;

    // Background
    ctx.fillStyle = this.theme.minimapBackground;
    ctx.strokeStyle = this.theme.nodeBorder;
    ctx.lineWidth = 1;
    this.roundRect(ctx, mmX, mmY, MINIMAP_WIDTH, MINIMAP_HEIGHT, 6);
    ctx.fill();
    ctx.stroke();

    // Scale to fit bounds into minimap
    const pad = 10;
    const scaleX = (MINIMAP_WIDTH - pad * 2) / (bounds.width || 1);
    const scaleY = (MINIMAP_HEIGHT - pad * 2) / (bounds.height || 1);
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mmX, mmY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.clip();

    const offsetX = mmX + pad + ((MINIMAP_WIDTH - pad * 2) - bounds.width * scale) / 2;
    const offsetY = mmY + pad + ((MINIMAP_HEIGHT - pad * 2) - bounds.height * scale) / 2;

    // Draw nodes as small rectangles
    for (const node of model.getNodes()) {
      const nx = offsetX + (node.position.x - bounds.x) * scale;
      const ny = offsetY + (node.position.y - bounds.y) * scale;
      const nw = Math.max(3, node.size.x * scale);
      const nh = Math.max(2, node.size.y * scale);

      ctx.fillStyle = node.selected ? this.theme.nodeGlowSelected : this.theme.nodeBorder;
      ctx.fillRect(nx, ny, nw, nh);
    }

    // Draw viewport rectangle
    const visibleRect = viewport.getVisibleWorldRect();
    const vx = offsetX + (visibleRect.x - bounds.x) * scale;
    const vy = offsetY + (visibleRect.y - bounds.y) * scale;
    const vw = visibleRect.width * scale;
    const vh = visibleRect.height * scale;

    ctx.strokeStyle = this.theme.minimapViewport;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);

    ctx.restore();
  }

  // ── Zoom indicator ─────────────────────────────────────────────────

  private drawZoomIndicator(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const text = `${Math.round(zoom * 100)}%`;
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillStyle = this.theme.zoomIndicatorText;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(text, 12, canvasHeight - 12);
    ctx.textAlign = 'start'; // reset
  }

  // ── Hit testing ────────────────────────────────────────────────────

  /** Check if a world-space point hits a node. Returns node id or null. */
  hitTestNode(worldPoint: Vec2, model: DiagramModel): string | null {
    const padding = 4;
    // Iterate in reverse so topmost nodes are hit first
    const nodes = model.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (
        worldPoint.x >= node.position.x - padding &&
        worldPoint.x <= node.position.x + node.size.x + padding &&
        worldPoint.y >= node.position.y - padding &&
        worldPoint.y <= node.position.y + node.size.y + padding
      ) {
        return node.id;
      }
    }
    return null;
  }

  /** Check if a world-space point is near an edge. Returns edge id or null. */
  hitTestEdge(worldPoint: Vec2, model: DiagramModel): string | null {
    const tolerance = EDGE_HIT_TOLERANCE;
    const nodeMap = new Map<string, DiagramNode>();
    for (const n of model.getNodes()) nodeMap.set(n.id, n);

    for (const edge of model.getEdges()) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) continue;

      const bezier = this.getEdgeBezierPoints(source, target);

      // Sample points along the Bezier and check distance
      for (let t = 0; t <= 1; t += 0.05) {
        const pt = cubicBezierPoint(t, bezier.p0, bezier.p1, bezier.p2, bezier.p3);
        const dx = pt.x - worldPoint.x;
        const dy = pt.y - worldPoint.y;
        if (dx * dx + dy * dy <= tolerance * tolerance) {
          return edge.id;
        }
      }
    }
    return null;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private isRectVisible(node: DiagramNode, visibleRect: Rect): boolean {
    return (
      node.position.x + node.size.x >= visibleRect.x &&
      node.position.x <= visibleRect.x + visibleRect.width &&
      node.position.y + node.size.y >= visibleRect.y &&
      node.position.y <= visibleRect.y + visibleRect.height
    );
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
