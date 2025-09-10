# SyndrDB Client Application

A modern database management tool built with Electron, Lit web components, and Tailwind CSS.

## Features

- 🖥️ **Desktop Application** - Native Electron app for macOS, Windows, and Linux
- 🎨 **Modern UI** - Dark theme optimized for database work
- ⚡ **Fast & Lightweight** - Built with Lit web components
- 🎯 **Database Focused** - Designed specifically for SyndrDB management
- 📱 **Responsive Layout** - Two-column layout with resizable panels

## Tech Stack

- **Electron** - Desktop app framework
- **Lit** - Lightweight web components
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety and modern JavaScript features
- **Vite** - Fast build tool and dev server

## Project Structure

```
├── src/
│   ├── components/          # Lit web components
│   │   ├── sidebar-panel.ts # Database connection tree
│   │   ├── main-panel.ts    # Query editor and results
│   │   └── connection-tree.ts # Connection tree component
│   ├── index.html          # Main HTML template
│   ├── main.ts             # App entry point
│   └── styles.css          # Tailwind CSS and custom styles
├── main.ts                 # Electron main process
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run electron:dev
   ```

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run electron` - Run Electron app (production)
- `npm run electron:dev` - Run Electron app (development)
- `npm run dist` - Create distributable packages

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ SyndrDB Client                                          │
├─────────────────┬───────────────────────────────────────┤
│ Connections     │ Query Editor                          │
│ ├── Local DB ●  │ ┌─────────────────────────────────────┐│
│ ├── Remote DB ○ │ │ SELECT * FROM tables;               ││
│ │   ├── Tables  │ │                                     ││
│ │   ├── Views   │ │                                     ││
│ │   └── Schema  │ └─────────────────────────────────────┘│
│                 │ Results                               │
│                 │ ┌─────────────────────────────────────┐│
│                 │ │ Table Name │ Schema │ Rows │ Size   ││
│                 │ │ users      │ public │ 1234 │ 45KB   ││
│                 │ │ orders     │ public │ 5678 │ 123KB  ││
│                 │ └─────────────────────────────────────┘│
└─────────────────┴───────────────────────────────────────┘
```

## Components

### SidebarPanel
- Database connection management
- Tree view of database objects
- Connection status indicators

### MainPanel  
- SQL query editor with syntax highlighting
- Query execution toolbar
- Results table with sorting and filtering
- Export functionality

### ConnectionTree
- Hierarchical view of database objects
- Expandable/collapsible tree nodes
- Visual connection status

## Database Features (Planned)

- [ ] Multi-database connection support
- [ ] SQL syntax highlighting
- [ ] Query auto-completion
- [ ] Table data editing
- [ ] Schema visualization
- [ ] Export/import functionality
- [ ] Query history
- [ ] Saved queries/snippets

## Building for Distribution

```bash
# Build the app
npm run build

# Create distributable packages
npm run dist
```

This will create platform-specific packages in the `electron-dist/` directory.

## License

MIT License - see LICENSE file for details.
