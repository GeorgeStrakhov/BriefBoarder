import { CreativeApproach } from "./base";
import { CAAContext, CAAResult } from "../types";
import { LLMClient } from "../llm-client";

/**
 * Simple Creative Approach
 * Clean, accurate enhancement with minimal interpretation
 */
export class SimpleApproach implements CreativeApproach {
  id = "simple";
  name = "Simple";
  description = "Clean, accurate enhancement with minimal interpretation";

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    const systemPrompt = `You are using the SIMPLE approach:
- Enhance prompts for clarity and technical accuracy
- Stay true to the user's intent
- Add specific details about composition, lighting, and style
- Keep it straightforward - no dramatic reinterpretation`;

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
