import { NextResponse } from "next/server";
import { db } from "@/db";
import { briefs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    const [brief] = await db.select().from(briefs).where(eq(briefs.id, uuid));

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    return NextResponse.json(brief);
  } catch (error) {
    console.error("Error fetching brief:", error);
    return NextResponse.json(
      { error: "Failed to fetch brief" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.canvasState !== undefined) {
      updateData.canvasState = body.canvasState;
    }
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }

    const [updatedBrief] = await db
      .update(briefs)
      .set(updateData)
      .where(eq(briefs.id, uuid))
      .returning();

    if (!updatedBrief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    return NextResponse.json(updatedBrief);
  } catch (error) {
    console.error("Error updating brief:", error);
    return NextResponse.json(
      { error: "Failed to update brief" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    const [deletedBrief] = await db
      .delete(briefs)
      .where(eq(briefs.id, uuid))
      .returning();

    if (!deletedBrief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting brief:", error);
    return NextResponse.json(
      { error: "Failed to delete brief" },
      { status: 500 },
    );
  }
}
