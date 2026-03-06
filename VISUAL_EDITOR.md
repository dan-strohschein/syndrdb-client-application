# Schema Diagram Tool - Implementation Plan

## Context

SyndrDB client needs a visual diagram tool that renders bundles (document collections) and their relationships as an interactive graph. This gives users a spatial understanding of their database schema that complements the existing tree view and query editor. The tool will live as a third tab alongside SyndrQL/GraphQL in the query editor area.

**Phase 1**: Read-only visualization — load bundles + relationships, auto-layout, interactive exploration with neon/cyberpunk aesthetics.
**Phase 2**: Write-back — edit bundles/fields/relationships visually, generate DDL, execute against the database.

Both phases are designed together to avoid architectural rework, but implementation is Phase 1 first.

---

## Architecture Overview

```
Lit/src/components/schema-diagram/
├── schema-diagram.ts            # Lit component host (canvas lifecycle, Lit integration)
├── types.ts                     # All diagram-specific TypeScript interfaces
├── diagram-model.ts             # Graph data model (nodes, edges, positions, selection)
├── diagram-data-service.ts      # Fetches bundles+relationships, builds DiagramModel
├── diagram-renderer.ts          # Canvas 2D rendering pipeline (background, nodes, edges, effects)
├── diagram-viewport.ts          # Pan/zoom camera with world↔screen transforms + inertia
├── diagram-interaction.ts       # Mouse/keyboard event handling (pan, zoom, drag, select, hover)
├── diagram-layout-engine.ts     # Force-directed auto-layout algorithm
├── diagram-effects.ts           # Particle system, neon glow, animated grid, pulsing effects
└── diagram-edit-controller.ts   # (Phase 2) Modification tracking + DDL generation
```

---

## Phase 1: Read-Only Visualization

### Step 1: Types & Data Model (`types.ts`, `diagram-model.ts`)

Define core interfaces:

```typescript
interface DiagramNode {
  id: string;                    // bundle name
  bundleName: string;
  fields: DiagramField[];        // { name, type, isRequired, isUnique, isRelationshipField }
  indexes: DiagramIndex[];
  documentCount?: number;
  position: Vec2;                // world coordinates
  velocity: Vec2;                // for layout engine
  pinned: boolean;               // user-dragged = excluded from layout forces
  width: number; height: number; // computed from content
  hovered: boolean; selected: boolean;
  glowIntensity: number;         // 0-1, animated
}

interface DiagramEdge {
  id: string;                    // RelationshipID
  name: string;
  sourceNodeId: string; sourceField: string;
  targetNodeId: string; targetField: string;
  relationshipType: 'oneToOne' | 'oneToMany' | 'manyToMany';
  hovered: boolean; selected: boolean;
}
```

`DiagramModel` holds `Map<string, DiagramNode>`, `Map<string, DiagramEdge>`, and selection/hover state.

### Step 2: Data Service (`diagram-data-service.ts`)

Fetches schema from existing services and builds the model:

1. Call `connectionManager.getBundlesForDatabase(connectionId, databaseName)` for the bundle list
2. For each bundle, call `connectionManager.getBundleDetails(connectionId, bundleName)` for full field/relationship/index info
3. Aggregate relationships across all bundles, deduplicate by RelationshipID
4. Normalize relationship types (`"1toMany"` → `'oneToMany'`, etc.)
5. Build and return a `DiagramModel`

**Reuses**: `ConnectionManager` (`Lit/src/services/connection-manager.ts`), `BundleManager` (`Lit/src/services/bundle-manager.ts`), `Bundle`/`Relationship` types (`Lit/src/types/bundle.ts`)

### Step 3: Viewport (`diagram-viewport.ts`)

Camera system with:
- `worldToScreen(wx, wy)` / `screenToWorld(sx, sy)` transforms
- Smooth zoom centered on cursor position (`zoomAtPoint`)
- Pan inertia with friction decay per frame
- Zoom range: 0.1x to 5.0x
- `fitAll(nodes)` — calculate bounding box and set zoom/offset to show everything

### Step 4: Layout Engine (`diagram-layout-engine.ts`)

Force-directed layout:
- **Repulsion** between all node pairs (Coulomb's law, capped at max distance)
- **Attraction** along edges (Hooke's law, spring to ideal edge length ~250px)
- **Centering** force to prevent drift
- **Damping** (0.85) and max velocity cap
- Runs in batches (~50 iterations per animation frame) to stay responsive
- Converges when total kinetic energy drops below threshold
- User-dragged nodes are pinned and excluded from forces

### Step 5: Renderer (`diagram-renderer.ts`)

Canvas 2D rendering in layered order each frame:

1. **Background**: Dark fill (#0a0a12), animated dot grid with subtle pulse
2. **Edges**: Bezier curves with neon glow (`shadowBlur` + `shadowColor`), color-coded by type:
   - One-to-one: cyan (#22d3ee)
   - One-to-many: indigo (#818cf8) — matches the accent
   - Many-to-many: magenta (#f472b6)
   - Cardinality labels at endpoints (1, N, M)
   - Flowing particle effects along curves
3. **Nodes**: Glassmorphism cards:
   - Semi-transparent dark fill with subtle gradient
   - Neon border glow via `shadowBlur` (8-15px)
   - Header: bundle name (bold), document count badge
   - Field rows: name, type pill, constraint icons (key, snowflake)
   - Relationship fields highlighted with a colored dot matching their edge
4. **Selection overlay**: Intensified glow pulse on hovered/selected nodes
5. **HUD**: Minimap (bottom-right), zoom indicator

**Level-of-detail**: At zoom < 0.3, nodes render as colored rectangles (name only). At 0.3-0.7, name + field count. At > 0.7, full field details. Particles disabled below zoom 0.5.

**High-DPI**: Same pattern as code editor — `canvas.width = rect.width * dpr`, `ctx.scale(dpr, dpr)`.

### Step 6: Effects System (`diagram-effects.ts`)

- **Particle system**: Particles flow along edge bezier paths with velocity/lifetime. Max 1000 particles total, distributed across edges. Each particle is a small glowing dot.
- **Node glow pulse**: `glowIntensity` oscillates on hover/selection via sin wave
- **Grid animation**: Dot grid opacity subtly shifts over time, brightens near nodes (proximity)
- **Edge flow**: Animated dash offset creating "data flowing" illusion

All effects driven by `deltaTime` from the render loop for frame-rate independence.

### Step 7: Interaction Handler (`diagram-interaction.ts`)

State machine with modes: `idle`, `panning`, `nodeDragging`, `boxSelecting`

- **Pan**: Middle-click drag or Space+left-click. Updates viewport offset. On release, applies inertia.
- **Zoom**: Mouse wheel with smooth interpolation, centered on cursor
- **Select**: Left-click on node. Shift+click for multi-select.
- **Drag node**: Left-click+drag on node. Updates node position, pins it.
- **Hover**: Mousemove triggers hit-testing against node bounding rects and edge bezier curves (8px tolerance). Updates hover state for glow effects.
- **Fit all**: `Cmd/Ctrl+0`
- **Zoom in/out**: `Cmd/Ctrl+=` / `Cmd/Ctrl+-`
- **Deselect**: `Escape`

### Step 8: Lit Component Shell (`schema-diagram.ts`)

Lit component that:
- Creates and manages a `<canvas>` element
- Receives `connectionId` and `databaseName` as properties
- On `connectedCallback`: fetches data via data service, runs layout, starts render loop
- On `disconnectedCallback`: stops render loop, cleans up
- Handles ResizeObserver for canvas sizing (same pattern as code editor)
- Provides a toolbar overlay (HTML on top of canvas) for zoom controls, fit-all button, and Phase 2 edit mode toggle

### Step 9: Tab Integration

**Modify `query-editor-tab-container.ts`**:
- Extend `activeTab` type to `'syndrql' | 'graphql' | 'diagram'`
- Add third tab button with `fa-diagram-project` icon and "Schema Diagram" label
- Add a diagram container div (like the existing editor divs) that renders `<schema-diagram>` when active
- When switching to diagram, no query text management needed
- Pass `connectionId` (new property, forwarded from frame) and `databaseName` to the diagram component

**Modify `query-editor-frame.ts`**:
- Extend `activeQueryTab` type to include `'diagram'`
- When `activeQueryTab === 'diagram'`:
  - Hide the "Query Editor" header, execute button, save button
  - Hide the resize handle
  - Hide the results panel
  - Give the tab container full height
- Update breadcrumb to show "Schema Diagram" when diagram tab is active
- Forward `connectionId` to the tab container (it doesn't currently receive it)

---

## Phase 2: Write-Back (Architecture Prepared, Implemented Later)

### Edit Controller (`diagram-edit-controller.ts`)

Tracks a changeset of modifications:
- `createBundle(name, fields)` → uses `buildCreateBundleCommand()` from `Lit/src/domain/bundle-commands.ts`
- `updateBundle(existing, newData)` → uses `buildUpdateBundleCommands()`
- `addRelationship(rel)` → uses `buildAddRelationshipCommand()` from `Lit/src/tools/exporter/domain/ddl-script-generator.ts`
- `deleteBundle(name)` → generates `DROP BUNDLE "name";`

**UI additions for Phase 2**:
- Edit mode toggle in toolbar (read-only by default)
- Double-click node → inline field editor panel
- Right-click context menu → Add Bundle, Add Field, Add Relationship, Delete
- Drag from field port to another node → create relationship
- Floating changes bar: "N pending changes" | Preview DDL | Open in Editor | Execute | Discard
- "Open in Editor" switches to SyndrQL tab with the generated DDL pre-filled
- Execute runs DDL via `connectionManager.executeQueryWithContext()`, then refreshes the diagram

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `Lit/src/components/query-editor/query-editor-tab-container.ts` | Add `'diagram'` tab type, third tab button, `<schema-diagram>` container, accept `connectionId` property |
| `Lit/src/components/query-editor/query-editor-frame.ts` | Extend `activeQueryTab` type, conditionally hide editor/results split when diagram active, forward `connectionId` to tab container |

## Critical Files to Reuse (Read-Only Reference)

| File | What We Reuse |
|------|--------------|
| `Lit/src/services/connection-manager.ts` | `getBundlesForDatabase()`, `getBundleDetails()`, `executeQueryWithContext()` |
| `Lit/src/services/bundle-manager.ts` | `loadBundlesForDatabase()`, `bundlesLoaded` event |
| `Lit/src/types/bundle.ts` | `Bundle`, `Relationship`, `FieldDefinition`, `BundleIndex` interfaces |
| `Lit/src/domain/bundle-commands.ts` | `buildCreateBundleCommand()`, `buildUpdateBundleCommands()` (Phase 2) |
| `Lit/src/tools/exporter/domain/ddl-script-generator.ts` | `buildAddRelationshipCommand()` (Phase 2) |
| `Lit/src/components/code-editor/code-editor.ts` | Canvas lifecycle patterns (DPR scaling, ResizeObserver, render loop) |
| `Lit/src/lib/bundle-utils.ts` | `fieldDefinitionsToArray()`, `indexesToArray()` normalization |

---

## Implementation Order

1. **types.ts** — Interfaces (DiagramNode, DiagramEdge, Vec2, etc.)
2. **diagram-model.ts** — Model class with node/edge maps, selection state
3. **diagram-data-service.ts** — Fetch + transform bundle data into model
4. **diagram-viewport.ts** — Camera transforms, zoom, pan inertia
5. **diagram-layout-engine.ts** — Force-directed auto-layout
6. **diagram-effects.ts** — Particle system, glow pulse, grid animation
7. **diagram-renderer.ts** — Full canvas rendering pipeline
8. **diagram-interaction.ts** — Mouse/keyboard interaction state machine
9. **schema-diagram.ts** — Lit component shell tying everything together
10. **Tab integration** — Modify tab container + frame to add diagram tab
11. **diagram-edit-controller.ts** — Phase 2 modification tracking + DDL generation

---

## Verification

1. **Dev mode**: `cd Lit && npm run electron:dev`
2. Connect to a SyndrDB instance with a database containing multiple bundles with relationships
3. Open a query editor tab, click "Schema Diagram" tab
4. Verify: bundles appear as neon glassmorphism cards, relationships shown as glowing bezier curves
5. Test: pan (middle-click drag), zoom (scroll wheel), node drag, hover glow effects
6. Test: particle effects flowing along relationship edges
7. Test: level-of-detail rendering at different zoom levels
8. Test: fit-all (Cmd+0), switching between tabs preserves diagram state
9. Test: empty database shows appropriate empty state
