# Bimah BC - Pledge Analytics

**Bimah BC** is a Next.js 16 application designed to ingest, analyze, and report on synagogue pledge data from ShulCloud exports. It provides comprehensive analytics, interactive visualizations, and detailed Excel reports for tracking pledge commitments across fiscal years.

## Features

- **Secure Authentication**: Passcode-protected access via httpOnly cookies
- **Multi-File Upload**: Drag-and-drop XLSX/CSV file uploads with support for multiple files
- **Smart Column Mapping**: Flexible column mapping interface with live preview
- **Data Validation**: Row-level validation with clear error reporting
- **Comprehensive Analytics**:
  - Total pledges, changes, and renewal rates
  - Age cohort analysis (Under 40, 40-49, 50-64, 65+)
  - Pledge bin distribution ($1-$1,799, $1,800-$2,499, etc.)
  - Status classification (Renewed, New, Resigned)
  - Change direction tracking (Increased, Decreased, No Change)
- **Interactive Visualizations**: Pie charts, bar charts, and sortable tables using Recharts
- **Export Capabilities**:
  - Multi-sheet Excel workbook with formatted metrics
  - CSV export of normalized data
- **Accessibility**: Keyboard navigation, high contrast, readable typography

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Processing**: SheetJS (xlsx) for parsing, ExcelJS for export
- **Charts**: Recharts
- **Validation**: Zod
- **Testing**: Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 18+ (tested with Node 22)
- npm or pnpm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/tavinathanson/bimah-bc.git
cd bimah-bc
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your passcode:

```bash
BIMAH_PASSCODE=your-secure-passcode-here
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tavinathanson/bimah-bc)

Make sure to set the `BIMAH_PASSCODE` environment variable in your Vercel project settings.

## Usage Guide

### 1. Authentication

When you first access the app, you'll be prompted to enter the passcode configured in your environment variables. This creates a secure session cookie that lasts 24 hours.

### 2. Preparing Your Data

Export pledge data from ShulCloud as XLSX or CSV files. Your files should contain at minimum:

- **Age column**: Integer age values (floats will be truncated)
- **Current FY Pledge column**: Numeric pledge amounts for the current fiscal year
- **Prior FY Pledge column**: Numeric pledge amounts for the prior fiscal year

Currency symbols, commas, and whitespace are automatically handled during parsing.

### 3. Upload and Map Columns

1. Drag and drop your files or click to browse
2. For each file, map the required columns:
   - Age Column
   - Current FY Pledge
   - Prior FY Pledge
3. Preview the first 25 rows to verify parsing
4. Click "Validate File" to check for errors
5. Once all files are validated, click "Continue to Dashboard"

### 4. View Analytics

The dashboard displays:

- **Summary tiles**: Total households, pledges, changes, and renewal counts
- **Pie chart**: Pledge status distribution (Renewed, New, Resigned)
- **Bar charts**: Age cohorts, pledge bins, change direction
- **Tables**: Detailed cohort and bin metrics with sortable columns

### 5. Export Reports

- **CSV Export**: Raw normalized data with all computed fields
- **Excel Report**: Multi-sheet workbook including:
  - Read Me (definitions and documentation)
  - Summary metrics
  - Pledge bin analysis
  - Age cohort analysis
  - Renewal status breakdown
  - Raw normalized data

## Data Definitions

### Fiscal Year

- **FY26**: July 1, 2025 to June 30, 2026 (hardcoded for v0)

### Age Cohorts

- **Under 40**: age ≤ 39
- **40-49**: age 40-49
- **50-64**: age 50-64
- **65+**: age ≥ 65

### Pledge Bins

Bins use **[inclusive lower, exclusive upper)** boundaries except the last bin:

- **$1-$1,799**: [1, 1800)
- **$1,800-$2,499**: [1800, 2500)
- **$2,500-$3,599**: [2500, 3600)
- **$3,600-$5,399**: [3600, 5400)
- **$5,400+**: [5400, ∞)

### Status Classifications

- **Renewed**: Pledged > 0 in both current and prior FY
- **New**: Pledged > 0 in current FY, 0 in prior FY
- **Resigned**: Pledged 0 in current FY, > 0 in prior FY
- **No-pledge-both**: Pledged 0 in both years

### Change Direction (Renewed Only)

- **Increased**: Current pledge > Prior pledge
- **Decreased**: Current pledge < Prior pledge
- **No Change**: Current pledge = Prior pledge

## Validation Rules

- Age must be a non-negative integer
- Pledge amounts must be numeric and ≥ 0
- All rows require valid age, current pledge, and prior pledge values
- Empty or non-numeric values will cause row-level errors

## Known Limitations (v0)

- **No time-based progress tracking**: Requires gift dates, not available in this version
- **Single snapshot only**: Cannot compare across multiple fiscal years simultaneously
- **No household deduplication**: Each row is treated independently
- **In-memory only**: Data is stored in sessionStorage; no database persistence
- **No user roles**: Single passcode for all users

## Testing

Run the test suite:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

Generate coverage report:

```bash
npm run test:coverage
```

## Project Structure

```
bimah-bc/
├── app/                    # Next.js App Router pages
│   ├── enter/             # Authentication page
│   ├── upload/            # File upload and mapping
│   └── dashboard/         # Analytics and visualizations
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                  # Core business logic
│   ├── parsing/          # File parsing (SheetJS)
│   ├── math/             # Metrics calculations
│   ├── export/           # Excel export (ExcelJS)
│   └── schema/           # Zod schemas and types
├── tests/                # Test files
└── middleware.ts         # Authentication middleware
```

## Future Enhancements

Ideas for future versions:

- Multi-year trend analysis with gift dates
- Household deduplication and canonical IDs
- Server-side persistence (Postgres with row-level security)
- User roles and audit logs
- White-label theming for Beth Chaim branding
- Advanced filtering and custom cohort definitions
- Automated email reports
- Integration with ShulCloud API

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues or questions, please file an issue at [GitHub Issues](https://github.com/tavinathanson/bimah-bc/issues)

## Acknowledgments

Built with love for Beth Chaim and the broader synagogue community.
