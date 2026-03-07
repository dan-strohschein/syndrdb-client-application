<div align="center">

# ◈ SyndrDB Client ◈

### `The Database IDE for SyndrDB`

<br/>

[![Electron](https://img.shields.io/badge/Electron-27-%2347848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Lit](https://img.shields.io/badge/Lit-3-%23324FFF?style=for-the-badge&logo=lit&logoColor=white)](https://lit.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-%233178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-4.5-%23646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.3-%2306B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<br/>

![macOS](https://img.shields.io/badge/macOS-%23000000?style=flat-square&logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-%230078D6?style=flat-square&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-%23FCC624?style=flat-square&logo=linux&logoColor=black)

<br/>

**A professional desktop database management tool for [SyndrDB](https://syndrdb.com) — the document-oriented database.**
<br/>
Full-featured IDE experience with a custom canvas-based editor, grammar-driven language intelligence,
<br/>
interactive schema visualization, real-time server monitoring, and an extensible plugin architecture.

<br/>

```
  ╔══════════════════════════════════════════════════════════════════════╗
  ║                                                                      ║
  ║     ███████╗██╗   ██╗███╗   ██╗██████╗ ██████╗ ██████╗ ██████╗      ║
  ║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗     ║
  ║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║  ██║██████╔╝██║  ██║██████╔╝     ║
  ║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║  ██║██╔══██╗██║  ██║██╔══██╗     ║
  ║     ███████║   ██║   ██║ ╚████║██████╔╝██║  ██║██████╔╝██████╔╝     ║
  ║     ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═════╝      ║
  ║                                                                      ║
  ╚══════════════════════════════════════════════════════════════════════╝
```

</div>

---

<br/>

## ⬡ Table of Contents

<table>
<tr>
<td width="33%" valign="top">

**Core Features**
- [🔌 Connection Management](#-connection-management)
- [✏️ Code Editor](#%EF%B8%8F-code-editor)
- [🧠 Language Service](#-syndrql-language-service)
- [◆ GraphQL Editor](#-graphql-query-editor)
- [📊 Query Results](#-query-results)

</td>
<td width="33%" valign="top">

**Advanced Tools**
- [🔷 Schema Diagram](#-schema-diagram)
- [📜 Query History](#-query-history)
- [📦 Bundle Management](#-bundle-collection-management)
- [🗄️ Database Admin](#%EF%B8%8F-database-administration)
- [📡 Server Profiler](#-server-profiler)

</td>
<td width="33%" valign="top">

**Platform & Ecosystem**
- [👁️ Session Manager](#%EF%B8%8F-session-manager)
- [🤖 AI Assistant](#-ai-assistant)
- [🔄 Import & Export](#-import--export-tools)
- [💾 Backup & Restore](#-backup--restore)
- [🧩 Plugin System](#-plugin-system)
- [⌨️ Command Palette](#%EF%B8%8F-command-palette)
- [🎨 UI & Theming](#-ui--theming)

</td>
</tr>
</table>

<table>
<tr>
<td width="50%" valign="top">

**Architecture & Development**
- [🏛️ Architecture](#%EF%B8%8F-architecture)
- [📁 Project Structure](#-project-structure)

</td>
<td width="50%" valign="top">

**Getting Started**
- [🚀 Quick Start](#-getting-started)
- [⚙️ Configuration](#%EF%B8%8F-configuration)
- [📦 Distribution](#-building-for-distribution)
- [🧪 Testing](#-testing)

</td>
</tr>
</table>

---

<br/>

<div align="center">

## `━━━━━━━━━━ FEATURES ━━━━━━━━━━`

</div>

<br/>

## 🔌 Connection Management

> *Manage multiple simultaneous connections to SyndrDB servers with full lifecycle support.*

<table>
<tr>
<td>

| Capability | Details |
|:---|:---|
| 🟢 **Connect** | Modal with name, hostname, port (`1776`), database, credentials |
| 🧪 **Test** | Validate connectivity before saving |
| 💾 **Persist** | Connections saved to disk via Electron secure storage |
| ✏️ **Edit / Delete** | Modify or remove saved connections |
| 🌲 **Tree Explorer** | Hierarchical view: connections → databases → bundles → fields |
| 📋 **Context Menus** | Right-click any node for contextual actions |
| ⌨️ **Keyboard Nav** | Arrow keys to traverse, Enter to expand/collapse |
| 🔴🟡🟢 **Status Dots** | Live indicators: connected, connecting, error, disconnected |
| ♻️ **Connection Pool** | Efficient managed pool for resource reuse |

</td>
</tr>
</table>

<br/>

## ✏️ Code Editor

> *A fully custom **canvas-based code editor** built from scratch — no Monaco, no CodeMirror.*
> *Designed specifically for SyndrQL with 60fps rendering performance.*

<table>
<tr>
<td width="50%">

**⬡ Rendering Engine**
| Component | Function |
|:---|:---|
| 🖼️ Canvas Pipeline | Direct HTML5 Canvas rendering at 60fps |
| 📄 Virtual Document | Line-based text model with efficient ops |
| 👆 Multi-Selection | Click, shift-click, drag selections |
| ↩️ Undo / Redo | Full history with cursor restoration |
| 🔢 Line Numbers | Dedicated gutter rendering |
| 📜 Scroll Controller | Smooth scrolling + custom scrollbar |
| 🔤 Font Metrics | Pixel-perfect Geist Mono measurement |

</td>
<td width="50%">

**⬡ Intelligence**
| Component | Function |
|:---|:---|
| 🎨 Syntax Highlighting | Real-time token-based colorization |
| 💡 Autocomplete | Context-aware keyword/schema suggestions |
| 🔴 Error Squiggles | Inline underlines + hover popovers |
| 🔍 Find & Replace | Regex, case-sensitive, replace all |
| 🪟 Viewport Manager | Only visible lines rendered |
| ✅ Statement Validation | Debounced real-time validation |
| ⚙️ Configurable | Each feature toggleable via `config.yaml` |

</td>
</tr>
</table>

<br/>

## 🧠 SyndrQL Language Service

> *Grammar-driven language intelligence engine — IDE-level support for the SyndrQL query language.*

```
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌─────────────────┐
│  Tokenizer  │───▶│ Statement Parser │───▶│ Grammar Engine │───▶│ Error Analyzer  │
│  (lexical)  │    │  (boundaries)    │    │   (4 JSONs)    │    │ Suggestion Eng. │
└─────────────┘    └──────────────────┘    └────────────────┘    └─────────────────┘
```

<table>
<tr>
<td width="50%">

**⬡ Grammar Definitions**

| Grammar | Statements |
|:---|:---|
| 📐 **DDL** | `CREATE BUNDLE` · `ALTER BUNDLE` · `DROP BUNDLE` |
| 📝 **DML** | `FIND` · `INSERT` · `UPDATE` · `DELETE` |
| 🔧 **DOL** | `USE DATABASE` · `SHOW BUNDLES` · `SHOW DATABASES` |
| 🔀 **Migration** | Schema migration statements |

</td>
<td width="50%">

**⬡ Advanced Capabilities**

| Feature | Details |
|:---|:---|
| 📖 Document Context | Schema-aware completions from live metadata |
| ⚡ Context Expander | Pre-fetches schema during idle time |
| 🗃️ Statement Cache | LRU with access-weighted eviction (5MB) |
| 💿 Cache Persistence | Background worker saves to disk (30s interval) |
| 🔗 Cross-Statement | Inter-statement dependency validation |
| ⏰ Staleness UI | Warns when schema metadata is outdated |

</td>
</tr>
</table>

<br/>

## ◆ GraphQL Query Editor

> *Dedicated editor tab for querying SyndrDB's GraphQL endpoint.*

- 🎨 **GraphQL tokenizer** — syntax highlighting for queries, mutations, and fragments
- 💡 **Schema-aware suggestions** — autocomplete from the server's GraphQL schema
- ✅ **Real-time validation** — error checking against the live schema
- 🧩 **Independent service** — own token types and rendering pipeline

<br/>

## 🔷 Schema Diagram

> *Interactive, canvas-rendered entity-relationship diagram for visualizing database schemas.*

<table>
<tr>
<td>

| Feature | Description |
|:---|:---|
| 🧲 **Auto-Layout** | Force-directed graph arrangement |
| 🃏 **Bundle Cards** | Name, fields, types, and constraints |
| 🔗 **Relationship Lines** | 0-to-Many · 1-to-Many · Many-to-Many |
| 🖱️ **Pan & Zoom** | Drag to pan, scroll to zoom |
| ✨ **Visual Effects** | Hover highlights, selection glow, animations |
| 🔄 **Live Data** | Auto-updates when schema changes |
| 📑 **Tab Integration** | Opens alongside query editors |

</td>
</tr>
</table>

<br/>

## 📊 Query Results

> *View and interact with query execution results.*

- 📋 **Results Grid** — auto-extracted columns (union of all document keys)
- 🔼🔽 **Three-state sort** — none → ascending → descending → none
- 📎 **Cell click to copy** — click any value to copy to clipboard
- 🌳 **JSON Tree View** — expandable/collapsible nested documents
- ⏱️ **Execution metrics** — document count + timing in the status bar
- 🏷️ **Result type icons** — data results, success confirmations, errors

<br/>

## 📜 Query History

> *Searchable log of every executed query with full metadata.*

- 🕐 **Timestamped entries** — execution time, connection, database context
- 🔍 **Full-text search** — filter by query content
- ♻️ **One-click reuse** — open in new tab or copy to clipboard
- 🧹 **Clear history** — purge when needed
- 💿 **Persistent** — survives app restarts

<br/>

## 📦 Bundle (Collection) Management

> *Full CRUD for bundles (SyndrDB's document collections) and their schemas.*

<table>
<tr>
<td width="33%" align="center">

**📋 Fields Tab**

Add, edit, remove fields
<br/>
`STRING` · `INT` · `DECIMAL`
<br/>
`DATETIME` · `BOOLEAN`
<br/>
IsRequired · IsUnique · Default

</td>
<td width="33%" align="center">

**🔗 Relationships Tab**

Foreign keys between bundles
<br/>
`0toMany` · `1toMany`
<br/>
`ManyToMany`
<br/>
Dedicated field editor

</td>
<td width="33%" align="center">

**⚡ Indexes Tab**

Create & manage indexes
<br/>
Hash · B-Tree
<br/>
Performance optimization
<br/>
DDL preview

</td>
</tr>
</table>

<br/>

## 🗄️ Database Administration

- 🏗️ **Create database** — modal for new databases on a connected server
- 🗑️ **Delete database** — confirmation modal with safety warnings
- 👤 **User management** — create/manage users with roles from the connection tree
- 🔀 **USE DATABASE** — switch context via tree or SyndrQL commands

<br/>

## 📡 Server Profiler

> *Real-time server performance monitoring in a dedicated tab.*

| Feature | Details |
|:---|:---|
| 🔌 Connection Picker | Use existing connection or new credentials |
| 📈 Live Metrics | Memory, CPU, connections, query stats |
| ⏱️ Auto-Refresh | Configurable interval (default: 10s) |
| ⏸️ Pause/Resume | Toggle metric collection |
| 🔒 Dedicated Connection | Won't interfere with queries |
| ⌨️ Shortcut | `Cmd/Ctrl + Shift + P` |

<br/>

## 👁️ Session Manager

> *Monitor and inspect active client sessions on a SyndrDB server.*

| Feature | Details |
|:---|:---|
| 📋 Session List | All active sessions with client info |
| 🔎 Detail View | Drill into session activity |
| 📡 Live Monitoring | Real-time snapshots (1s interval) |
| ⚠️ Staleness Indicator | Warns when data may be outdated |
| 🔒 Hidden Connection | Doesn't appear in sidebar |

<br/>

## 🤖 AI Assistant

> *Natural language → SyndrQL translation powered by an AI backend.*

| Feature | Details |
|:---|:---|
| 💬 Natural Language | Describe what you want in plain English |
| 🧠 Schema-Aware | Uses current DB context for accurate generation |
| 📥 Insert or Copy | Push generated SyndrQL into editor or clipboard |
| ✅ Validation | Shows whether generated query is valid |
| ⚙️ Configurable | Custom endpoint and timeout |
| 📐 Collapsible | Integrated panel in the query editor frame |

<br/>

## 🔄 Import & Export Tools

> *Wizard-driven data import and export with a plugin-based architecture.*

<table>
<tr>
<td width="50%">

**📥 Import Wizard** `Cmd/Ctrl+Shift+I`
- CSV parser with configurable delimiters
- Header detection
- Field mapping & type coercion
- Preview before execution

</td>
<td width="50%">

**📤 Export Wizard** `Cmd/Ctrl+Shift+E`
- JSON exporter (formatted)
- SQL script exporter
- Plugin-based engine
- Dynamic plugin loading

</td>
</tr>
</table>

<br/>

## 💾 Backup & Restore

> *Database-level backup and restore operations.*

- 🗜️ **Compression options** — gzip · zstd · none
- 📋 **Index inclusion** — optionally include indexes in backup
- 🔒 **Database locking** — lock during backup for consistency
- 📬 **Toast feedback** — progress and completion notifications

<br/>

## 🧩 Plugin System

> *Extensible architecture for adding custom functionality.*

```
Plugin Manifest
├── 📂 Sidebar Sections     ──→  Custom panels in the sidebar
├── 📑 Tab Types             ──→  New tab content types
├── 📋 Menu Items            ──→  Entries in the Tools menu
├── 🔍 Command Palette       ──→  Searchable commands
├── 📊 Status Bar Widgets    ──→  Right-side status displays
└── 🔧 Toolbar Actions       ──→  Quick-action buttons
```

- **Plugin Registry** — discovers, loads, and manages lifecycle
- **Sandboxed API** — scoped access to connections and data
- **Error Boundary** — plugin tab host catches failures gracefully
- **Hot-loadable** — discovered and activated at startup

<br/>

## ⌨️ Command Palette

> *Quick access to every command — `Cmd/Ctrl + K` to open.*

<table>
<tr>
<td width="50%">

| Command | Shortcut |
|:---|:---|
| 🔌 New Connection | `Ctrl+N` |
| 📂 Open Saved Connection | `Ctrl+O` |
| 📝 New Query Tab | — |
| ▶️ Execute Query | `Ctrl+Enter` |
| 💾 Save Query | `Ctrl+S` |
| 🤖 Toggle AI Assistant | — |
| 📜 Query History | — |

</td>
<td width="50%">

| Command | Shortcut |
|:---|:---|
| 📡 Open Server Profiler | `Ctrl+Shift+P` |
| 👁️ Open Session Manager | — |
| 📥 Open Import Tool | `Ctrl+Shift+I` |
| 📤 Open Export Tool | `Ctrl+Shift+E` |
| 💾 Backup Database | — |
| 🔄 Restore Database | — |
| 🏗️ Create Database | — |
| 📦 Create Bundle | — |

</td>
</tr>
</table>

<br/>

## 🎨 UI & Theming

> *A polished dark-first interface with an extensive design system.*

<table>
<tr>
<td width="50%">

**◈ Color System**

| Layer | Value |
|:---|:---|
| 🟣 Accent | Electric Indigo `#6366F1` |
| ⬛ Surface 0 | `#121212` |
| ⬛ Surface 1 | `#1a1a1a` |
| ◼️ Surface 2 | `#232323` |
| ◼️ Surface 3 | `#2d2d2d` |
| ◻️ Surface 4 | `#353535` |
| 🟡 Gold | `#EAB308` |
| 🟢 Success | `#059669` |
| 🔴 Error | `#DC2626` |
| 🟠 Warning | `#D97706` |
| 🔵 Info | `#2563EB` |

</td>
<td width="50%">

**◈ Animations & Effects**

| Effect | Duration |
|:---|:---|
| Modal enter (scale + fade) | `200ms` |
| Modal exit | `150ms` |
| Toast slide-up | `300ms` |
| Toast exit | `200ms` |
| Tab open (slide) | `200ms` |
| Tab close | `150ms` |
| Context menu pop-in | `120ms` |
| Chevron rotation | `150ms` |
| Shimmer loading | `1.5s ∞` |
| Button pulse | `300ms` |
| Spinner | `600ms ∞` |
| Progress bar | `1.5s ∞` |

</td>
</tr>
</table>

**Additional UI features:**
- 🎭 **27 DaisyUI themes** — dark, synthwave, dracula, cyberpunk, and more
- 🔤 **Geist typography** — Sans for UI, Mono for code
- 🔥 **Animated logo** — ember particle effects + shimmer
- 📐 **Resizable panels** — draggable sidebar/main divider
- 🍞 **Toast system** — replaces all `alert()`/`confirm()` calls
- 🗂️ **Elevation shadows** — 4 levels for visual hierarchy
- 🎯 **30+ icon colors** — deep saturated palette for every action type

---

<br/>

<div align="center">

## `━━━━━━━━━━ ARCHITECTURE ━━━━━━━━━━`

</div>

<br/>

## 🏛️ Architecture

### ◈ High-Level Data Flow

```
 ╔═══════════════════════════════════════════════════════════════════════════╗
 ║                          RENDERER PROCESS                                ║
 ║                                                                          ║
 ║   ┌───────────────┐     ┌────────────────┐     ┌─────────────────────┐  ║
 ║   │ UI Components │────▶│ Service Layer  │────▶│   Driver (IPC)      │  ║
 ║   │    (Lit 3)    │◀────│  (Singletons)  │◀────│  (SyndrDBDriver)    │  ║
 ║   └───────┬───────┘     └───────┬────────┘     └──────────┬──────────┘  ║
 ║           │                     │                          │             ║
 ║      CustomEvents          Lit Context               Electron IPC       ║
 ║       (bubbling)          (@lit/context)            (contextBridge)      ║
 ║                                                          │              ║
 ╠══════════════════════════════════════════════════════════╪══════════════╣
 ║                          MAIN PROCESS                    │              ║
 ║                                                          ▼              ║
 ║   ┌────────────────────────────────────────────────────────────────┐    ║
 ║   │                   syndrdb-main-service.ts                      │    ║
 ║   │   ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐   │    ║
 ║   │   │ TCP Sockets  │  │ Zstd Decomp   │  │ Authentication   │   │    ║
 ║   │   │ (to SyndrDB) │  │   (fzstd)     │  │                  │   │    ║
 ║   │   └──────────────┘  └───────────────┘  └──────────────────┘   │    ║
 ║   └────────────────────────────────────────────────────────────────┘    ║
 ║                                                                         ║
 ║   ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────┐    ║
 ║   │ Connection      │ │ Export / Import │ │  Plugin Loader        │    ║
 ║   │ Storage         │ │ Engines         │ │  (visual plugins)     │    ║
 ║   │ (secure disk)   │ │ (plugin-based)  │ │                       │    ║
 ║   └─────────────────┘ └─────────────────┘ └───────────────────────┘    ║
 ╚═════════════════════════════════════════════════════════════════════════╝
                                  │
                                  ▼
                       ┌────────────────────┐
                       │   SyndrDB Server   │
                       │    (TCP :1776)      │
                       └────────────────────┘
```

<br/>

### ◈ Component Architecture

```
 ╔═════════════════════════════════════════════════════════════════════════════════╗
 ║ <app-root>                                                                     ║
 ║ ┌─────────────────────────────────────────────────────────────────────────────┐ ║
 ║ │ <navigation-bar>   File │ Edit │ Database │ Tools │ Settings │ AI │ Help   │ ║
 ║ ├─────────────────────────────────────────────────────────────────────────────┤ ║
 ║ │ <toolbar>   [▶ Execute]  [＋ New Tab]  [💾 Save]  [🔍 Find]  ...          │ ║
 ║ ├──────────────────────┬──────────────────────────────────────────────────────┤ ║
 ║ │ <sidebar-panel>      │ <main-panel>                                        │ ║
 ║ │                      │ ┌────────────────────────────────────────────────┐   │ ║
 ║ │ <connection-tree>    │ │ Tab Bar  [Query 1] [Query 2] [Profiler] [＋]  │   │ ║
 ║ │ ├─ 🟢 Connection 1  │ ├────────────────────────────────────────────────┤   │ ║
 ║ │ │  ├─ 🗄️ database_1 │ │ <query-editor-frame>                          │   │ ║
 ║ │ │  │  ├─ 📦 Bundles  │ │  ┌──────────────────────────────────────────┐ │   │ ║
 ║ │ │  │  │  ├─ users    │ │  │ Sub-tabs: [SyndrQL] [GraphQL] [Diagram] │ │   │ ║
 ║ │ │  │  │  └─ orders   │ │  ├──────────────────────────────────────────┤ │   │ ║
 ║ │ │  │  ├─ 🔑 Indexes  │ │  │                                          │ │   │ ║
 ║ │ │  │  └─ 👤 Users    │ │  │   <code-editor>  (canvas-based)          │ │   │ ║
 ║ │ │  └─ 🗄️ database_2 │ │  │    ├─ virtual-dom                        │ │   │ ║
 ║ │ └─ 🔴 Connection 2  │ │  │    ├─ rendering-pipeline                 │ │   │ ║
 ║ │                      │ │  │    ├─ input-handler                      │ │   │ ║
 ║ │                      │ │  │    ├─ suggestion-controller              │ │   │ ║
 ║ │                      │ │  │    ├─ find-replace-controller            │ │   │ ║
 ║ │                      │ │  │    ├─ statement-validation-controller    │ │   │ ║
 ║ │                      │ │  │    └─ language-service-v2                │ │   │ ║
 ║ │                      │ │  │                                          │ │   │ ║
 ║ │                      │ │  └──────────────────────────────────────────┘ │   │ ║
 ║ │                      │ │  <ai-assistant-panel> (collapsible)  ◀── 🤖  │   │ ║
 ║ │                      │ ├──────────────────────────────────────────────┤ │   │ ║
 ║ │                      │ │ Results: <results-grid> │ <json-tree-view>  │ │   │ ║
 ║ │                      │ └────────────────────────────────────────────────┘   │ ║
 ║ ├──────────────────────┴──────────────────────────────────────────────────────┤ ║
 ║ │ <status-bar>  🟢 Connection │ 🗄️ DB │ ⏱️ Time │ 📊 Rows │ ⏰ Schema Age │ ║
 ║ └─────────────────────────────────────────────────────────────────────────────┘ ║
 ║                                                                                 ║
 ║ ┌─ Overlay Components ───────────────────────────────────────────────────────┐  ║
 ║ │ <command-palette>  <query-history-panel>  <toast-notification>             │  ║
 ║ │ <connection-modal>  <database-modal>  <bundle-modal>  <user-modal>        │  ║
 ║ │ <backup-modal>  <restore-modal>  <import-wizard>  <export-wizard>         │  ║
 ║ │ <about-modal>  <error-modal>  <confirmation-modal>  <delete-*-modal>      │  ║
 ║ └───────────────────────────────────────────────────────────────────────────┘   ║
 ╚═════════════════════════════════════════════════════════════════════════════════╝
```

<br/>

### ◈ Code Editor Subsystems

```
 ╔══════════════════════════════════════════════════════════════════════╗
 ║                         <code-editor>                               ║
 ║                                                                     ║
 ║   ┌──────────────────┐       ┌────────────────────────────────┐    ║
 ║   │  input-handler    │──────▶│  virtual-dom (document model)  │    ║
 ║   │  (keyboard/mouse) │       │  lines[] · cursor · selections │    ║
 ║   └────────┬─────────┘       │  undo/redo history              │    ║
 ║            │                  └──────────────┬─────────────────┘    ║
 ║            │                                 │                      ║
 ║            ▼                                 ▼                      ║
 ║   ┌──────────────────┐       ┌────────────────────────────────┐    ║
 ║   │  viewport-mgr    │       │  rendering-pipeline            │    ║
 ║   │  (visible range)  │──────▶│  (canvas draw loop)            │    ║
 ║   └──────────────────┘       │  text · cursors · selections   │    ║
 ║                               │  line numbers · decorations    │    ║
 ║   ┌──────────────────┐       └────────────────────────────────┘    ║
 ║   │  scroll-controller│                                             ║
 ║   │  (offset/scrollbar)│      ┌────────────────────────────────┐    ║
 ║   └──────────────────┘       │  language-service-v2            │    ║
 ║                               │  ┌──────────────────────────┐  │    ║
 ║   ┌──────────────────┐       │  │ ◆ tokenizer              │  │    ║
 ║   │  suggestion-ctrl  │◀─────│  │ ◆ statement-parser        │  │    ║
 ║   │  (autocomplete)   │      │  │ ◆ grammar-engine (4 JSON) │  │    ║
 ║   └──────────────────┘       │  │ ◆ error-analyzer          │  │    ║
 ║                               │  │ ◆ suggestion-engine       │  │    ║
 ║   ┌──────────────────┐       │  │ ◆ document-context        │  │    ║
 ║   │  find-replace-ctrl│      │  │ ◆ cross-stmt-validator    │  │    ║
 ║   │  (search/replace) │      │  │ ◆ statement-cache (LRU)   │  │    ║
 ║   └──────────────────┘       │  └──────────────────────────┘  │    ║
 ║                               └────────────────────────────────┘    ║
 ║   ┌──────────────────┐       ┌────────────────────────────────┐    ║
 ║   │  stmt-validation  │       │  error-popover-controller     │    ║
 ║   │  (debounced)      │       │  (hover error display)        │    ║
 ║   └──────────────────┘       └────────────────────────────────┘    ║
 ║                                                                     ║
 ║   ┌──────────────────┐       ┌────────────────────────────────┐    ║
 ║   │  text-renderer    │       │  font-metrics                  │    ║
 ║   │  (token coloring)  │      │  (char measurement)            │    ║
 ║   └──────────────────┘       └────────────────────────────────┘    ║
 ╚══════════════════════════════════════════════════════════════════════╝
```

<br/>

### ◈ Service Layer

| Service | Responsibility |
|:---|:---|
| `ConnectionManager` | Connection lifecycle — connect, disconnect, status tracking, event emission |
| `DatabaseManager` | Database CRUD — create, drop, list databases on a connection |
| `BundleManager` | Bundle CRUD — create, alter, drop bundles; manage fields, relationships, indexes |
| `QueryHistoryService` | Record, search, and persist executed queries |
| `ConnectionPool` | Manage pooled TCP connections for efficient reuse |
| `ConnectionSchemaAPI` | Fetch schema metadata (databases, bundles, fields) for a connection |
| `AIAssistantService` | Proxy natural language prompts to the AI backend for SyndrQL generation |
| `PluginRegistry` | Discover, load, and manage visual plugin lifecycle |
| `PluginAPIBuilder` | Construct sandboxed API objects for plugins |
| `SchemaServerAPI` | Low-level schema queries against the SyndrDB server |

<br/>

### ◈ Communication Patterns

```
  Components ──[ CustomEvents (bubbling) ]──▶ Components
  Components ──[ direct method calls ]──────▶ Services (singletons)
  Components ◀──[ @lit/context providers ]──▶ Shared State
  Renderer   ──[ Electron IPC ]─────────────▶ Main Process
  Main       ──[ TCP sockets + zstd ]───────▶ SyndrDB Server
```

---

<br/>

## 📁 Project Structure

<details>
<summary><b>Click to expand full project tree</b></summary>

```
syndrdb-client-application/
├── Lit/                              # Electron application
│   ├── main.ts                       # Electron main process entry
│   ├── src/
│   │   ├── main.ts                   # App root component (<app-root>)
│   │   ├── components/
│   │   │   ├── code-editor/          # ✏️ Canvas-based code editor
│   │   │   │   ├── virtual-dom.ts            # Line-based document model
│   │   │   │   ├── input-handler.ts          # Keyboard/mouse capture
│   │   │   │   ├── rendering-pipeline.ts     # Canvas draw loop
│   │   │   │   ├── viewport-manager.ts       # Visible line range
│   │   │   │   ├── scroll-controller.ts      # Scroll offset & scrollbar
│   │   │   │   ├── suggestion-controller.ts  # Autocomplete dropdown
│   │   │   │   ├── find-replace-controller.ts# Search & replace
│   │   │   │   ├── error-popover-controller.ts # Hover error display
│   │   │   │   ├── statement-validation-controller.ts # Debounced validation
│   │   │   │   ├── text-renderer.ts          # Token colorization
│   │   │   │   ├── font-metrics.ts           # Character measurement
│   │   │   │   ├── caret-management.ts       # Cursor rendering
│   │   │   │   ├── line-numbers/             # Gutter line numbers
│   │   │   │   ├── suggestion-complete/      # Suggestion dropdown & service
│   │   │   │   ├── error-pop-up/             # Error popover component
│   │   │   │   ├── syndrQL-language-serviceV2/  # 🧠 SyndrQL intelligence
│   │   │   │   │   ├── tokenizer.ts          # Lexical analysis
│   │   │   │   │   ├── statement-parser.ts   # Statement boundary detection
│   │   │   │   │   ├── grammar_engine.ts     # Grammar validation
│   │   │   │   │   ├── error-analyzer.ts     # Error message generation
│   │   │   │   │   ├── suggestion-engine.ts  # Autocomplete generation
│   │   │   │   │   ├── document-context.ts   # Schema awareness
│   │   │   │   │   ├── context-expander.ts   # Schema pre-fetching
│   │   │   │   │   ├── statement-cache.ts    # LRU cache
│   │   │   │   │   ├── cache-persistence.ts  # Disk persistence
│   │   │   │   │   ├── cross-statement-validator.ts # Inter-statement checks
│   │   │   │   │   ├── schema-validator.ts   # Grammar file validation
│   │   │   │   │   └── grammars/             # DDL, DML, DOL, Migration JSON
│   │   │   │   └── graphql-language-service/ # ◆ GraphQL language support
│   │   │   ├── connection-tree/      # 🌲 Sidebar connection explorer
│   │   │   │   ├── connection-tree.ts        # Main tree component
│   │   │   │   ├── tree-data-service.ts      # Data fetching & state
│   │   │   │   ├── tree-context-menu.ts      # Right-click menu logic
│   │   │   │   ├── database-node-renderer.ts # Database subtree rendering
│   │   │   │   └── user-management-renderer.ts # User node rendering
│   │   │   ├── bundle-modal/         # 📦 Bundle CRUD
│   │   │   ├── query-editor/         # 📝 Tabbed editor frame
│   │   │   ├── results-grid/         # 📊 Sortable results display
│   │   │   ├── schema-diagram/       # 🔷 Canvas ER diagram
│   │   │   │   ├── schema-diagram.ts         # Main component
│   │   │   │   ├── diagram-model.ts          # Data model
│   │   │   │   ├── diagram-renderer.ts       # Canvas rendering
│   │   │   │   ├── diagram-layout-engine.ts  # Force-directed layout
│   │   │   │   ├── diagram-viewport.ts       # Pan/zoom
│   │   │   │   ├── diagram-interaction.ts    # Mouse/keyboard interaction
│   │   │   │   ├── diagram-effects.ts        # Visual effects
│   │   │   │   ├── diagram-data-service.ts   # Schema data fetching
│   │   │   │   └── diagram-edit-controller.ts# Edit operations
│   │   │   ├── server-profiler/      # 📡 Server metrics monitoring
│   │   │   ├── session-manager/      # 👁️ Active session monitoring
│   │   │   ├── ai-assistant/         # 🤖 Natural language → SyndrQL
│   │   │   ├── json-tree/            # 🌳 Expandable JSON tree
│   │   │   ├── json-tree-view/       # 🌳 Alternative JSON rendering
│   │   │   ├── dragndrop/            # 🖱️ Drag-and-drop primitives
│   │   │   ├── navigation-bar.ts     # 📋 Top menu bar
│   │   │   ├── sidebar-panel.ts      # ◀️ Left panel container
│   │   │   ├── main-panel.ts         # ▶️ Right panel (tabs + results + AI)
│   │   │   ├── toolbar.ts            # 🔧 Action toolbar
│   │   │   ├── status-bar.ts         # 📊 Bottom status bar
│   │   │   ├── command-palette.ts    # ⌨️ Cmd+K command overlay
│   │   │   ├── query-history-panel.ts# 📜 Query history overlay
│   │   │   ├── toast-notification.ts # 🍞 Non-blocking toasts
│   │   │   ├── context-menu.ts       # 📋 Reusable context menu
│   │   │   ├── confirmation-modal.ts # ⚠️ Destructive action confirmation
│   │   │   ├── connection-modal.ts   # 🔌 Connection create/edit
│   │   │   ├── database-modal.ts     # 🗄️ Database creation
│   │   │   ├── user-modal.ts         # 👤 User management
│   │   │   ├── backup-modal.ts       # 💾 Database backup
│   │   │   ├── restore-modal.ts      # 🔄 Database restore
│   │   │   ├── about-modal.ts        # ℹ️ About/splash screen
│   │   │   ├── error-modal.ts        # ❌ Error display
│   │   │   ├── animated-logo.ts      # 🔥 Animated SyndrDB logo
│   │   │   └── plugin-tab-host.ts    # 🧩 Plugin error boundary
│   │   ├── services/                 # ⚙️ Business logic singletons
│   │   ├── drivers/                  # 🔌 SyndrDB driver (IPC bridge)
│   │   ├── context/                  # 🔗 Lit Context providers
│   │   ├── domain/                   # 📐 Domain models & SyndrQL builders
│   │   ├── tools/
│   │   │   ├── importer/             # 📥 Import wizard UI
│   │   │   └── exporter/             # 📤 Export wizard UI
│   │   ├── types/                    # 🏷️ TypeScript type definitions
│   │   ├── config/                   # ⚙️ YAML config loader
│   │   ├── lib/                      # 🔧 Utilities
│   │   └── electron/                 # ⚡ Main process services
│   │       ├── syndrdb-main-service.ts      # TCP socket management
│   │       ├── preload.ts                   # Context bridge
│   │       ├── connection-storage-service.ts# Persistent storage
│   │       ├── secure-storage.ts            # Encrypted credentials
│   │       ├── ai-assistant-main-service.ts # AI backend proxy
│   │       ├── export-execution-engine.ts   # Export pipeline
│   │       ├── exporter-plugin-loader.ts    # Export plugin discovery
│   │       ├── import-execution-engine.ts   # Import pipeline
│   │       ├── importer-plugin-loader.ts    # Import plugin discovery
│   │       ├── visual-plugin-loader.ts      # UI plugin discovery
│   │       ├── exporters/                   # Built-in: JSON, SQL
│   │       └── parsers/                     # Built-in: CSV
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── tests/
│   ├── unit/                         # Unit tests
│   ├── integration/
│   └── e2e/
├── config.yaml                       # Runtime configuration
├── vitest.config.ts                  # Test config (path aliases)
└── package.json                      # Root: test tooling
```

</details>

---

<br/>

<div align="center">

## `━━━━━━━━━━ GETTING STARTED ━━━━━━━━━━`

</div>

<br/>

## 🚀 Getting Started

### Prerequisites

![Node.js](https://img.shields.io/badge/Node.js-18%2B-%23339933?style=flat-square&logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-latest-%23CB3837?style=flat-square&logo=npm&logoColor=white)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd syndrdb-client-application

# Install root dependencies (test tooling)
npm install

# Install application dependencies
cd Lit && npm install
```

### Development

```bash
# Start the full development environment (Vite dev server + Electron)
cd Lit && npm run electron:dev
```

> This launches Vite on `http://localhost:5173` with HMR, and the Electron main process connects to it.

### Available Scripts

<table>
<tr>
<td width="50%">

**From `Lit/` directory:**

| Script | Description |
|:---|:---|
| `npm run electron:dev` | Dev mode (Electron + Vite) |
| `npm run dev` | Vite dev server only |
| `npm run build` | Build renderer + main process |
| `npm run dist` | Build + platform installer |
| `npm run electron` | Run built app (production) |

</td>
<td width="50%">

**From project root:**

| Script | Description |
|:---|:---|
| `npm test` | Run all tests (Vitest) |
| `npm run test:coverage` | Tests + v8 coverage (80%) |

</td>
</tr>
</table>

---

<br/>

## ⚙️ Configuration

Runtime behavior is controlled via `config.yaml`:

```yaml
environment: production                # 'development' enables grammar hot-reload

languageService:
  statementCacheBufferSize: 5242880    # 5MB cache
  cacheAccessWeightFactor: 0.7         # Eviction: frequency vs recency (0.0–1.0)
  cachePersistenceInterval: 30000      # Save interval (30s)
  suggestionPrefetchEnabled: true      # Pre-generate suggestions on idle
  suggestionPrefetchDelay: 50          # Delay before pre-fetch (ms)
  validationDebounceDelay: 1000        # Delay before validation (ms)

editor:
  syntaxHighlightingEnabled: true
  autoSuggestionsEnabled: true
  errorHighlightingEnabled: true

context:
  displaySchemaAge: true               # Show schema age in status bar
  schemaAgeWarningThreshold: 30        # Warning threshold (minutes)
```

---

<br/>

## 📦 Building for Distribution

```bash
cd Lit && npm run build && npm run dist
```

| Platform | Format | Output |
|:---|:---|:---|
| ![macOS](https://img.shields.io/badge/-macOS-%23000000?style=flat-square&logo=apple&logoColor=white) | DMG | `Lit/electron-dist/` |
| ![Windows](https://img.shields.io/badge/-Windows-%230078D6?style=flat-square&logo=windows&logoColor=white) | NSIS | `Lit/electron-dist/` |
| ![Linux](https://img.shields.io/badge/-Linux-%23FCC624?style=flat-square&logo=linux&logoColor=black) | AppImage | `Lit/electron-dist/` |

---

<br/>

## 🧪 Testing

Tests use [Vitest](https://vitest.dev/) with v8 coverage and an 80% threshold.

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage report
cd Lit && npm run test:unit # Unit tests only
cd Lit && npm run test:watch # Watch mode
```

**Path aliases:** `@` → `Lit/src` · `@tests` → `tests`

---

<br/>

## ⌨️ Keyboard Shortcuts

<div align="center">

| Shortcut | Action | | Shortcut | Action |
|:---|:---|:---|:---|:---|
| `⌘/Ctrl K` | Command palette | | `⌘/Ctrl Shift P` | Server profiler |
| `⌘/Ctrl N` | New connection | | `⌘/Ctrl Shift I` | Import tool |
| `⌘/Ctrl O` | Open file | | `⌘/Ctrl Shift E` | Export tool |
| `⌘/Ctrl S` | Save file | | `⌘/Ctrl Z` | Undo |
| `⌘/Ctrl F` | Find & replace | | `⌘/Ctrl Shift Z` | Redo |
| `⌘/Ctrl Enter` | Execute query | | | |

</div>

---

<br/>

## 🛠️ Tech Stack

<div align="center">

[![Electron](https://img.shields.io/badge/Electron_27-Desktop_Shell-%2347848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Lit](https://img.shields.io/badge/Lit_3-Web_Components-%23324FFF?style=for-the-badge&logo=lit&logoColor=white)](https://lit.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.2-Strict_Mode-%233178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite_4.5-Build_Tool-%23646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

[![Tailwind CSS](https://img.shields.io/badge/Tailwind_3.3-Styling-%2306B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![DaisyUI](https://img.shields.io/badge/DaisyUI_5.1-Themes-%235A0EF8?style=for-the-badge&logo=daisyui&logoColor=white)](https://daisyui.com/)
[![Vitest](https://img.shields.io/badge/Vitest_1.1-Testing-%236E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Geist](https://img.shields.io/badge/Geist_1.5-Typography-%23000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/font)

</div>

---

<br/>

<div align="center">

**◈ SyndrDB Client ◈**

MIT License — see [LICENSE](LICENSE) for details.

<br/>

`Built with precision for the SyndrDB ecosystem.`

</div>
