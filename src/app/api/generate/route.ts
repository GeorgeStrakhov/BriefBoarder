import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/services/replicate/replicate";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, model, aspectRatio } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Generate image using Replicate
    const result = await generateImage({
      prompt,
      model: model || "imagen-4-ultra",
      aspectRatio: aspectRatio || "1:1",
      folder: "generated-images",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 },
    );
  }
}
