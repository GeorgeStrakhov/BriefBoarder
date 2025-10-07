import { NextRequest, NextResponse } from "next/server";
import { answerUnstructured } from "@/lib/services/llm/llm";

export async function POST(req: NextRequest) {
  try {
    const { briefName, briefDescription } = await req.json();

    if (!briefName && !briefDescription) {
      return NextResponse.json(
        { error: "Brief name or description is required" },
        { status: 400 },
      );
    }

    const systemPrompt = `You are a creative director and strategist helping to refine advertising briefs.

Your task is to enhance the brief description by:
- Making it more comprehensive and actionable
- Adding strategic insights and creative direction
- Clarifying the core message and objectives
- Suggesting tone, audience, and creative approaches
- Making it inspiring and useful for creative teams

Keep the enhanced brief:
- Concise but thorough (2-4 paragraphs max)
- Focused on what matters for creative execution
- Authentic to the original intent
- Written in a clear, professional tone

If the original brief is very short, expand it thoughtfully. If it's already detailed, refine and strengthen it.`;

    const userPrompt = `Brief Name: ${briefName || "Untitled"}

Current Description:
${briefDescription || "No description provided"}

Enhance this brief description by making it more solid, comprehensive, and creatively inspiring. Return ONLY the enhanced description - no additional formatting or labels.`;

    console.log("[Enhance Brief] Calling LLM with:", {
      briefName,
      briefDescriptionLength: briefDescription?.length || 0,
    });

    const response = await answerUnstructured({
      systemPrompt,
      userPrompt,
      model: "anthropic/claude-sonnet-4.5",
      temperature: 0.7,
      maxTokens: 2000,
    });

    console.log(
      "[Enhance Brief] Raw LLM response:",
      response.substring(0, 200) + "...",
    );

    // Keep original name unchanged, only enhance description
    const enhancedDescription = response.trim();

    console.log("[Enhance Brief] Enhanced:", {
      originalName: briefName,
      enhancedDescriptionLength: enhancedDescription.length,
    });

    return NextResponse.json({
      enhancedName: briefName, // Keep original name unchanged
      enhancedDescription,
    });
  } catch (error) {
    console.error("[Enhance Brief] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to enhance brief",
      },
      { status: 500 },
    );
  }
}
