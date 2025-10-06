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

// Get CDN base URL
const getCDNBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Client-side
    return process.env.NEXT_PUBLIC_S3_ENDPOINT || "";
  }
  // Server-side
  return process.env.S3_PUBLIC_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT || "";
};

// Preset assets automatically available to all briefs
export const PRESET_ASSETS: Asset[] = [
  {
    name: "logo",
    label: "Logo",
    url: `${getCDNBaseUrl()}/logo.png`,
    type: "preset",
  },
];
