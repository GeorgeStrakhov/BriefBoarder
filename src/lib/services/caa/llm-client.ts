import OpenAI from "openai";
import { CAAContext, caaResponseSchema, adConceptSchema } from "./types";
import { z } from "zod";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Convert Zod schema to JSON schema for LLM
function zodSchemaToJsonSchema(
  schema: typeof caaResponseSchema | typeof adConceptSchema
): unknown {
  // Check if it's the ad concept schema by looking at the shape
  const shape = (schema as any)._def?.shape?.();

  if (shape?.textPlacement) {
    // Ad concept schema
    return {
      type: "object",
      properties: {
        textPlacement: {
          type: "string",
          enum: ["overlay", "integrated", "none"],
          description: "How text should be handled in the ad",
        },
        headline: {
          type: "string",
          description: "Headline text (required if textPlacement is 'overlay')",
        },
        imagePrompt: {
          type: "string",
          description: "Visual description for image generation",
        },
        reasoning: {
          type: "string",
          description: "Explanation of how this uses the advertising technique",
        },
      },
      required: ["textPlacement", "imagePrompt", "reasoning"],
    };
  }

  // CAA response schema
  return {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["generate", "edit", "answer", "generate_and_note"],
      },
      enhancedPrompt: { type: "string" },
      includeAssets: {
        type: "array",
        items: { type: "string" },
      },
      noteText: { type: "string" },
      reasoning: { type: "string" },
    },
    required: ["action", "reasoning"],
  };
}

/**
 * LLM Client for Creative Approach Agent
 * Uses OpenRouter with response_format for structured output
 */
export class LLMClient {
  constructor(private modelId: string) {}

  /**
   * Call LLM with structured output
   */
  async callWithStructuredOutput<T extends z.ZodTypeAny>(options: {
    systemPrompt: string;
    userPrompt: string;
    context: CAAContext;
    schema?: T;
  }): Promise<z.infer<T>> {
    const schema = options.schema || (caaResponseSchema as T);
    const fullSystemPrompt = this.buildFullSystemPrompt(
      options.systemPrompt,
      options.context,
    );

    const jsonSchema = zodSchemaToJsonSchema(schema as any);
    const enhancedSystemPrompt = `${fullSystemPrompt}

IMPORTANT: You MUST return a valid JSON object that matches exactly this schema:
${JSON.stringify(jsonSchema, null, 2)}

Return ONLY the JSON object, no markdown formatting, no backticks, no additional text.`;

    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const isRetry = attempt > 0;
        const retryInstruction = isRetry
          ? "\n\nIMPORTANT: Your previous response failed validation. PLEASE RETURN ONLY VALID JSON AS INSTRUCTED ABOVE. No markdown, no backticks, just the raw JSON object."
          : "";

        // Build user message with images if available
        const userMessageContent: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = [];

        // Add images first (if any selected)
        if (options.context.selectedImages.length > 0) {
          options.context.selectedImages.forEach((img) => {
            userMessageContent.push({
              type: "image_url",
              image_url: {
                url: img.transformedUrl, // 1024px transformed version
              },
            });
          });
        }

        // Add text prompt
        userMessageContent.push({
          type: "text",
          text:
            options.userPrompt +
            (isRetry
              ? "\n\nREMINDER: Return ONLY valid JSON matching the specified schema."
              : ""),
        });

        const completion = await openrouter.chat.completions.create({
          model: this.modelId,
          messages: [
            {
              role: "system",
              content: enhancedSystemPrompt + retryInstruction,
            },
            {
              role: "user",
              content: userMessageContent,
            },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          response_format: {
            type: "json_object",
          },
        });

        const content = completion.choices[0]?.message?.content;

        if (!content) {
          throw new Error("No response content from LLM");
        }

        const parsedJson = JSON.parse(content);
        const validatedData = schema.parse(parsedJson);

        return validatedData;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries - 1) {
          throw new Error(
            `Failed to get valid structured response after ${maxRetries} attempts. Last error: ${lastError.message}`,
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
      }
    }

    throw lastError || new Error("Unexpected error in CAA LLM call");
  }

  /**
   * Build full system prompt with context
   */
  private buildFullSystemPrompt(
    approachPrompt: string,
    context: CAAContext,
  ): string {
    return `You are a Creative Approach Agent helping users create visual moodboards and brief boards.

CONTEXT:
- Brief: ${context.briefName} - ${context.briefDescription}
- Selected Images: ${context.selectedImages.length}
- Selected Post-its: ${context.selectedPostits.length}
- Available Assets: ${context.availableAssets.map((a) => a.label).join(", ")}

${approachPrompt}

YOUR TASK:
Analyze the user's request and canvas context, then choose ONE action:

1. **Generate new image**: User has no images selected, wants to create something new
   → Set action: "generate"
   → Provide enhancedPrompt

2. **Edit existing image(s)**: User has 1-8 images selected, wants to modify them
   → Set action: "edit"
   → Provide enhancedPrompt
   → If user mentions "logo", "brand", "watermark" → include asset names in includeAssets

3. **Answer question**: User asks about images (e.g., "how are these different?", "what's the common theme?")
   → Set action: "answer"
   → Provide noteText with a thoughtful 2-4 sentence answer

4. **Generate with explanation**: Rare cases where context suggests both image and note
   → Set action: "generate_and_note"
   → Provide both enhancedPrompt and noteText

ASSET MATCHING:
Available assets: ${context.availableAssets.map((a) => `${a.label} (${a.name})`).join(", ")}
When user mentions: "logo", "brand", "watermark", "pattern" → include matching asset names

IMPORTANT:
- Be concise but detailed in prompts
- For questions, provide thoughtful multi-sentence answers
- Always provide reasoning to explain your decision`;
  }
}
