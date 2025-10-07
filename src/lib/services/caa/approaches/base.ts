import { CAAContext, CAAResult, adConceptSchema } from "../types";
import { LLMClient } from "../llm-client";
import { AdvertisingTrick } from "./advertising-tricks";
import { Asset } from "@/config/assets";

/**
 * Ad Generation Context
 * Passed to approaches for autonomous ad generation
 */
export interface AdGenerationContext {
  briefName: string;
  briefDescription: string;
  trick: AdvertisingTrick;
  availableAssets: Asset[];
  preferredTypeface: string;
  aspectRatio?: "1:1" | "16:9" | "9:16"; // User's selected aspect ratio
  settings: {
    imageGenerationModel: string;
    imageEditingModel: string;
    model: string; // LLM model
  };
}

/**
 * Ad Generation Result
 * Returned by approaches after autonomous ad concept generation
 */
export interface AdGenerationResult {
  headline?: string; // Optional - may not have text
  imagePrompt: string;
  reasoning: string;
  textPlacement: "overlay" | "integrated" | "none";
  aspectRatio?: "1:1" | "16:9" | "9:16";
}

/**
 * Creative Approach Interface
 *
 * Each approach is a programmable workflow that can:
 * - Execute simple single-step LLM calls
 * - Implement complex multi-step workflows
 * - Add dynamic randomization and parameter variation
 * - Apply conditional logic based on context
 * - Generate autonomous ads with consistent creative vision
 */
export interface CreativeApproach {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Brief description of the approach */
  description: string;

  /**
   * Main execution method for user prompt enhancement
   * Can be simple (single LLM call) or complex (multi-step workflow)
   */
  execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;

  /**
   * Autonomous ad generation
   * Generates complete ad concept without user prompt
   */
  generateAutonomousAd(
    context: AdGenerationContext,
    llm: LLMClient,
  ): Promise<AdGenerationResult>;

  /**
   * Image style guidance for this approach
   */
  getImageStyleGuidance(): string;

  /**
   * Copy/headline style guidance for this approach
   */
  getCopyStyleGuidance(): string;
}

/**
 * Base Creative Approach
 * Provides default implementation for autonomous ad generation
 * Subclasses can override guidance methods or full workflow
 */
export abstract class BaseCreativeApproach implements CreativeApproach {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  // Subclasses must implement manual prompt enhancement
  abstract execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;

  /**
   * Default image style guidance
   * Subclasses should override for custom styling
   */
  getImageStyleGuidance(): string {
    return "clean, professional photography with good composition and lighting";
  }

  /**
   * Default copy style guidance
   * Subclasses should override for custom styling
   */
  getCopyStyleGuidance(): string {
    return "clear, benefit-focused headline that communicates value";
  }

  /**
   * Default autonomous ad generation workflow
   * Uses template method pattern - subclasses can override for complex workflows
   */
  async generateAutonomousAd(
    context: AdGenerationContext,
    llm: LLMClient,
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

TEXT PLACEMENT STRATEGY:
You must decide how text should be handled in this ad:

1. "overlay" (MOST COMMON):
   - The background image is generated WITHOUT any text
   - Text is added afterward as an overlay via nano-banana compositing
   - You must provide the headline in the "headline" field
   - The imagePrompt should describe ONLY the visual scene (no text!)
   - Preferred typeface for overlays: ${context.preferredTypeface}

2. "integrated":
   - Text is part of the generated image itself
   - Examples: "neon sign saying X", "graffiti wall with text Y", "text written on napkin"
   - You must describe the text placement in the imagePrompt
   - Leave headline field empty

3. "none":
   - No text needed, the image tells the complete story
   - Pure visual communication
   - Leave headline field empty

Generate a complete ad concept that:
1. Uses the "${context.trick.name}" technique authentically
2. Applies the specified image and copy styles
3. Communicates the brief's message clearly
4. Creates a compelling, memorable mobile advertisement`;

    const userPrompt = `Brief: "${context.briefName}"
Description: ${context.briefDescription || "No additional context provided"}

Create an advertising concept using the "${context.trick.name}" technique with the specified style.

Provide your response with these fields:
- textPlacement: Choose "overlay" | "integrated" | "none"
- headline: ONLY if textPlacement is "overlay", provide a punchy, memorable headline (2-8 words). Otherwise leave empty.
- imagePrompt: Detailed visual description for image generation. If textPlacement is "overlay", describe ONLY the visual scene WITHOUT text. If "integrated", describe how text appears in the image.
- reasoning: Brief explanation of how this concept uses the technique`;

    // Create minimal CAAContext for LLM client
    const minimalContext: CAAContext = {
      userPrompt,
      briefName: context.briefName,
      briefDescription: context.briefDescription,
      selectedImages: [],
      selectedPostits: [],
      availableAssets: context.availableAssets,
      settings: {
        approach: "", // Not needed for autonomous mode
        model: context.settings.model,
        imageGenerationModel: context.settings.imageGenerationModel,
        imageEditingModel: context.settings.imageEditingModel,
      },
    };

    console.log("\n[BaseApproach] Calling LLM with prompts:");
    console.log("System prompt:", systemPrompt.substring(0, 500) + "...");
    console.log("User prompt:", userPrompt);

    const response = await llm.callWithStructuredOutput({
      systemPrompt,
      userPrompt,
      context: minimalContext,
      schema: adConceptSchema,
    });

    console.log("\n[BaseApproach] Raw LLM response:", response);

    // Response now uses correct schema - direct mapping
    const result: AdGenerationResult = {
      headline: response.headline || undefined,
      imagePrompt: response.imagePrompt,
      reasoning: response.reasoning,
      textPlacement: response.textPlacement,
      aspectRatio: context.aspectRatio || "9:16", // Use user's selected aspect ratio
    };

    console.log("\n[BaseApproach] Mapped result:", result);
    console.log(
      `Using aspect ratio: ${context.aspectRatio || "9:16 (default)"}`,
    );

    return result;
  }
}
