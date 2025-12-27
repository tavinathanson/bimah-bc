# PII Filtering Guide

This document describes how Personally Identifiable Information (PII) is handled during data import to protect member privacy.

## Overview

When users import pledge data from CSV or Excel files, the system automatically strips sensitive information before it can be displayed or stored. This happens at the earliest possible point in the data pipeline.

## What Gets Filtered

### Name Columns (Completely Removed)

Any column matching these patterns is stripped entirely:

| Pattern | Examples |
|---------|----------|
| `name` | "Name", "NAME" |
| `first name` | "First Name", "firstname", "FirstName" |
| `last name` | "Last Name", "lastname" |
| `full name` | "Full Name", "fullname" |
| `member name` | "Member Name" |
| `donor name` | "Donor Name" |
| `spouse name` | "Spouse Name", "Spouse's Name" |
| `primary's name` | "Primary's Name" (ShulCloud) |
| `surname` | "Surname" |
| `nickname` | "Nickname" |
| `given name` | "Given Name" |
| `family name` | "Family Name" |
| `household name` | "Household Name" |
| `salutation` | "Salutation" |

### Birthday/DOB Columns (Converted to Age)

Any column matching these patterns is converted to age:

| Pattern | Examples |
|---------|----------|
| `dob` | "DOB", "dob" |
| `date of birth` | "Date of Birth" |
| `birthday` | "Birthday", "birth day" |
| `birthdate` | "Birthdate", "birth date" |
| `primary's birthday` | "Primary's Birthday" (ShulCloud) |
| `spouse's birthday` | "Spouse's Birthday" (ShulCloud) |

## Where Filtering Happens

```
┌─────────────────┐
│   User drops    │
│   CSV/Excel     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  getFileHeaders()                                   │
│  ├─ Returns: { headers, dobHeaders }                │
│  ├─ headers: All columns EXCEPT names and DOB       │
│  └─ dobHeaders: Only DOB columns (for Age dropdown) │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  previewFile()                                      │
│  ├─ Name columns: REMOVED entirely                  │
│  └─ DOB columns: Converted to "DOB → Age" column    │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Column Mapping UI                                  │
│  ├─ Age/DOB dropdown: Shows dobHeaders + headers    │
│  └─ Other dropdowns: Shows only headers (no DOB)    │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  parseFile() / parseShulCloudFile()                 │
│  ├─ DOB values → Age (calculated from date)         │
│  └─ Output: Only age, pledges, zip (no PII)         │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Database (report_rows table)                       │
│  └─ Stores only: age, pledge_current, pledge_prior, │
│                  zip_code (optional)                │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### Core Module: `lib/privacy/pii-filter.ts`

```typescript
// Check if a column header is a name column
isNameColumn(header: string): boolean

// Check if a column header is a DOB column
isDobColumn(header: string): boolean

// Check if column is sensitive (name OR DOB)
isSensitiveColumn(header: string): boolean

// Filter out name columns only
filterNameColumns(headers: string[]): string[]

// Filter out both name AND DOB columns
filterSensitiveColumns(headers: string[]): string[]

// Convert a date value to age
convertToAge(value: unknown): number | null

// Sanitize preview data (remove names, convert DOB to age)
sanitizePreviewData(rows: Record<string, unknown>[]): Record<string, unknown>[]
```

### Parser Integration

**`getFileHeaders(file)`** returns:
```typescript
{
  headers: string[];    // General columns (no names, no DOB)
  dobHeaders: string[]; // DOB columns only
}
```

**`previewFile(file)`** returns sanitized rows where:
- Name columns are removed
- DOB columns become `"DOB → Age"` with computed age value

### UI Behavior

| Dropdown | Shows |
|----------|-------|
| Age / Date of Birth | `dobHeaders` + `headers` (Age if present) |
| ZIP Code | `headers` only |
| Current FY Pledge | `headers` only |
| Prior FY Pledge | `headers` only |

### Preview Table

The preview table shows:
- All non-sensitive columns unchanged
- DOB columns as `"DOB → Age"` with the computed age
- Name columns are completely absent

Example transformation:

| Before (Raw File) | After (Preview) |
|-------------------|-----------------|
| Name: "John Doe" | *(removed)* |
| Birthday: "1980-01-15" | DOB → Age: 45 |
| Zip: "07030" | Zip: "07030" |
| Pledge: 1000 | Pledge: 1000 |

## Age Calculation

Ages are calculated from DOB using these supported formats:

- ISO: `2000-01-31`
- US: `1/31/2000`, `01/31/2000`
- International: `31/1/2000`, `31/01/2000`
- Excel serial dates (days since 1899-12-30)

Invalid dates or ages outside 0-120 range are rejected.

## Testing

Tests are located in:
- `lib/privacy/pii-filter.test.ts` - Core filtering logic (34 tests)
- `lib/parsing/parser.test.ts` - Parser integration (13 tests)

Run tests:
```bash
npm test -- --run lib/privacy/pii-filter.test.ts lib/parsing/parser.test.ts
```

## Adding New PII Patterns

To add new name patterns, edit `lib/privacy/pii-filter.ts`:

```typescript
const NAME_COLUMN_PATTERNS = [
  /\bname\b/i,
  /\bfirst\s*name\b/i,
  // Add new patterns here
  /\bnew\s*pattern\b/i,
];
```

To add new DOB patterns:

```typescript
const DOB_COLUMN_PATTERNS = [
  /\bdob\b/i,
  /\bbirthday\b/i,
  // Add new patterns here
  /\bnew\s*date\s*pattern\b/i,
];
```

## Security Considerations

1. **Defense in Depth**: Filtering happens at multiple layers (headers, preview, parsing)
2. **Fail Secure**: Unknown columns pass through; only recognized PII patterns are filtered
3. **No Persistence**: Raw PII never reaches sessionStorage or database
4. **Immediate Conversion**: DOB → Age conversion happens before any display
