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

**Creative Assistant Agent (CAA) (`src/lib/services/caa/`)**:

The Creative Assistant enhances user prompts with creative interpretation and intelligent decision-making. It determines whether to generate, edit, or provide informational responses based on context.

**Architecture**:
- **LLM Client** (`llm-client.ts`): Direct OpenRouter API calls with structured output
  - Uses `response_format: { type: "json_object" }` for guaranteed JSON responses
  - Zod schema validation with retry logic (3 attempts, exponential backoff)
  - Multimodal support: passes selected images via `image_url` objects using `transformedUrl` (1024px versions)
- **Types & Schemas** (`types.ts`): Defines `CAAContext`, `CAAResult`, and Zod response schema
- **Approaches** (`approaches/`): Different creative styles
  - **Simple**: Clean, accurate enhancement with minimal interpretation
  - **Dramatic**: Bold B&W photography with cinematic lighting and randomized techniques

**Actions**:
- `generate` - Create new images from scratch
- `edit` - Modify existing selected images
- `answer` - Provide informational responses without image generation
- `generate_and_note` - Generate image + create reference post-it note

**Key Patterns**:
- **Nano-Banana Editing**: When editing images, prompts describe CHANGES/ADDITIONS only, not the full scene
  - Example: "add bold red text saying 'SALE' in the top right corner" ✓
  - Example: "a scenic mountain landscape with red text" ✗ (describes full image)
- **Text/Copy Handling**: Text content goes in `noteText` (creates post-it), visual style in `enhancedPrompt`
  - Post-it serves as reference, image shows visual result
- **Asset Integration**: Can reference and include custom assets in edits via `includeAssets` field

**Settings**:
- Stored in localStorage (per-user, not synced via Liveblocks)
- Toggle on/off, select approach (simple/dramatic), choose LLM model
- Default model: GPT-4.1 Mini (also supports Claude Sonnet 4)
- Settings persist across sessions but remain personal to each user

**Image Generation (`src/lib/services/replicate/replicate.ts`)**:

- Model registry pattern abstracts different Replicate models
- Generation models: `imagen-4-ultra` (default), `flux-pro-1-1`, `flux-schnell`
- Editing models: `nano-banana` (supports up to 8 images), `flux-kontext` (single image)
- All images automatically uploaded to S3 after generation
- **Image format handling**: All images converted to JPEG via Cloudflare image transformation before sending to editing models (nano-banana doesn't support transparent PNGs)

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
- `/api/caa` - POST: Creative Assistant Agent endpoint, enhances prompts and determines actions
- `/api/briefs` - GET/POST: List and create briefs
- `/api/briefs/[uuid]` - GET/PATCH: Load and update brief canvas state
- `/api/upload` - POST: Upload images from client to S3
- `/api/liveblocks-auth` - POST: Liveblocks authentication, provides room access tokens

### Canvas Components

**Canvas.tsx**: Main Konva stage component with:

- Transformer for multi-select resize/rotate
- Infinite canvas with pan/zoom
- Keyboard shortcuts (Delete, Cmd+Z/Cmd+Shift+Z for undo/redo)
- Click-away to deselect, shift-click for multi-select
- Auto-save debounced to 2 seconds
- Prompt island with Creative Assistant indicator (shows active style when enabled)
- Selection indicator (shows selected image count and editing model)

**CropDialog.tsx**: Image cropping using `react-image-crop` library

### User Preferences

**Preferences Hook (`src/hooks/usePreferences.ts`)**: Reusable localStorage-backed preferences system:

- Stores user preferences like `lastPostItColor`
- Automatically persists to localStorage
- Provides `updatePreference()` for setting values
- Extensible for future user-specific settings (theme, layout preferences, etc.)

### Assets System

**Asset Management (`src/config/assets.ts`)**: Two-tier asset system for reusable brand elements:

- **Preset Assets**: Defined in code via `getPresetAssets()`, available to all briefs (read-only)
  - Stored in R2 at `assets/` folder (e.g., `assets/logo.png`)
  - Lazy evaluation ensures CDN URL is available at runtime
- **Custom Assets**: User-uploaded per brief, stored in `customAssets` field (synced via Liveblocks)
  - Uploaded via `/api/upload` endpoint
  - Stored in brief's `canvasState` JSONB field
  - Collaborative - synced to all users in the room
- **getAllAssets()**: Returns combined preset + custom assets
- **CORS Requirements**: All asset images must have `crossOrigin="anonymous"` to work with canvas export and image editing

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
- Brief name and description
- Custom assets (user-uploaded assets per brief)
- User selections (see what others are selecting via Presence)

**What stays local**:
- Zoom level and pan position (independent viewports)
- Undo/redo history (can only undo your own changes)
- HTMLImageElement objects (reconstructed from S3 URLs)
- AI model settings (stored in localStorage, per-user preferences)
- Creative Assistant preferences (enabled/disabled, approach, model)

### Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json)

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `REPLICATE_API_KEY` - For image generation/editing
- `GROQ_API_KEY` - For structured LLM calls
- `OPENROUTER_API_KEY` - For unstructured LLM calls
- `S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_ID_KEY`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` - R2/S3 configuration (server-side)
- `S3_PUBLIC_ENDPOINT` - CDN endpoint for serving images (server-side)
- `NEXT_PUBLIC_S3_ENDPOINT` - CDN endpoint for client-side access (required for assets, image transformations)
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

### Preventing Hydration Errors

Components that use localStorage-based settings (like `settings` from canvasStore) must prevent SSR/client mismatches:

```typescript
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

// Then conditionally render settings-dependent UI
{isMounted && settings.caaEnabled && <Switch ... />}
```

**Why**: Server renders with default settings values, but client loads from localStorage (different values) causing hydration mismatch.

### Image Caching for Realtime Sync

The `loadImageElement` function caches HTMLImageElement objects by ID and URL:

- **Cache key**: Image `id` (stable across operations on same object)
- **Cache validation**: Checks if `cached.src === s3Url` before returning
- **Why URL check**: Operations like crop, upscale, remove-background change the S3 URL while keeping same ID
- **Behavior**: When User A crops an image, User B's cache detects URL change and reloads the new cropped version
- **Applies to**: Crop, upscale, remove background, any operation that changes `s3Url` while preserving `id`
