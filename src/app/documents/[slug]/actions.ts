'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ExportRefusedError } from '../../../domain/approval';
import { recordReview, ReviewError } from '../../../review/decide';
import { exportDocument } from '../../../review/export';
import { getDb } from '../../db';

const REVIEWER = 'demo reviewer (mock)';

const reviewSchema = z.object({
  slug: z.string().min(1),
  draftId: z.uuid(),
  ordinal: z.coerce.number().int().positive(),
  decision: z.enum(['accept', 'edit', 'reject']),
  finalText: z.string().max(10000).optional(),
});

const exportSchema = z.object({ slug: z.string().min(1) });

const back = (slug: string, error?: string, anchor?: string): string =>
  `/documents/${encodeURIComponent(slug)}${error ? `?error=${error}` : ''}${anchor ? `#${anchor}` : ''}`;

export async function reviewAction(formData: FormData): Promise<void> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(back(String(formData.get('slug') ?? ''), 'invalid'));
  const { slug, draftId, ordinal, decision, finalText } = parsed.data;

  let error: string | undefined;
  try {
    await recordReview(getDb(), { draftId, decision, finalText, reviewer: REVIEWER });
  } catch (caught) {
    error = caught instanceof ReviewError ? caught.code : 'unknown';
  }
  // Without this the client keeps the old page: a redirect that only adds a #hash is treated as in-page navigation.
  revalidatePath(`/documents/${slug}`);
  redirect(back(slug, error, `q-${ordinal}`));
}

export async function exportAction(formData: FormData): Promise<void> {
  const parsed = exportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(back('', 'invalid'));
  const { slug } = parsed.data;

  let error: string | undefined;
  try {
    await exportDocument(getDb(), slug);
  } catch (caught) {
    if (caught instanceof ExportRefusedError) error = 'not_ready';
    else if (caught instanceof ReviewError) error = caught.code;
    else error = 'unknown';
  }
  revalidatePath(`/documents/${slug}`);
  redirect(back(slug, error, 'export-heading'));
}
