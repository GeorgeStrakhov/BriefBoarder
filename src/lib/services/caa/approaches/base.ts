import { CAAContext, CAAResult } from "../types";
import { LLMClient } from "../llm-client";

/**
 * Creative Approach Interface
 *
 * Each approach is a programmable workflow that can:
 * - Execute simple single-step LLM calls
 * - Implement complex multi-step workflows
 * - Add dynamic randomization and parameter variation
 * - Apply conditional logic based on context
 */
export interface CreativeApproach {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Brief description of the approach */
  description: string;

  /**
   * Main execution method
   * Can be simple (single LLM call) or complex (multi-step workflow)
   */
  execute(context: CAAContext, llm: LLMClient): Promise<CAAResult>;
}
