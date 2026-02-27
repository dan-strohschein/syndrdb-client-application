import type { Particle, DiagramEdge, Vec2, Rect } from './types';

const HEX_RADIUS = 30;          // circumradius of each hexagon
const HEX_LINE_WIDTH = 0.5;
const GRID_PULSE_SPEED = 0.0008;
const MAX_PARTICLES = 1000;
const PARTICLES_PER_EDGE = 2;
const PARTICLE_BASE_SPEED = 0.15;  // t-units per second
const GLOW_PULSE_SPEED = 0.003;

/**
 * Particle system, background grid animation, and glow effects.
 * All operations are frame-rate-independent via deltaTime.
 */
export class DiagramEffects {
  private particles: Particle[] = [];
  private time = 0;
  private glowPhase = 0;

  /** Whether any animation is in progress (drives rAF continuation). */
  isAnimating(): boolean {
    return true; // Background grid always pulses
  }

  /** Advance all effects by deltaTime (seconds). */
  update(deltaTime: number, edges: DiagramEdge[], visibleRect: Rect): void {
    this.time += deltaTime;
    this.glowPhase = (Math.sin(this.time * GLOW_PULSE_SPEED * 1000) + 1) / 2;

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += p.speed * deltaTime;
      if (p.t >= 1.0) {
        p.t -= 1.0; // wrap
      }
    }

    // Ensure we have particles for visible edges
    const visibleEdgeIds = new Set<string>();
    for (const edge of edges) {
      visibleEdgeIds.add(edge.id);
    }

    // Remove particles for edges no longer visible
    this.particles = this.particles.filter((p) => visibleEdgeIds.has(p.edgeId));

    // Add particles for edges that need them (up to max)
    for (const edge of edges) {
      const existing = this.particles.filter((p) => p.edgeId === edge.id).length;
      const needed = PARTICLES_PER_EDGE - existing;
      if (needed > 0 && this.particles.length < MAX_PARTICLES) {
        for (let i = 0; i < needed && this.particles.length < MAX_PARTICLES; i++) {
          this.particles.push({
            t: Math.random(),
            speed: PARTICLE_BASE_SPEED + Math.random() * 0.1,
            edgeId: edge.id,
            opacity: 0.6 + Math.random() * 0.4,
          });
        }
      }
    }
  }

  /** Get current glow intensity (0–1) for hover/selection pulse. */
  getGlowIntensity(): number {
    return this.glowPhase;
  }

  /** Get particles for a given edge. */
  getParticlesForEdge(edgeId: string): Particle[] {
    return this.particles.filter((p) => p.edgeId === edgeId);
  }

  /** Get the current global time (for grid pulse). */
  getTime(): number {
    return this.time;
  }

  // ── Drawing helpers ────────────────────────────────────────────────

  /**
   * Draw a faint hexagonal grid background with a subtle breathing pulse.
   */
  drawGrid(
    ctx: CanvasRenderingContext2D,
    visibleRect: Rect,
    zoom: number,
    lineColor: string,
    pulseColor: string,
  ): void {
    const r = HEX_RADIUS;
    // Flat-top hexagon tiling:
    //   horizontal spacing = r * 1.5      (center-to-center, sharing edges)
    //   vertical   spacing = r * sqrt(3)  (center-to-center along y)
    //   odd columns are offset by half the vertical spacing
    const colW = r * 1.5;
    const rowH = r * Math.sqrt(3);
    const halfRowH = rowH / 2;

    // Extend bounds by one hex so partially visible hexes still render
    const startCol = Math.floor((visibleRect.x - r * 2) / colW);
    const endCol = Math.ceil((visibleRect.x + visibleRect.width + r * 2) / colW);
    const startRow = Math.floor((visibleRect.y - r * 2) / rowH);
    const endRow = Math.ceil((visibleRect.y + visibleRect.height + r * 2) / rowH);

    // Breathing pulse
    const pulse = (Math.sin(this.time * GRID_PULSE_SPEED * 1000) + 1) / 2;
    const baseAlpha = 0.12 + pulse * 0.06;

    ctx.save();
    ctx.lineWidth = HEX_LINE_WIDTH / Math.max(0.3, zoom);
    ctx.lineJoin = 'round';

    // Pre-compute the 6 unit vertices of a flat-top hexagon
    const vx: number[] = [];
    const vy: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      vx.push(Math.cos(angle) * r);
      vy.push(Math.sin(angle) * r);
    }

    // Batch into a single path per style to minimise draw calls
    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      const cx = col * colW;
      const isOddCol = ((col % 2) + 2) % 2; // works for negative cols
      const yOffset = isOddCol ? halfRowH : 0;

      for (let row = startRow; row <= endRow; row++) {
        const cy = row * rowH + yOffset;
        ctx.moveTo(cx + vx[0], cy + vy[0]);
        for (let v = 1; v < 6; v++) {
          ctx.lineTo(cx + vx[v], cy + vy[v]);
        }
        ctx.closePath();
      }
    }

    // Main hex lines
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = lineColor;
    ctx.stroke();

    // Subtle pulse highlight on top
    ctx.globalAlpha = pulse * 0.06;
    ctx.strokeStyle = pulseColor;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a single particle at a point on a Bezier curve.
   */
  drawParticle(
    ctx: CanvasRenderingContext2D,
    t: number,
    opacity: number,
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
    color: string,
  ): void {
    const pos = cubicBezierPoint(t, p0, p1, p2, p3);
    ctx.save();
    ctx.globalAlpha = opacity * 0.8;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Evaluate a point on a cubic Bezier curve at parameter t. */
export function cubicBezierPoint(t: number, p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}
