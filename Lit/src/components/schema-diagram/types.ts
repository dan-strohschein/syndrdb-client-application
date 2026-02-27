/** Vec2 — simple 2D vector / point. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounding rectangle. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Camera state for the viewport (pan + zoom). */
export interface Camera {
  offset: Vec2;   // world-space translation
  zoom: number;   // scale factor (0.1 – 5.0)
}

/** Neon/cyberpunk color constants used by the renderer. */
export interface DiagramTheme {
  background: string;
  gridDot: string;
  gridDotPulse: string;
  nodeBackground: string;
  nodeBorder: string;
  nodeHeaderBackground: string;
  nodeHeaderText: string;
  nodeFieldText: string;
  nodeFieldTypeText: string;
  nodeGlowSelected: string;
  nodeGlowHovered: string;
  edgeOneToOne: string;
  edgeOneToMany: string;
  edgeManyToMany: string;
  edgeGlow: string;
  selectionBox: string;
  selectionBoxFill: string;
  minimapBackground: string;
  minimapViewport: string;
  zoomIndicatorText: string;
  particleColor: string;
  loadingText: string;
  emptyStateText: string;
}

export const DEFAULT_DIAGRAM_THEME: DiagramTheme = {
  background: '#0f0f1a',
  gridDot: '#6366f1',
  gridDotPulse: '#818cf8',
  nodeBackground: 'rgba(15,15,30,0.85)',
  nodeBorder: 'rgba(99,102,241,0.5)',
  nodeHeaderBackground: 'rgba(99,102,241,0.15)',
  nodeHeaderText: '#e0e7ff',
  nodeFieldText: '#c7d2fe',
  nodeFieldTypeText: '#818cf8',
  nodeGlowSelected: 'rgba(99,102,241,0.6)',
  nodeGlowHovered: 'rgba(99,102,241,0.35)',
  edgeOneToOne: '#22d3ee',
  edgeOneToMany: '#818cf8',
  edgeManyToMany: '#f472b6',
  edgeGlow: 'rgba(99,102,241,0.3)',
  selectionBox: '#6366f1',
  selectionBoxFill: 'rgba(99,102,241,0.1)',
  minimapBackground: 'rgba(15,15,30,0.9)',
  minimapViewport: 'rgba(99,102,241,0.4)',
  zoomIndicatorText: 'rgba(199,210,254,0.5)',
  particleColor: '#a5b4fc',
  loadingText: '#818cf8',
  emptyStateText: 'rgba(199,210,254,0.4)',
};

/** A single field within a diagram node. */
export interface DiagramField {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isRelationshipSource: boolean;
  isRelationshipTarget: boolean;
}

/** A node in the schema diagram (represents a bundle). */
export interface DiagramNode {
  id: string;
  bundleName: string;
  fields: DiagramField[];
  indexes: string[];
  position: Vec2;
  velocity: Vec2;
  pinned: boolean;
  size: Vec2;
  selected: boolean;
  hovered: boolean;
  documentCount?: number;
}

export type RelationshipCardinality = '1:1' | '1:N' | 'M:N';

/** An edge in the schema diagram (represents a relationship). */
export interface DiagramEdge {
  id: string;
  name: string;
  sourceNodeId: string;
  sourceField: string;
  targetNodeId: string;
  targetField: string;
  relationshipType: RelationshipCardinality;
}

/** Interaction state machine modes. */
export type InteractionMode = 'idle' | 'panning' | 'nodeDragging' | 'boxSelecting';

/** Full interaction state. */
export interface InteractionState {
  mode: InteractionMode;
  dragStartWorld: Vec2 | null;
  dragStartScreen: Vec2 | null;
  dragNodeId: string | null;
  panVelocity: Vec2;
  boxSelectStart: Vec2 | null;
  boxSelectEnd: Vec2 | null;
  lastMouseMoves: Array<{ pos: Vec2; time: number }>;
  spaceHeld: boolean;
}

/** A particle that flows along an edge path. */
export interface Particle {
  t: number;         // parameter 0..1 along the Bezier
  speed: number;     // units/second
  edgeId: string;
  opacity: number;
}

/** Level of detail for nodes based on zoom level. */
export type LODLevel = 'minimal' | 'summary' | 'full';
