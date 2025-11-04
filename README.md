# Bimah: Beth Chaim - Pledge Analytics

**Bimah** is a Next.js application designed to analyze synagogue pledge data from ShulCloud exports. It provides comprehensive analytics, interactive visualizations, and detailed Excel reports for tracking pledge commitments across fiscal years.

## 🔒 Privacy First

**All data processing happens entirely in your browser.** Your pledge data:
- ✅ Never leaves your computer
- ✅ Is never uploaded to any server
- ✅ Is stored only in your browser's session storage
- ✅ Disappears when you close the browser tab

The only server interaction is a one-time passcode check for authentication. After that, everything runs client-side using JavaScript in your browser.

## Features

- **Secure Authentication**: Passcode-protected access via httpOnly cookies
- **Multi-File Upload**: Drag-and-drop XLSX/CSV file uploads with support for multiple files
- **Smart Column Mapping**: Flexible column mapping interface with live preview
- **Data Validation**: Row-level validation with clear error reporting
- **Comprehensive Analytics**:
  - Total pledges, changes, and renewal rates
  - Age cohort analysis (Under 40, 40-49, 50-64, 65+)
  - Pledge bin distribution ($1-$1,799, $1,800-$2,499, etc.)
  - Status classification (Renewed, Current Year Only, Prior Year Only)
  - Change direction tracking (Increased, Decreased, No Change)
  - Advanced insights (retention rates, concentration analysis, generational giving)
  - Statistical forecasts and projections
- **Interactive Visualizations**: Pie charts, bar charts, scatter plots with regression lines using Recharts
- **Export Capabilities**:
  - Multi-sheet Excel workbook with formatted metrics
  - CSV export of normalized data
- **Accessibility**: Keyboard navigation, high contrast, readable typography
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Processing**: SheetJS (xlsx) for parsing, ExcelJS for export - **all client-side**
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

## Deploy to Vercel

### 1. Push to GitHub

Ensure your code is pushed to a GitHub repository.

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 3. Set Environment Variable

In Vercel project settings, add:
- **Key**: `BIMAH_PASSCODE`
- **Value**: Your secure passcode

### 4. Deploy

Click "Deploy" and wait for the build to complete.

### 5. Configure Custom Domain (bethchaim.bimah.org)

#### In Vercel:
1. Go to your project settings → Domains
2. Add domain: `bethchaim.bimah.org`
3. Vercel will provide DNS records to configure

#### In Namecheap:
1. Log in to Namecheap
2. Go to Domain List → bimah.org → Manage
3. Navigate to "Advanced DNS"
4. Add a CNAME record:
   - **Type**: CNAME Record
   - **Host**: bethchaim
   - **Value**: `cname.vercel-dns.com.` (or the value Vercel provides)
   - **TTL**: Automatic

5. Wait for DNS propagation (can take up to 48 hours, usually much faster)

Vercel will automatically provision an SSL certificate for your custom domain.

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

**Privacy Note**: Your files are processed entirely in your browser. No data is uploaded to any server.

### 4. View Analytics

The dashboard displays:

- **Summary tiles**: Total households, pledges, changes, and renewal counts
- **Pie chart**: Pledge status distribution (Renewed, Current Year Only, Prior Year Only)
- **Bar charts**: Age cohorts, pledge bins, change direction
- **Tables**: Detailed cohort and bin metrics with sortable columns
- **Insights page**: Advanced metrics including retention rates, pledge concentration, and generational giving
- **Forecasts page**: Statistical projections with regression analysis and scenario planning

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

- **FY26**: July 1, 2025 to June 30, 2026

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
- **Current Year Only**: Pledged > 0 in current FY, 0 in prior FY
- **Prior Year Only**: Pledged 0 in current FY, > 0 in prior FY
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

## Known Limitations

- **No time-based progress tracking**: Requires gift dates, not available in this version
- **Single snapshot only**: Cannot compare across multiple fiscal years simultaneously
- **No household deduplication**: Each row is treated independently
- **In-memory only**: Data is stored in browser sessionStorage; no database persistence
- **No user roles**: Single passcode for all users

## Privacy & Security

### How Your Data is Protected

1. **Client-Side Processing**: All file parsing, calculations, and analysis happen in your browser using JavaScript. Your pledge data never leaves your computer.

2. **No Server Upload**: When you upload a file, it's read by your browser directly - not sent to any server.

3. **Session Storage Only**: Data is temporarily stored in your browser's `sessionStorage`, which:
   - Only exists for the current browser tab
   - Is automatically deleted when you close the tab
   - Cannot be accessed by other websites
   - Is never synced or backed up anywhere

4. **Authentication**: The only server interaction is checking your passcode when you first log in. This creates a session cookie that proves you're authenticated, but doesn't contain any pledge data.

5. **No Analytics or Tracking**: This application does not use Google Analytics, Facebook Pixel, or any other tracking services.

6. **Open Source**: All code is open source and can be audited. You can verify that no data is being sent anywhere by reviewing the code or using browser developer tools to monitor network requests.

### What Gets Sent to the Server

The **only** data sent to the server is:
- Your passcode (encrypted via HTTPS) during login
- Standard HTTP headers (user agent, etc.)

The server **never** receives:
- Your Excel/CSV files
- Pledge amounts
- Names or identifying information
- Any analytics or usage data

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
│   ├── dashboard/         # Main analytics dashboard
│   ├── insights/          # Advanced metrics
│   └── forecasts/         # Statistical projections
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                  # Core business logic
│   ├── parsing/          # File parsing (SheetJS - client-side)
│   ├── math/             # Metrics calculations (client-side)
│   ├── export/           # Excel export (ExcelJS - client-side)
│   └── schema/           # Zod schemas and types
├── tests/                # Test files
└── middleware.ts         # Authentication middleware
```

## Future Enhancements

Ideas for future versions:

- Multi-year trend analysis with gift dates
- Household deduplication and canonical IDs
- Server-side persistence (optional, with encryption)
- User roles and audit logs
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
