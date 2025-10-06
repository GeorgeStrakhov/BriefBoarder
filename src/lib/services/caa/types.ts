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
