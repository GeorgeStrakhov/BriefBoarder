import { CreativeApproach } from "./base";
import { SimpleApproach } from "./simple";
import { DramaticApproach } from "./dramatic";
import { BernbachApproach } from "./bernbach";

/**
 * Approach Registry
 * Central registry for all creative approaches
 */

const APPROACHES: Record<string, CreativeApproach> = {
  simple: new SimpleApproach(),
  dramatic: new DramaticApproach(),
  bernbach: new BernbachApproach(),
  // Future approaches can be added here:
  // "layout-first": new LayoutFirstApproach(),
  // "random-technique": new RandomTechniqueApproach(),
};

/**
 * Get approach by ID
 */
export function getApproach(id: string): CreativeApproach {
  const approach = APPROACHES[id];
  if (!approach) {
    throw new Error(`Unknown creative approach: ${id}`);
  }
  return approach;
}

/**
 * List all available approaches
 */
export function listApproaches(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return Object.values(APPROACHES).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
  }));
}
