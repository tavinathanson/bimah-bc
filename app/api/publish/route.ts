import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateReportId } from '@/lib/generateReportId';
import { hashPassword } from '@/lib/password';
import { z } from 'zod';

/**
 * Request schema for publishing a report
 */
const PublishRequestSchema = z.object({
  title: z.string().min(1).max(200),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  rows: z.array(z.object({
    age: z.number().int().nonnegative(),
    pledgeCurrent: z.number().nonnegative(),
    pledgePrior: z.number().nonnegative(),
    zipCode: z.string().optional(),
  })).min(1),
  synagogueAddress: z.string().optional(),
  synagogueLat: z.number().optional(),
  synagogueLng: z.number().optional(),
  password: z.string().min(4).max(100).optional(),
});

/**
 * POST /api/publish
 *
 * Publishes a new pledge report to the database.
 * Returns the report ID and shareable URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { title, snapshotDate, rows, synagogueAddress, synagogueLat, synagogueLng, password } = PublishRequestSchema.parse(body);

    // Generate unique report ID
    const reportId = generateReportId();

    // Hash password if provided
    const passwordHash = password ? hashPassword(password) : null;

    // Insert report metadata
    await sql`
      INSERT INTO published_reports (report_id, title, snapshot_date, synagogue_address, synagogue_lat, synagogue_lng, password_hash)
      VALUES (${reportId}, ${title}, ${snapshotDate}, ${synagogueAddress ?? null}, ${synagogueLat ?? null}, ${synagogueLng ?? null}, ${passwordHash})
    `;

    // Bulk insert rows
    // Note: Vercel Postgres supports bulk inserts efficiently
    for (const row of rows) {
      await sql`
        INSERT INTO report_rows (report_id, age, pledge_current, pledge_prior, zip_code)
        VALUES (
          ${reportId},
          ${row.age},
          ${row.pledgeCurrent},
          ${row.pledgePrior},
          ${row.zipCode ?? null}
        )
      `;
    }

    // Return success with report URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const url = `${baseUrl}/${reportId}`;

    return NextResponse.json({
      success: true,
      reportId,
      url,
      isPasswordProtected: !!password,
    });

  } catch (error) {
    console.error('Error publishing report:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to publish report' },
      { status: 500 }
    );
  }
}
