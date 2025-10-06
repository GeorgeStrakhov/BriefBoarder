import { createClient } from "@liveblocks/client";

// Initialize Liveblocks client
export const liveblocksClient = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,

  // Optional: Enable throttling for performance
  throttle: 50, // ms between updates
});
