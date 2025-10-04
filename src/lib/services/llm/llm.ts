import { Groq } from "groq-sdk";
import OpenAI from "openai";
import { z } from "zod";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface AnswerStructuredOptions<T extends z.ZodType> {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: T;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}

function zodSchemaToJsonSchema(schema: z.ZodType): unknown {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodSchemaToJsonSchema(value as z.ZodType);
      if (!(value as z.ZodTypeAny).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  } else if (schema instanceof z.ZodString) {
    return { type: "string" };
  } else if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  } else if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  } else if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodSchemaToJsonSchema(schema.element as z.ZodType),
    };
  } else if (schema instanceof z.ZodOptional) {
    return zodSchemaToJsonSchema(schema.unwrap() as z.ZodType);
  } else if (schema instanceof z.ZodNullable) {
    const innerSchema = zodSchemaToJsonSchema(schema.unwrap() as z.ZodType);
    return { ...(innerSchema as Record<string, unknown>), nullable: true };
  } else if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  } else {
    return {};
  }
}

export async function answerStructured<T extends z.ZodType>({
  systemPrompt,
  userPrompt,
  responseSchema,
  model = "moonshotai/kimi-k2-instruct",
  temperature = 0.6,
  maxTokens = 4096,
  maxRetries = 3,
}: AnswerStructuredOptions<T>): Promise<z.infer<T>> {
  let lastError: Error | undefined;
  const jsonSchema = zodSchemaToJsonSchema(responseSchema);

  const enhancedSystemPrompt = `${systemPrompt}

IMPORTANT: You MUST return a valid JSON object that matches exactly this schema:
${JSON.stringify(jsonSchema, null, 2)}

Return ONLY the JSON object, no markdown formatting, no backticks, no additional text.`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const isRetry = attempt > 0;
      const retryInstruction = isRetry
        ? "\n\nIMPORTANT: Your previous response failed validation. PLEASE RETURN ONLY VALID JSON AS INSTRUCTED ABOVE. No markdown, no backticks, just the raw JSON object."
        : "";

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: enhancedSystemPrompt + retryInstruction,
          },
          {
            role: "user",
            content:
              userPrompt +
              (isRetry
                ? "\n\nREMINDER: Return ONLY valid JSON matching the specified schema."
                : ""),
          },
        ],
        model,
        temperature,
        max_completion_tokens: maxTokens,
        top_p: 1,
        stream: false,
        response_format: {
          type: "json_object",
        },
      });

      const content = chatCompletion.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response content from LLM");
      }

      const parsedJson = JSON.parse(content);
      const validatedData = responseSchema.parse(parsedJson);

      return validatedData;
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1) {
        throw new Error(
          `Failed to get valid structured response after ${maxRetries} attempts. Last error: ${lastError.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Unexpected error in answerStructured");
}

// ===== UNSTRUCTURED GENERATION (OpenRouter) =====

interface AnswerUnstructuredOptions {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function answerUnstructured({
  systemPrompt,
  userPrompt,
  model = "anthropic/claude-sonnet-4.5",
  temperature = 0.7,
  maxTokens = 4096,
}: AnswerUnstructuredOptions): Promise<string> {
  try {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push({
      role: "user",
      content: userPrompt,
    });

    const completion = await openrouter.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from LLM");
    }

    return content;
  } catch (error) {
    throw new Error(
      `Failed to get unstructured response: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
