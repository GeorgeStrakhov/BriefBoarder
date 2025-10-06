/**
 * Asset Configuration
 * Defines predefined brand assets available to users and CAA
 */

export interface Asset {
  name: string; // Internal identifier (e.g., "logo")
  label: string; // Display name (e.g., "Company Logo")
  url: string; // CDN URL
  type: "brand" | "pattern" | "texture" | "custom";
}

// Predefined assets available to all users
export const PREDEFINED_ASSETS: Asset[] = [
  {
    name: "logo",
    label: "Company Logo",
    url: "https://placeholder.com/logo.png", // TODO: Replace with actual asset URL
    type: "brand",
  },
  {
    name: "logo-white",
    label: "Logo (White)",
    url: "https://placeholder.com/logo-white.png", // TODO: Replace with actual asset URL
    type: "brand",
  },
  {
    name: "pattern",
    label: "Brand Pattern",
    url: "https://placeholder.com/pattern.png", // TODO: Replace with actual asset URL
    type: "pattern",
  },
];
