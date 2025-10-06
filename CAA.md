# Creative Approach Agent (CAA) - Implementation Plan

## Overview

The Creative Approach Agent (CAA) is a multi-stage AI system that intelligently processes user prompts based on canvas context (selected images, post-it notes, assets) to enhance generation quality, answer questions, and perform smart edits.

## Core Concept

Instead of directly sending user prompts to image generation/editing models, CAA acts as an intelligent middleware that:
- Analyzes canvas context (selected items, brief description)
- Determines user intent (generate, edit, combine, question)
- Enhances prompts based on selected "creative approach"
- Executes appropriate actions (generate image, create post-it, edit with assets)
- Handles errors gracefully with toast notifications

## Architecture

### Technology Stack
- **AI SDK v5** (Vercel) for tool calling and multi-step workflows
- **OpenRouter** for LLM provider (supports multiple models)
- **Zod** for type-safe parameter schemas
- **Server-side only** (API route) to protect API keys

### Models Supported
Users can choose CAA model in settings:
- `anthropic/claude-sonnet-4` (default - best reasoning)
- `openai/gpt-4.1-mini` (faster, cheaper)

## User-Facing Features

### 1. Settings UI (Sidebar)

Add new section below existing model settings:

```
┌─ Creative Approach Agent ─────────┐
│                                   │
│ [Enable/Disable Switch]           │
│                                   │
│ Creative Approach:                │
│ [Dropdown: Simple / Dramatic]     │
│                                   │
│ CAA Model:                        │
│ [Dropdown: Claude / GPT-4.1-mini] │
│                                   │
└───────────────────────────────────┘
```

**Settings Schema** (add to `BriefSettings`):
```typescript
{
  caaEnabled: boolean;
  caaApproach: "simple" | "dramatic";
  caaModel: "anthropic/claude-sonnet-4" | "openai/gpt-4.1-mini";
}
```

**Defaults:**
- `caaEnabled: true`
- `caaApproach: "simple"`
- `caaModel: "anthropic/claude-sonnet-4"`

### 2. Creative Approaches Architecture

Creative approaches are implemented as **programmable workflows** using the Strategy Pattern. Each approach is a class implementing the `CreativeApproach` interface, allowing for:
- Simple single-step prompt enhancements
- Complex multi-step LLM workflows
- Dynamic randomization and parameter variation
- Conditional logic based on context

**Interface Definition:**

```typescript
export interface CreativeApproach {
  id: string;
  name: string;
  description: string;

  // Main execution - can be simple or complex multi-step
  execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;
}
```

#### Simple Approach (Initial Implementation)

```typescript
export class SimpleApproach implements CreativeApproach {
  id = "simple";
  name = "Simple";
  description = "Clean, accurate enhancement with minimal interpretation";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    const systemPrompt = `Enhance prompts for clarity and technical accuracy.
Stay true to user's original intent. Add specific details about composition, lighting, colors.
Keep style natural and realistic.`;

    const result = await llm.callWithTools({
      systemPrompt,
      userPrompt: context.userPrompt,
      context,
      tools: [enhancePromptForGeneration, enhancePromptForEditing, answerQuestion, generateWithExplanation],
    });

    return parseToolResults(result);
  }
}
```

**Characteristics:**
- Single LLM call
- Minimal creative interpretation
- Focus on clarity and detail
- Preserves user's original vision

#### Dramatic Approach (Initial Implementation)

```typescript
const DRAMATIC_TECHNIQUES = [
  "film noir lighting with hard shadows",
  "chiaroscuro inspired by Caravaggio",
  "high contrast street photography style",
  "cinematic wide-angle with deep blacks",
];

export class DramaticApproach implements CreativeApproach {
  id = "dramatic";
  name = "Dramatic";
  description = "Bold B&W photography with cinematic lighting";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    // Random technique selection for variety
    const technique = DRAMATIC_TECHNIQUES[
      Math.floor(Math.random() * DRAMATIC_TECHNIQUES.length)
    ];

    const systemPrompt = `Transform into dramatic black and white photography.
Apply this specific technique: ${technique}
Emphasize: strong contrast, moody atmosphere, powerful composition.
ALWAYS specify black and white unless user explicitly requests color.`;

    const result = await llm.callWithTools({
      systemPrompt,
      userPrompt: context.userPrompt,
      context,
      tools: [enhancePromptForGeneration, enhancePromptForEditing, answerQuestion, generateWithExplanation],
    });

    return parseToolResults(result);
  }
}
```

**Characteristics:**
- Single LLM call with randomization
- Bold creative interpretation
- Black & white, high contrast aesthetic
- Randomized technique selection for variety

#### Future Approaches (Examples)

**Layout-First Approach (Multi-step):**

```typescript
export class LayoutFirstApproach implements CreativeApproach {
  id = "layout-first";
  name = "Layout First";
  description = "Multi-step: layout → copy → final composition";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    // Step 1: Generate layout concept
    const layoutResult = await llm.call({
      systemPrompt: "You are a layout designer. Analyze the request and suggest compositional layout.",
      userPrompt: `Request: ${context.userPrompt}\n\nProvide layout structure.`,
    });

    // Step 2: Generate copy/text elements
    const copyResult = await llm.call({
      systemPrompt: "You are a copywriter. Create compelling copy.",
      userPrompt: `Layout: ${layoutResult}\n\nGenerate messaging.`,
    });

    // Step 3: Combine into final prompt
    const finalResult = await llm.callWithTools({
      systemPrompt: `Combine layout and copy:\nLayout: ${layoutResult}\nCopy: ${copyResult}`,
      userPrompt: context.userPrompt,
      context,
      tools: [enhancePromptForGeneration],
    });

    return parseToolResults(finalResult);
  }
}
```

**Random Creative Technique Approach:**

```typescript
const CREATIVE_TECHNIQUES = [
  { name: "SCAMPER", prompt: "Apply SCAMPER: Substitute, Combine, Adapt, Modify..." },
  { name: "Oblique Strategies", prompt: "Random constraint: Use fewer elements..." },
  { name: "Forced Connections", prompt: "Force unexpected connections..." },
];

export class RandomTechniqueApproach implements CreativeApproach {
  id = "random-technique";
  name = "Random Technique";
  description = "Applies randomized creative thinking method";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    const technique = CREATIVE_TECHNIQUES[Math.floor(Math.random() * CREATIVE_TECHNIQUES.length)];

    const systemPrompt = `Apply ${technique.name}: ${technique.prompt}`;

    const result = await llm.callWithTools({
      systemPrompt,
      userPrompt: context.userPrompt,
      context,
      tools: [...],
    });

    return parseToolResults(result);
  }
}
```

#### Approach Registry

```typescript
// src/lib/services/caa/approaches/registry.ts
import { SimpleApproach } from "./simple";
import { DramaticApproach } from "./dramatic";

const APPROACHES = {
  simple: new SimpleApproach(),
  dramatic: new DramaticApproach(),
  // Future approaches can be added here
};

export function getApproach(id: string): CreativeApproach {
  const approach = APPROACHES[id];
  if (!approach) {
    throw new Error(`Unknown creative approach: ${id}`);
  }
  return approach;
}

export function listApproaches(): Array<{ id: string; name: string; description: string }> {
  return Object.values(APPROACHES).map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
  }));
}
```

### 3. Visual Indicators

**While CAA is Processing:**
- Show in prompt island textarea placeholder: "Analyzing..." (disabled state)
- Optional: Subtle shimmer effect on prompt island border

**AI-Generated Post-its:**
- **Color:** `#E8E8E8` (light grey)
- **Icon:** Small robot icon (🤖) in top-right corner of post-it
- **Positioning:** Smart placement to top-right of selected image/group
- **Editable:** Yes, users can edit like normal post-its

## CAA Workflow

### Entry Point: `handleGenerateImage()` in Canvas.tsx

**Current flow:**
```
User types prompt → Click generate → Generate/Edit image
```

**New flow with CAA:**
```
User types prompt → Click generate →
  ↓
  If CAA enabled → Send to /api/caa
  ↓
  CAA analyzes context → Determines intent → Executes tools
  ↓
  Returns enhanced prompt OR creates post-it OR both
  ↓
  Continue with generation/editing
```

### Context Gathering

Before calling CAA, collect:

```typescript
interface CAAContext {
  userPrompt: string;
  briefName: string;
  briefDescription: string;
  selectedImages: Array<{
    id: string;
    s3Url: string;
    prompt?: string;
    sourceType: ImageSourceType;
    transformedUrl: string; // 1024px max
  }>;
  selectedPostits: Array<{
    id: string;
    text: string;
    color: string;
  }>;
  availableAssets: Array<{
    name: string;
    label: string;
    url: string;
  }>;
  settings: {
    approach: "simple" | "dramatic";
    model: string;
    imageGenerationModel: string;
    imageEditingModel: string;
  };
}
```

**Validation:**
- Max 8 selected images
- All selected images have s3Url (no uploading/generating images)
- Transform image URLs to 1024px max before sending to LLM

### API Route: `/api/caa/route.ts`

**Request:**
```typescript
POST /api/caa
{
  context: CAAContext
}
```

**Response:**
```typescript
{
  action: "generate" | "edit" | "answer" | "generate_and_note";
  enhancedPrompt?: string;
  postit?: {
    text: string;
    position: { x: number; y: number }; // Smart placement
  };
  imageInputs?: string[]; // For editing (includes asset URLs)
  error?: string;
}
```

## AI SDK v5 Tool Calling Implementation

### Tools Definition

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const tools = {
  // Tool 1: Enhance prompt for generation
  enhancePromptForGeneration: tool({
    description: 'Enhance user prompt for image generation with creative approach applied',
    parameters: z.object({
      enhancedPrompt: z.string().describe('Enhanced prompt optimized for image generation'),
      reasoning: z.string().describe('Brief explanation of enhancements made'),
    }),
    execute: async ({ enhancedPrompt, reasoning }) => ({
      enhancedPrompt,
      reasoning,
    }),
  }),

  // Tool 2: Enhance prompt for editing with optional asset inclusion
  enhancePromptForEditing: tool({
    description: 'Enhance user prompt for editing existing images, optionally including assets like logos',
    parameters: z.object({
      enhancedPrompt: z.string().describe('Enhanced prompt for image editing'),
      includeAssets: z.array(z.string()).describe('Array of asset names to include (e.g., ["logo", "brand-pattern"])'),
      reasoning: z.string().describe('Brief explanation of edits and asset choices'),
    }),
    execute: async ({ enhancedPrompt, includeAssets, reasoning }) => ({
      enhancedPrompt,
      includeAssets,
      reasoning,
    }),
  }),

  // Tool 3: Answer question about images
  answerQuestion: tool({
    description: 'Answer user question about selected images without generating new content',
    parameters: z.object({
      answer: z.string().describe('Comprehensive answer to user question'),
    }),
    execute: async ({ answer }) => ({
      answer,
    }),
  }),

  // Tool 4: Generate with explanatory note
  generateWithExplanation: tool({
    description: 'Generate new image AND create explanatory post-it note',
    parameters: z.object({
      enhancedPrompt: z.string().describe('Enhanced prompt for image generation'),
      noteText: z.string().describe('Explanatory note text (2-3 sentences)'),
      reasoning: z.string().describe('Why both image and note are needed'),
    }),
    execute: async ({ enhancedPrompt, noteText, reasoning }) => ({
      enhancedPrompt,
      noteText,
      reasoning,
    }),
  }),
};
```

### LLM Client & System Prompt Builder

**LLM Client:**

```typescript
// src/lib/services/caa/llm-client.ts
export class LLMClient {
  constructor(private modelId: string) {}

  async callWithTools(options: {
    systemPrompt: string;
    userPrompt: string;
    context: CAAContext;
    tools: any[];
  }) {
    const fullSystemPrompt = this.buildFullSystemPrompt(
      options.systemPrompt,
      options.context
    );

    const { text, toolCalls } = await generateText({
      model: openrouter(this.modelId),
      system: fullSystemPrompt,
      prompt: options.userPrompt,
      tools: options.tools,
      maxSteps: 3,
    });

    return { text, toolCalls };
  }

  private buildFullSystemPrompt(approachPrompt: string, context: CAAContext): string {
    return `You are a Creative Approach Agent helping users create visual moodboards.

CONTEXT:
- Brief: ${context.briefName} - ${context.briefDescription}
- Selected Images: ${context.selectedImages.length}
- Selected Post-its: ${context.selectedPostits.length}
- Available Assets: ${context.availableAssets.map(a => a.label).join(', ')}

${approachPrompt}

YOUR TASK:
Analyze the user's request and canvas context, then choose ONE action:

1. **Generate new image**: User has no images selected, wants to create something new
   → Use enhancePromptForGeneration

2. **Edit existing image(s)**: User has 1-8 images selected, wants to modify them
   → Use enhancePromptForEditing
   → If user mentions "logo", "brand", "watermark" → include relevant assets
   → Asset URLs will be added to imageInputs for the editing model

3. **Answer question**: User asks about images (e.g., "how are these different?", "what's the common theme?")
   → Use answerQuestion
   → Answer will be placed in a grey AI post-it near the images

4. **Generate with explanation**: Rare cases where context suggests both image and note
   → Use generateWithExplanation

ASSET MATCHING:
Available assets: ${context.availableAssets.map(a => `${a.label} (${a.name})`).join(', ')}
When user mentions: "logo", "brand", "watermark", "pattern" → include matching asset names

IMPORTANT:
- Be concise but detailed in prompts
- For questions, provide thoughtful multi-sentence answers
- Never refuse - always choose the most appropriate action`;
  }
}
```

### CAA Execution Flow

```typescript
// src/app/api/caa/route.ts
import { getApproach } from "@/lib/services/caa/approaches/registry";
import { LLMClient } from "@/lib/services/caa/llm-client";

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json();

    // Validate
    if (context.selectedImages.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 images can be selected' },
        { status: 400 }
      );
    }

    // Get the selected creative approach instance
    const approach = getApproach(context.settings.caaApproach);

    // Create LLM client
    const llm = new LLMClient(context.settings.caaModel);

    // Execute approach (could be single-step or multi-step workflow)
    const result = await approach.execute(context, llm);

    return NextResponse.json(result);

  } catch (error) {
    console.error('CAA error:', error);
    return NextResponse.json(
      { error: error.message || 'CAA processing failed' },
      { status: 500 }
    );
  }
}
```

## Canvas Integration

### Modified `handleGenerateImage()`

```typescript
const handleGenerateImage = async () => {
  if (!prompt.trim()) return;

  const promptText = prompt;

  // Gather context
  const selectedImages = selectedIndices
    .map((index) => images[index])
    .filter((img) => img && img.s3Url && !img.uploading && !img.isGenerating);

  const selectedPostits = selectedIndices
    .map((index) => images[index])
    .filter((img) => img?.sourceType === "postit")
    .map((img) => ({ id: img.id, text: img.text || "", color: img.color || "" }));

  // If CAA enabled, route through agent
  if (settings.caaEnabled) {
    try {
      // Show processing state
      setPrompt(""); // Clear input

      const caaResponse = await fetch("/api/caa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            userPrompt: promptText,
            briefName: name,
            briefDescription: description,
            selectedImages: selectedImages.map(img => ({
              id: img.id,
              s3Url: img.s3Url,
              prompt: img.prompt,
              sourceType: img.sourceType,
              transformedUrl: transformImageUrl(img.s3Url, {
                width: 1024,
                height: 1024,
                fit: "scale-down"
              }),
            })),
            selectedPostits,
            availableAssets: getAvailableAssets(),
            settings: {
              approach: settings.caaApproach,
              model: settings.caaModel,
              imageGenerationModel: settings.imageGenerationModel,
              imageEditingModel: settings.imageEditingModel,
            },
          },
        }),
      });

      const caaData = await caaResponse.json();

      if (!caaResponse.ok) {
        toast.error(caaData.error || "CAA processing failed");
        return;
      }

      // Handle CAA response
      if (caaData.action === "answer") {
        // Create AI post-it with answer
        createAIPostIt(caaData.postit.text, caaData.postit.position);
        return;
      }

      if (caaData.postit) {
        // Create explanatory post-it
        createAIPostIt(caaData.postit.text, caaData.postit.position);
      }

      // Continue with generation/editing using enhanced prompt
      if (caaData.action === "generate" || caaData.action === "generate_and_note") {
        await generateImageWithPrompt(caaData.enhancedPrompt);
      } else if (caaData.action === "edit") {
        await editImagesWithPrompt(
          caaData.enhancedPrompt,
          caaData.imageInputs || selectedImages.map(img => img.s3Url)
        );
      }

    } catch (error) {
      console.error("CAA error:", error);
      toast.error("Failed to process request");
    }
  } else {
    // Original flow: direct generation/editing
    // ... existing code ...
  }
};
```

### Helper: Create AI Post-it

```typescript
const createAIPostIt = (text: string, position?: { x: number; y: number }) => {
  // Smart positioning: top-right of selected images bounding box
  const bounds = getSelectionBounds();

  const posX = position?.x ?? (bounds ? bounds.x + bounds.width + 20 : 200);
  const posY = position?.y ?? (bounds ? bounds.y : 200);

  // Create canvas with grey background
  const canvas = document.createElement("canvas");
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#E8E8E8"; // Grey for AI post-its
  ctx.fillRect(0, 0, size, size);

  const dataUrl = canvas.toDataURL();
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = dataUrl;

  img.onload = () => {
    addImage({
      id: crypto.randomUUID(),
      image: img,
      width: size,
      height: size,
      x: posX,
      y: posY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      sourceType: "postit",
      text: text,
      color: "#E8E8E8",
      isAIGenerated: true, // New flag
      s3Url: dataUrl,
    });
  };
};
```

## Assets System Enhancement

### Current State
Assets are hardcoded in Canvas.tsx with placeholder URLs.

### Enhancement Needed

**1. Create Assets Configuration File**

```typescript
// src/config/assets.ts
export interface Asset {
  name: string; // Internal identifier (e.g., "logo")
  label: string; // Display name (e.g., "Company Logo")
  url: string; // CDN URL
  type: "brand" | "pattern" | "texture" | "custom";
}

export const PREDEFINED_ASSETS: Asset[] = [
  {
    name: "logo",
    label: "Company Logo",
    url: "https://cdn.example.com/logo.png",
    type: "brand",
  },
  {
    name: "logo-white",
    label: "Logo (White)",
    url: "https://cdn.example.com/logo-white.png",
    type: "brand",
  },
  // Add more predefined assets
];
```

**2. Add Custom Assets Support**

Extend `CanvasState` interface:
```typescript
interface CanvasState {
  // ... existing fields
  customAssets: Asset[]; // User-uploaded assets
}
```

Add to store actions:
```typescript
{
  addCustomAsset: (asset: Asset) => void;
  removeCustomAsset: (name: string) => void;
  getAllAssets: () => Asset[]; // Returns predefined + custom
}
```

**3. Assets Sidebar Section**

Add below Settings section:
```
┌─ Assets ──────────────────────────┐
│                                   │
│ [+ Upload Asset]                  │
│                                   │
│ • Company Logo       [x]          │
│ • Logo (White)       [x]          │
│ • Brand Pattern      [x]          │
│                                   │
│ Custom:                           │
│ • My Texture         [x]          │
│                                   │
└───────────────────────────────────┘
```

**4. Asset Upload Flow**

```typescript
const handleAssetUpload = async (file: File) => {
  // Upload to S3
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (response.ok) {
    // Add to custom assets
    const asset: Asset = {
      name: slugify(file.name),
      label: file.name,
      url: data.s3Url,
      type: "custom",
    };

    addCustomAsset(asset);
    toast.success("Asset uploaded");
  }
};
```

## Data Model Updates

### CanvasImage Interface

Add field for AI-generated post-its:

```typescript
export interface CanvasImage {
  // ... existing fields
  isAIGenerated?: boolean; // For AI post-its
}
```

### BriefSettings Interface

Add CAA settings:

```typescript
export type CAAApproachId = "simple" | "dramatic"; // Extensible for future approaches

export interface BriefSettings {
  // ... existing fields
  caaEnabled: boolean;
  caaApproach: CAAApproachId;
  caaModel: "anthropic/claude-sonnet-4" | "openai/gpt-4.1-mini";
}
```

### SerializableImageState

Add to serialization:

```typescript
{
  // ... existing fields
  isAIGenerated?: boolean;
}
```

## Implementation Phases

### Phase 1: Foundation
1. Install `ai` package from Vercel
2. Enhance assets system (config file + store actions)
3. Add CAA settings to `BriefSettings` interface
4. Update UI: Add CAA settings section to sidebar

### Phase 2: CAA Core Architecture
1. Create type definitions (`types.ts`)
2. Implement `CreativeApproach` interface (`approaches/base.ts`)
3. Build LLM client wrapper (`llm-client.ts`)
4. Implement AI SDK v5 tool definitions (`tools.ts`)
5. Create Simple approach (`approaches/simple.ts`)
6. Create Dramatic approach (`approaches/dramatic.ts`)
7. Build approach registry (`approaches/registry.ts`)
8. Test approaches with mock data

### Phase 3: CAA API Route
1. Create `/api/caa/route.ts`
2. Integrate approach registry
3. Add validation and error handling
4. Test end-to-end with real LLM calls

### Phase 4: Canvas Integration
1. Modify `handleGenerateImage()` to route through CAA when enabled
2. Implement `createAIPostIt()` helper
3. Add visual indicators (analyzing state)
4. Handle CAA responses (generate/edit/answer)
5. Error handling with toast

### Phase 5: Assets UI
1. Create assets sidebar section
2. Implement asset upload flow
3. Display predefined + custom assets
4. Add drag-to-canvas for assets (existing feature)

### Phase 6: Testing & Refinement
1. Test all scenarios (generate, edit, question, combine)
2. Test with both creative approaches
3. Test asset matching logic
4. Refine prompts based on output quality
5. Performance optimization

## Error Handling

**All errors show as toasts:**

```typescript
// API errors
if (!response.ok) {
  toast.error(data.error || "Processing failed");
  return;
}

// LLM errors
catch (error) {
  console.error("CAA error:", error);
  toast.error("Failed to process request");
}

// Validation errors
if (selectedImages.length > 8) {
  toast.error("Maximum 8 images can be selected");
  return;
}
```

**No blocking dialogs, no complex error states.**

## Performance Considerations

1. **Image Transformation**: Always send 1024px max versions to LLM
2. **Caching**: Consider caching asset list (rare changes)
3. **Debouncing**: None needed (explicit button click)
4. **Streaming**: Not needed for tool calling (responses are structured)
5. **Timeouts**: Set reasonable timeout (30s) for CAA API calls

## Security

1. **API Keys**: All LLM calls server-side only
2. **Asset Upload**: Validate file types, size limits
3. **Input Validation**: Sanitize all user inputs before sending to LLM
4. **Rate Limiting**: Consider adding to prevent abuse

## Future Enhancements (Out of Scope)

**New Creative Approaches:**
- "Layout-First" (multi-step: layout → copy → composition)
- "Random Technique" (applies SCAMPER, Oblique Strategies, etc.)
- "Vintage" (retro aesthetics with period-appropriate styling)
- "Minimalist" (reduction to essential elements)
- "Surreal" (dreamlike, unexpected combinations)

**Advanced Features:**
- CAA history/audit log
- Custom approach definitions via UI
- Multi-language support
- Advanced asset tagging/search
- Asset categories and organization
- Batch operations
- Approach parameter tuning (e.g., intensity slider)

## Dependencies to Install

```bash
pnpm add ai zod
```

## File Structure

```
src/
├── app/
│   └── api/
│       └── caa/
│           └── route.ts                    # CAA API endpoint
├── components/
│   └── canvas/
│       └── Canvas.tsx                      # Modified with CAA integration
├── config/
│   └── assets.ts                           # Asset configuration
├── lib/
│   └── services/
│       └── caa/
│           ├── types.ts                    # TypeScript interfaces
│           ├── llm-client.ts               # LLM client wrapper
│           ├── tools.ts                    # AI SDK tool definitions
│           ├── utils.ts                    # Helper functions
│           └── approaches/
│               ├── registry.ts             # Approach registry
│               ├── simple.ts               # Simple approach
│               ├── dramatic.ts             # Dramatic approach
│               └── base.ts                 # CreativeApproach interface
└── stores/
    └── canvasStore.ts                      # Updated with CAA settings & asset actions
```

## Success Criteria

✅ CAA can be enabled/disabled via settings
✅ Two creative approaches work as expected (simple, dramatic)
✅ CAA correctly identifies intent (generate, edit, question)
✅ Asset matching works ("add logo" includes logo asset)
✅ AI post-its are created with correct styling and positioning
✅ Errors show as toasts, no crashes
✅ Custom assets can be uploaded and used by CAA
✅ Works with both supported LLM models
✅ Realtime sync propagates CAA-generated content
✅ Performance is acceptable (<5s for CAA processing)

---

**Ready to implement!** Start with Phase 1 after user approval.
