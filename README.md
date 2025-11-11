# Bimah - Analytics for Synagogues

**Bimah** is a privacy-first analytics platform for synagogues. Upload your data, explore insights with interactive visualizations, export detailed reports, and optionally publish secure dashboards to share with your board.

## 🎯 Design Philosophy: Extensibility First

This application is designed to work for **any synagogue or religious organization**, not just one specific congregation. We avoid hardcoding values and instead calculate bins, ranges, and thresholds dynamically from your data. See [`.claude/design-principles.md`](./.claude/design-principles.md) for detailed design guidelines.

## 🔒 Privacy First

**Two modes of operation:**

**1. Local Analysis (Default)**: All data processing happens entirely in your browser:
- ✅ Data never leaves your computer
- ✅ Stored only in browser session storage
- ✅ Automatically deleted when you close the tab
- ✅ No server interaction required

**2. Publish & Share (Optional)**: Securely share anonymous reports:
- ✅ Only minimal data uploaded (age, pledge amounts, ZIP codes)
- ✅ **Never** uploads names or personal information
- ✅ Unguessable URLs (128-bit security)
- ✅ Blocked from search engines

## Features

- **No Login Required**: Since all data is processed locally in your browser, no authentication needed (passcode feature available but currently disabled)
- **Multi-File Import**: Drag-and-drop XLSX/CSV file imports with support for multiple files
- **Smart Column Mapping**: Flexible column mapping interface with live preview
- **Data Validation**: Row-level validation with clear error reporting
- **Comprehensive Analytics**:
  - Total pledges, changes, and renewal rates
  - Age cohort analysis (Under 40, 40-49, 50-64, 65+)
  - Pledge bin distribution ($1-$1,799, $1,800-$2,499, etc.)
  - Status classification (Renewed, New: Current Year Only, Lapsed: Prior Year Only)
  - Change direction tracking (Increased, Decreased, No Change)
  - Advanced insights (retention rates, concentration analysis, generational giving)
  - Statistical forecasts and projections
  - **Geographic analysis** (optional): ZIP code mapping and distance-based visualizations
- **Interactive Visualizations**: Pie charts, bar charts, scatter plots with regression lines using Recharts
- **Export Capabilities**:
  - Multi-sheet Excel workbook with formatted metrics
  - CSV export of normalized data
- **Publish & Share** (optional):
  - Securely publish reports with unguessable URLs
  - Share interactive dashboards with board members
  - Anonymous data only (no names or personal info)
  - Point-in-time snapshots with clear dates
- **Accessibility**: Keyboard navigation, high contrast, readable typography
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Processing**: SheetJS (xlsx) for parsing, ExcelJS for export - **all client-side**
- **Charts**: Recharts
- **Maps**: Leaflet + react-leaflet for geographic visualizations
- **Database**: Vercel Postgres (optional, for published reports only)
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

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

**Note**: Passcode authentication is currently disabled since all data is local. To re-enable it, uncomment the middleware code in `middleware.ts` and set `BIMAH_PASSCODE` in `.env.local`.

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

### 3. Set Up Database (Optional - for Publish Feature)

**To enable report publishing:**

1. In your Vercel project, go to the **Storage** tab
2. Click **Create Database** → Select **Postgres**
3. Choose your region and create the database
4. Go to the **Query** tab and run the schema:

```sql
-- Copy and paste the contents of db/schema.sql
```

**If you skip this step**: The app works perfectly for local analysis. Publishing will simply be unavailable.

### 4. Deploy

Click "Deploy" and wait for the build to complete. Environment variables are automatically configured by Vercel when you create the database.

### 5. Configure Custom Domain (Optional)

#### In Vercel:
1. Go to your project settings → Domains
2. Add your custom domain (e.g., `analytics.yoursynagogue.org`)
3. Vercel will provide DNS records to configure

#### In Your DNS Provider:
1. Log in to your domain registrar (Namecheap, GoDaddy, etc.)
2. Navigate to DNS settings for your domain
3. Add a CNAME record:
   - **Type**: CNAME Record
   - **Host**: your subdomain (e.g., `analytics`)
   - **Value**: `cname.vercel-dns.com.` (or the value Vercel provides)
   - **TTL**: Automatic

4. Wait for DNS propagation (can take up to 48 hours, usually much faster)

Vercel will automatically provision an SSL certificate for your custom domain.

## Usage Guide

### 1. Access the App

Simply visit your Vercel URL (or custom domain if configured). No login required!

### 2. Preparing Your Data

Export pledge data from ShulCloud as XLSX or CSV files. Your files should contain at minimum:

- **Age column** (or **Date of Birth column**): Integer age values (floats will be truncated) or dates in various formats
- **Current FY Pledge column**: Numeric pledge amounts for the current fiscal year
- **Prior FY Pledge column**: Numeric pledge amounts for the prior fiscal year
- **ZIP Code column** (optional): 5-digit ZIP codes for geographic analysis

Currency symbols, commas, and whitespace are automatically handled during parsing.

### 3. Upload and Map Columns

1. Drag and drop your files or click to browse
2. For each file, map the required columns:
   - Age / Date of Birth Column (required)
   - ZIP Code Column (optional - enables Geography page)
   - Current FY Pledge (required)
   - Prior FY Pledge (required)
3. Preview the first 25 rows to verify parsing
4. Click "Validate File" to check for errors
5. Once all files are validated, click "Continue to Dashboard"

**Privacy Note**: Your files are processed entirely in your browser. No data is uploaded to any server.

### 4. View Analytics

The dashboard displays:

- **Summary tiles**: Total households, pledges, changes, and renewal counts
- **Pie chart**: Pledge status distribution (Renewed, New: Current Year Only, Lapsed: Prior Year Only)
- **Bar charts**: Age cohorts, pledge bins, change direction
- **Tables**: Detailed cohort and bin metrics with sortable columns
- **Insights page**: Advanced metrics including retention rates, pledge concentration, and generational giving
- **Forecasts page**: Statistical projections with regression analysis and scenario planning
- **Geography page** (if ZIP codes provided):
  - Interactive map with ZIP code markers
  - Distance histogram from synagogue
  - Sortable ZIP code table with export

### 5. Export Summary Reports

- **Excel Summary Report**: Multi-sheet workbook with aggregated metrics including:
  - Read Me (definitions and documentation)
  - Summary metrics (totals, counts, changes)
  - Pledge bin analysis
  - Age cohort analysis
  - Renewal status breakdown

**Note**: Individual household data is not included in exports to protect privacy. Only aggregate summary statistics are exported.

### 6. Publish & Share Reports (Optional)

**Share interactive reports with board members:**

1. Click **Publish Report** in the dashboard navigation
2. Enter a title (e.g., "FY25 Pledge Report")
3. Review what data will be shared (ages, pledges, ZIP codes only)
4. Click **Publish Report**
5. Copy and share the unique URL

**What gets published:**
- Anonymous pledge data (age, current pledge, prior pledge, ZIP code)
- Static snapshot as of the publish date
- **Never includes** names, addresses, or personal information

**Security:**
- Unguessable 21-character URLs (128-bit security)
- Blocked from search engines via robots.txt and noindex tags
- Anyone with the link can view (no password required)

**Note**: Requires Vercel Postgres to be set up (see deployment section).

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
- **New: Current Year Only**: Pledged > 0 in current FY, 0 in prior FY
- **Lapsed: Prior Year Only**: Pledged 0 in current FY, > 0 in prior FY
- **No Pledge**: Pledged 0 in both years

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
- **Published reports are read-only**: No ability to edit or update after publishing
- **No access control on published reports**: Anyone with the URL can view (by design for simplicity)

## Privacy & Security

### How Your Data is Protected

1. **Client-Side Processing**: All file parsing, calculations, and analysis happen in your browser using JavaScript. Your pledge data never leaves your computer.

2. **No Server Upload**: When you upload a file, it's read by your browser directly - not sent to any server.

3. **Session Storage Only**: Data is temporarily stored in your browser's `sessionStorage`, which:
   - Only exists for the current browser tab
   - Is automatically deleted when you close the tab
   - Cannot be accessed by other websites
   - Is never synced or backed up anywhere

4. **No Authentication Required**: Since all data is local, no login or passcode is needed. You can start using the app immediately.

5. **No Analytics or Tracking**: This application does not use Google Analytics, Facebook Pixel, or any other tracking services.

6. **Open Source**: All code is open source and can be audited. You can verify that no data is being sent anywhere by reviewing the code or using browser developer tools to monitor network requests.

### What Gets Sent to the Server

**Local Analysis Mode (Default):**
- Nothing. All processing happens in your browser.

**When You Publish a Report (Optional):**
- Anonymous pledge rows (age, pledge amounts, ZIP codes)
- Report title and snapshot date

The server **never** receives:
- Your original Excel/CSV files
- Names or identifying information
- Email addresses or phone numbers
- Any analytics or usage data

## Testing & Linting

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

Check for TypeScript errors:

```bash
npm run type-check
```

Run linter:

```bash
npm run lint
```

Run both type checking and linting:

```bash
npm run check
```

**Before pushing to GitHub**, run `npm run check` to catch TypeScript and linting errors locally.

## Geographic Analysis

When you include a ZIP Code column in your data, geographic analysis becomes available in the Dashboard.

### Getting Started
1. **Import data with ZIP codes**: Ensure your CSV/XLSX includes a ZIP Code column
2. **Go to Dashboard**: The Geographic Analysis section appears below the overview cards
3. **Set your location**: Expand the section and enter your synagogue/organization address
4. **Analyze and filter**: Use Dashboard filters to slice geographic data by age, pledge amount, or status

### Features
- **Integrated with Dashboard filters**: Geographic visualizations update based on your active filters
  - Example: Filter to age 30-40 and see only those households on the map
  - Example: Filter to $1000+ pledges and see distance distribution for major donors
- **Interactive map**:
  - Circle markers sized by household count
  - Color by total pledge (blue scale) or % change (green/red)
  - Click circles for detailed ZIP statistics
- **Distance histogram**:
  - Shows household distribution by distance from your location
  - Distance bins: 0-2mi, 2-5mi, 5-10mi, 10-20mi, 20+mi
  - Toggle between household count and total pledge metrics
- **Collapsible section**: Expand/collapse to save screen space
- **Location persistence**: Your address is saved for future sessions

### Privacy & Data
- **All processing is client-side** - no data uploaded to any server
- **Geocoding**: Uses free public APIs (OpenStreetMap Nominatim for addresses, zippopotam.us for ZIPs)
- **Caching**: Addresses and ZIP coordinates cached in localStorage for instant subsequent loads
- Only addresses and ZIP codes are sent to geocoding APIs - never pledge amounts or personal data

### Try it with Demo Data
Generate a demo CSV file with ZIP codes included:

```bash
npm run generate-demo-zip
```

This creates `demo-pledges-zip.csv` with 500 sample households in a local area (New Jersey).

For testing with a wider geographic spread (spanning multiple states from NYC to California):

```bash
npm run generate-demo-wide
```

This creates `demo-pledges-wide.csv` with 500 sample households distributed across:
- 40% Local (NYC/NJ metro, 0-50 miles)
- 30% Regional (Philadelphia, Baltimore, Boston area, 100-200 miles)
- 20% Distant (DC, Pittsburgh, Buffalo, Vermont, 200-500 miles)
- 10% Very distant (Florida, Chicago, California, 500+ miles)

## Project Structure

```
bimah-bc/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── publish/      # Publish report endpoint
│   │   └── reports/      # Fetch published reports
│   ├── enter/             # Authentication page
│   ├── import/            # File upload and mapping
│   ├── dashboard/         # Main analytics dashboard
│   ├── insights/          # Advanced metrics
│   ├── forecasts/         # Statistical projections
│   ├── view/              # View published reports
│   └── geo/               # Geographic analysis (optional)
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── geo/              # Geography-specific components
│   └── PublishModal.tsx  # Publish report modal
├── lib/                  # Core business logic
│   ├── parsing/          # File parsing (SheetJS - client-side)
│   ├── math/             # Metrics calculations (client-side)
│   ├── geo/              # Geocoding & aggregation (client-side)
│   ├── export/           # Excel export (ExcelJS - client-side)
│   ├── schema/           # Zod schemas and types
│   ├── db.ts             # Database client
│   └── generateReportId.ts  # Secure ID generation
├── db/                   # Database files
│   └── schema.sql        # PostgreSQL schema
├── tests/                # Test files
│   └── geo/             # Geography feature tests
├── public/               # Static assets
│   ├── leaflet/         # Map marker icons
│   └── robots.txt       # Search engine directives
└── middleware.ts         # Authentication middleware
```

## Future Enhancements

Ideas for future versions:

- Multi-year trend analysis with gift dates
- Household deduplication and canonical IDs
- Access control for published reports (passcode or email-based authentication)
- Report expiration dates and deletion
- User dashboard to manage published reports
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
