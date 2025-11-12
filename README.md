# Bimah - Analytics for Synagogues

**Bimah** is a privacy-first analytics platform for synagogues. Upload your data, explore insights with interactive visualizations, export detailed reports, and optionally publish secure dashboards to share with your board.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Privacy & Security](#privacy--security)
- [Deployment](#deployment)
  - [Deploy to Vercel](#deploy-to-vercel)
  - [Set Up Database (Optional)](#set-up-database-optional)
  - [Custom Domain (Optional)](#custom-domain-optional)
  - [Troubleshooting](#troubleshooting)
- [Usage Guide](#usage-guide)
- [Data Definitions](#data-definitions)
- [Development](#development)
  - [Local Setup](#local-setup)
  - [Testing & Linting](#testing--linting)
  - [Tech Stack](#tech-stack)
- [Geographic Analysis](#geographic-analysis)
- [Project Structure](#project-structure)
- [Contributing & Support](#contributing--support)

---

## Quick Start

**Try it now:** Visit the [live demo](https://bimah.vercel.app) or run locally in 3 steps:

```bash
git clone https://github.com/tavinathanson/bimah-bc.git
cd bimah-bc
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Launch Demo Dashboard** to see sample analytics, or **Upload Your Data** to analyze your own files.

---

## Features

### Core Analytics
- **No Login Required** - All data processed locally in your browser
- **Multi-File Import** - Drag-and-drop XLSX/CSV files with smart column mapping
- **Comprehensive Metrics**:
  - Total pledges, changes, and renewal rates
  - Age cohort analysis (Under 40, 40-49, 50-64, 65+)
  - Pledge bin distribution ($1-$1,799, $1,800-$2,499, etc.)
  - Status classification (Renewed, New, Lapsed)
  - Change direction tracking (Increased, Decreased, No Change)
  - Advanced insights (retention rates, concentration analysis, generational giving)
  - Statistical forecasts and projections
  - **Geographic analysis** (optional): ZIP code mapping and distance visualizations

### Visualization & Export
- **Interactive Dashboards** - Pie charts, bar charts, scatter plots with regression lines
- **Excel Export** - Multi-sheet workbook with formatted aggregate metrics
- **CSV Export** - Normalized data export

### Publish & Share (Optional)
- **Secure Dashboards** - Publish with unguessable 21-character URLs (128-bit security)
- **Anonymous Data Only** - Never includes names or personal information
- **Point-in-Time Snapshots** - Clear dates, blocked from search engines

### Accessibility
- Keyboard navigation, high contrast, readable typography
- Mobile responsive (desktop, tablet, mobile)

---

## Privacy & Security

### 🔒 Privacy-First Design

**Two modes of operation:**

**1. Local Analysis (Default)** - All data processing happens entirely in your browser:
- ✅ Data never leaves your computer
- ✅ Stored only in browser session storage
- ✅ Automatically deleted when you close the tab
- ✅ No server interaction required

**2. Publish & Share (Optional)** - Securely share anonymous reports:
- ✅ Only minimal data uploaded (age, pledge amounts, ZIP codes)
- ✅ **Never** uploads names or personal information
- ✅ Unguessable URLs (128-bit security)
- ✅ Blocked from search engines

### What Gets Sent to the Server

**Local Analysis Mode (Default):**
- Nothing. All processing happens in your browser.

**When You Publish a Report (Optional):**
- Anonymous pledge rows (age, pledge amounts, ZIP codes)
- Report title and snapshot date

**Never sent to server:**
- ❌ Excel/CSV files
- ❌ Names or identifying information
- ❌ Email addresses or phone numbers
- ❌ Analytics or tracking data

### Open Source & Auditable
All code is open source and can be audited. You can verify that no data is being sent anywhere by reviewing the code or using browser developer tools to monitor network requests.

---

## Deployment

### Deploy to Vercel

#### 1. Push to GitHub

Ensure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

#### 3. Deploy

Click **Deploy** and wait for build to complete (~2-3 minutes).

Your site will be live at: `https://[your-project-name].vercel.app`

**✅ At this point, your app works perfectly for local analysis!** The publish feature won't work yet, but everything else does.

---

### Set Up Database (Optional)

**Only needed if you want users to publish and share dashboards.**

#### Step 1: Create Neon Database

1. Go to [neon.tech](https://neon.tech) and sign up for **free**
2. Click **Create Project**
3. Choose a name (e.g., "bimah-analytics") and region
4. Click **Create**

#### Step 2: Initialize Schema

1. In Neon, go to the **SQL Editor** tab
2. Open `db/schema.sql` from your repository
3. Copy and paste the entire contents into the SQL Editor
4. Click **Run** to create the tables

#### Step 3: Configure Vercel

1. In Neon, go to the project **Dashboard**
2. Copy the connection string (starts with `postgresql://`)
3. In Vercel, go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `POSTGRES_URL`
   - **Value**: Your Neon connection string (paste from step 2)
   - **Environment**: Production (and optionally Preview/Development)
5. Go to **Deployments** tab
6. Click the **⋯** menu on your latest deployment → **Redeploy**

After redeployment completes, the publish feature will be enabled!

**Cost:** Neon's free tier includes 512 MB storage - more than enough for published reports. No credit card required.

---

### Custom Domain (Optional)

#### In Vercel:
1. Go to your project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `analytics.yoursynagogue.org`)
4. Vercel will show you DNS configuration needed

#### In Your DNS Provider:
1. Log in to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
2. Navigate to DNS settings for your domain
3. Add a CNAME record:
   - **Type**: CNAME Record
   - **Host**: your subdomain (e.g., `analytics`)
   - **Value**: `cname.vercel-dns.com.` (exactly as Vercel shows)
   - **TTL**: Automatic (or 1 min for faster propagation)
4. Save the record

#### Wait for Propagation
- DNS changes can take 5 minutes to 48 hours (usually 10-30 minutes)
- Check status at: https://dnschecker.org (enter your domain)
- Vercel automatically provisions SSL certificate once DNS is validated

---

### Troubleshooting

#### Build fails on Vercel
- Run `npm install` and `npm run build` locally first to catch errors
- Check build logs in Vercel dashboard for specific errors
- Verify all dependencies are in package.json

#### Publish feature not working
1. Verify `POSTGRES_URL` is set in Vercel environment variables
2. Verify you ran the schema SQL in Neon's SQL Editor
3. Redeploy the project after adding the variable
4. Check browser console for error messages

#### Domain not working after 24 hours
Check DNS records:
```bash
dig yourdomain.com CNAME
```
Should show: `yourdomain.com. 300 IN CNAME cname.vercel-dns.com.`

#### SSL Certificate not provisioning
1. Verify DNS is correct
2. Remove and re-add domain in Vercel
3. Wait another hour

---

## Usage Guide

### 1. Access the App

Visit your Vercel URL (or custom domain). No login required!

### 2. Prepare Your Data

Export data from ShulCloud (or your database) as XLSX or CSV files. Required columns:

- **Age** (or **Date of Birth**): Integer age values or dates in various formats
- **Current FY Pledge**: Numeric pledge amounts for current fiscal year
- **Prior FY Pledge**: Numeric pledge amounts for prior fiscal year
- **ZIP Code** (optional): 5-digit ZIP codes for geographic analysis

Currency symbols ($), commas, and whitespace are automatically handled.

### 3. Upload and Map Columns

1. Drag and drop your files or click to browse
2. Map the required columns:
   - Age / Date of Birth Column (required)
   - Current FY Pledge (required)
   - Prior FY Pledge (required)
   - ZIP Code Column (optional - enables Geographic Analysis)
3. Preview the first 25 rows to verify parsing
4. Click **Validate File** to check for errors
5. Once all files are validated, click **Continue to Dashboard**

**Privacy Note**: Your files are processed entirely in your browser. No data is uploaded to any server.

### 4. View Analytics

The dashboard displays:

- **Summary tiles**: Total households, pledges, changes, renewal counts
- **Pie chart**: Pledge status distribution
- **Bar charts**: Age cohorts, pledge bins, change direction
- **Tables**: Detailed cohort and bin metrics with sortable columns
- **Insights tab**: Retention rates, pledge concentration, generational giving
- **Forecasts tab**: Statistical projections with regression analysis
- **Geographic Analysis** (if ZIP codes provided):
  - Interactive map with ZIP code markers
  - Distance histogram from synagogue
  - Sortable ZIP code table with export

### 5. Export Reports

Click **Export** in the navbar to download:

- **Excel Summary Report**: Multi-sheet workbook with:
  - Read Me (definitions and documentation)
  - Summary metrics (totals, counts, changes)
  - Pledge bin analysis
  - Age cohort analysis
  - Renewal status breakdown

**Note**: Individual household data is not included in exports to protect privacy. Only aggregate summary statistics are exported.

### 6. Publish & Share (Optional)

**Share interactive dashboards with board members:**

1. Click **Publish** in the navbar
2. Enter a title (e.g., "FY25 Analytics Report")
3. Review what data will be shared (ages, pledges, ZIP codes only - no names)
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

**Note**: Requires Neon Postgres to be set up (see [Deployment](#set-up-database-optional)).

---

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

### Validation Rules

- Age must be a non-negative integer
- Pledge amounts must be numeric and ≥ 0
- All rows require valid age, current pledge, and prior pledge values
- Empty or non-numeric values will cause row-level errors

---

## Development

### Local Setup

#### Prerequisites

- Node.js 18+ (tested with Node 22)
- npm or pnpm

#### Installation

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

**Database**: Local development automatically uses SQLite (no setup required). Data is stored in `bimah-local.db`.

#### Building for Production

```bash
npm run build
npm start
```

---

### Testing & Linting

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

---

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Processing**: SheetJS (xlsx) for parsing, ExcelJS for export - **all client-side**
- **Charts**: Recharts
- **Maps**: Leaflet + react-leaflet for geographic visualizations
- **Database**: Neon Postgres (optional, for published reports only)
- **Local Development**: SQLite (auto-initialized, no setup)
- **Validation**: Zod
- **Testing**: Vitest + Testing Library

---

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

---

## Project Structure

```
bimah-bc/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── publish/      # Publish report endpoint
│   │   └── reports/      # Fetch published reports
│   ├── [reportId]/        # View published reports
│   ├── enter/             # Authentication page (optional)
│   ├── import/            # File upload and mapping
│   ├── dashboard/         # Main analytics dashboard
│   ├── insights/          # Advanced metrics
│   └── forecasts/         # Statistical projections
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── geo/              # Geography-specific components
│   ├── PublishModal.tsx  # Publish report modal
│   └── RecentDashboards.tsx  # Recently published list
├── lib/                  # Core business logic
│   ├── parsing/          # File parsing (SheetJS - client-side)
│   ├── math/             # Metrics calculations (client-side)
│   ├── geo/              # Geocoding & aggregation (client-side)
│   ├── export/           # Excel export (ExcelJS - client-side)
│   ├── schema/           # Zod schemas and types
│   ├── db.ts             # Database client (Neon/SQLite switcher)
│   ├── db-sqlite.ts      # SQLite implementation for local dev
│   └── generateReportId.ts  # Secure ID generation
├── db/                   # Database files
│   └── schema.sql        # PostgreSQL schema
├── tests/                # Test files
│   └── geo/             # Geography feature tests
├── public/               # Static assets
│   ├── leaflet/         # Map marker icons
│   └── robots.txt       # Search engine directives
└── middleware.ts         # Authentication middleware (optional)
```

---

## Contributing & Support

### Design Philosophy

This application is designed to work for **any synagogue or religious organization**, not just one specific congregation. We avoid hardcoding values and instead calculate bins, ranges, and thresholds dynamically from your data. See [`.claude/design-principles.md`](./.claude/design-principles.md) for detailed design guidelines.

### Known Limitations

- **No time-based progress tracking**: Requires gift dates, not available in this version
- **Single snapshot only**: Cannot compare across multiple fiscal years simultaneously
- **No household deduplication**: Each row is treated independently
- **Published reports are read-only**: No ability to edit or update after publishing
- **No access control on published reports**: Anyone with the URL can view (by design for simplicity)

### Future Enhancements

Ideas for future versions:

- Multi-year trend analysis with gift dates
- Household deduplication and canonical IDs
- Access control for published reports (passcode or email-based authentication)
- Report expiration dates and deletion
- User dashboard to manage published reports
- Advanced filtering and custom cohort definitions
- Automated email reports
- Integration with ShulCloud API

### Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Support

- **Documentation**: [Vercel](https://vercel.com/docs) | [Neon](https://neon.tech/docs)
- **Issues**: [GitHub Issues](https://github.com/tavinathanson/bimah-bc/issues)

### License

MIT License - see [LICENSE](LICENSE) file for details

### Acknowledgments

Built with love for the broader synagogue community.
