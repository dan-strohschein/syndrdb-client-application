# CLAUDE.md — SyndrDB Client Application

## Project Overview

SyndrDB Client is a desktop database management application for **SyndrDB**, a document-oriented database. Built with **Electron + Lit + TypeScript**, it provides connection management, a custom canvas-based code editor with SyndrQL language support, schema management (bundles, fields, relationships), and query execution with result visualization.

## Tech Stack

- **Electron 27** — Desktop shell (main process handles TCP sockets to SyndrDB)
- **Lit 3** — Web components (Shadow DOM disabled for Tailwind compatibility)
- **TypeScript 5.2** — Strict mode enabled
- **Vite 4.5** — Dev server & bundler
- **Tailwind CSS 3.3 + DaisyUI 5.1** — Styling
- **Vitest 1.1** — Testing (v8 coverage, 80% threshold)
- **fzstd** — Zstd decompression for SyndrDB protocol

## Project Structure

```
syndrdb-client-application/
├── Lit/                          # Electron app (renderer + main process)
│   ├── main.ts                   # Electron main process entry
│   ├── src/
│   │   ├── main.ts               # App root component (<app-root>)
│   │   ├── components/           # Lit web components
│   │   │   ├── code-editor/      # Canvas-based editor + language service
│   │   │   │   └── syndrQL-language-serviceV2/  # Grammar-driven language service
│   │   │   ├── connection-tree/  # Sidebar tree (connections > databases > bundles)
│   │   │   ├── bundle-modal/     # Bundle CRUD (fields, relationships, indexes tabs)
│   │   │   ├── query-editor/     # Tabbed query editor frame
│   │   │   ├── sidebar-panel.ts  # Left panel
│   │   │   ├── main-panel.ts     # Right panel (query tabs + results)
│   │   │   ├── navigation-bar.ts # Top menu bar
│   │   │   └── status-bar.ts     # Bottom status
│   │   ├── services/             # Business logic (ConnectionManager, BundleManager, etc.)
│   │   ├── drivers/              # SyndrDB driver (IPC bridge to Electron main)
│   │   ├── electron/             # Preload, main service, connection storage
│   │   ├── context/              # Lit Context providers (connection, query editor)
│   │   ├── domain/               # Domain models & SyndrQL command builders
│   │   ├── types/                # TypeScript type definitions
│   │   ├── config/               # YAML config loader & types
│   │   └── lib/                  # Utilities (base modal mixin, validation, etc.)
│   ├── package.json              # App dependencies & build scripts
│   ├── vite.config.ts
│   └── tailwind.config.js
├── tests/                        # Test suite
│   ├── unit/                     # 9 test files (language service focus)
│   ├── integration/
│   └── e2e/
├── config.yaml                   # Runtime config (cache sizes, debounce, thresholds)
├── vitest.config.ts              # Test config (aliases: @ → Lit/src, @tests → tests)
└── package.json                  # Root: vitest + @lit/context
```

## Architecture

```
UI Components (Lit)  →  Service Layer (Managers)  →  Driver (IPC)  →  Electron Main (TCP/SyndrDB)
```

- **Components** dispatch `CustomEvent`s upward; consume `@lit/context` for shared state
- **Services** are singletons: `ConnectionManager`, `BundleManager`, `DatabaseManager`
- **Driver** (`SyndrDBDriver`) sends queries via Electron IPC to the main process
- **Main process** manages TCP sockets, authentication, zstd decompression, and connection storage

### Code Editor Architecture

Canvas-based (not DOM). Subsystems in `Lit/src/components/code-editor/`:
- `virtual-dom.ts` — Line-based text model, cursor, selection, undo/redo
- `input-handler.ts` — Keyboard/mouse capture & command dispatch
- `rendering-pipeline.ts` — Canvas draw loop
- `viewport-manager.ts` — Visible line range
- `scroll-controller.ts` — Scroll offset & scrollbar
- `suggestion-controller.ts` — Autocomplete dropdown
- `error-popover-controller.ts` — Hover error display
- `statement-validation-controller.ts` — Debounced validation

### Language Service V2 (`syndrQL-language-serviceV2/`)

Grammar-driven pipeline: Tokenizer → StatementParser → GrammarEngine → ErrorAnalyzer/SuggestionEngine

- 4 grammar JSON files: DDL, DML, DOL, Migration
- `statement-cache.ts` — LRU cache with access-weighted eviction
- `document-context.ts` — Schema awareness (databases, bundles, fields)
- `context-expander.ts` — Pre-fetches schema info
- `cross-statement-validator.ts` — Inter-statement dependency checks

## Key Domain Concepts

- **Connection** — A connection to a SyndrDB server (host, port, credentials)
- **Database** — A database within a SyndrDB server
- **Bundle** — A document collection (like a table/collection) with field definitions
- **FieldDefinition** — Schema field: Name, Type (STRING/INT/DECIMAL/DATETIME/BOOLEAN), IsRequired, IsUnique, DefaultValue
- **Relationship** — Foreign key between bundles (0toMany, 1toMany, ManyToMany)
- **SyndrQL** — SyndrDB's query language (DDL: CREATE/ALTER BUNDLE; DML: FIND/INSERT/UPDATE/DELETE; DOL: USE DATABASE, SHOW BUNDLES)

## Common Commands

```bash
# Development
cd Lit && npm run electron:dev     # Start Electron + Vite dev server

# Build
cd Lit && npm run build            # Build renderer + main process
cd Lit && npm run dist             # Build + create platform installer

# Tests (run from root)
npm test                           # Run all tests
npm run test:coverage              # Tests with coverage report
cd Lit && npm run test:unit        # Unit tests only
```

## Build Details

- Renderer: Vite bundles to `Lit/dist/`
- Main process: Individual `tsc` compilations → `.cjs` files in `Lit/dist/`
- Electron loads Vite dev server (`:5173`) in dev mode, or `dist/index.html` in production
- Distribution output: `Lit/electron-dist/`

## Conventions

- **No Shadow DOM** — Components use `static shadowRootOptions` or `createRenderRoot()` returning `this` for global Tailwind access
- **CustomEvents** for component communication (e.g., `add-query-editor`, `open-modal`, `connection-changed`)
- **Singleton services** via `getInstance()` pattern
- **Modals** extend `BaseModalMixin` (`Lit/src/lib/base-modal-mixin.ts`)
- **Path aliases** in tests: `@` → `Lit/src`, `@tests` → `tests`
- **Two package.json files**: root (test tooling) and `Lit/` (app dependencies)
