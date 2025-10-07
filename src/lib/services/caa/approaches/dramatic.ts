import { BaseCreativeApproach } from "./base";
import { CAAContext, CAAResult, CAAResponseType } from "../types";
import { LLMClient } from "../llm-client";

const DRAMATIC_TECHNIQUES = [
  "film noir lighting with hard shadows",
  "chiaroscuro inspired by Caravaggio",
  "high contrast street photography style",
  "cinematic wide-angle with deep blacks",
];

/**
 * Dramatic Approach
 * Bold B&W photography with cinematic lighting
 * Includes randomization for variety
 */
export class DramaticApproach extends BaseCreativeApproach {
  id = "dramatic";
  name = "Dramatic";
  description = "Bold B&W photography with cinematic lighting";

  getImageStyleGuidance(): string {
    const technique =
      DRAMATIC_TECHNIQUES[
        Math.floor(Math.random() * DRAMATIC_TECHNIQUES.length)
      ];
    return `bold black and white photography with dramatic lighting. Use: ${technique}`;
  }

  getCopyStyleGuidance(): string {
    return "provocative, emotionally charged headline that stops the viewer and creates impact";
  }

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    // Random technique selection for variety
    const technique =
      DRAMATIC_TECHNIQUES[
        Math.floor(Math.random() * DRAMATIC_TECHNIQUES.length)
      ];

    const systemPrompt = `You are using the DRAMATIC approach:
- Transform into dramatic black and white photography
- Apply this specific technique: ${technique}
- Emphasize: strong contrast, moody atmosphere, powerful composition
- ALWAYS specify black and white unless user explicitly requests color

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

    const llmResponse = (await llm.callWithStructuredOutput({
      systemPrompt,
      userPrompt: context.userPrompt,
      context,
    })) as CAAResponseType;

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
