import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { RawRow } from '@/lib/schema/types';

/**
 * Response schema for a published report
 */
export interface PublishedReport {
  reportId: string;
  title: string;
  snapshotDate: string; // YYYY-MM-DD
  createdAt: string;    // ISO timestamp
  rows: RawRow[];
}

/**
 * GET /api/reports/[reportId]
 *
 * Fetches a published report by ID.
 * Returns report metadata and all pledge rows.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    // Validate reportId format (21 chars, alphanumeric + - and _)
    if (!/^[A-Za-z0-9_-]{21}$/.test(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID format' },
        { status: 400 }
      );
    }

    // Fetch report metadata
    const reportResult = await sql`
      SELECT report_id, title, snapshot_date, created_at
      FROM published_reports
      WHERE report_id = ${reportId}
    `;

    if (reportResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const report = reportResult.rows[0];

    // Fetch all rows for this report
    const rowsResult = await sql`
      SELECT age, pledge_current, pledge_prior, zip_code
      FROM report_rows
      WHERE report_id = ${reportId}
      ORDER BY id
    `;

    // Map database rows to RawRow format
    const rows: RawRow[] = rowsResult.rows.map((row: any) => ({
      age: Number(row.age),
      pledgeCurrent: Number(row.pledge_current),
      pledgePrior: Number(row.pledge_prior),
      zipCode: row.zip_code || undefined,
    }));

    // Return complete report
    const response: PublishedReport = {
      reportId: report.report_id,
      title: report.title,
      snapshotDate: report.snapshot_date,
      createdAt: report.created_at,
      rows,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/[reportId]
 *
 * Deletes a published report.
 * This will cascade delete all associated rows.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    // Validate reportId format
    if (!/^[A-Za-z0-9_-]{21}$/.test(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID format' },
        { status: 400 }
      );
    }

    // Delete report (will cascade to report_rows)
    const result = await sql`
      DELETE FROM published_reports
      WHERE report_id = ${reportId}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
