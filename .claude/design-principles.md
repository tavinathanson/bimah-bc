# Design Principles for Bimah BC

## Core Principle: Design for Extensibility

**Avoid hardcoding values whenever possible.** This application should adapt to different synagogues, congregations, and data patterns without requiring code changes.

### Key Areas of Extensibility

#### 1. Geographic Analysis
- ✅ **Distance ranges are dynamically calculated** based on actual data distribution
  - Local congregation (max ≤10 mi): 0-2, 2-5, 5-10, 10+ mi
  - Regional congregation (max ≤50 mi): 0-5, 5-15, 15-30, 30+ mi
  - Wide spread (max >50 mi): 0-10, 10-30, 30-100, 100+ mi
- ✅ **Same distance ranges used everywhere** - filters, histogram, and analysis all use the same dynamic bins
- ✅ **No hardcoded synagogue location** - user sets their own address
- ✅ **ZIP codes are geocoded dynamically** from external APIs
- ✅ **Map always centers on synagogue** - zoom level adjusts based on congregant distribution (95th percentile distance)

#### 2. Age Cohorts
- ⚠️ **Current**: Hardcoded as "Under 40", "40-49", "50-64", "65+"
- 🎯 **Future**: Should calculate based on data distribution (quartiles or natural breaks)

#### 3. Pledge Bins
- ⚠️ **Current**: Hardcoded as $1-$1,799, $1,800-$2,499, $2,500-$3,599, $3,600-$5,399, $5,400+
- 🎯 **Future**: Should calculate based on data distribution using:
  - Jenks natural breaks
  - Quantiles (quartiles/quintiles)
  - Or standard deviations from mean

#### 4. Status Classifications
- ✅ **Logic-based, not hardcoded**: Renewed, New, Lapsed, No Pledge
- Determined by pledge amounts in current vs prior year

### Implementation Guidelines

When adding new features:

1. **Ask: "Will this work for other organizations?"**
   - Don't assume specific locations, names, or numeric ranges
   - Make values configurable or data-driven

2. **Use data-driven calculations**
   ```typescript
   // ❌ BAD - Hardcoded
   const ranges = ["0-5", "5-10", "10-20", "20+"];

   // ✅ GOOD - Data-driven
   const ranges = calculateRangesFromData(distances);
   ```

3. **Document assumptions**
   - If something must be hardcoded (e.g., fiscal year), document why
   - Provide comments explaining how to adapt for different use cases

4. **Prefer configuration over code**
   - User-provided settings (address, fiscal year)
   - Calculated from data (bins, ranges, zoom levels)
   - Only hardcode universal constants (e.g., color schemes)

### Testing for Extensibility

When testing new features, ask:
- Would this work for a synagogue in California? Israel? London?
- Would this work for 50 members? 5,000 members?
- Would this work with pledges ranging from $10 to $100,000?
- Would this handle ZIP codes from different regions (East Coast vs West Coast)?

### Privacy & Client-Side Processing

All data processing happens **entirely in the browser**. Never:
- Send pledge amounts to external services
- Store personally identifiable information on servers
- Hardcode any organization-specific data that could leak information

Only addresses and ZIP codes are sent to public geocoding APIs - never paired with pledge data or names.
