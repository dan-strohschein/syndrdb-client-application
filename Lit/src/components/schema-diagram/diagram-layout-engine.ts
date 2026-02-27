import type { DiagramNode, DiagramEdge, Vec2 } from './types';

const REPULSION_STRENGTH = 8000;
const ATTRACTION_STRENGTH = 0.005;
const IDEAL_EDGE_LENGTH = 250;
const CENTER_GRAVITY = 0.01;
const VELOCITY_DAMPING = 0.8;
const ALPHA_DECAY = 0.998;
const ALPHA_MIN = 0.001;
const ALPHA_START = 1.0;

/**
 * Fruchterman-Reingold-style force-directed layout engine.
 * Call `tick()` each frame until it returns false (converged).
 */
export class DiagramLayoutEngine {
  private alpha = ALPHA_START;
  private centerX = 0;
  private centerY = 0;

  /** Set the center of gravity for the layout. */
  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
  }

  /** Initialize node positions in a grid layout as a starting point. */
  initializePositions(nodes: DiagramNode[]): void {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const spacing = 320;

    for (let i = 0; i < nodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodes[i].position = {
        x: col * spacing - (cols * spacing) / 2 + this.centerX,
        y: row * spacing - (Math.ceil(nodes.length / cols) * spacing) / 2 + this.centerY,
      };
      nodes[i].velocity = { x: 0, y: 0 };
    }

    this.alpha = ALPHA_START;
  }

  /** Reheat the simulation (e.g. after user interaction). */
  reheat(): void {
    this.alpha = Math.max(this.alpha, 0.3);
  }

  /** Returns true if the simulation is still active. */
  isActive(): boolean {
    return this.alpha > ALPHA_MIN;
  }

  /**
   * Advance one simulation tick. Returns true if still active.
   */
  tick(nodes: DiagramNode[], edges: DiagramEdge[]): boolean {
    if (this.alpha <= ALPHA_MIN) return false;

    // 1. Repulsion between all node pairs (Coulomb's law)
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].pinned) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const distSq = Math.max(dx * dx + dy * dy, 100); // min distance to avoid explosion
        const dist = Math.sqrt(distSq);
        const force = (REPULSION_STRENGTH * this.alpha) / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!a.pinned) {
          a.velocity.x -= fx;
          a.velocity.y -= fy;
        }
        if (!b.pinned) {
          b.velocity.x += fx;
          b.velocity.y += fy;
        }
      }
    }

    // 2. Attraction along edges (Hooke's law)
    const nodeMap = new Map<string, DiagramNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    for (const edge of edges) {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) continue;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - IDEAL_EDGE_LENGTH;
      const force = ATTRACTION_STRENGTH * displacement * this.alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!source.pinned) {
        source.velocity.x += fx;
        source.velocity.y += fy;
      }
      if (!target.pinned) {
        target.velocity.x -= fx;
        target.velocity.y -= fy;
      }
    }

    // 3. Center gravity
    for (const node of nodes) {
      if (node.pinned) continue;
      const dx = this.centerX - node.position.x;
      const dy = this.centerY - node.position.y;
      node.velocity.x += dx * CENTER_GRAVITY * this.alpha;
      node.velocity.y += dy * CENTER_GRAVITY * this.alpha;
    }

    // 4. Apply velocity and damping
    for (const node of nodes) {
      if (node.pinned) continue;
      node.velocity.x *= VELOCITY_DAMPING;
      node.velocity.y *= VELOCITY_DAMPING;
      node.position.x += node.velocity.x;
      node.position.y += node.velocity.y;
    }

    // 5. Alpha decay
    this.alpha *= ALPHA_DECAY;
    if (this.alpha < ALPHA_MIN) this.alpha = 0;

    return this.alpha > 0;
  }
}
