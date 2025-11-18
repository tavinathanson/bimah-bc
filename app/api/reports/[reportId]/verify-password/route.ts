import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { z } from 'zod';
import type { RawRow } from '@/lib/schema/types';

const VerifyPasswordSchema = z.object({
  password: z.string().min(1),
});

/**
 * POST /api/reports/[reportId]/verify-password
 *
 * Verifies a password for a password-protected report.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    // Validate reportId format
    if (!/^[A-Za-z0-9_-]{21}$/.test(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { password } = VerifyPasswordSchema.parse(body);

    // Fetch password hash and metadata from database
    const result = await sql`
      SELECT password_hash, synagogue_address, synagogue_lat, synagogue_lng
      FROM published_reports
      WHERE report_id = ${reportId}
    `;

    // Handle both postgres (returns array directly) and SQLite (returns {rows, rowCount})
    const rows = Array.isArray(result) ? result : (result as any).rows;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const { password_hash, synagogue_address, synagogue_lat, synagogue_lng } = rows[0];

    // Report is not password protected
    if (!password_hash) {
      return NextResponse.json({ valid: true });
    }

    // Verify password
    const isValid = verifyPassword(password, password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect password', valid: false },
        { status: 401 }
      );
    }

    // Password verified - fetch and return the actual report data
    const rowsResult = await sql`
      SELECT age, pledge_current, pledge_prior, zip_code
      FROM report_rows
      WHERE report_id = ${reportId}
      ORDER BY id
    `;

    const dbRows = Array.isArray(rowsResult) ? rowsResult : (rowsResult as any).rows;

    const reportRows: RawRow[] = dbRows.map((row: any) => ({
      age: Number(row.age),
      pledgeCurrent: Number(row.pledge_current),
      pledgePrior: Number(row.pledge_prior),
      zipCode: row.zip_code || undefined,
    }));

    return NextResponse.json({
      valid: true,
      rows: reportRows,
      ...(synagogue_address && { synagogueAddress: synagogue_address }),
      ...(synagogue_lat !== null && synagogue_lat !== undefined && { synagogueLat: Number(synagogue_lat) }),
      ...(synagogue_lng !== null && synagogue_lng !== undefined && { synagogueLng: Number(synagogue_lng) }),
    });

  } catch (error) {
    console.error('Error verifying password:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}
