# BriefBoarder

_do image-driven ad things with AI. Together._

An AI-powered visual moodboard for creating and collaborating on advertising concepts. Generate images, edit compositions, and create complete ad layouts with the help of creative AI approaches.

## Key Features

- **AI Image Generation & Editing** - Generate images from text prompts using Imagen 4, Flux, and other models
- **Creative Approaches** - Three distinct AI styles: Simple (modern minimalist), Dramatic (bold B&W), Bernbach (vintage 1960s)
- **Magic Ad Generator** - Autonomous ad creation using 16 classic advertising techniques
- **Realtime Collaboration** - Work together on boards with live cursors and synced edits via Liveblocks
- **Infinite Canvas** - Pan, zoom, arrange images freely with multi-select and transform controls
- **Asset Management** - Upload and reuse brand assets (logos, graphics) across projects
- **Brief Enhancement** - AI-powered brief refinement using Claude

## What's not implemented

- Auth and users. would be easy to add wtih Auth.js or anything else that works with drizzle. Think about how you'd want it to work including liveblocks in terms of real-time collab.

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database (Neon recommended)
- Cloudflare R2 or S3-compatible storage
- API keys: Replicate, OpenRouter, Groq, Liveblocks

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd BriefBoarder

# Install dependencies
pnpm install

# Copy environment template
cp env.example .env

# Configure environment variables (see env.example)
# Fill in your database URL, API keys, and S3 credentials

# NB! It's important to enable R2 image transforms on your bucket, to give it a public url e.g. cdn.yourdomain.com, and also to enable the right CORS policy

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit `http://localhost:3000`

## Commands

### Development

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier

### Database

- `pnpm db:generate` - Generate Drizzle migrations from schema
- `pnpm db:migrate` - Apply pending migrations
- `pnpm db:studio` - Open Drizzle Studio GUI

## Tech Stack

- **Framework**: Next.js 15, React 19
- **Canvas**: Konva.js for canvas and image manipulation
- **Database**: PostgreSQL (NEON) with Drizzle ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI Models**: Replicate (Imagen 4, Flux, nano-banana)
- **LLMs**: OpenRouter (Claude, GPT), Groq
- **Realtime**: Liveblocks for real-time sync and collaboration

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.
