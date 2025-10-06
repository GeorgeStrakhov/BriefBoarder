import { CreativeApproach } from "./base";
import { CAAContext, CAAResult } from "../types";
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
export class DramaticApproach implements CreativeApproach {
  id = "dramatic";
  name = "Dramatic";
  description = "Bold B&W photography with cinematic lighting";

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
- ALWAYS specify black and white unless user explicitly requests color`;

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
