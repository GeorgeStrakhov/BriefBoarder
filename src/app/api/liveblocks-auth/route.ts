import { Liveblocks } from "@liveblocks/node";
import { NextRequest, NextResponse } from "next/server";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    // Get room ID from request body
    const { room } = await request.json();

    if (!room) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 },
      );
    }

    // TODO: Add real authentication here
    // For now, generate a random user ID
    // In production, verify user session and check if they have access to this brief
    const userId = `user-${Math.random().toString(36).substring(7)}`;
    const userName = `User ${userId.substring(5, 10)}`;

    // Create a session for the user
    const session = liveblocks.prepareSession(userId, {
      userInfo: {
        name: userName,
        // Add more user info as needed (avatar, email, etc.)
      },
    });

    // Allow access to the requested room
    session.allow(room, session.FULL_ACCESS);

    // Authorize the user and return the token
    const { status, body } = await session.authorize();

    return new NextResponse(body, { status });
  } catch (error) {
    console.error("Liveblocks auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
