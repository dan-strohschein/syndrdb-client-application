# SyndrDB Client vs. SSMS: Feature Gap Analysis & Production Readiness Roadmap

## Context

This analysis compares the SyndrDB client application against SQL Server Management Studio (SSMS) and modern alternatives (DataGrip, DBeaver, Azure Data Studio) to identify missing features, UX improvements, and a prioritized path to production readiness. The SyndrDB client already has a solid foundation — the goal is to identify what's needed to make it a tool developers choose over the command line.

---

## What SyndrDB Client Already Does Well

- **Multi-connection management** with secure credential storage, test-before-save, status tracking
- **Grammar-driven language service** with context-aware autocomplete (databases, bundles, fields, keywords)
- **Canvas-based code editor** with syntax highlighting, validation, error popovers
- **Tabbed query interface** with session persistence across restarts
- **Full schema CRUD** — databases, bundles (fields/relationships/indexes), users
- **Import/Export wizards** with multi-format support (CSV, JSON, Parquet, SQL)
- **Backup/Restore** with compression options
- **Server Profiler & Session Manager** tools
- **AI Assistant** for natural language to SyndrQL
- **Command Palette** (Ctrl+K) for fast access to all actions
- **Toast notifications**, animated modals, keyboard shortcuts throughout

---

## Feature Gap Analysis (Prioritized)

### CRITICAL — Blocks Production Adoption

| # | Feature | SSMS Equivalent | Current State | Impact |
|---|---------|----------------|---------------|--------|
| C1 | ~~**Find and Replace** (Ctrl+F / Ctrl+H)~~ | Find and Replace dialog | **DONE** (2026-02-26) | Users cannot search within queries. Blocks anyone writing multi-statement scripts |
| C2 | **Comment/Uncomment Toggle** (Ctrl+/) | Block Comment/Uncomment | Tokenizer recognizes comments but no toggle command exists | Core debugging workflow — commenting out statements is muscle memory |
| C3 | ~~**Results Grid View** with column sorting~~ | Results to Grid | **DONE** (2026-02-26) | Data browsing is impractical without tabular display. Every competitor has this |
| C4 | ~~**Multi-statement result sets**~~ | Separate result panes per statement | **DONE** (2026-02-26) | Forces users to execute one statement at a time — extremely frustrating |
| C5 | **Go to Line** (Ctrl+G) | Go to Line Number | Not implemented | When errors reference line numbers, users can't navigate to them |

### HIGH — Significantly Impacts Daily Productivity

| # | Feature | SSMS Equivalent | Current State | Better Modern Approach |
|---|---------|----------------|---------------|----------------------|
| H1 | **"Script As" from context menu** | Right-click → Script As → CREATE/ALTER/DROP | DDL generator exists in `ddl-script-generator.ts` but only used by export wizard | Expose existing DDL generator through tree context menu → opens new query tab. DataGrip does this with one click |
| H2 | **Code Snippets / Templates** | Code Snippets, Template Explorer | `SuggestionKind.SNIPPET` enum exists but no snippet definitions or expansion logic | VS Code-style snippets with tab stops (`SELECT $1 FROM $2 WHERE $3`) are superior to SSMS templates |
| H3 | **Object Properties Panel** | Right-click → Properties | Bundle details available but only viewable through edit modal | DataGrip-style inspector panel (non-modal, read-only by default, edit button to switch modes) |
| H4 | ~~**Resizable Editor/Results Splitter**~~ | Draggable splitter | **DONE** (2026-02-26) | Drag-to-resize splitter with 20-80% clamp, double-click to reset, localStorage persistence |
| H5 | **Execution Plan Viewer** | Display Estimated/Actual Execution Plan | Not implemented (requires SyndrDB server EXPLAIN support) | Graphical plan display when server supports it |
| H6 | **Object Search** across all databases | Object Explorer Search (Ctrl+D) | Sidebar filter only searches connection names | DataGrip's Ctrl+N global fuzzy search across all connections/databases/bundles/fields |

### MEDIUM — Enhances Professional Use

| # | Feature | Notes |
|---|---------|-------|
| M1 | **Query formatting / auto-indent** | Standardize keyword casing, indentation, clause alignment |
| M2 | **Code folding** per statement | Fold/unfold multi-statement scripts at statement boundaries |
| M3 | **Inline document editing** from results | Click a result document → JSON editor → generates UPDATE statement |
| M4 | **Visual permission matrix** | Users vs. permissions grid (builds on existing GRANT/REVOKE grammar support) |
| M5 | **Block/column selection** (Alt+Shift+Arrow) | Useful for editing multiple WHERE clauses |
| M6 | **DDL Preview** in schema modals | Show generated SyndrQL at bottom of bundle/database modals before executing. `bundle-commands.ts` already generates these — just display them |
| M7 | **Client statistics** per query | Network latency, parse time, render time (beyond current execution time display) |
| M8 | **Refresh individual tree nodes** | Right-click → Refresh on any tree node instead of full tree refresh |

### LOW — Nice-to-Have / Differentiation

| # | Feature | Notes |
|---|---------|-------|
| L1 | **Visual schema/relationship diagram** | Canvas or SVG ERD showing bundles as nodes, relationships as edges |
| L2 | **Schema compare** between databases | Diff engine + visual comparison |
| L3 | **Split editor** (side-by-side queries) | VS Code-style horizontal/vertical split |
| L4 | **Scheduled operations** | Cron-like backup/maintenance scheduling |
| L5 | **Bookmarks** in editor | Mark and jump between locations in long scripts |
| L6 | **Source control integration** | Git integration for saved queries |
| L7 | **Multi-server queries** | Execute same query across multiple connections |

---

## UX/UI Recommendations for Database & Schema Management

### 1. Replace Edit Modals with Inspector Panel/Tabs

**Current:** Right-click bundle → Edit → blocking modal with tabs (Fields, Relationships, Indexes).

**Recommended:** Clicking a bundle opens a non-modal "Bundle Inspector" as a new tab type in `main-panel.ts`. The inspector shows all metadata in read-only mode. An "Edit" button switches to editable mode. Changes generate SyndrQL DDL preview at the bottom before executing.

**Why:** Modals block the entire UI. Tabs allow side-by-side comparison, non-blocking workflows, and are the pattern used by DataGrip, DBeaver, and Azure Data Studio.

**Implementation:** Add tab types to `main-panel.ts` — currently `'query' | 'profiler' | 'session-manager'`, add `'bundle-editor' | 'database-inspector' | 'user-manager'`.

### 2. DDL Preview Before Execution

Show the generated SyndrQL statements at the bottom of all schema modals. `buildCreateBundleCommand()` and `buildUpdateBundleCommands()` in `bundle-commands.ts` already generate these. Users learn SyndrQL syntax and can verify exactly what executes.

### 3. Rich Results Table for Document Data

For a document database, the flat SSMS grid isn't ideal. Better approach (MongoDB Compass pattern):
- Top-level fields as sortable columns
- Nested objects shown as expandable `{...}` cells
- Arrays shown with count badge, click to expand
- Missing fields displayed as NULL with visual distinction
- Virtual scrolling for large result sets (reuse `viewport-manager.ts` pattern)
- Filter/search within results
- Copy with headers, export selection

### 4. Contextual Command Palette

Extend the command palette to be context-aware:
- When a tree node is focused, show "Script As", "Delete", "Edit" for that node
- Add parameterized commands: "Create Bundle [name] in [database]"
- Show recent/frequent commands at top
- This replaces deep menu navigation for most actions

### 5. Keyboard-First Panel Navigation

- `Ctrl+1` focus sidebar, `Ctrl+2` focus editor, `Ctrl+3` focus results
- `Ctrl+Shift+T` reopen closed tab (like browser)
- `Ctrl+Tab` quick tab switcher with preview popup

---

## Phased Production Readiness Roadmap

### Phase 1: Essential (Must Ship)

Core editor and results features that block serious adoption.

| # | Feature | Effort | Key Files |
|---|---------|--------|-----------|
| 1.1 | ~~Find and Replace~~ | Large | **DONE** (2026-02-26) — `find-replace-controller.ts`, `code-editor.ts`, `input-handler.ts` |
| 1.2 | ~~Comment/Uncomment toggle (Ctrl+/)~~ | Small | **DONE** (2026-02-26) |
| 1.3 | ~~Go to Line (Ctrl+G)~~ | Small | **DONE** (2026-02-26) |
| 1.4 | ~~Results Grid View with sortable columns~~ | Large | **DONE** (2026-02-26) — `results-grid.ts` with 3-state sort, type-aware cells, click-to-copy |
| 1.5 | ~~Multi-statement result sets~~ | Medium | **DONE** (2026-02-26) — `query-editor-frame.ts` statement tabs with summary view |
| 1.6 | ~~Resizable editor/results splitter~~ | Medium | **DONE** (2026-02-26) — drag handle with localStorage persistence in `query-editor-frame.ts` |
| 1.7 | ~~"Script As" from context menu~~ | Medium | **DONE** (2026-02-26) |
| 1.8 | ~~Copy results with headers~~ | Small | **DONE** (2026-02-26) |
| 1.9 | ~~DDL Preview in schema modals~~ | Small | **DONE** (2026-02-26) |

### Phase 2: Professional Feature Parity (Post-Launch)

Features that make the tool competitive with DataGrip/DBeaver.

| # | Feature | Effort |
|---|---------|--------|
| 2.1 | Code snippets with tab-stop expansion | Large |
| 2.2 | Global object search across databases | Medium |
| 2.3 | Bundle Inspector panel (non-modal) | Large |
| 2.4 | Query formatting / auto-indent | Medium |
| 2.5 | Code folding per statement | Medium |
| 2.6 | Inline document editing from results | Large |
| 2.7 | Visual permission matrix | Medium |
| 2.8 | Enhanced profiler (expensive queries, resource waits) | Medium |
| 2.9 | ~~Refresh individual tree nodes~~ | Small | **DONE** (2026-02-26) |

### Phase 3: Differentiation

Features that make SyndrDB Client stand out.

| # | Feature | Effort |
|---|---------|--------|
| 3.1 | Visual relationship/schema diagram | Large |
| 3.2 | Execution plan viewer (requires server EXPLAIN) | Large |
| 3.3 | Split editor (side-by-side queries) | Medium |
| 3.4 | Schema compare between databases | Large |
| 3.5 | Inline AI suggestions (Copilot-style ghost text) | Large |
| 3.6 | Scheduled operations | Large |

---

## Quick Wins (High Impact, Low Effort)

All quick wins shipped on 2026-02-26:

1. **Comment toggle** (Ctrl+/) — `input-handler.ts` + `virtual-dom.ts` + `code-editor.ts` -- DONE
2. **Go to Line** (Ctrl+G) — overlay dialog in `code-editor.ts` -- DONE
3. **DDL Preview** in modals — collapsible section in `bundle-modal.ts` + `database-modal.ts` -- DONE
4. **Copy with headers** — "Copy with Headers" button in `query-editor-frame.ts` results area -- DONE
5. **"Script As"** — "Script As CREATE" / "Script As DROP" in `tree-context-menu.ts` for bundles + databases -- DONE
6. **Refresh tree node** — "Refresh" in context menu for connection, database, and bundle nodes -- DONE
