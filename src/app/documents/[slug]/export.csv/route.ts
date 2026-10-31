import { ExportRefusedError } from '../../../../domain/approval';
import { ReviewError } from '../../../../review/decide';
import { ExportNotRecordedError, exportSheet } from '../../../../review/export';
import { getDb } from '../../../db';

export const dynamic = 'force-dynamic';

const text = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  try {
    const { csv, filename } = await exportSheet(getDb(), slug);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ReviewError && error.code === 'not_found') return text('Unknown document.', 404);
    if (error instanceof ExportRefusedError || error instanceof ExportNotRecordedError) return text(error.message, 409);
    throw error;
  }
}
