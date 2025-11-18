import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ViewReportClient } from './ViewReportClient';
import type { PublishedReport } from '@/app/api/reports/[reportId]/route';
import { sql } from '@/lib/db';
import type { RawRow } from '@/lib/schema/types';

/**
 * Prevent search engine indexing of published reports
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Fetch published report data directly from database
 * For password-protected reports, only returns metadata (not rows) until verified
 */
async function getReport(reportId: string): Promise<PublishedReport | null> {
  try {
    // Validate reportId format (21 chars, alphanumeric + - and _)
    if (!/^[A-Za-z0-9_-]{21}$/.test(reportId)) {
      return null;
    }

    // Fetch report metadata
    const reportResult = await sql`
      SELECT report_id, title, snapshot_date, created_at, synagogue_address, synagogue_lat, synagogue_lng, password_hash
      FROM published_reports
      WHERE report_id = ${reportId}
    `;

    // Handle both postgres (returns array directly) and SQLite (returns {rows, rowCount})
    const reportRows = Array.isArray(reportResult) ? reportResult : (reportResult as any).rows;

    if (!reportRows || reportRows.length === 0) {
      return null;
    }

    const report = reportRows[0];
    const isPasswordProtected = !!report.password_hash;

    // For password-protected reports, don't fetch data until verified
    if (isPasswordProtected) {
      return {
        reportId: report.report_id,
        title: report.title,
        snapshotDate: report.snapshot_date,
        createdAt: report.created_at,
        rows: [], // Empty - must verify password first
        isPasswordProtected: true,
      };
    }

    // Fetch all rows for this report (only for non-protected reports)
    const rowsResult = await sql`
      SELECT age, pledge_current, pledge_prior, zip_code
      FROM report_rows
      WHERE report_id = ${reportId}
      ORDER BY id
    `;

    // Handle both postgres and SQLite response formats
    const dbRows = Array.isArray(rowsResult) ? rowsResult : (rowsResult as any).rows;

    // Map database rows to RawRow format
    const rows: RawRow[] = dbRows.map((row: any) => ({
      age: Number(row.age),
      pledgeCurrent: Number(row.pledge_current),
      pledgePrior: Number(row.pledge_prior),
      zipCode: row.zip_code || undefined,
    }));

    // Return complete report
    return {
      reportId: report.report_id,
      title: report.title,
      snapshotDate: report.snapshot_date,
      createdAt: report.created_at,
      rows,
      ...(report.synagogue_address && { synagogueAddress: report.synagogue_address }),
      ...(report.synagogue_lat !== null && report.synagogue_lat !== undefined && { synagogueLat: Number(report.synagogue_lat) }),
      ...(report.synagogue_lng !== null && report.synagogue_lng !== undefined && { synagogueLng: Number(report.synagogue_lng) }),
      isPasswordProtected: false,
    };
  } catch (error) {
    console.error('Error fetching report:', error);
    return null;
  }
}

/**
 * View Published Report Page
 *
 * Server component that fetches the report and passes to client component for rendering.
 */
export default async function ViewReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await getReport(reportId);

  if (!report) {
    notFound();
  }

  return <ViewReportClient report={report} />;
}
