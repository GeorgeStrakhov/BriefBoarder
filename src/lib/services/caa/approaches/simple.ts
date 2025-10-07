import { BaseCreativeApproach } from "./base";
import { CAAContext, CAAResult } from "../types";
import { LLMClient } from "../llm-client";

/**
 * Simple Creative Approach
 * Clean, accurate enhancement with minimal interpretation
 */
export class SimpleApproach extends BaseCreativeApproach {
  id = "simple";
  name = "Simple";
  description = "Clean, accurate enhancement with minimal interpretation";

  getImageStyleGuidance(): string {
    return "clean, straightforward photography with clear composition and natural lighting";
  }

  getCopyStyleGuidance(): string {
    return "clear, accurate headline that communicates the core benefit without exaggeration";
  }

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    const systemPrompt = `You are using the SIMPLE approach:
- Enhance prompts for clarity and technical accuracy
- Stay true to the user's intent
- Add specific details about composition, lighting, and style
- Keep it straightforward - no dramatic reinterpretation

IMPORTANT FOR IMAGE EDITING:
When user has images selected and wants to EDIT them:
- Describe what should be ADDED or CHANGED, not the entire scene
- Example: "add bold red text saying 'SALE' in the top right corner"
- Example: "overlay a blue watermark logo in bottom left"
- Don't describe the existing image content - the AI can see it
- Focus ONLY on the modifications/additions

IMPORTANT FOR TEXT/COPY:
If user asks to add specific text/copy to an image:
- Use action "edit" (since they have images selected)
- Put the actual text/copy in noteText field (creates a post-it for reference)
- In enhancedPrompt, describe ONLY the visual style/placement of text
- Example: noteText: "SUMMER SALE - 50% OFF", enhancedPrompt: "add bold red text saying 'SUMMER SALE - 50% OFF' in a yellow banner at the top"
- The post-it serves as a reference for the text content, while the image shows it visually`;

    const llmResponse = await llm.callWithStructuredOutput({
      systemPrompt,
      userPrompt: context.userPrompt,
      context,
    });

    // Transform LLM response into CAAResult
    const result: CAAResult = {
      action: llmResponse.action,
    };

    if (llmResponse.enhancedPrompt) {
      result.enhancedPrompt = llmResponse.enhancedPrompt;
    }

    if (llmResponse.noteText) {
      result.postit = {
        text: llmResponse.noteText,
      };
    }

    // Handle asset mapping for editing
    if (llmResponse.action === "edit" && llmResponse.includeAssets) {
      const assetUrls = llmResponse.includeAssets
        .map((name) => {
          const asset = context.availableAssets.find((a) => a.name === name);
          return asset?.url;
        })
        .filter(Boolean) as string[];

      result.imageInputs = [
        ...context.selectedImages.map((img) => img.s3Url),
        ...assetUrls,
      ];
    }

    return result;
  }
}
