import ExcelJS from "exceljs";
import type { PledgeRow } from "../schema/types";
import {
  calculateTotals,
  calculateCohortMetrics,
  calculateBinMetrics,
  calculateStatusMetrics,
} from "../math/calculations";
import { FISCAL_YEAR } from "../schema/constants";
import { STATUS_DISPLAY_NAMES } from "../constants/statusDisplayNames";

export async function generateExcelWorkbook(data: PledgeRow[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Bimah BC";
  workbook.created = new Date();

  // Calculate metrics
  const totals = calculateTotals(data);
  const cohortMetrics = calculateCohortMetrics(data);
  const binMetrics = calculateBinMetrics(data);
  const statusMetrics = calculateStatusMetrics(data);

  // Sheet 1: Read Me
  const readMeSheet = workbook.addWorksheet("Read Me");
  readMeSheet.columns = [{ width: 100 }];

  readMeSheet.addRow(["Bimah BC - Pledge Analytics Report"]);
  readMeSheet.getCell("A1").font = { size: 16, bold: true };
  readMeSheet.addRow([]);
  readMeSheet.addRow([`Fiscal Year: ${FISCAL_YEAR.label} (${FISCAL_YEAR.startDate} to ${FISCAL_YEAR.endDate})`]);
  readMeSheet.addRow([]);
  readMeSheet.addRow(["DEFINITIONS"]);
  readMeSheet.getCell("A5").font = { bold: true, size: 12 };
  readMeSheet.addRow([]);
  readMeSheet.addRow(["Age Cohorts:"]);
  readMeSheet.addRow(["  • Under 40: age ≤ 39"]);
  readMeSheet.addRow(["  • 40-49: age 40-49"]);
  readMeSheet.addRow(["  • 50-64: age 50-64"]);
  readMeSheet.addRow(["  • 65+: age ≥ 65"]);
  readMeSheet.addRow([]);
  readMeSheet.addRow(["Pledge Bins (inclusive lower, exclusive upper except last):"]);
  readMeSheet.addRow(["  • $1-$1,799: [1, 1800)"]);
  readMeSheet.addRow(["  • $1,800-$2,499: [1800, 2500)"]);
  readMeSheet.addRow(["  • $2,500-$3,599: [2500, 3600)"]);
  readMeSheet.addRow(["  • $3,600-$5,399: [3600, 5400)"]);
  readMeSheet.addRow(["  • $5,400+: [5400, ∞)"]);
  readMeSheet.addRow([]);
  readMeSheet.addRow(["Status Classifications:"]);
  readMeSheet.addRow([`  • ${STATUS_DISPLAY_NAMES["renewed"]}: pledged > 0 in both years`]);
  readMeSheet.addRow([`  • ${STATUS_DISPLAY_NAMES["current-only"]}: pledged > 0 in current FY, 0 in prior FY`]);
  readMeSheet.addRow([`  • ${STATUS_DISPLAY_NAMES["prior-only"]}: pledged 0 in current FY, > 0 in prior FY`]);
  readMeSheet.addRow([`  • ${STATUS_DISPLAY_NAMES["no-pledge-both"]}: 0 in both years`]);
  readMeSheet.addRow([]);
  readMeSheet.addRow(["Validation Rules:"]);
  readMeSheet.addRow(["  • Age must be a non-negative integer"]);
  readMeSheet.addRow(["  • Pledge amounts must be numeric and ≥ 0"]);
  readMeSheet.addRow(["  • All rows require age, current pledge, and prior pledge values"]);
  readMeSheet.addRow([]);
  readMeSheet.addRow(["Limitations in v0:"]);
  readMeSheet.addRow(["  • No time-based progress tracking (requires gift dates)"]);
  readMeSheet.addRow(["  • Single snapshot analysis only"]);
  readMeSheet.addRow(["  • No household deduplication"]);

  // Sheet 2: Summary
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 20 },
    { header: "Notes", key: "notes", width: 40 },
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  summarySheet.addRow({
    metric: "Total Households",
    value: totals.totalHouseholds,
    notes: "Eligible households with valid data",
  });

  summarySheet.addRow({
    metric: "Total Pledged (Current FY)",
    value: totals.totalPledgedCurrent,
    notes: "",
  });
  summarySheet.getCell(`B${summarySheet.lastRow!.number}`).numFmt = "$#,##0.00";

  summarySheet.addRow({
    metric: "Total Pledged (Prior FY)",
    value: totals.totalPledgedPrior,
    notes: "",
  });
  summarySheet.getCell(`B${summarySheet.lastRow!.number}`).numFmt = "$#,##0.00";

  summarySheet.addRow({
    metric: "Delta ($)",
    value: totals.deltaDollar,
    notes: "Current - Prior",
  });
  summarySheet.getCell(`B${summarySheet.lastRow!.number}`).numFmt = "$#,##0.00";

  summarySheet.addRow({
    metric: "Delta (%)",
    value: totals.deltaPercent,
    notes: "(Current - Prior) / Prior",
  });
  summarySheet.getCell(`B${summarySheet.lastRow!.number}`).numFmt = "0.0%";

  summarySheet.addRow({ metric: STATUS_DISPLAY_NAMES["renewed"], value: totals.renewed, notes: "" });
  summarySheet.addRow({ metric: STATUS_DISPLAY_NAMES["current-only"], value: totals.currentOnly, notes: "" });
  summarySheet.addRow({ metric: STATUS_DISPLAY_NAMES["prior-only"], value: totals.priorOnly, notes: "" });
  summarySheet.addRow({
    metric: `${STATUS_DISPLAY_NAMES["no-pledge-both"]} (Both Years)`,
    value: totals.noPledgeBoth,
    notes: "",
  });

  // Sheet 3: Pledge Bins
  const binSheet = workbook.addWorksheet("Pledge Bins");
  binSheet.columns = [
    { header: "Bin", key: "bin", width: 20 },
    { header: "Households", key: "households", width: 15 },
    { header: "Total", key: "total", width: 15 },
    { header: "Average", key: "average", width: 15 },
    { header: "Median", key: "median", width: 15 },
  ];

  binSheet.getRow(1).font = { bold: true };
  binSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  binMetrics.forEach((bin) => {
    const row = binSheet.addRow({
      bin: bin.bin,
      households: bin.householdCount,
      total: bin.total,
      average: bin.average,
      median: bin.median,
    });

    row.getCell("total").numFmt = "$#,##0.00";
    row.getCell("average").numFmt = "$#,##0.00";
    row.getCell("median").numFmt = "$#,##0.00";
  });

  // Sheet 4: Age Cohorts
  const cohortSheet = workbook.addWorksheet("Age Cohorts");
  cohortSheet.columns = [
    { header: "Cohort", key: "cohort", width: 15 },
    { header: "Households", key: "households", width: 15 },
    { header: "Total Current", key: "totalCurrent", width: 15 },
    { header: "Avg. Current", key: "avgCurrent", width: 15 },
    { header: "Median Current", key: "medianCurrent", width: 15 },
    { header: "Renewal Rate", key: "renewalRate", width: 15 },
    { header: "Increased", key: "increased", width: 12 },
    { header: "Decreased", key: "decreased", width: 12 },
    { header: "No Change", key: "noChange", width: 12 },
  ];

  cohortSheet.getRow(1).font = { bold: true };
  cohortSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  cohortMetrics.forEach((cohort) => {
    const row = cohortSheet.addRow({
      cohort: cohort.cohort,
      households: cohort.householdCount,
      totalCurrent: cohort.totalCurrent,
      avgCurrent: cohort.averageCurrent,
      medianCurrent: cohort.medianCurrent,
      renewalRate: cohort.renewalRate,
      increased: cohort.increased,
      decreased: cohort.decreased,
      noChange: cohort.noChange,
    });

    row.getCell("totalCurrent").numFmt = "$#,##0.00";
    row.getCell("avgCurrent").numFmt = "$#,##0.00";
    row.getCell("medianCurrent").numFmt = "$#,##0.00";
    row.getCell("renewalRate").numFmt = "0.0%";
  });

  // Sheet 5: Renewal Status
  const statusSheet = workbook.addWorksheet("Renewal Status");
  statusSheet.columns = [
    { header: "Status", key: "status", width: 20 },
    { header: "Households", key: "households", width: 15 },
    { header: "Total Current", key: "totalCurrent", width: 15 },
    { header: "Total Prior", key: "totalPrior", width: 15 },
  ];

  statusSheet.getRow(1).font = { bold: true };
  statusSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  statusMetrics.forEach((status) => {
    const row = statusSheet.addRow({
      status: STATUS_DISPLAY_NAMES[status.status as keyof typeof STATUS_DISPLAY_NAMES] || status.status,
      households: status.householdCount,
      totalCurrent: status.totalCurrent,
      totalPrior: status.totalPrior,
    });

    row.getCell("totalCurrent").numFmt = "$#,##0.00";
    row.getCell("totalPrior").numFmt = "$#,##0.00";
  });


  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
