import { NextResponse } from "next/server";
import { db } from "@/db";
import { briefs } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const allBriefs = await db
      .select()
      .from(briefs)
      .orderBy(desc(briefs.createdAt));
    return NextResponse.json(allBriefs);
  } catch (error) {
    console.error("Error fetching briefs:", error);
    return NextResponse.json(
      { error: "Failed to fetch briefs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [newBrief] = await db
      .insert(briefs)
      .values({
        name,
        description: description || null,
        canvasState: { images: [] },
      })
      .returning();

    return NextResponse.json(newBrief);
  } catch (error) {
    console.error("Error creating brief:", error);
    return NextResponse.json(
      { error: "Failed to create brief" },
      { status: 500 },
    );
  }
}
