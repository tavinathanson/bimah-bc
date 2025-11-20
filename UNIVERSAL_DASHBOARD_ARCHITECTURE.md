# Universal Dashboard Architecture

## Overview

This document describes the new universal analytics architecture that transforms Bimah from a single-purpose pledge dashboard into a flexible, multi-category analytics engine.

## Status: Foundation Complete ✅

**What's been implemented:**

✅ Phase 1: Foundation type files and utilities
✅ Phase 2: Reusable component library
✅ Privacy validation in publish flow
✅ Saved views framework
✅ Filter system infrastructure

**What's next:**

- [ ] Integrate new components into existing dashboard
- [ ] Add CSV import for transactions/directory
- [ ] Build "All Giving" dashboard
- [ ] Migrate existing charts to use new components

---

## Architecture

### 1. Data Model (`lib/schema/`)

#### Universal Types (`universal-types.ts`)

**New normalized entities:**
- `Household` - Household with membership metadata (PII fields clearly marked)
- `Person` - Individual within household (PII fields clearly marked)
- `Address` - Geographic data (street/city marked as PII, ZIP/state safe)
- `Transaction` - Financial activity (description marked as PII)
- `PledgeSummary` - Derived pledge aggregates
- `ChargeGroup` - User-defined transaction groupings

**Privacy-first design:**
- All PII fields are explicitly commented as `// PRIVATE`
- PII should NEVER be displayed in UI, even locally
- Prevents accidental screenshots or screen shares of sensitive data

#### Adapters (`adapters.ts`)

Backward compatibility layer:
- `pledgeRowToEntities()` - Convert legacy PledgeRow → normalized entities
- `entitiesToPledgeRow()` - Convert normalized entities → legacy PledgeRow
- Allows existing Hineini CSV imports to work seamlessly

### 2. Privacy System (`lib/privacy/`)

#### Privacy Rules (`rules.ts`)

**PII field definitions:**
```typescript
const PII_FIELDS = {
  household: ["primaryName", "secondaryName", "email", "phone"],
  person: ["firstName", "lastName", "email"],
  address: ["street", "city"], // City can be quasi-identifier
  transaction: ["description"],
};
```

**Key functions:**
- `stripPII()` - Remove PII fields from an object
- `validateNoPII()` - Check if data contains PII (returns violations list)
- `assertNoPII()` - Throw error if PII detected
- `anonymizeAggregates()` - Ensure k-anonymity (min group size)

**Applied in publish flow:**
`app/api/publish/route.ts` now validates all data before publishing.

### 3. Filter System (`lib/dashboard/`)

#### Filter Types (`filter-types.ts`)

```typescript
interface FilterDefinition {
  id: string;               // "ageCohort_40-49"
  field: string;            // "age"
  operator: FilterOperator; // "equals" | "in" | "between" | "gt" | "lt"
  value: string | number | string[] | [number, number];
  label: string;            // "Age: 40-49"
  category: string;         // "Age"
}
```

#### useFilters Hook (`useFilters.ts`)

Centralized filter management:

```typescript
const {
  filters,           // Active filters
  chips,             // For FilterChips component
  addFilter,
  removeFilter,
  clearFilters,
  toggleFilter,      // For chart clicks
  applyFilters,      // Apply to dataset
} = useFilters();

const filteredData = applyFilters(rawData);
```

#### Chart Utilities (`chart-utils.ts`)

- `shouldHideChart()` - Hide charts when only 1 category remains
- `getHiddenChartMessage()` - Explain why chart is hidden
- `CHART_COLORS` - Theme colors (blue dominant + gold accents)
- `formatChartValue()` - Consistent number formatting

### 4. Saved Views (`lib/dashboard/`)

#### Saved Views (`saved-views.ts`)

```typescript
interface SavedView {
  id: string;
  name: string;
  category: DashboardCategory;
  timeframe: DashboardTimeframe;
  filters: FilterDefinition[];
  visibleSections: string[];
  isOfficial?: boolean;  // Built-in views
}

type DashboardCategory =
  | "hineini"                // Two-year pledge comparison (existing)
  | "all_giving"             // All transactions
  | "custom_charge_group"    // User-defined groups
  | "membership"             // Demographics
  | "geography"              // Geographic analysis
  | "attendance";            // Future

type DashboardTimeframe =
  | "this_year"              // Current FY snapshot
  | "last_year"              // Prior FY snapshot
  | "compare_two_years"      // Side-by-side (default for Hineini)
  | "multi_year_trend"       // Trend over time
  | "custom_range";          // User-defined
```

#### Official Presets (`official-presets.ts`)

**Beth Chaim - Hineini** preset:
- Category: `hineini`
- Timeframe: `compare_two_years`
- No default filters
- All sections visible
- **This is the default view for existing users**

Functions:
- `getAllViews()` - Get official + user views
- `saveView()` - Save new user view
- `updateView()` - Update existing view (not official)
- `deleteView()` - Delete user view (not official)

---

## Component Library (`components/dashboard/`)

### MetricCard

Large KPI display with optional icon, trend, badge.

```tsx
<MetricCard
  title="Total Households"
  value={1234}
  format="number"
  icon={Users}
  trend={{
    direction: "up",
    value: "+5%",
    label: "vs last year"
  }}
/>
```

### ChartCard

Universal chart wrapper with empty states and hiding logic.

```tsx
<ChartCard
  title="Age Distribution"
  subtitle="Households by age cohort"
  description="Click a bar to filter"
  isHidden={shouldHideChart("bar", data)}
  hiddenMessage="Chart hidden (only one category after filtering)"
>
  <InteractiveBarChart ... />
</ChartCard>
```

### DashboardSection

Logical grouping with optional collapse.

```tsx
<DashboardSection
  title="Overview"
  subtitle="Key metrics at a glance"
  collapsible
  badge={{ text: "Updated", variant: "success" }}
>
  {/* Metrics and charts */}
</DashboardSection>
```

### FilterChips

Display active filters as removable chips.

```tsx
<FilterChips
  filters={chips}
  onClearAll={clearFilters}
/>
```

### UniversalTooltip

Consistent tooltip for all charts.

```tsx
<Tooltip content={<UniversalTooltip formatValue={formatCurrency} />} />
```

### InteractiveBarChart

Bar chart with click-to-filter.

```tsx
<InteractiveBarChart
  data={cohortData}
  xKey="cohort"
  dataKey="count"
  onChartClick={toggleFilter}
  clickHandler={{
    field: "ageCohort",
    category: "Age",
    getLabel: (value) => value,
  }}
  activeFilters={filters.filter(f => f.field === "ageCohort")}
/>
```

### InteractivePieChart

Pie/donut chart with click-to-filter.

```tsx
<InteractivePieChart
  data={statusData}
  nameKey="status"
  dataKey="count"
  onChartClick={toggleFilter}
  clickHandler={{
    field: "status",
    category: "Status",
    getLabel: (value) => STATUS_DISPLAY_NAMES[value],
  }}
  innerRadius={60}  // 0 for pie, >0 for donut
/>
```

### SavedViewSelector

Load official or custom saved views.

```tsx
<SavedViewSelector
  currentViewId={activeViewId}
  onLoadView={(view) => {
    setConfig({ category: view.category, timeframe: view.timeframe });
    view.filters.forEach(addFilter);
  }}
  onSaveNew={() => setShowSaveDialog(true)}
/>
```

### CategorySelector

Switch between dashboard categories.

```tsx
<CategorySelector
  value={config.category}
  onChange={(cat) => setConfig({ ...config, category: cat })}
/>
```

---

## Migration Strategy

### Current State (app/dashboard/page.tsx)

The existing 1,978-line dashboard is **fully functional** and should remain untouched during migration.

### Phase 1: Wrapper Integration (Next Step)

Add new infrastructure around existing dashboard without modifying core logic:

1. Add `<SavedViewSelector>` at top of page
2. Add `<CategorySelector>` (only "Hineini" enabled for now)
3. Wrap dashboard in `<DashboardSection>` components
4. Add `<FilterChips>` display

**Result:** Existing functionality works exactly as before, but with saved views and better organization.

### Phase 2: Incremental Chart Migration

Migrate one chart at a time from inline to component-based:

1. **Start with Age Cohort chart** (simplest):
   ```tsx
   // Before (inline)
   <Card>
     <CardHeader><CardTitle>Age Distribution</CardTitle></CardHeader>
     <CardContent>
       <ResponsiveContainer>
         <BarChart data={cohortData}>...</BarChart>
       </ResponsiveContainer>
     </CardContent>
   </Card>

   // After (component-based)
   <ChartCard
     title="Age Distribution"
     isHidden={shouldHideChart("bar", cohortData)}
   >
     <InteractiveBarChart
       data={cohortData}
       xKey="cohort"
       dataKey="Households"
       onChartClick={toggleFilter}
       clickHandler={{ field: "ageCohort", category: "Age", getLabel: (v) => v }}
     />
   </ChartCard>
   ```

2. **Then migrate metrics**:
   ```tsx
   // Before
   <Card>
     <CardHeader><CardTitle>Total Households</CardTitle></CardHeader>
     <CardContent><div className="text-4xl">{totals.totalHouseholds}</div></CardContent>
   </Card>

   // After
   <MetricCard
     title="Total Households"
     value={totals.totalHouseholds}
     format="number"
     icon={Users}
   />
   ```

3. **Continue with remaining charts**

**Benefits:**
- Each migration is testable independently
- Can be done incrementally over time
- Existing dashboard continues working throughout

### Phase 3: Filter System Integration

Replace custom filter state with `useFilters` hook:

```tsx
// Before
const [filterCohort, setFilterCohort] = useState<string[]>([]);
const [filterStatus, setFilterStatus] = useState<string[]>([]);
// ... etc

// After
const { filters, chips, toggleFilter, clearFilters, applyFilters } = useFilters();
const filteredData = applyFilters(data);
```

### Phase 4: Future Dashboards

Build new dashboard categories using the component library:

```tsx
// components/dashboards/AllGivingDashboard.tsx
export function AllGivingDashboard({ transactions, config }) {
  return (
    <>
      <DashboardSection title="Giving Overview">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard title="Total Giving" value={totalGiving} format="currency" />
          <MetricCard title="Pledges" value={pledges} format="currency" />
          <MetricCard title="Donations" value={donations} format="currency" />
          <MetricCard title="Events" value={events} format="currency" />
        </div>
      </DashboardSection>

      <DashboardSection title="Breakdown by Category">
        <ChartCard title="Giving by Category">
          <InteractivePieChart data={categoryData} ... />
        </ChartCard>
      </DashboardSection>
    </>
  );
}
```

---

## Privacy Guidelines

### Display Rules

**NEVER display these fields in the UI:**
- Names (first, last, household)
- Email addresses
- Phone numbers
- Street addresses
- Cities (can be quasi-identifiers)
- Transaction descriptions (may contain names)

**SAFE to display and aggregate:**
- Age (NOT date of birth)
- Amounts
- ZIP codes (5-digit, for geographic aggregation)
- States
- Dates (transaction dates, event dates)
- Categories/types
- Counts and aggregates (with k-anonymity)

### Export Rules

Before any export (CSV, Excel, publish):

```typescript
import { validateNoPII, stripPII } from '@/lib/privacy/rules';

// Validate
const validation = validateNoPII(data);
if (!validation.valid) {
  throw new Error('Cannot export: PII detected');
}

// Strip as additional safety
const safeData = data.map(row => stripPII(row));
```

### K-Anonymity

For small group sizes, use anonymization:

```typescript
import { anonymizeAggregates } from '@/lib/privacy/rules';

const aggregates = [
  { zipCode: "02139", count: 45, total: 150000 },
  { zipCode: "02140", count: 2, total: 7200 },  // TOO SMALL
];

const safeAggregates = anonymizeAggregates(aggregates, 5);
// Returns only first row (count >= 5)
```

---

## Testing

### Type Safety

```bash
npm run type-check
```

All new code passes TypeScript strict mode.

### Privacy Validation Tests

```typescript
import { validateNoPII, stripPII } from '@/lib/privacy/rules';

test('rejects data with PII', () => {
  const data = [
    { age: 45, amount: 3600, primaryName: "John Doe" } // PII!
  ];

  const result = validateNoPII(data);
  expect(result.valid).toBe(false);
  expect(result.violations.length).toBeGreaterThan(0);
});

test('strips PII from objects', () => {
  const row = { age: 45, amount: 3600, primaryName: "John Doe", email: "john@example.com" };
  const clean = stripPII(row, 'household');

  expect(clean.primaryName).toBeUndefined();
  expect(clean.email).toBeUndefined();
  expect(clean.age).toBe(45);
  expect(clean.amount).toBe(3600);
});
```

---

## Next Steps

1. **Test current dashboard** - Ensure everything still works as expected
2. **Add SavedViewSelector** - Wrap existing dashboard with saved view selector
3. **Migrate first chart** - Convert Age Cohort chart to use new components
4. **Add FilterChips** - Display active filters using new component
5. **Build CSV import for transactions** - Extend import flow for ShulCloud exports
6. **Create All Giving dashboard** - First new dashboard category

---

## Questions?

- **Where are PII fields defined?** → `lib/privacy/rules.ts`
- **How do I add a new chart type?** → Extend `lib/dashboard/chart-utils.ts` and create component in `components/dashboard/`
- **How do I create a new dashboard category?** → Add to `DashboardCategory` type in `lib/dashboard/saved-views.ts`
- **Can I edit the Beth Chaim preset?** → No, official views are read-only. Users can duplicate and customize.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard Page (Universal Controller)                  │
│  - Saved View Selector                                  │
│  - Category Selector (Hineini, All Giving, etc.)       │
│  - Filter Chips Display                                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Dashboard Renderer (Category-Driven)                   │
│  - Hineini → Current 1,978-line dashboard (legacy)     │
│  - All Giving → New AllGivingDashboard component       │
│  - Membership → New MembershipDashboard component       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Reusable Component Library                             │
│  - MetricCard, ChartCard, DashboardSection             │
│  - FilterChips, InteractiveBarChart, InteractivePieChart│
│  - UniversalTooltip, CategorySelector, SavedViewSelector│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Filter & Privacy Layer                                 │
│  - useFilters() hook (centralized filter state)         │
│  - validateNoPII() (before any export/publish)          │
│  - stripPII() (remove sensitive fields)                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Data Layer (Normalized In-Memory Store)                │
│  - Household, Person, Address, Transaction              │
│  - Adapters for backward compatibility with PledgeRow   │
│  - Privacy fields clearly marked as PRIVATE             │
└─────────────────────────────────────────────────────────┘
```

---

**Status:** Foundation complete and type-safe ✅
**Next:** Integration and migration
**Timeline:** Incremental, no breaking changes
