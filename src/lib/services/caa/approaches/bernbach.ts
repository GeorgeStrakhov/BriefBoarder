import { BaseCreativeApproach } from "./base";
import { CAAContext, CAAResult, CAAResponseType } from "../types";
import { LLMClient } from "../llm-client";

const BERNBACH_VISUAL_STYLES = [
  "simple product shot on plain background, 1960s advertising style",
  "honest documentary-style photography, minimal staging, authentic moment",
  "clean black and white composition with generous white space, vintage DDB aesthetic",
  "understated product photography that lets the subject speak for itself",
];

/**
 * Bernbach Approach
 * Honest, witty copy inspired by Bill Bernbach's legendary DDB work
 * Visual: Simple, iconic 1960s aesthetic (Think Small, Avis, Lemon)
 * Copy: Self-aware, conversational, embrace limitations as strengths
 */
export class BernbachApproach extends BaseCreativeApproach {
  id = "bernbach";
  name = "Bernbach";
  description = "Honest, witty copy with vintage 1960s aesthetic";

  getImageStyleGuidance(): string {
    const style =
      BERNBACH_VISUAL_STYLES[
        Math.floor(Math.random() * BERNBACH_VISUAL_STYLES.length)
      ];
    return `${style}. Inspired by 1960s Volkswagen and Avis ads - simple, iconic, minimal staging, authentic moments. Not overly polished.`;
  }

  getCopyStyleGuidance(): string {
    return "witty, self-aware headline that makes you smile - honesty over hype, embrace limitations as strengths, conversational tone. Think 'Think Small' or 'We Try Harder' - undermine expectations with charm.";
  }

  async execute(context: CAAContext, llm: LLMClient): Promise<CAAResult> {
    // Random visual style selection for variety
    const visualStyle =
      BERNBACH_VISUAL_STYLES[
        Math.floor(Math.random() * BERNBACH_VISUAL_STYLES.length)
      ];

    const systemPrompt = `You are using the BERNBACH approach (inspired by Bill Bernbach's legendary DDB work):

VISUAL STYLE:
- ${visualStyle}
- Reference: 1960s Volkswagen "Think Small", Avis "We Try Harder", "Lemon" ads
- Simple, iconic imagery - let the product/subject speak for itself
- Clean composition with generous negative space
- Authentic, not overly polished - documentary feel
- Often black and white or muted vintage colors

COPY STYLE:
- Witty, self-aware, conversational
- Honesty over hype - embrace limitations as strengths
- Make them smile while making your point
- Undermine expectations with charm
- Examples: "Think Small" (when everyone else said big), "We Try Harder" (admitting you're #2), "Lemon" (calling out a defect)

IMPORTANT FOR IMAGE EDITING:
When user has images selected and wants to EDIT them:
- Describe what should be ADDED or CHANGED, not the entire scene
- Example: "add simple bold text saying 'SALE' in Helvetica, centered"
- Example: "overlay a small logo in bottom corner, minimal and understated"
- Don't describe the existing image content - the AI can see it
- Focus ONLY on the modifications/additions
- Keep edits simple and iconic, in line with 1960s DDB aesthetic

IMPORTANT FOR TEXT/COPY:
If user asks to add specific text/copy to an image:
- Use action "edit" (since they have images selected)
- Put the actual text/copy in noteText field (creates a post-it for reference)
- In enhancedPrompt, describe ONLY the visual style/placement of text
- Example: noteText: "Think Small", enhancedPrompt: "add simple bold text saying 'Think Small' in clean Helvetica typeface, centered at bottom with generous white space"
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
