import { BaseCreativeApproach } from "./base";
import { CAAContext, CAAResult } from "../types";
import { LLMClient } from "../llm-client";

/**
 * Simple Creative Approach
 * Clean, accurate enhancement with minimal interpretation
 * Focus: Professional quality with modern aesthetics
 */
export class SimpleApproach extends BaseCreativeApproach {
  id = "simple";
  name = "Simple";
  description = "Clean, accurate enhancement with minimal interpretation";

  getImageStyleGuidance(): string {
    return "clean, professional photography with excellent composition and lighting. Modern aesthetic inspired by Swiss design principles - clarity, simplicity, good use of negative space. Well-lit, sharp focus, uncluttered backgrounds. Quality over complexity.";
  }

  getCopyStyleGuidance(): string {
    return "clear, benefit-focused headline with strong hierarchy and readability. Communicate value directly without exaggeration or unnecessary cleverness. Professional and trustworthy tone.";
  }

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    const systemPrompt = `You are using the SIMPLE approach:

VISUAL STYLE:
- Clean, professional photography with excellent composition
- Modern aesthetic inspired by Swiss design - clarity, simplicity, negative space
- Well-lit with natural or studio lighting - sharp focus, uncluttered backgrounds
- Quality over complexity - let the subject breathe
- Reference: Apple product photography, modern editorial style, minimalist design

COPY STYLE:
- Clear, benefit-focused headlines with strong hierarchy
- Communicate value directly - no hype or exaggeration
- Professional and trustworthy tone
- Readable and accessible - clarity is key

APPROACH PRINCIPLES:
- Stay true to the user's intent - enhance, don't reinterpret
- Add specific details about composition, lighting, quality
- Keep it straightforward and professional
- Focus on making good design choices, not being clever

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
