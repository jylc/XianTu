# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**仙途 (XianTu)** is an AI-driven immersive cultivation (xianxia) text adventure game built with Vue 3 + TypeScript.

- **Author**: 千夜 (qianye60) | GitHub: qianye60 | Bilibili: 477576651
- **License**: CC BY-NC-SA 4.0 (commercial use requires authorization)
- **Tech Stack**: Vue 3, TypeScript, Pinia, Webpack, Tailwind CSS
- **Deployment**: Can run as standalone web app or integrated with SillyTavern

## Development Commands

```bash
# Build (requires Node.js >= 18)
pnpm build           # Production build (outputs to dist/)
pnpm build:single    # Single file build (inline JS into HTML for SillyTavern)
pnpm watch           # Development build with watch mode (auto-rebuild on changes)
pnpm serve           # Development server (http://localhost:8080 with hot reload)

# Code Quality
pnpm lint            # ESLint with auto-fix
pnpm lint:check      # ESLint check only (no auto-fix)
pnpm type-check      # TypeScript type checking
```

### Backend (Optional)

Backend provides account/save APIs with SQLite (default) or PostgreSQL:

```bash
# From project root
cp server/.env.example server/.env
python -m pip install -r server/requirements.txt
uvicorn server.main:app --reload --port 12345
```

## Code Style

Configuration in `.editorconfig`, `.prettierrc.json`, and `eslint.config.ts`:
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Omitted
- **Line width**: 100 characters
- **End of line**: LF
- **TypeScript strict mode**: Enabled

ESLint rules of note:
- `@typescript-eslint/no-unused-vars`: warn
- `@typescript-eslint/no-explicit-any`: warn
- Vue 3 SFC with `<script setup lang="ts">`

## Build Configuration

### Build Modes

1. **Production** (`pnpm build`): Outputs `dist/XianTu.js` + `index.html`
2. **Watch** (`pnpm watch`): Outputs `dist/index.html` with inlined JS, auto-rebuilds on changes
3. **Single File** (`pnpm build:single`): Single HTML file with everything inlined for SillyTavern

### Webpack Externals

The following libraries are treated as external dependencies (must be available globally):

| External | Global Variable | Source |
|----------|----------------|--------|
| jquery | `$` | SillyTavern / CDN |
| lodash | `_` | SillyTavern / CDN |
| toastr | `toastr` | SillyTavern / CDN |
| vue | `Vue` | SillyTavern / CDN |
| vue-router | `VueRouter` | SillyTavern / CDN |
| yaml | `YAML` | SillyTavern / CDN |
| zod | `z` | SillyTavern / CDN |

This allows the game to run in SillyTavern's environment without duplicating dependencies.

### Development Server

The dev server runs on port 8080 with:
- Hot module replacement
- Proxy for `/api` requests to `https://back.ddct.top`
- Full host access allowed (for iframe/embed scenarios)

## Architecture

### Dual Mode System

The game supports two runtime modes with different API calling patterns:

1. **Tavern Mode** (`tavern`): Main API calls go through SillyTavern's `TavernHelper`. Auxiliary features (memory summary, text optimization, etc.) can use independent APIs.
2. **Web Mode** (`web`): All features use configured custom APIs.

Environment detection: `src/utils/tavern.ts` - `isTavernEnv()` checks for SillyTavern integration.

### AI System Architecture

**Core AI Flow** (`src/utils/AIBidirectionalSystem.ts`):
```
User Input → Prompt Assembly → AI Service → Response Parsing → Command Execution → State Update
```

Key components:
- **Prompt Assembly**: `src/utils/prompts/promptAssembler.ts` - Assembles system prompts with game state
- **AI Service**: `src/services/aiService.ts` - Unified API interface for multiple providers
- **Command Parsing**: Extracts `tavern_commands` JSON blocks from AI responses
- **State Updates**: Executes commands to modify game state

**AI Service Providers** (configured in `apiManagementStore`):
- OpenAI, Claude, Gemini, DeepSeek, 智谱AI (ZhipuGLM), SiliconFlow (embedding)

### State Management (Pinia Stores)

Located in `src/stores/`:

| Store | Purpose |
|-------|---------|
| `gameStateStore` | Main game state: character, attributes, inventory, relationships, world info, sect system, memory, game time |
| `characterStore` | Character list management, save data loading/saving to IndexedDB |
| `apiManagementStore` | API configuration for different usage types |
| `uiStore` | UI state (panels, modals, loading states) |
| `actionQueueStore` | Action queue for sequential command execution |
| `characterCreationStore` | Character creation flow state |

### Data Persistence

- **IndexedDB**: Save data storage (character profiles, save slots)
- **localStorage**: Settings, API configs, memory settings
- **Save Format**: V3 schema with structured data (`src/types/saveSchemaV3.ts`)

Key migration: `src/utils/saveMigration.ts` - Handles legacy save data conversion.

### Key Game Systems

| System | Location |
|--------|----------|
| Memory System | `src/utils/memoryUtils.ts`, memory tiers (short/medium/long-term) |
| Cultivation | `src/utils/realmUtils.ts`, technique progress, skill mastery |
| Sect System | `src/utils/sectSystemFactory.ts`, member management, sect wars |
| World/Region Maps | `src/types/gameMap.ts`, `src/components/dashboard/GameMapPanel.vue` |
| Event System | Random events, world events based on game time |
| Relationship Network | NPC-NPC relationships, visualization via `react-force-graph-2d` |
| Inventory/Equipment | Currency system (`src/utils/currencySystem.ts`), item quality |

### Prompt Engineering

Prompts are organized by feature in `src/utils/prompts/`:
- `promptAssembler.ts` - Main prompt assembly with game state injection
- `tasks/` - Feature-specific prompts (crafting, game elements, data repair)
- `cot/cotCore.ts` - Chain-of-thought reasoning prompts

## Important Patterns

### State Updates

When updating game state, always use `gameStateStore.updateState(path, value)`:
- This ensures Vue 3 reactivity through Pinia's `$patch`
- For nested updates, uses lodash `set` on a cloned object before patching

### API Usage Types

Different game features can use different APIs:
- `main` - Main game flow
- `memory_summary` - Memory summarization
- `embedding` - Vector/semantic search
- `text_optimization` - Text refinement
- `world_generation` - World/map generation
- `event_generation` - Random events
- `sect_generation` - Sect content
- `crafting` - Alchemy/item crafting

### Tavern Helper Integration

When in Tavern mode, the game accesses `TavernHelper` for:
- Character card data (`getCharData()`)
- Chat messages (`getChatHistory()`)
- API calls (`Generate()`, `GenerateRaw()`)
- Event system (`eventOn`, `eventOff`)

### Save Data Flow

Loading: `characterStore.loadSaveData()` → `gameStateStore.loadFromSaveData()`
Saving: `gameStateStore.toSaveData()` → `characterStore.saveCurrentGame()`

Auto-save triggers:
- After AI conversation completion
- Time-based saves (configurable interval)
- Manual save via Save panel

## TypeScript Configuration

- Path alias: `@/*` maps to `src/*`
- Strict mode enabled
- Vue 3 components with `<script setup lang="ts">`

## Component Structure

- **Views** (`src/views/`): Top-level pages (GameView, CharacterCreation, ModeSelection, etc.)
- **Dashboard Components** (`src/components/dashboard/`): In-game panels (MainGamePanel, SkillsPanel, InventoryPanel, etc.)
- **Common Components** (`src/components/common/`): Shared UI (modals, toasts, progress bars, etc.)
- **Character Creation** (`src/components/character-creation/`): Multi-step character creation flow

## Route Structure

Uses `createMemoryHistory()` (not browser history) for iframe compatibility.

Key routes:
- `/` - Mode selection (Offline/Online/Workshop)
- `/game` - Main game view with nested child routes for panels
- `/creation` - Character creation
- `/prompts` - Standalone prompt management (no game data load required)

## Testing & Debugging

- localStorage debug flags: `dad_debug_tavern` → enable Tavern detection logging
- Console patching: `src/utils/consolePatch.ts` patches console for colored logging
- Toast notifications: `src/utils/toast.ts` for user feedback

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR | Run `type-check` + `build` |
| `docker.yml` | Tag `v*` | Build & push Docker image to Docker Hub |
| `release.yml` | Tag `v*` | Create GitHub Release with build artifacts |
| `pages.yml` | Push to `master` | Deploy to GitHub Pages |

## Project Structure

```
src/
├── components/
│   ├── character-creation/   # Character creation flow components
│   ├── common/               # Shared UI components (modals, toasts, etc.)
│   └── dashboard/            # In-game panels (MainGamePanel, SkillsPanel, etc.)
├── services/                 # Business logic services (AI, embedding, backend API)
├── stores/                   # Pinia stores for state management
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions and game systems
│   └── prompts/              # AI prompt templates and assembly
├── views/                    # Top-level page components
├── router/                   # Vue Router configuration (memory history)
└── main.ts                   # Application entry point

webpack/                      # Webpack plugins (TavernLiveReloadPlugin)
docs/                         # Additional documentation
.github/workflows/            # CI/CD automation
```
