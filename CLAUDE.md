# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered visual moodboard application built with Next.js 15, React 19, and Konva.js for canvas manipulation. The app allows users to generate and edit images using AI models (via Replicate), arrange them on an infinite canvas, and manage visual briefs. It uses Drizzle ORM with PostgreSQL (Neon) for persistence and AWS S3-compatible storage (Cloudflare R2) for image assets.

## Commands

### Development

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production with Turbopack
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier and auto-fix ESLint issues
- `pnpm format:check` - Check code formatting without making changes

**Note**: Only run `pnpm format` and `pnpm build` when explicitly requested by the user. Do not run these proactively.

### Database

- `pnpm db:generate` - Generate Drizzle migrations from schema changes
- `pnpm db:migrate` - Apply pending migrations to database
- `pnpm db:studio` - Open Drizzle Studio for database GUI

## Architecture

### Core State Management

**Canvas Store (`src/stores/canvasStore.ts`)**: Central Zustand store with Liveblocks middleware for realtime collaboration:

- Image objects with transform properties (position, rotation, scale, zIndex)
- Selection state for multi-select operations (synced via Liveblocks Presence)
- Undo/redo history (max 50 steps, local only - not synced)
- Auto-save with debouncing to prevent excessive database writes
- Settings for AI models and aspect ratios
- Realtime sync via Liveblocks for collaborative editing

**Key architectural decisions**:

- Konva.Image refs stored outside Zustand (in `imageRefsMap`) to prevent re-render loops
- History system uses serializable snapshots (excludes HTMLImageElement objects)
- Images must have S3 URLs before being included in history/saves
- Two-tier zIndex system: regular images use 0-9999, reactions/post-its use 10000+ (ensures reactions always appear above images while maintaining bring-to-front within each category)
- **Realtime collaboration**: Liveblocks middleware wraps store, syncs `syncedImages` (serializable) while keeping `images` (with HTMLImageElement) local
- **Leader-based persistence**: Only the first user in a room saves to PostgreSQL (leader election via lowest connectionId)

### AI Services Layer

**LLM Service (`src/lib/services/llm/llm.ts`)**:

- Structured output: Uses Groq with JSON schema validation and auto-retry
- Unstructured output: Uses OpenRouter (defaults to Claude Sonnet 4.5)
- Converts Zod schemas to JSON schema for model constraints

**Image Generation (`src/lib/services/replicate/replicate.ts`)**:

- Model registry pattern abstracts different Replicate models
- Generation models: `imagen-4-ultra` (default), `flux-pro-1-1`, `flux-schnell`
- Editing models: `nano-banana` (supports up to 8 images), `flux-kontext` (single image)
- All images automatically uploaded to S3 after generation

### Storage & Database

**S3 Service (`src/lib/services/s3/`)**:

- Uses Cloudflare R2 (S3-compatible)
- Public CDN endpoint defined in the .env
- Supports upload from URL or data URI
- Handles automatic content-type detection
- **CORS Configuration Required**: R2 bucket must have CORS enabled for canvas exports
  - In Cloudflare dashboard: R2 → Select bucket → Settings → CORS Policy → Add CORS policy
  - Required config: `AllowedOrigins: ["*"]`, `AllowedMethods: ["GET", "HEAD"]`, `AllowedHeaders: ["*"]`
  - All images loaded with `crossOrigin = 'anonymous'` attribute to enable canvas export

**Database Schema (`src/db/schema/briefs.ts`)**:

- Single `briefs` table with UUID primary key
- `canvasState` JSONB field stores all image transforms and positions
- `settings` JSONB field stores per-brief AI model preferences
- Managed via Drizzle ORM with PostgreSQL dialect

### API Routes

- `/api/generate` - POST: Generate new images from text prompts
- `/api/edit` - POST: Edit existing images with AI (multi-image support)
- `/api/upscale` - POST: Upscale images using AI models
- `/api/briefs` - GET/POST: List and create briefs
- `/api/briefs/[uuid]` - GET/PATCH: Load and update brief canvas state
- `/api/upload` - POST: Upload images from client to S3

### Canvas Components

**Canvas.tsx**: Main Konva stage component with:

- Transformer for multi-select resize/rotate
- Infinite canvas with pan/zoom
- Keyboard shortcuts (Delete, Cmd+Z/Cmd+Shift+Z for undo/redo)
- Click-away to deselect, shift-click for multi-select
- Auto-save debounced to 2 seconds

**CropDialog.tsx**: Image cropping using `react-image-crop` library

### User Preferences

**Preferences Hook (`src/hooks/usePreferences.ts`)**: Reusable localStorage-backed preferences system:

- Stores user preferences like `lastPostItColor`
- Automatically persists to localStorage
- Provides `updatePreference()` for setting values
- Extensible for future user-specific settings (theme, layout preferences, etc.)

### Realtime Collaboration

**Liveblocks Integration**: Multi-user realtime collaboration powered by Liveblocks Zustand middleware:

- **Synced state**: Images (transforms, positions, colors), settings, selections (presence)
- **Local state**: Zoom/pan (per-user viewport), undo/redo history, HTMLImageElement objects
- **Image sync pattern**: `images` (local with HTMLImageElement) ↔ `syncedImages` (serialized, synced)
- **Auto-healing**: When remote images arrive, HTMLImageElements are automatically loaded from S3 URLs
- **Leader election**: Lowest connectionId = leader, responsible for database persistence
- **Auth**: `/api/liveblocks-auth` endpoint provides room access tokens

**What syncs in realtime**:
- Image positions, rotations, scales
- Post-it notes (text and colors)
- Stickers and reactions
- AI model settings
- User selections (see what others are selecting)

**What stays local**:
- Zoom level and pan position (independent viewports)
- Undo/redo history (can only undo your own changes)
- HTMLImageElement objects (reconstructed from S3 URLs)

### Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json)

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `REPLICATE_API_KEY` - For image generation/editing
- `GROQ_API_KEY` - For structured LLM calls
- `OPENROUTER_API_KEY` - For unstructured LLM calls
- `S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_ID_KEY`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` - R2/S3 configuration
- `S3_PUBLIC_ENDPOINT` - CDN endpoint for serving images
- `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` - Liveblocks public key (client-side)
- `LIVEBLOCKS_SECRET_KEY` - Liveblocks secret key (server-side auth)

## Key Patterns

### Adding New AI Models

1. Add to model registry in `src/lib/services/replicate/replicate.ts`
2. Implement `buildInput` function for model-specific parameters
3. Update settings UI to expose new model option

### Working with Canvas Images

Images flow through these states:

1. Local HTMLImageElement created (no S3 URL)
2. Upload to S3 initiated (`uploading: true`)
3. Upload completes, S3 URL assigned
4. History snapshot pushed (only after S3 URL exists)
5. Auto-save to database triggered

### Undo/Redo System

- Only saved images (with S3 URLs) are included in history
- History uses serialized state, deserialization re-downloads images from S3
- Max 50 history steps, old states trimmed automatically
- History pushed after: uploads, deletions, transforms, selection changes
