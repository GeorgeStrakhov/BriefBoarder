# LLM Service Module

A reusable module for interacting with Large Language Models (LLMs) using Groq SDK.

## Setup

Ensure you have the `GROQ_API_KEY` environment variable set in your `.env` file:

```bash
GROQ_API_KEY=your_api_key_here
```

## Usage

### answerStructured

Sends prompts to an LLM and returns structured, validated responses using Zod schemas.

```typescript
import { answerStructured } from "@/lib/services/llm/llm";
import { z } from "zod";

// Define your response schema
const UserProfileSchema = z.object({
  name: z.string(),
  profession: z.string(),
  location: z.string(),
});

// Use the function
const result = await answerStructured({
  systemPrompt: `Convert the user input into structured JSON with the following fields: name, profession, location.
    Return a valid JSON object. If something is unknown, use "N/A".`,
  userPrompt: "Hi, I'm John, a software engineer from San Francisco",
  responseSchema: UserProfileSchema,
  // Optional parameters with defaults:
  model: "moonshotai/kimi-k2-instruct", // default
  temperature: 0.6, // default
  maxTokens: 4096, // default
  maxRetries: 3, // default
});

console.log(result);
// Output: { name: "John", profession: "software engineer", location: "San Francisco" }
```

## Features

- **Automatic JSON validation**: Uses Zod to validate the LLM response structure
- **Retry mechanism**: Automatically retries up to 3 times (configurable) if the LLM doesn't return valid structured data
- **Type safety**: Full TypeScript support with inferred types from Zod schemas
- **Configurable parameters**: Control model, temperature, max tokens, and retry attempts
- **Exponential backoff**: Implements increasing delays between retry attempts

## API Reference

### answerStructured(options)

#### Parameters

| Parameter        | Type      | Required | Default                         | Description                                            |
| ---------------- | --------- | -------- | ------------------------------- | ------------------------------------------------------ |
| `systemPrompt`   | `string`  | Yes      | -                               | Instructions for the LLM on how to format the response |
| `userPrompt`     | `string`  | Yes      | -                               | The user's input to process                            |
| `responseSchema` | `ZodType` | Yes      | -                               | Zod schema to validate the response                    |
| `model`          | `string`  | No       | `'moonshotai/kimi-k2-instruct'` | The LLM model to use                                   |
| `temperature`    | `number`  | No       | `0.6`                           | Controls response randomness (0-1)                     |
| `maxTokens`      | `number`  | No       | `4096`                          | Maximum tokens in the response                         |
| `maxRetries`     | `number`  | No       | `3`                             | Number of retry attempts for validation failures       |

#### Returns

Returns a Promise that resolves to the validated data matching the provided Zod schema.

#### Errors

Throws an error if:

- The LLM fails to respond
- The response cannot be parsed as JSON
- The response fails Zod validation after all retry attempts

## Available Models

The default model is `moonshotai/kimi-k2-instruct`, but you can use any model supported by Groq, such as:

- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- And more...

Check the [Groq documentation](https://console.groq.com/docs/models) for the latest available models.
