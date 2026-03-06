import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * Color palette from SyndrDB brand (PNG): purple gradient on dark.
 * - Purple gradient: #5D00B0 (deep) → #AD00FF (vibrant)
 * - Dark background: #333333
 * - Outline/wireframe: #2C2C2C
 */
const COLORS = {
  purpleDeep: '#5D00B0',
  purpleVibrant: '#AD00FF',
  purpleMid: '#7D00D8',
  bgDark: '#333333',
  outline: '#2C2C2C',
  emberHot: '#FF6B35',
  emberMid: '#FF8C42',
  emberCool: '#FFB347',
  emberGlow: 'rgba(255, 107, 53, 0.9)',
} as const;

/** Single particle for ember/cinder effect */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  hue: number;
  brightness: number;
}

/** Slow ambient orb for depth / energy-field effect */
interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;   /* purple-amber range */
  alpha: number;
  phase: number; /* 0–1 for subtle pulse */
}

/**
 * Animated SyndrDB logo: SVG wordmark with purple gradient and
 * canvas-drawn ember/cinder particles. Loops forever with randomness.
 */
@customElement('animated-logo')
export class AnimatedLogo extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
      contain: layout style paint;
    }
    .logo-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 2.5rem;
      width: 3rem;
      border-radius: 6px;
      /* Match navbar: linear-gradient(180deg, #1a1a1a, #121212) */
      background: linear-gradient(180deg, #1a1a1a, #121212);
      overflow: hidden;
    }
    .particles-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .logo-svg-wrap {
      position: relative;
      z-index: 1;
      height: 2.34375rem;   /* 25% larger than 1.875rem */
      width: auto;
      max-width: 3.75rem;
      filter: drop-shadow(0 0 4px rgba(173, 0, 255, 0.4));
      animation: logo-glow 4s ease-in-out infinite;
    }
    @keyframes logo-glow {
      0%, 100% { opacity: 1; filter: drop-shadow(0 0 4px rgba(173, 0, 255, 0.4)); }
      50% { opacity: 0.95; filter: drop-shadow(0 0 8px rgba(173, 0, 255, 0.6)); }
    }
    .logo-svg {
      height: 100%;
      width: auto;
      display: block;
    }
  `;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private orbs: Orb[] = [];
  private rafId = 0;
  private lastTime = 0;
  private spawnAccum = 0;

  /** SyndrDB logo path from official SVG (scaled to viewBox 0 0 108 117.54) */
  private readonly logoPath =
    'M314.659 210.632C314.257 237.252 313.76 263.263 313.546 289.276C313.509 293.74 311.044 295.738 308.102 297.642C290.087 309.295 272.017 320.855 254.008 332.516C224.65 351.526 195.311 370.565 166.001 389.656C161.218 392.772 156.676 392.554 152.002 389.549C114.508 365.442 77.0104 341.341 39.4967 317.268C28.6047 310.278 17.6663 303.367 6.731 296.452C2.15121 293.556 -0.0276978 289.906 0.000265697 283.763C0.258603 227.018 0.245117 170.271 0.074958 113.525C0.0426641 102.758 3.18464 95.1578 12.7117 89.4456C40.5878 72.7319 67.9995 55.1645 95.5309 37.8231C108 29.9693 120.319 21.8545 132.711 13.867C138.585 10.0808 144.508 6.37645 150.342 2.52353C156.242 -1.37265 161.729 -0.472427 167.408 3.27778C209.224 30.8885 251.093 58.4087 292.959 85.9354C296.515 88.2736 300.012 90.8064 303.807 92.6313C311.913 96.5296 314.523 103.699 314.563 112.137C314.717 144.765 314.646 177.394 314.659 210.632M65.4935 242.495C49.6381 232.346 33.7828 222.197 17.9874 212.086C17.9874 230.332 18.3403 248.134 17.8559 265.911C17.5623 276.687 18.8642 285.721 30.3544 289.212C31.0431 289.421 31.5482 290.223 32.2022 290.64C64.1053 310.972 96.0118 331.298 127.927 351.608C134.65 355.886 141.408 360.1 148.688 364.683C148.688 346.986 147.874 330.278 148.955 313.706C149.769 301.223 147.758 291.819 135.473 287.413C135.299 287.35 135.165 287.173 135.002 287.068C112.063 272.386 89.1227 257.706 65.4935 242.495M296.091 231.931C296.091 225.868 296.091 219.806 296.091 213.231C294.696 214.01 293.538 214.56 292.474 215.266C280.074 223.497 267.679 231.734 255.302 240.002C228.311 258.032 201.308 276.043 174.395 294.198C172.366 295.567 169.58 297.993 169.548 299.97C169.199 321.495 169.329 343.029 169.329 364.833C179.971 357.96 190.8 350.965 201.63 343.971C231.957 324.389 262.301 304.836 292.554 285.129C293.824 284.302 294.909 282.07 294.961 280.453C295.474 264.688 295.749 248.915 296.091 231.931M101.808 171.573C97.7043 169.046 93.0962 167.114 89.6056 163.863C83.0659 157.773 77.4482 162.037 72.2322 165.189C61.991 171.378 52.2161 178.414 42.2429 185.091C37.4371 188.309 32.6192 191.506 26.8412 195.356C68.414 222.015 108.821 247.926 148.685 273.49C148.685 250.182 148.732 227.089 148.561 203.998C148.552 202.707 146.99 201.036 145.747 200.208C131.421 190.667 117.016 181.254 101.808 171.573M223.547 171.722C205.264 182.956 186.982 194.19 168.704 205.422C168.704 228.017 168.704 250.823 168.704 274.252C180.45 266.828 191.838 259.9 202.965 252.539C223.805 238.752 244.519 224.756 265.228 210.755C271.524 206.498 277.677 202.001 283.777 197.44C284.616 196.812 285.352 194.274 285.15 194.129C280.218 190.59 275.221 187.132 270.09 183.917C264.807 180.608 259.082 178 254.061 174.319C245.157 167.79 236.675 160.426 225.828 170.463C225.41 170.849 224.818 171.029 223.547 171.722M50.6089 113.306C64.6223 104.366 78.6318 95.42 92.6499 86.4886C112.414 73.8961 132.179 61.3052 151.957 48.7362C155.94 46.2048 160.116 45.0384 164.43 47.812C197.649 69.1706 230.86 90.5443 264.044 111.964C267.434 114.152 270.375 114.826 273.991 112.05C277.912 109.04 282.373 106.804 286.903 104.045C285.142 103.033 283.595 102.248 282.147 101.296C242.855 75.4532 203.542 49.6461 164.339 23.6568C160.37 21.0257 157.391 21.1285 153.419 23.6515C123.331 42.762 93.1027 61.628 62.9355 80.6005C51.5758 87.7447 40.262 94.9689 28.6058 102.361C31.4771 104.307 33.7034 106.175 36.2085 107.434C40.64 109.662 45.2412 111.518 50.6089 113.306M209.714 153.469C211.738 151.601 213.762 149.734 215.497 148.132C214.083 147.381 212.659 146.738 211.342 145.907C201.163 139.489 191.01 133.026 180.84 126.593C174.792 122.768 167.909 119.874 162.912 114.896C158.362 110.364 154.752 112.829 151.061 114.206C147.456 115.551 144.37 118.417 141.044 120.596C127.438 129.512 113.828 138.421 99.4464 147.838C119.5 160.711 139.282 173.409 159.153 186.164C175.9 175.313 192.431 164.602 209.714 153.469M202.538 116.961C209.7 121.589 217.226 125.708 223.922 130.985C230.799 136.405 236.853 138.9 243.83 131.5C245.665 129.554 248.461 128.603 251.336 126.883C249.133 125.129 247.566 123.65 245.799 122.51C218.941 105.176 192.004 87.9749 165.231 70.4983C160.687 67.5325 157.087 67.7024 152.712 70.6542C142.758 77.3696 132.577 83.7176 122.459 90.1637C103.748 102.084 85.0155 113.968 65.8162 126.169C69.7039 128.718 73.3219 130.651 76.4353 133.249C79.8165 136.071 82.3852 135.907 86.0825 133.473C108.26 118.871 130.533 104.42 153.081 90.4628C155.679 88.855 160.918 89.3173 163.665 91.0399C176.599 99.1498 189.091 108.034 202.538 116.961M52.9989 154.658C56.5769 152.435 60.155 150.211 64.1797 147.71C48.6865 137.779 33.381 127.969 17.9193 118.058C17.9193 138.101 17.9193 157.186 17.9193 177.379C29.8498 169.581 41.025 162.276 52.9989 154.658M289.986 173.931C291.916 175.03 293.845 176.128 295.659 177.161C295.659 160.793 295.659 144.457 295.659 127.755C282.397 135.886 269.617 143.723 256.384 151.836C267.702 159.259 278.49 166.335 289.986 173.931Z';

  override connectedCallback(): void {
    super.connectedCallback();
    this.startLoop();
  }

  override disconnectedCallback(): void {
    this.stopLoop();
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    this.canvas = this.renderRoot?.querySelector('.particles-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      this.initOrbs();
      const ro = new ResizeObserver(() => this.resizeCanvas());
      ro.observe(this.canvas);
    }
  }

  /** Create initial pool of slow ambient orbs. */
  private initOrbs(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const count = 4;
    for (let i = 0; i < count; i++) {
      this.orbs.push(this.createOrb(w, h));
    }
  }

  private createOrb(w: number, h: number): Orb {
    /* Spawn from bottom half; 50% slower drift */
    return {
      x: Math.random() * w,
      y: h * 0.4 + Math.random() * h * 0.6,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -0.3 - Math.random() * 0.5,
      radius: 3 + Math.random() * 4,
      hue: 270 + Math.random() * 50,
      alpha: 0.12 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.scale(dpr, dpr);
    }
  }

  private startLoop(): void {
    const tick = (t: number) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min((t - this.lastTime) / 1000, 0.1);
      this.lastTime = t;
      this.updateParticles(dt);
      this.drawParticles();
    };
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Spawn a single ember with random parameters. Velocities in px/s for slow drift. */
  private spawnParticle(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const margin = 4;
    const x = margin + Math.random() * (w - 2 * margin);
    const y = h - margin - Math.random() * 6;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    /* Slow drift: ~1.5–4.5 px/s (50% slower again) */
    const speedPxPerSec = 1.5 + Math.random() * 3;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speedPxPerSec,
      vy: Math.sin(angle) * speedPxPerSec,
      radius: 0.8 + Math.random() * 1.2,
      life: 0,
      maxLife: 1.5 + Math.random() * 2.5,
      hue: 18 + Math.random() * 25,
      brightness: 0.7 + Math.random() * 0.3,
    });
  }

  private updateParticles(dt: number): void {
    /* 50% fewer particles + 50% slower: spawn less often */
    this.spawnAccum += dt;
    while (this.spawnAccum > 0.9) {
      this.spawnAccum -= 0.9 + Math.random() * 0.4;
      this.spawnParticle();
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
    /* Update orbs: respawn when they leave the view */
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.phase += dt * 0.6;
      if (o.y < -o.radius * 2 || o.y > h + o.radius * 2 || o.x < -o.radius * 2 || o.x > w + o.radius * 2) {
        this.orbs[i] = this.createOrb(w, h);
      }
    }
  }

  private drawParticles(): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    /* Draw ambient orbs first (behind embers) */
    for (const o of this.orbs) {
      const pulse = 0.85 + 0.2 * Math.sin(o.phase);
      const r = o.radius * pulse;
      const a = o.alpha * pulse;
      this.ctx.beginPath();
      this.ctx.arc(o.x, o.y, r * 2, 0, Math.PI * 2);
      const g = this.ctx.createRadialGradient(
        o.x - r * 0.3, o.y - r * 0.3, 0,
        o.x, o.y, r * 2
      );
      g.addColorStop(0, `hsla(${o.hue}, 70%, 60%, ${a})`);
      g.addColorStop(0.5, `hsla(${o.hue}, 60%, 50%, ${a * 0.4})`);
      g.addColorStop(1, 'transparent');
      this.ctx.fillStyle = g;
      this.ctx.fill();
    }
    /* Draw ember particles on top */
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t * t;
      const r = p.radius * (1 - t * 0.5);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      const g = this.ctx.createRadialGradient(
        p.x - r * 0.3, p.y - r * 0.3, 0,
        p.x, p.y, r * 2
      );
      g.addColorStop(0, `hsla(${p.hue}, 100%, ${p.brightness * 100}%, ${alpha * 0.95})`);
      g.addColorStop(0.5, `hsla(${p.hue}, 90%, 55%, ${alpha * 0.4})`);
      g.addColorStop(1, 'transparent');
      this.ctx.fillStyle = g;
      this.ctx.fill();
    }
  }

  override render() {
    return html`
      <div class="logo-wrap" aria-hidden="true">
        <canvas class="particles-canvas" aria-hidden="true"></canvas>
        <div class="logo-svg-wrap">
          <svg
            class="logo-svg"
            viewBox="0 0 108 117.54"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="SyndrDB"
          >
            <defs>
              <linearGradient id="syndrdb-logo-gradient-animated" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${COLORS.purpleDeep}" />
                <stop offset="50%" stop-color="${COLORS.purpleMid}" />
                <stop offset="100%" stop-color="${COLORS.purpleVibrant}" />
              </linearGradient>
              <!-- Shimmer band in path's coordinate system (path has transform); path y ~0–390 so band must sweep that range -->
              <linearGradient id="logo-shimmer-gradient" gradientUnits="userSpaceOnUse" x1="157" y1="-20" x2="157" y2="40">
                <stop offset="0" stop-color="white" stop-opacity="0" />
                <stop offset="0.35" stop-color="white" stop-opacity="0.22" />
                <stop offset="0.5" stop-color="white" stop-opacity="0.35" />
                <stop offset="0.65" stop-color="white" stop-opacity="0.22" />
                <stop offset="1" stop-color="white" stop-opacity="0" />
                <animate attributeName="y1" from="-20" to="410" dur="5s" repeatCount="indefinite" />
                <animate attributeName="y2" from="40" to="470" dur="5s" repeatCount="indefinite" />
              </linearGradient>
            </defs>
            <path
              fill="url(#syndrdb-logo-gradient-animated)"
              stroke="${COLORS.outline}"
              stroke-width="0.5"
              stroke-opacity="0.4"
              transform="matrix(0.225941422594142 0 0 0.225941422594142 18.4521707217587 14.4968601396847)"
              d="${this.logoPath}"
            />
            <!-- Shimmer overlay: same shape, only the moving gradient is visible on the fill -->
            <path
              fill="url(#logo-shimmer-gradient)"
              stroke="none"
              transform="matrix(0.225941422594142 0 0 0.225941422594142 18.4521707217587 14.4968601396847)"
              d="${this.logoPath}"
            />
          </svg>
        </div>
      </div>
    `;
  }
}
