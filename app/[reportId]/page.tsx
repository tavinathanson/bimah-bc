import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ViewReportClient } from './ViewReportClient';
import type { PublishedReport } from '@/app/api/reports/[reportId]/route';

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
 * Fetch published report data server-side
 */
async function getReport(reportId: string): Promise<PublishedReport | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/reports/${reportId}`, {
      // Disable caching to always get fresh data
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
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
