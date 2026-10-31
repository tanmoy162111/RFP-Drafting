import { z } from 'zod';
import type { DraftResponse } from './types';

const claimSchema = z.object({ text: z.string(), entryIds: z.array(z.string()) });

/** What the live model is asked to return. yesNo is required (with an explicit "not_applicable") so strict structured output works. */
export const modelOutputSchema = z.object({
  answer: z.string(),
  claims: z.array(claimSchema),
  yesNo: z.enum(['yes', 'no', 'not_applicable']),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** What the pipeline accepts from any provider. */
export const draftResponseSchema = z.object({
  answer: z.string(),
  claims: z.array(claimSchema),
  yesNo: z.enum(['yes', 'no']).optional(),
});

export function toDraftResponse(output: ModelOutput): DraftResponse {
  const { yesNo, ...rest } = output;
  return yesNo === 'not_applicable' ? rest : { ...rest, yesNo };
}
