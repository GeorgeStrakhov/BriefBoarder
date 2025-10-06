/**
 * Asset Configuration
 * Defines preset assets available to all briefs
 */

export interface Asset {
  name: string; // Internal identifier (e.g., "logo")
  label: string; // Display name (e.g., "Company Logo")
  url: string; // CDN URL
  type: "preset" | "custom";
}

// Get CDN base URL (lazy evaluation)
export function getCDNBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side - must use NEXT_PUBLIC_ prefix
    const url = process.env.NEXT_PUBLIC_S3_ENDPOINT || "";
    if (!url) {
      console.warn("NEXT_PUBLIC_S3_ENDPOINT not set - assets may not load correctly");
    }
    return url;
  }
  // Server-side
  return process.env.S3_PUBLIC_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT || "";
}

// Get preset assets (lazy evaluation so env vars are available)
export function getPresetAssets(): Asset[] {
  return [
    {
      name: "logo",
      label: "Logo",
      url: `${getCDNBaseUrl()}/logo.png`,
      type: "preset",
    },
  ];
}
