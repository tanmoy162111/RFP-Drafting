export interface DomainConfig {
  /** Evidence older than this many months since last review is stale. */
  stalenessMonths: number;
  /** Retrieval scores below this count as no evidence. */
  scoreFloor: number;
  /** Minimum similarity to the submitted answer to count as accepted without major edits. */
  similarityThreshold: number;
  /** Assumed minutes to answer one question manually. An assumption, not a measurement. */
  minutesPerManualAnswer: number;
}

export const DEFAULT_CONFIG: DomainConfig = {
  stalenessMonths: 12,
  scoreFloor: 0.35,
  similarityThreshold: 0.8,
  minutesPerManualAnswer: 20,
};
