import type { DiagramNode, DiagramEdge, Vec2, Rect } from './types';

/**
 * Graph data model for the schema diagram.
 * Stores nodes (bundles) and edges (relationships) with mutation/query methods.
 */
export class DiagramModel {
  private nodes = new Map<string, DiagramNode>();
  private edges = new Map<string, DiagramEdge>();
  private _dirty = true;

  /** Replace the entire graph. */
  setGraph(nodes: DiagramNode[], edges: DiagramEdge[]): void {
    this.nodes.clear();
    this.edges.clear();
    for (const node of nodes) this.nodes.set(node.id, node);
    for (const edge of edges) this.edges.set(edge.id, edge);
    this._dirty = true;
  }

  // ── Mutations ──────────────────────────────────────────────────────

  setNodePosition(nodeId: string, position: Vec2): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.position = position;
      this._dirty = true;
    }
  }

  pinNode(nodeId: string, pinned: boolean): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.pinned = pinned;
      this._dirty = true;
    }
  }

  selectNode(nodeId: string, selected: boolean, exclusive: boolean): void {
    if (exclusive) {
      for (const node of this.nodes.values()) node.selected = false;
    }
    const node = this.nodes.get(nodeId);
    if (node) {
      node.selected = selected;
      this._dirty = true;
    }
  }

  deselectAll(): void {
    for (const node of this.nodes.values()) node.selected = false;
    this._dirty = true;
  }

  setHoveredNode(nodeId: string | null): void {
    for (const node of this.nodes.values()) {
      const shouldHover = node.id === nodeId;
      if (node.hovered !== shouldHover) {
        node.hovered = shouldHover;
        this._dirty = true;
      }
    }
  }

  setHoveredEdge(_edgeId: string | null): void {
    // Reserved for future edge hover effects
    this._dirty = true;
  }

  // ── Queries ────────────────────────────────────────────────────────

  getNode(id: string): DiagramNode | undefined {
    return this.nodes.get(id);
  }

  getNodes(): DiagramNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): DiagramEdge[] {
    return Array.from(this.edges.values());
  }

  getEdgesForNode(nodeId: string): DiagramEdge[] {
    return this.getEdges().filter(
      (e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId,
    );
  }

  getSelectedNodes(): DiagramNode[] {
    return this.getNodes().filter((n) => n.selected);
  }

  /** World-space bounding box of all nodes (or null if empty). */
  getBounds(): Rect | null {
    const nodes = this.getNodes();
    if (nodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.x);
      maxY = Math.max(maxY, node.position.y + node.size.y);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  // ── Dirty flag ─────────────────────────────────────────────────────

  get dirty(): boolean {
    return this._dirty;
  }

  clearDirty(): void {
    this._dirty = false;
  }

  markDirty(): void {
    this._dirty = true;
  }
}
