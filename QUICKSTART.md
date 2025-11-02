# Quick Start Guide

## 1. Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/tavinathanson/bimah-bc.git
cd bimah-bc

# Install dependencies
npm install

# Set your passcode
echo "BIMAH_PASSCODE=your-secure-passcode" > .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 2. First Login

Enter the passcode you set in `.env.local` when prompted.

## 3. Upload Your Data

### Prepare Your File

Your Excel or CSV file should have at minimum these columns:

| Age | Current FY Pledge | Prior FY Pledge |
|-----|-------------------|-----------------|
| 35  | 2500              | 2000            |
| 52  | 3600              | 3600            |
| 68  | 5400              | 5000            |

The column names can be anything - you'll map them in the next step.

### Upload Steps

1. **Drag & drop** your XLSX or CSV file (or click to browse)
2. **Map columns**:
   - Select which column contains Age
   - Select which column contains Current FY Pledge
   - Select which column contains Prior FY Pledge
3. **Validate** - Click "Validate File" to check for errors
4. **Continue** - Once validated, click "Continue to Dashboard"

## 4. View Analytics

The dashboard shows:

- **Summary cards**: Total households, pledge amounts, changes
- **Charts**: Status distribution, age cohorts, pledge bins
- **Tables**: Detailed breakdowns with sortable columns

## 5. Export Reports

### CSV Export
- Click "Export CSV" for raw data with all calculated fields
- Opens in Excel, Google Sheets, etc.

### Excel Report
- Click "Export Excel Report" for a formatted multi-sheet workbook
- Includes: Summary, Cohort Analysis, Bin Analysis, Raw Data, and Documentation

## Sample Data Format

```csv
Age,FY26 Pledge,FY25 Pledge,Name,Email
35,2500,2000,John Doe,john@example.com
52,3600,3600,Jane Smith,jane@example.com
68,5400,5000,Bob Jones,bob@example.com
42,1800,0,Alice Brown,alice@example.com
55,0,2200,Charlie Davis,charlie@example.com
```

When mapping:
- Age → "Age"
- Current FY Pledge → "FY26 Pledge"
- Prior FY Pledge → "FY25 Pledge"

(Name and Email columns will be ignored unless you specifically map them)

## Common Issues

### "Invalid passcode"
- Check your `.env.local` file
- Restart the dev server after changing `.env.local`

### "Column not found"
- Make sure your column names exactly match what you select
- Check for extra spaces in column headers

### "Invalid age value"
- Age must be a number ≥ 0
- Floats will be truncated (e.g., 39.7 → 39)

### "Invalid pledge value"
- Pledge amounts must be numbers ≥ 0
- Currency symbols and commas are OK ($2,500.00 works)

## Tips

- **Multiple files**: You can upload multiple files and they'll be combined
- **PII**: Name/email columns won't be stored unless you explicitly map them
- **Session**: Data is stored in your browser session only (not on a server)
- **Fresh start**: Refresh the page to clear data and start over

## Next Steps

- See [README.md](README.md) for full documentation
- See [lib/schema/constants.ts](lib/schema/constants.ts) to customize cohorts/bins
- Run tests: `npm test`
- Deploy to Vercel: See README deployment section
