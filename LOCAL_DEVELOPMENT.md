# Local Development Setup

## Quick Start (No Database Setup Required!)

The app automatically uses **SQLite** for local development - no setup needed!

```bash
npm install
npm run dev
```

That's it! Open http://localhost:3000 and the publish feature will work automatically.

**What happens:**
- First time you publish, a `bimah-local.db` file is created automatically
- All your published reports are stored in this local SQLite database
- When you deploy to Vercel, it automatically switches to Vercel Postgres

---

## Testing the Publish Feature

1. Go to http://localhost:3000
2. Click "Import Data" and upload a CSV/XLSX file
3. Go to Dashboard
4. Click **"Publish Report"** in the navigation
5. Enter a title and click "Publish Report"
6. You'll get a shareable URL like `http://localhost:3000/view/xK9mP2qR8tBvN5hZ7wLcJ`
7. Click "View Report" to see the published version

---

## Database Files

**Local (SQLite):**
- Database file: `bimah-local.db` (created automatically)
- Location: Project root directory
- Ignored by git (already in `.gitignore`)

**Production (Vercel):**
- Automatically uses Vercel Postgres when `POSTGRES_URL` environment variable is set
- No code changes needed - it just works!

---

## Advanced: Use Vercel Postgres Locally (Optional)

If you want to test with the production database locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment variables from Vercel
vercel env pull .env.local

# Run dev server (will use Vercel Postgres instead of SQLite)
npm run dev
```

---

## Troubleshooting

**Can't publish reports?**
- Make sure you've imported data first
- Check the terminal for any errors
- The SQLite database should auto-initialize on first use

**Want to reset local database?**
```bash
rm bimah-local.db
npm run dev  # Database will be recreated automatically
```

**See which database you're using?**
- Check the terminal when you start `npm run dev`
- You'll see: `📦 Database: SQLite (local)` or `📦 Database: Vercel Postgres`
