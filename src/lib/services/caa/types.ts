import { Asset } from "@/config/assets";
import { ImageSourceType } from "@/stores/canvasStore";
import { z } from "zod";

export interface SelectedImage {
  id: string;
  s3Url: string;
  prompt?: string;
  sourceType: ImageSourceType;
  transformedUrl: string; // 1024px max for LLM
}

export interface SelectedPostit {
  id: string;
  text: string;
  color: string;
}

export interface CAASettings {
  approach: string;
  model: string;
  imageGenerationModel: string;
  imageEditingModel: string;
}

export interface CAAContext {
  userPrompt: string;
  briefName: string;
  briefDescription: string;
  selectedImages: SelectedImage[];
  selectedPostits: SelectedPostit[];
  availableAssets: Asset[];
  settings: CAASettings;
}

export interface CAAResult {
  action: "generate" | "edit" | "answer" | "generate_and_note";
  enhancedPrompt?: string;
  postit?: {
    text: string;
  };
  imageInputs?: string[]; // For editing (includes asset URLs)
  includeAssets?: string[]; // Asset names to include
}

// Zod schema for structured LLM response
export const caaResponseSchema = z.object({
  action: z
    .enum(["generate", "edit", "answer", "generate_and_note"])
    .describe(
      "The action to take: 'generate' for new images, 'edit' for modifying existing images, 'answer' for questions, 'generate_and_note' for image + explanation",
    ),
  enhancedPrompt: z
    .string()
    .optional()
    .describe(
      "Enhanced prompt for image generation or editing (required for generate/edit/generate_and_note)",
    ),
  includeAssets: z
    .array(z.string())
    .optional()
    .describe(
      'Asset names to include when editing (e.g., ["logo", "brand-pattern"])',
    ),
  noteText: z
    .string()
    .optional()
    .describe("Text for post-it note (required for answer/generate_and_note)"),
  reasoning: z
    .string()
    .describe("Brief explanation of your decision and enhancements"),
});

export type CAAResponseType = z.infer<typeof caaResponseSchema>;

// Zod schema for autonomous ad generation
export const adConceptSchema = z.object({
  textPlacement: z
    .enum(["overlay", "integrated", "none"])
    .describe(
      "How text should be handled: 'overlay'=add text after image generation via nano-banana, 'integrated'=text is part of the generated image itself (e.g., written on napkin, neon sign), 'none'=no text needed",
    ),
  headline: z
    .string()
    .optional()
    .describe(
      "Headline text for the ad (required only if textPlacement is 'overlay'). Should be punchy and memorable. Leave empty for 'integrated' or 'none'.",
    ),
  imagePrompt: z
    .string()
    .describe(
      "Detailed visual description for image generation. If textPlacement is 'integrated', describe how text appears in the image (e.g., 'neon sign saying X'). If 'overlay' or 'none', describe ONLY the visual scene without text.",
    ),
  reasoning: z
    .string()
    .describe(
      "Brief explanation of how this concept uses the advertising technique",
    ),
});
