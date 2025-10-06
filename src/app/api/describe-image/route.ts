import { NextRequest, NextResponse } from "next/server";
import { describeImage } from "@/lib/services/llm/llm";
import { transformImageUrl } from "@/lib/utils/image-transform";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    // Transform URL to max 1024px for vision API to save tokens
    const transformedUrl = transformImageUrl(imageUrl, {
      width: 1024,
      height: 1024,
      fit: "scale-down",
    });

    const description = await describeImage({
      imageUrl: transformedUrl,
    });

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Describe image error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to describe image",
      },
      { status: 500 },
    );
  }
}
