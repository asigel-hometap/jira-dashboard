# Data Source Strategy for Sparkline

## Principles

1. **Consistency**: The sparkline should match the left side for the current week
2. **Accuracy**: Use the most accurate data available
3. **Performance**: Prefer fast lookups (snapshots) over slow reconstruction
4. **Maintainability**: Clear, single decision point for data source selection

## Data Source Priority (for a given week)

1. **Live Data** (if current week or recent week < 14 days)
   - Most accurate for current/recent weeks
   - Ensures consistency with left side
   - Used when: `isCurrentWeek || daysSince <= 14`

2. **Snapshot with Individual Counts** (if available and not recent)
   - Fast lookup
   - Accurate historical data
   - Used when: `snapshot exists && hasIndividualCounts && !isRecentWeek`

3. **Historical Reconstruction** (if snapshot has only total)
   - Slow but accurate
   - Used when: `snapshot exists && !hasIndividualCounts && !isRecentWeek`

4. **CSV Data** (for dates before Sept 15, 2025)
   - Legacy data source
   - Used when: `date < 2025-09-15`

5. **Skip** (if too old and no data available)
   - Used when: `date > 30 days old && no snapshot && no CSV`

## Proposed Refactor

Create a single function `getDataForWeek(monday: Date)` that returns:
- `{ source: 'live' | 'snapshot' | 'reconstruction' | 'csv' | 'skip', data: WeeklySnapshot }`

This centralizes all the decision logic and makes it testable.

