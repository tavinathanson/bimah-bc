# ShulCloud Transactions Export Guide

This guide explains how to export and import ShulCloud transaction data into Bimah for pledge analysis.

## Exporting from ShulCloud

1. Log in to your ShulCloud admin portal
2. Navigate to **Reports** > **Transaction Reports** (or similar)
3. Select the date range for your export (must include at least 2 fiscal years)
4. Export to Excel (.xlsx) or CSV format

## Required Columns

The export must include these columns for Bimah to process it:

| Column | Description |
|--------|-------------|
| **Type** | Transaction type - must contain "Hineini" and fiscal year (e.g., "Hineini 25") |
| **Charge** | The pledge/donation amount |
| **Account ID** | Unique identifier for each household |
| **Primary's Birthday** | Date of birth for age calculation |

## Optional Columns

These columns are supported but not required:

| Column | Description |
|--------|-------------|
| **Zip** | ZIP code for geographic analysis |
| **Date** | Transaction date |
| **Member Since** | Membership start date |
| **Join Date** | Join date |
| **ID** | Transaction ID |
| **Type External ID** | External type identifier |
| **Date Entered** | Entry timestamp |

## How Bimah Processes ShulCloud Data

When you import a ShulCloud export, Bimah automatically:

1. **Detects the format** - Recognizes ShulCloud exports by column headers
2. **Filters for Hineini** - Only processes rows where the Type column contains "hineini" (case-insensitive)
3. **Extracts fiscal years** - Looks for year codes like "25" or "26" in the Type column (e.g., "Hineini 25" = fiscal year 2025)
4. **Groups by Account ID** - Combines all transactions for the same household
5. **Sums amounts** - If a household has multiple transactions in the same fiscal year, amounts are summed
6. **Calculates age** - Converts Primary's Birthday to current age
7. **Uses two most recent years** - For year-over-year comparison charts

## Example Type Values

Valid Type values:
- `Hineini 25` - Fiscal year 2025
- `HINEINI 26` - Fiscal year 2026 (case doesn't matter)
- `Hineini Pledge 25` - Also valid

Invalid Type values (will cause errors):
- `Hineini` - Missing year
- `Hineini 2025` - Full year format not supported (use 2-digit)

## Requirements

### Minimum Data Requirements

- **At least 2 fiscal years** - Bimah needs year-over-year data for comparison charts
- **Valid birthdays** - Each account must have a valid date in Primary's Birthday

### How Amounts Are Calculated

All transactions for the same Account ID and fiscal year are **summed together**. This includes:
- Multiple pledge payments
- Adjustments
- Credits/refunds (negative values)

Negative values can be entered as:
- Negative numbers: `-100.00`
- Accounting notation: `($100.00)` or `(100)`

This ensures the net pledge amount is calculated correctly for each household per fiscal year.

### Fiscal Year Format

The fiscal year must appear as a 2-digit number in the Type column:
- `25` = 2025
- `26` = 2026
- `24` = 2024

## Troubleshooting

### "Missing fiscal year" error

Make sure each Hineini transaction has a 2-digit year in the Type column. Check that the Type value looks like "Hineini 25" not just "Hineini".

### "Only 1 fiscal year found" error

Bimah requires at least 2 years of data for year-over-year analysis. Expand your export date range to include transactions from a second fiscal year.

### "Invalid or missing birthday" error

The Primary's Birthday column must contain a valid date for each account. Check that the date is properly formatted (Excel dates, ISO format, or common date formats are supported).

### "Missing Account ID" error

Each Hineini transaction must have an Account ID to enable grouping by household. Ensure this column is included in your ShulCloud export.

## Data Privacy

All processing happens in your browser. ShulCloud data is never uploaded to any server unless you explicitly publish a report (which only includes anonymized aggregate data - age, pledge amounts, and ZIP code).
