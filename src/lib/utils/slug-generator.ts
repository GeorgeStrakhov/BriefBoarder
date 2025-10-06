/**
 * Generates a random short slug for landing pages
 * Format: adjective-noun-4digits (e.g., "swift-falcon-7829")
 */

const adjectives = [
  "swift",
  "bright",
  "bold",
  "smart",
  "fresh",
  "clear",
  "prime",
  "rapid",
  "sharp",
  "sleek",
  "cool",
  "pure",
  "keen",
  "wise",
  "brave",
  "agile",
  "vital",
  "noble",
  "crisp",
  "vivid",
  "stellar",
  "mighty",
  "cosmic",
  "radiant",
  "dynamic",
];

const nouns = [
  "falcon",
  "rocket",
  "spark",
  "wave",
  "bloom",
  "flash",
  "pulse",
  "storm",
  "dream",
  "leap",
  "quest",
  "forge",
  "nexus",
  "prism",
  "beacon",
  "phoenix",
  "comet",
  "aurora",
  "zenith",
  "vertex",
  "matrix",
  "cipher",
  "quantum",
  "fusion",
  "orbit",
];

export function generateRandomSlug(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `${adjective}-${noun}-${number}`;
}

/**
 * Validates if a slug is in the correct format
 */
export function isValidSlug(slug: string): boolean {
  // Allow alphanumeric characters, hyphens, and underscores
  // Must start and end with alphanumeric
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Sanitizes a string to create a valid slug
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .replace(/-{2,}/g, "-"); // Replace multiple hyphens with single
}
