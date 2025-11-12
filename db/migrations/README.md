# Database Migrations

This directory contains SQL migrations for the Neon Postgres database.

## Quick Start

### Running Migrations

The migration script automatically loads from `.env.prod` by default:

```bash
# Run all pending migrations (uses .env.prod automatically)
npm run db:migrate

# Or start fresh (drops all tables and re-runs all migrations)
npm run db:migrate:fresh
```

### Using a Different .env File

You can specify a different env file:

```bash
# Use .env.local instead
npm run db:migrate -- --env=.env.local

# Or .env.production
npm run db:migrate -- --env=.env.production
```

### Your .env.prod File

Make sure your `.env.prod` file contains your Neon connection string:

```
POSTGRES_URL=postgresql://user:pass@host.neon.tech/database
```

## Migration Files

Migrations are numbered sequentially and run in order:

- `001_initial_schema.sql` - Creates the base tables for published reports
- `002_add_synagogue_location.sql` - Adds columns for storing synagogue location for geographic analysis

## Adding New Migrations

1. Create a new file in this directory with the next sequential number:
   ```
   003_your_migration_name.sql
   ```

2. Write your SQL migration

3. Run the migration:
   ```bash
   npm run db:migrate
   ```

## Migration Strategies

### Updating an Existing Database

If you already have data in your Neon database and need to add the new synagogue location columns:

```bash
export POSTGRES_URL="your-neon-connection-string"
npm run db:migrate
```

This will only run migrations that haven't been executed yet. Since Neon already has the base tables from migration 001, it will only run migration 002 to add the new columns.

### Starting Fresh

If you want to completely reset your database and start from scratch:

```bash
export POSTGRES_URL="your-neon-connection-string"
npm run db:migrate:fresh
```

**Warning:** This will delete all existing data!

## Vercel Environment Variables

After running migrations, make sure your Vercel project has the `POSTGRES_URL` environment variable set:

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add `POSTGRES_URL` with your Neon connection string
3. Set it for Production (and optionally Preview/Development)
4. Redeploy your application

## Local Development

Local development uses SQLite automatically - no migrations needed! The SQLite database is created automatically when you run the app locally.
