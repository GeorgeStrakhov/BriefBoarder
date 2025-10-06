import { NextRequest, NextResponse } from "next/server";
import { getApproach } from "@/lib/services/caa/approaches/registry";
import { LLMClient } from "@/lib/services/caa/llm-client";
import { CAAContext } from "@/lib/services/caa/types";

export async function POST(req: NextRequest) {
  try {
    const { context }: { context: CAAContext } = await req.json();

    // Validate
    if (!context.userPrompt || !context.userPrompt.trim()) {
      return NextResponse.json(
        { error: "User prompt is required" },
        { status: 400 }
      );
    }

    if (context.selectedImages.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 images can be selected" },
        { status: 400 }
      );
    }

    // Get the selected creative approach instance
    const approach = getApproach(context.settings.approach);

    // Create LLM client
    const llm = new LLMClient(context.settings.model);

    // Execute approach (could be single-step or multi-step workflow)
    const result = await approach.execute(context, llm);

    return NextResponse.json(result);

  } catch (error) {
    console.error("CAA error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "CAA processing failed",
      },
      { status: 500 }
    );
  }
}
