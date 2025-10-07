# Autonomous Ad Generation Architecture

## Overview

Add a "magic button" that autonomously generates complete ad compositions from a brief without user prompting. The system combines:
- Random advertising trick selection (from 16 classic techniques)
- Creative approach styling (Simple, Dramatic, future: Bernbach, etc.)
- Multi-step AI orchestration (concept → image → composition)
- Final nano-banana compositing (background + logo + optional text)

**Key Principles**:
1. Creative approaches own the creative vision end-to-end. When a user selects "Dramatic" or "Bernbach", that style should permeate everything—both manual prompt enhancement AND autonomous ad generation.
2. Text handling is flexible—not hardcoded. The approach/LLM decides if text should be overlaid, integrated into the image (e.g., "written on a napkin"), or if the image alone tells the story.
3. Mobile-first: Default to 9:16 aspect ratio for mobile advertising.

## Architecture Decision

### Hybrid Approach: Approaches + Service

**CreativeApproach** (owns creative vision)
- Extends to include autonomous ad generation capability
- Provides style guidance for image and copy
- Can override full workflow for complex multi-step creative processes
- Ensures consistency between manual and autonomous modes

**AdGeneratorService** (technical orchestrator)
- Handles workflow mechanics (trick selection, image gen, compositing)
- Delegates creative decisions to selected approach
- Manages assets and canvas placement
- No creative opinions—purely technical

### Why This Works

1. **Consistency**: User selects "Dramatic" → gets dramatic everything
2. **Extensibility**: Easy to add "Bernbach", "Sensational", etc.
3. **Flexibility**: Simple approaches override guidance methods, complex ones override full workflow
4. **Separation of concerns**: Creative vs. technical responsibilities clear
5. **Reusability**: Approaches' style guidance used in both modes

## Interface Changes

### Extended CreativeApproach Interface

```typescript
// src/lib/services/caa/approaches/base.ts

export interface AdGenerationContext {
  briefName: string;
  briefDescription: string;
  trick: AdvertisingTrick; // Selected advertising trick
  availableAssets: Asset[]; // Logo, brand assets
  preferredTypeface: string; // From user preferences (e.g., "Geist", "Bebas Neue")
  settings: {
    imageGenerationModel: string;
    imageEditingModel: string;
    model: string; // LLM model
  };
}

export interface AdGenerationResult {
  headline?: string; // Optional - may not have text
  imagePrompt: string;
  reasoning: string;
  textPlacement: "overlay" | "integrated" | "none"; // How text should be handled
  aspectRatio?: "1:1" | "16:9" | "9:16"; // Default 9:16 for mobile ads
}

export interface CreativeApproach {
  id: string;
  name: string;
  description: string;

  // Existing: user prompt enhancement
  execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;

  // NEW: autonomous ad generation
  generateAutonomousAd(
    context: AdGenerationContext,
    llm: LLMClient
  ): Promise<AdGenerationResult>;

  // NEW: style guidance (used by base implementation)
  getImageStyleGuidance(): string;
  getCopyStyleGuidance(): string;
}
```

### Base Implementation (Template Method Pattern)

```typescript
// src/lib/services/caa/approaches/base.ts

export abstract class BaseCreativeApproach implements CreativeApproach {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  // Subclasses must implement
  abstract execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;

  // Subclasses can override for customization
  protected getImageStyleGuidance(): string {
    return "clean, professional photography with good composition and lighting";
  }

  protected getCopyStyleGuidance(): string {
    return "clear, benefit-focused headline that communicates value";
  }

  // Default autonomous ad generation workflow
  // Subclasses can override for complex multi-step processes
  async generateAutonomousAd(
    context: AdGenerationContext,
    llm: LLMClient
  ): Promise<AdGenerationResult> {
    const systemPrompt = `You are a creative director generating an advertising concept.

ADVERTISING TECHNIQUE: ${context.trick.name}
${context.trick.description}

When to use: ${context.trick.whenToUse}
Examples: ${context.trick.examples.join(" | ")}
${context.trick.inspiration ? `Classic reference: ${context.trick.inspiration}` : ""}

STYLE GUIDANCE:
Image style: ${this.getImageStyleGuidance()}
Copy style: ${this.getCopyStyleGuidance()}

TEXT PLACEMENT OPTIONS:
You must decide how text should be handled in this ad:
- "overlay": Text will be overlaid on the image after generation (most common). Provide headline for overlay.
- "integrated": Text is part of the image itself (e.g., "written on a napkin", "neon sign", "billboard"). Describe text placement in imagePrompt.
- "none": No text - the image tells the complete story. Leave headline empty.

If using "overlay" and text is needed, preferred typeface for overlays is: ${context.preferredTypeface}

Generate a complete ad concept that:
1. Uses the "${context.trick.name}" technique authentically
2. Applies the specified image and copy styles
3. Communicates the brief's message clearly
4. Creates a compelling, memorable mobile advertisement`;

    const userPrompt = `Brief: "${context.briefName}"
Description: ${context.briefDescription || "No additional context provided"}

Create an advertising concept using the "${context.trick.name}" technique with the specified style.

Provide:
- textPlacement: "overlay" | "integrated" | "none"
- headline: If textPlacement is "overlay", provide punchy headline. Otherwise leave empty.
- imagePrompt: Detailed description of the visual. If textPlacement is "integrated", describe how text appears in the image.
- reasoning: Brief explanation of how this concept uses the technique`;

    const response = await llm.callWithStructuredOutput({
      systemPrompt,
      userPrompt,
      context: {} as any, // Not used in autonomous mode
    });

    return {
      headline: response.enhancedPrompt || undefined,
      imagePrompt: response.noteText || "",
      reasoning: response.reasoning || "",
      textPlacement: (response.action as any) || "overlay", // Reuse action field
      aspectRatio: "9:16", // Default for mobile ads
    };
  }
}
```

## Implementation Components

### 1. Update Existing Approaches

```typescript
// src/lib/services/caa/approaches/simple.ts
export class SimpleApproach extends BaseCreativeApproach {
  // ... existing execute() method ...

  protected getImageStyleGuidance(): string {
    return "clean, straightforward photography with clear composition and natural lighting";
  }

  protected getCopyStyleGuidance(): string {
    return "clear, accurate headline that communicates the core benefit without exaggeration";
  }
}

// src/lib/services/caa/approaches/dramatic.ts
export class DramaticApproach extends BaseCreativeApproach {
  // ... existing execute() method ...

  protected getImageStyleGuidance(): string {
    const techniques = [
      "film noir lighting with hard shadows",
      "chiaroscuro inspired by Caravaggio",
      "high contrast street photography style",
      "cinematic wide-angle with deep blacks",
    ];
    const technique = techniques[Math.floor(Math.random() * techniques.length)];
    return `bold black and white photography with dramatic lighting. Use: ${technique}`;
  }

  protected getCopyStyleGuidance(): string {
    return "provocative, emotionally charged headline that stops the viewer and creates impact";
  }
}
```

### 2. Ad Generator Service

```typescript
// src/lib/services/ad-generator/ad-generator.ts

import { getRandomTrick } from "@/lib/services/caa/approaches/advertising-tricks";
import { getApproach } from "@/lib/services/caa/approaches/registry";
import { LLMClient } from "@/lib/services/caa/llm-client";
import { generateImage } from "@/lib/services/replicate/replicate";
import { editImage } from "@/lib/services/replicate/replicate";

export interface GenerateAdOptions {
  briefName: string;
  briefDescription: string;
  approach: string; // "simple" | "dramatic" | ...
  availableAssets: Asset[];
  preferredTypeface: string; // From user preferences
  settings: {
    imageGenerationModel: string;
    imageEditingModel: string;
    caaModel: string; // LLM model
  };
}

export interface GeneratedAd {
  imageUrl: string; // Final composited ad (or just background if textPlacement is "integrated" or "none")
  s3Key: string;
  headline?: string; // Optional - may not have text
  textPlacement: "overlay" | "integrated" | "none";
  trick: {
    id: string;
    name: string;
  };
  reasoning: string;
}

export async function generateAd(
  options: GenerateAdOptions
): Promise<GeneratedAd> {
  // 1. Pick random advertising trick
  const trick = getRandomTrick();

  // 2. Get selected creative approach
  const approach = getApproach(options.approach);

  // 3. Create LLM client
  const llm = new LLMClient(options.settings.caaModel);

  // 4. Generate ad concept via approach
  const concept = await approach.generateAutonomousAd(
    {
      briefName: options.briefName,
      briefDescription: options.briefDescription,
      trick,
      availableAssets: options.availableAssets,
      preferredTypeface: options.preferredTypeface,
      settings: options.settings,
    },
    llm
  );

  // 5. Generate background image
  const backgroundImage = await generateImage({
    prompt: concept.imagePrompt,
    model: options.settings.imageGenerationModel,
    aspectRatio: concept.aspectRatio || "9:16",
  });

  // 6. Determine if we need compositing
  // If textPlacement is "integrated" or "none", we're done - just return the background
  if (concept.textPlacement === "integrated" || concept.textPlacement === "none") {
    return {
      imageUrl: backgroundImage.imageUrl,
      s3Key: backgroundImage.key,
      headline: concept.headline,
      textPlacement: concept.textPlacement,
      trick: {
        id: trick.id,
        name: trick.name,
      },
      reasoning: concept.reasoning,
    };
  }

  // 7. Composite with nano-banana (textPlacement === "overlay")
  const logo = options.availableAssets.find((a) => a.name === "logo");

  const compositePrompt = `Create a mobile advertisement layout with:
${concept.headline ? `- Headline text: "${concept.headline}"` : ""}
${concept.headline ? `- Use ${options.preferredTypeface} typeface for the headline` : ""}
${concept.headline ? "- Place headline prominently with excellent legibility and contrast" : ""}
${logo ? "- Add the logo subtly in the bottom corner" : ""}
- Maintain the overall mood and style of the background image
- Ensure professional, polished appearance`;

  const imageInputs = [backgroundImage.imageUrl];
  if (logo) {
    imageInputs.push(logo.url);
  }

  const finalAd = await editImage({
    prompt: compositePrompt,
    imageInputs,
    model: options.settings.imageEditingModel, // nano-banana
  });

  return {
    imageUrl: finalAd.imageUrl,
    s3Key: finalAd.key,
    headline: concept.headline,
    textPlacement: concept.textPlacement,
    trick: {
      id: trick.id,
      name: trick.name,
    },
    reasoning: concept.reasoning,
  };
}
```

### 3. API Route

```typescript
// src/app/api/generate-ad/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateAd } from "@/lib/services/ad-generator/ad-generator";

export async function POST(req: NextRequest) {
  try {
    const options = await req.json();

    const result = await generateAd(options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ad generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ad generation failed",
      },
      { status: 500 }
    );
  }
}
```

### 4. Canvas Integration

```typescript
// src/components/canvas/Canvas.tsx

// Add magic button component
const MagicAdButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { preferences } = usePreferences(); // Get user preferences for typeface

  const handleGenerateAd = async () => {
    setIsGenerating(true);
    toast.loading("✨ Creating autonomous ad...", { id: "auto-ad" });

    try {
      // Get preferred typeface from user preferences
      const preferredFont = preferences.lastTextFont || "var(--font-geist-sans)";

      // Convert CSS var to actual font name for LLM
      const getFontName = (fontVar: string): string => {
        if (fontVar.includes("geist-sans")) return "Geist Sans";
        if (fontVar.includes("inter")) return "Inter";
        if (fontVar.includes("playfair")) return "Playfair Display";
        if (fontVar.includes("bebas")) return "Bebas Neue";
        if (fontVar.includes("caveat")) return "Caveat";
        if (fontVar.includes("roboto-mono")) return "Roboto Mono";
        if (fontVar.includes("orbitron")) return "Orbitron";
        return "Geist Sans";
      };

      const response = await fetch("/api/generate-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefName,
          briefDescription,
          approach: settings.caaApproach,
          availableAssets: getAllAssets(),
          preferredTypeface: getFontName(preferredFont),
          settings: {
            imageGenerationModel: settings.imageGenerationModel,
            imageEditingModel: settings.imageEditingModel,
            caaModel: settings.caaModel,
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Load generated ad image
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = data.imageUrl;
        img.onload = () => {
          // Add to canvas at center
          const centerX = dimensions.width / 2 / zoom - stagePosition.x / zoom;
          const centerY = dimensions.height / 2 / zoom - stagePosition.y / zoom;

          // Calculate dimensions for 9:16 aspect ratio
          const adWidth = 400; // Base width
          const adHeight = (adWidth * 16) / 9; // 9:16 = portrait

          addImage({
            id: crypto.randomUUID(),
            image: img,
            width: adWidth,
            height: adHeight,
            x: centerX - adWidth / 2,
            y: centerY - adHeight / 2,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            sourceType: "generated",
            s3Url: data.imageUrl,
            s3Key: data.s3Key,
            prompt: `Auto-generated ad using "${data.trick.name}" technique`,
          });

          const textInfo = data.textPlacement === "none"
            ? " (image only)"
            : data.textPlacement === "integrated"
            ? " (text integrated)"
            : "";

          toast.success(`Ad created using "${data.trick.name}" technique!${textInfo}`);
        };
      } else {
        toast.error(data.error || "Failed to generate ad");
      }
    } catch (error) {
      console.error("Auto ad error:", error);
      toast.error("Failed to generate ad");
    } finally {
      setIsGenerating(false);
      toast.dismiss("auto-ad");
    }
  };

  return (
    <button
      onClick={handleGenerateAd}
      disabled={isGenerating}
      className="absolute top-4 left-4 z-50 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 disabled:opacity-50"
      title="Generate autonomous ad from brief"
    >
      {isGenerating ? "✨ Creating..." : "✨ Magic Ad"}
    </button>
  );
};

// Add to Canvas component JSX (top-left corner)
<MagicAdButton />
```

## Flow Diagram

```
User clicks "✨ Magic Ad" button
  ↓
POST /api/generate-ad
  ↓
AdGeneratorService.generateAd()
  ↓
┌─────────────────────────────────────┐
│ 1. Pick random advertising trick    │
│    (from 16 techniques)              │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Get selected approach (e.g.      │
│    "dramatic")                       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. approach.generateAutonomousAd()  │
│    - Uses trick description          │
│    - Applies approach style guidance │
│    - Uses preferred typeface         │
│    - Decides textPlacement           │
│    - Generates: headline (optional), │
│      imagePrompt, reasoning          │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. Generate background image         │
│    - Use concept.imagePrompt         │
│    - Use imageGenerationModel        │
│    - 9:16 aspect ratio (mobile)      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. Check textPlacement               │
│    - "integrated"/"none" → done      │
│    - "overlay" → continue to step 6  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 6. Composite with nano-banana        │
│    (only if textPlacement="overlay") │
│    - Background image                │
│    - Logo asset (optional)           │
│    - Headline text using typeface    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 7. Return final ad image             │
│    - Upload to S3                    │
│    - Place on canvas                 │
└─────────────────────────────────────┘
```

## Future Extensibility

### Adding New Approaches (e.g., "Bernbach")

```typescript
// src/lib/services/caa/approaches/bernbach.ts

export class BernbachApproach extends BaseCreativeApproach {
  id = "bernbach";
  name = "Bernbach";
  description = "Honest, witty copy inspired by Bill Bernbach's legendary DDB work";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    // Manual prompt enhancement...
  }

  protected getImageStyleGuidance(): string {
    return "simple, iconic imagery inspired by 1960s Volkswagen and Avis ads - clean composition, minimal staging, authentic moments";
  }

  protected getCopyStyleGuidance(): string {
    return "witty, self-aware headline that makes you smile - honesty over hype, embrace limitations as strengths, conversational tone";
  }

  // Optional: override full workflow for complex Bernbach-specific logic
  async generateAutonomousAd(context, llm) {
    // Custom multi-step process if needed
    // Otherwise, base implementation uses guidance methods above
  }
}

// Register in registry.ts
const APPROACHES: Record<string, CreativeApproach> = {
  simple: new SimpleApproach(),
  dramatic: new DramaticApproach(),
  bernbach: new BernbachApproach(),
};
```

### Future Features

1. **Manual trick selection**: Dropdown to choose specific technique
2. **Multi-ad generation**: "Generate 5 variations"
3. **Trick-specific approaches**: "Anti-Ad Approach" that always uses reverse psychology
4. **Custom aspect ratios**: Square (1:1) for social, landscape (16:9) for web
5. **Asset variations**: Try different logos, color schemes
6. **A/B testing**: Generate multiple concepts, let user pick
7. **Typeface library**: Expand beyond user preferences to include ad-specific fonts

## Implementation Plan

### Phase 1: Foundation
- [ ] Extend `CreativeApproach` interface in `base.ts`
- [ ] Add `BaseCreativeApproach` abstract class with default implementation
- [ ] Update `SimpleApproach` and `DramaticApproach` to extend base and provide guidance
- [ ] Add type definitions for `AdGenerationContext` and `AdGenerationResult`

### Phase 2: Service Layer
- [ ] Create `src/lib/services/ad-generator/` directory
- [ ] Implement `ad-generator.ts` with `generateAd()` function
- [ ] Create API route `/api/generate-ad`
- [ ] Handle error cases and timeouts

### Phase 3: UI Integration
- [ ] Add magic button component to Canvas
- [ ] Position top-left corner with proper styling
- [ ] Add loading states and toast notifications
- [ ] Handle image loading and canvas placement

### Phase 4: Testing & Refinement
- [ ] Test with different approaches (simple, dramatic)
- [ ] Test with different advertising tricks
- [ ] Verify nano-banana compositing quality
- [ ] Adjust prompts based on output quality
- [ ] Test with/without logo asset

### Phase 5: Future Enhancements
- [ ] Add "Bernbach" approach
- [ ] Add manual trick selection UI
- [ ] Support custom aspect ratios
- [ ] Add variation generation (multiple ads)

## Technical Considerations

### LLM Response Schema
Extend existing `caaResponseSchema` to support ad generation:
```typescript
export const adConceptSchema = z.object({
  textPlacement: z.enum(["overlay", "integrated", "none"])
    .describe("How text should be handled: overlay=add after, integrated=part of image, none=no text"),
  headline: z.string().optional()
    .describe("Headline text (required only if textPlacement is 'overlay')"),
  imagePrompt: z.string()
    .describe("Detailed visual description. If textPlacement is 'integrated', describe how text appears in image"),
  reasoning: z.string()
    .describe("How this concept uses the advertising technique"),
});
```

### Nano-banana Compositing
- Only runs if textPlacement is "overlay"
- Max 8 input images (background + logo + optional assets)
- Supports text overlay via prompt with typeface guidance
- Aspect ratio: "match_input_image" (maintains 9:16)
- Output format: PNG for transparency support
- Typeface preference passed from user preferences (CSS var → font name mapping)

### Typeface Handling
User preferences store CSS variables (e.g., `var(--font-geist-sans)`), but LLM needs human-readable names:
- `--font-geist-sans` → "Geist Sans"
- `--font-bebas` → "Bebas Neue"
- `--font-playfair` → "Playfair Display"
- etc.

Mapping done in Canvas component before API call.

### Text Placement Strategies
1. **overlay**: Text added via nano-banana after image generation
   - Most common case
   - Uses user's preferred typeface
   - Requires compositing step
2. **integrated**: Text is part of the generated image
   - Examples: "written on napkin", "neon sign", "billboard in scene"
   - No compositing needed
   - Skips nano-banana step
3. **none**: No text, image tells complete story
   - Pure visual communication
   - No headline needed
   - No compositing needed

### Error Handling
- LLM failures: Retry with simpler prompt
- Image generation timeout: Show error, don't block
- Compositing failures (textPlacement="overlay"): Fall back to plain image + post-it note with headline
- No logo asset: Generate ad without logo (common case)
- Invalid textPlacement: Default to "overlay"

### Performance
- **With overlay**: ~40-70 seconds (concept + 2 image generations)
- **Without overlay** (integrated/none): ~20-40 seconds (concept + 1 image generation)
- Show progress: "Generating concept..." → "Creating image..." → "Adding text..." (if overlay)
- Optimization: Skip compositing when textPlacement is "integrated" or "none"

## Success Criteria

✅ User clicks button → complete ad appears on canvas
✅ Ad reflects selected approach style (dramatic → dramatic imagery/copy)
✅ Random advertising trick used authentically
✅ 9:16 aspect ratio suitable for mobile advertising
✅ Text placement decision made intelligently:
  - Overlay: clean text with preferred typeface
  - Integrated: text naturally part of image
  - None: powerful visual storytelling without text
✅ Logo included when appropriate (optional, not forced)
✅ Preferred typeface respected for overlay text
✅ Consistent experience with manual CAA usage
✅ Performance: faster generation when compositing not needed (integrated/none)
