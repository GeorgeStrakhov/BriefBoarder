import { NextRequest, NextResponse } from "next/server";
import { generateAd } from "@/lib/services/ad-generator/ad-generator";

export async function POST(req: NextRequest) {
  try {
    const options = await req.json();

    // Validate required fields
    if (!options.briefName || !options.approach) {
      return NextResponse.json(
        { error: "briefName and approach are required" },
        { status: 400 }
      );
    }

    const result = await generateAd(options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ad generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ad generation failed",
      },
      { status: 500 }
    );
  }
}
