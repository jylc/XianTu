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
# Build
pnpm build              # Production build
pnpm build:single       # Single file build
pnpm watch              # Development build with watch mode
pnpm serve              # Development server

# Code Quality
pnpm lint               # Lint and auto-fix
pnpm lint:check         # Lint check only
pnpm type-check         # TypeScript type checking
```

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
