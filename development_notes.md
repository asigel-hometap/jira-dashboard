# Jira Dashboard - Development Notes

## Project Overview
A Next.js dashboard for monitoring team member workload, tracking discovery cycle time trends, and identifying projects needing investigation or remediation.

## Architecture

### Tech Stack
- **Frontend**: Next.js 15.5.3 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: SQLite with sqlite3 package
- **Data Sources**: Jira API, PM Capacity Tracking.csv
- **Hosting**: Vercel (planned)

### Key Components
- **Database Service**: Lazy-loaded SQLite operations (`src/lib/database.ts`)
- **Data Processor**: Handles Jira API integration and CSV parsing (`src/lib/data-processor.ts`)
- **Sparkline Component**: SVG-based trend visualization (`src/components/Sparkline.tsx`)

## Implementation Notes

### Database Design
- **Tables**: issues, status_transitions, health_transitions, team_members, project_snapshots, capacity_data
- **Lazy Loading**: Services are instantiated on-demand to prevent module-load-time errors
- **Data Flow**: CSV → SQLite → API routes → React components

### Data Processing
- **CSV Parsing**: Manual parsing due to empty header in date column (M/D/YYYY format)
- **Team Member Mapping**: Maps first names to full names for consistency
- **Historical Data**: 31 weeks of capacity data from February 10, 2025 to September 8, 2025

## Current Status

### ✅ Completed Features
- [x] Next.js project setup with TypeScript and Tailwind
- [x] SQLite database schema and operations
- [x] CSV data ingestion from PM Capacity Tracking.csv
- [x] Team workload overview with project counts
- [x] Health breakdown visualization (On Track, At Risk, Off Track)
- [x] Overload detection and status indicators
- [x] Responsive sparkline charts for workload trends
- [x] Data context display (last updated, data source)

### 🔄 In Progress
- [ ] Jira API integration (currently disabled due to 410 error)
- [ ] Weekly snapshot creation system
- [ ] Projects at risk identification

## Known Issues & Bugs

### Database Issues
- **SQLite promisify errors**: Some database methods use incorrect promisify syntax
- **Missing methods**: `getHealthTransitions` method referenced but not implemented
- **Build errors**: TypeScript compilation issues with database queries

### Data Issues
- **Jira API**: 410 Gone error - token may be expired or endpoint changed
- **Jira API Token**: Current token may have expired or been revoked, causing empty results for all queries
- **Jira API Rate Limiting**: Hit rate limits after multiple API calls, need to wait before continuing
- **HT-247 Mystery**: HT-247 exists and is assigned to Jacqueline Gallagher, but doesn't appear in JQL search results (may be a search API vs direct API permission issue)
- **CSV parsing**: Manual parsing required due to empty date column header
- **Team member names**: Had to map first names to full names for consistency

## Future Enhancements

### Health Visualization
- [x] **Replaced progress bars with badge counts** - Better readability and space efficiency
- [x] **Added support for all health values** - On Track, At Risk, Off Track, On Hold, Mystery, Complete, Unknown
- [x] **Ensured badge counts sum to total active projects** - Mathematical accuracy verified

### Projects At Risk Table
- [x] **Implemented Projects At Risk table** - Shows projects with At Risk or Off Track health
- [x] **Added API endpoint** - `/api/projects-at-risk` with database initialization
- [x] **Table columns** - Key (with Jira link), Name, Assignee, Current Health, Current Status, # of Weeks at Risk, Biz Champ
- [x] **Health badges** - Color-coded health status indicators
- [x] **Responsive design** - Horizontal scroll for mobile devices
- [x] **Biz Champ field** - Added customfield_10150 to Jira API query and database schema
- [x] **Database schema update** - Added biz_champ and biz_champ_id columns to issues table
- [x] **Historical health tracking** - Calculate actual weeks at risk from Jira changelog data

### Historical Health Tracking
- [x] **calculateWeeksAtRisk function** - Parses Jira changelog to find health transitions
- [x] **Fixed changelog API structure** - Uses 'values' property instead of 'histories'
- [x] **Health field filtering** - Identifies changes to customfield_10238 (Health field)
- [x] **Weeks calculation** - Based on most recent transition to At Risk or Off Track
- [x] **Fallback handling** - Defaults to 1 week for recent transitions or calculation errors
- [x] **Fixed changelog pagination** - getIssueChangelog now fetches all pages of changelog data
- [x] **Recent data access** - Now captures health changes from September 2025 (previously only July 2025)
- [x] **Fixed Jira API pagination issue** - Jira API was returning duplicate issues on different pages due to complex JQL queries
- [x] **Increased maxResults to 200** - Single request now fetches all 66 active issues instead of paginating
- [x] **Added client-side status filtering** - Filter out unwanted statuses after API call instead of in JQL query
- [x] **Fixed weeks at risk calculation** - Changed from Math.floor() to Math.ceil() to round up partial weeks
- [x] **Removed test issue** - HT-TEST removed from database
- [x] **Added table sorting** - Projects At Risk table now sortable by assignee, health, status, weeks at risk, and biz champ
- [x] **Cycle Time Details table** - Shows discovery projects with start/end dates and logic
- [x] **Discovery cycle detection** - Parses changelog to find first discovery status transition
- [x] **End date logic tracking** - Identifies why discovery ended (build transition, archive, current date)
- [x] **Enhanced discovery end detection** - Now handles multiple end variants (Build, Won't Do, Live, Completed)
- [x] **Calendar days calculation** - Added calendar days in discovery column instead of end date
- [x] **Expanded project scope** - Now includes Build and Beta projects npm for testing different end variants
- [x] **Shortened end date logic** - Simplified text to prevent wrapping (Still in Discovery, Build Transition, etc.)
- [x] **Improved table layout** - Added whitespace-nowrap to prevent text wrapping in End Date Logic column
- [x] **Add table filtering** - Filter by assignee, status, discovery start date range to eliminate horizontal scroll

### Sparklines
- [ ] **Ensure sparklines fill full width of container** - Currently using fixed 400px width with viewBox scaling
- [ ] **Add tooltips for project counts** - Show exact project count and date on hover
- [ ] **Improve responsiveness** - Better handling of different container sizes
- [ ] **Add animations** - Smooth transitions and hover effects
- [ ] **Color coding improvements** - More sophisticated color schemes

### Dashboard Features
- [ ] **Projects At Risk section** - Table showing projects needing attention
- [ ] **Cycle Time Analysis** - Box-and-whisker charts for discovery cycle times
- [ ] **Trends Over Time** - Stacked bar charts for historical analysis
- [ ] **Cycle Time Details** - Detailed table with specific metrics
- [ ] **Manual refresh button** - Allow users to trigger data updates
- [ ] **Date range picker** - Filter data by custom date ranges

### Data Integration
- [ ] **Fix Jira API integration** - Resolve 410 error and implement proper authentication
- [ ] **Real-time data updates** - WebSocket or polling for live data
- [ ] **Data validation** - Better error handling and data quality checks
- [ ] **Export functionality** - Download data as CSV or PDF

### UI/UX Improvements
- [ ] **Loading states** - Better loading indicators and skeleton screens
- [ ] **Error handling** - User-friendly error messages and recovery options
- [ ] **Mobile responsiveness** - Optimize for mobile and tablet views
- [ ] **Accessibility** - Screen reader support and keyboard navigation
- [ ] **Dark mode** - Theme switching capability

### Performance
- [ ] **Data caching** - Implement Redis or in-memory caching
- [ ] **Lazy loading** - Load data on demand for better performance
- [ ] **Bundle optimization** - Reduce JavaScript bundle size
- [ ] **Database indexing** - Add indexes for better query performance

## Key Learnings

### Technical Decisions
1. **SVG over Recharts**: SVG sparklines proved more reliable than Recharts for this use case
2. **Lazy loading services**: Prevents module-load-time database connection issues
3. **Manual CSV parsing**: Required due to non-standard CSV format with empty headers
4. **Fixed width with viewBox**: Best approach for responsive SVG charts

### Challenges Overcome
1. **Next.js project setup**: Had to work around directory conflicts during initialization
2. **Database initialization**: Lazy loading pattern solved instantiation order issues
3. **CSV data parsing**: Custom parsing logic needed for date format and empty headers
4. **Sparkline responsiveness**: SVG with viewBox provided best solution
5. **Jira status categorization**: "07 BETA" was initially categorized as "Done", filtering out active projects - required workflow update

## Development Workflow

### Setup
```bash
npm install
npm run dev
```

### Database Initialization
```bash
npm run init-db
```

### Key Files
- `src/app/page.tsx` - Main dashboard component
- `src/components/Sparkline.tsx` - Trend visualization component
- `src/lib/database.ts` - Database operations
- `src/lib/data-processor.ts` - Data processing logic
- `PM Capacity Tracking.csv` - Historical data source

## Recent Progress (Latest Session)

### ✅ **Cycle Time Analysis Caching System**
- **Problem**: Cycle time analysis was taking 30-60 seconds to process all 519 projects from Jira API
- **Solution**: Implemented comprehensive caching system with `cycle_time_cache` database table
- **Performance**: Reduced subsequent loads from 30-60s to 1-2s (instant after first load)
- **Cache Logic**: 
  - First load: Fetches from Jira API, calculates cycle times, caches results
  - Subsequent loads: Uses cached data instantly
  - Cache invalidation: Automatically clears when fresh Jira data is processed
- **Database Methods**: Added `insertCycleTimeCache()`, `getCycleTimeCache()`, `getAllCycleTimeCache()`, `clearCycleTimeCache()`

### ✅ **Data Accuracy Improvements**
- **Fixed API Token**: Updated to use correct token from Requirements.md
- **Fixed Pagination**: Implemented proper `nextPageToken` pagination to fetch all 519 projects
- **Verified Data**: Now correctly includes test projects (HT-298, HT-312, HT-358, etc.)
- **Realistic Numbers**: Q1 2025: 31 projects, Q2 2025: 30 projects, Q3 2025: 34 projects

### ✅ **Box Plot Chart Improvements**
- **Fixed Layout Issues**: Chart now fills full width, proper spacing, no overlapping elements
- **Added Interactivity**: Hover tooltips with detailed statistics for each quarter
- **Improved Labeling**: Changed "Q1/Q3" to "1st Quartile/3rd Quartile" to avoid confusion with quarters
- **Fixed Outlier Logic**: Properly positioned outliers outside whisker boundaries using standard IQR method
- **Removed Clutter**: Removed chart legend and range labels for cleaner interface

### ✅ **Project Details Table Implementation**
- **Clickable Summary Cards**: Added click functionality to view detailed project tables
- **Real Data Integration**: Created `/api/cycle-time-details` endpoint with actual Jira data
- **Table Columns**: Project Key, Summary, Assignee, Discovery Start, Active Discovery Time (blank), Calendar Discovery Time
- **Unit Conversion**: Respects days/weeks toggle for all time values
- **Interactive UI**: Modal-style display with close button and loading states

### 🔧 **Performance Optimization (In Progress)**
- **Problem**: Project details API taking 2-3 minutes per quarter (processing all 519 projects)
- **Solution**: Implemented project details caching system
- **New Database Table**: `project_details_cache` for quarter-specific project details
- **Cache Strategy**: First click calculates and caches, subsequent clicks are instant
- **Database Methods**: Added `insertProjectDetailsCache()`, `getProjectDetailsCache()`, `clearProjectDetailsCache()`
- **Current Status**: API endpoint created but experiencing 500 errors during testing

## Current Testing Status (End of Session)

### 🔍 **Immediate Issues to Debug**
1. **API 500 Error**: `/api/cycle-time-details` endpoint returning 500 Internal Server Error
   - **Symptom**: Console shows "Failed to fetch cycle time details" when clicking summary cards
   - **Likely Cause**: Database table creation or SQL query issues in new caching logic
   - **Files to Check**: `src/app/api/cycle-time-details/route.ts`, `src/lib/database.ts`

### 🚀 **Performance Optimization Status**
- **Caching System**: Implemented but not yet working due to API errors
- **Expected Behavior**: First click takes 2-3 minutes, subsequent clicks should be instant
- **Database Tables**: `project_details_cache` table created and initialized
- **Next Steps**: Debug API errors, test caching performance

### 📊 **Working Features**
- ✅ **Cycle Time Analysis Chart**: Fully functional with proper box plots
- ✅ **Summary Cards**: Display correct statistics (31, 30, 34 projects)
- ✅ **Interactive Tooltips**: Hover functionality working
- ✅ **Unit Toggle**: Days/weeks conversion working
- ❌ **Project Details Table**: Not working due to API errors

## Active Discovery Time Calculation Issue (Current Session)

### 🔍 **Problem: HT-156 Active Discovery Time**
- **Issue**: HT-156 showing 0 active discovery days instead of expected 62 days
- **Timeline**: Discovery cycle spans Oct 29, 2024 → July 1, 2025 (245 calendar days)
- **Expected Behavior**: Should show ~62 active days (excluding 169 days in "03 Committed" status)
- **Current Status**: Algorithm returns 0 active days, suggesting missing historical data

### 🔍 **Root Cause Analysis**
1. **Historical Data Gap**: Changelog data may not go back to Q4 2024
2. **Discovery Start Date**: Set to Oct 29, 2024 but changelog might only contain 2025 data
3. **Algorithm Logic**: `calculateActiveDiscoveryDays` assumes project starts active, but HT-156 had complex status transitions

### 🧪 **Debugging Attempts**
1. **Added `since` parameter**: Tried `since=2024-10-01T00:00:00.000Z` in changelog API calls
2. **Enhanced algorithm**: Added logic to adjust discovery start date if before first changelog entry
3. **Debug logging**: Added comprehensive logging for HT-156 to trace calculation process
4. **API testing**: Direct Jira API calls return `null`, suggesting authentication or endpoint issues

### 🔧 **Technical Details**
- **Changelog API**: `/issue/HT-156/changelog?maxResults=100`
- **Expected Data**: Should include transitions from Oct 2024 (01 Inbox → 05 Solution Discovery → 03 Committed → 04 Problem Discovery → 06 Build)
- **Current Result**: API returns `null` or empty data
- **Algorithm**: Tracks status changes to identify inactive periods (03 Committed, 01 Inbox, 09 Live, Won't Do, On Hold health)

### 🎯 **Next Steps to Try**
1. **Verify Jira API Access**: Test changelog endpoint with different authentication methods
2. **Check API Permissions**: Ensure token has access to historical changelog data
3. **Alternative Data Sources**: Consider using `getAllIssuesForCycleAnalysis()` which fetches all 519 projects
4. **Fallback Strategy**: Implement logic to handle projects with incomplete changelog data
5. **Manual Verification**: Test with a project that has complete 2025 changelog data to verify algorithm

### 📝 **Key Learnings**
- **Q4 2024 Scope**: Going back to Oct 1, 2024 is practical for active projects (vs full 2024)
- **API Limitations**: Jira API may have restrictions on historical changelog data access
- **Data Completeness**: Need to verify changelog data goes back far enough for long discovery cycles
- **Algorithm Robustness**: Need better handling of edge cases with incomplete historical data

## Active Discovery Cycle Time Algorithm

### Overview
The active discovery cycle time calculation tracks the actual time a project spends in "active" discovery work, excluding periods when the project is inactive or on hold.

### Key Concepts

**Active States:**
- Discovery statuses: `02 Generative Discovery`, `04 Problem Discovery`, `05 Solution Discovery`
- Health: `On Track` (or any health except `On Hold`)

**Inactive States:**
- Inactive statuses: `01 Inbox`, `03 Committed`, `09 Live`, `Won't Do`
- On-hold health: `On Hold`

**Core Logic:**
A project is considered "inactive" if EITHER:
1. The status is in the inactive list, OR
2. The health is "On Hold"

### Algorithm Implementation

1. **Initialize**: Projects start as active when discovery begins
2. **Process Transitions**: For each changelog entry within the discovery period:
   - Update both status and health from all items in the entry
   - Determine new active/inactive state based on BOTH status and health
   - Track state changes and count periods accordingly
3. **State Changes**:
   - `Active → Inactive`: Count the active period, mark as inactive
   - `Inactive → Active`: Count the inactive period, add to total, mark as active
   - `Inactive → Inactive`: Count the inactive period, add to total
   - `Active → Active`: Just update the last transition date
4. **Final Period**: Add remaining time from last transition to discovery end

### Complex Cases Handled

**Same-Day Transitions:**
- Projects that start discovery and immediately go inactive (e.g., HT-218)
- Multiple status/health changes in a single changelog entry

**Mixed State Changes:**
- Status becomes active but health goes to "On Hold" (project becomes inactive)
- Health becomes "On Track" but status is inactive (project becomes active)

**Multiple Inactive Periods:**
- Projects that go on hold multiple times during discovery
- Projects that move between inactive statuses

### Field Detection

**Status Transitions:**
- Field name: `status`
- Values: Standard Jira status names

**Health Transitions:**
- Field name: `Health` OR field ID: `customfield_10238`
- Values: `On Track`, `On Hold`, `At Risk`, `Off Track`, etc.

### Example: HT-218 Timeline

```
June 11: Discovery starts (01 Inbox → 02 Generative Discovery) - ACTIVE
June 11: Goes inactive (02 Generative Discovery → 03 Committed) - INACTIVE
July 2:  Becomes active (03 Committed → 04 Problem Discovery) - ACTIVE
Aug 12:  Goes on hold (On Track → On Hold) - INACTIVE
Aug 19:  Becomes active (On Hold → On Track) - ACTIVE
Sep 11:  Goes on hold (On Track → On Hold) - INACTIVE
```

**Result**: 48 active days out of 95 calendar days

### Debugging

Enable debug logging by setting `isDebugIssue = true` for specific issue keys. The algorithm will log:
- Each transition processed
- Before/after state changes
- Period calculations
- State change reasons

### Performance Considerations

- Changelog data is fetched once per project and cached
- Algorithm processes transitions in chronological order
- Handles large changelogs efficiently with pagination
- Debug logging can be disabled for production

## Performance Issues & Enhancement Ideas

### Trends Over Time API Performance
**Current Issue**: The `/api/trends` endpoint takes 10+ minutes to complete due to fetching changelog data for every project for every week.

**Root Cause**: 
- 50 projects × 12 weeks = 600 project-week combinations
- Each combination requires fetching full changelog from Jira API
- HT-156 alone has 335 changelog entries requiring 4 API calls
- No caching of changelog data between weeks

**Enhancement Ideas**:

1. **Changelog Caching**
   - Cache changelog data in database after first fetch
   - Store in `changelog_cache` table with `issue_key`, `changelog_data`, `last_updated`
   - Only refetch if changelog is older than 24 hours

2. **Weekly Snapshot Pre-calculation**
   - Background job that calculates weekly snapshots daily
   - Store in `weekly_snapshots` table with `week_start`, `project_counts`, `health_breakdown`, `status_breakdown`
   - API just returns pre-calculated data

3. **Incremental Updates**
   - Only recalculate weeks that have changed since last run
   - Track last processed changelog entry per project
   - Process only new changelog entries

4. **Database-First Approach**
   - Store all changelog data locally during initial sync
   - Query database instead of Jira API for historical analysis
   - Much faster than API calls

5. **Parallel Processing**
   - Process multiple projects simultaneously
   - Use worker threads for changelog analysis
   - Batch API calls where possible

6. **Smart Filtering**
   - Only fetch changelog for projects that existed during the week
   - Skip projects created after the week being analyzed
   - Use project creation date to optimize

7. **Reduced Time Range**
   - Start with 4-6 weeks instead of 12
   - Add pagination for longer time ranges
   - Let users select specific date ranges

**Expected Performance Improvement**: From 10+ minutes to under 30 seconds

### Other Performance Enhancements

1. **Cycle Time Analysis Caching**
   - Pre-calculate cycle time data in background
   - Cache results for each quarter/cohort
   - Only recalculate when new projects complete discovery

2. **Project Details Table Optimization**
   - Implement pagination for large datasets
   - Add search/filter capabilities
   - Lazy load project details on demand

3. **Database Indexing**
   - Add indexes on frequently queried columns
   - Optimize SQL queries for better performance
   - Consider database connection pooling

## Next Session Priorities
1. **Deploy to Production**: Set up public web app deployment for team feedback
2. **Fix Project Details Table**: Currently not showing data when clicking on quarter summary cards
3. **Project Exclusion UI**: Create functionality to exclude specific projects from analysis
4. **Performance Optimization**: Implement changelog caching and weekly snapshots
5. **UI Enhancements**: Better visualization of active vs calendar cycle times

## Future Enhancement Ideas

### Data Source Improvements
1. **Team Workload Sparklines with Jira Data**
   - Replace PM Capacity spreadsheet dependency with Jira historical data
   - Use changelog analysis to track workload trends over time
   - Provide more accurate and real-time workload visualization
   - Eliminate manual data entry and CSV file maintenance

2. **Enhanced Cycle Time Details Filtering**
   - Add Business Champion (Biz Champ) filtering to Cycle Time Details table
   - Allow filtering by multiple criteria simultaneously (assignee + biz champ + status)
   - Improve data exploration and analysis capabilities

3. **Extended Historical Trends Analysis**
   - Pull more historical data to extend Trends Over Time chart beyond 12 weeks
   - Implement date range filtering (e.g., last 6 months, last year, custom range)
   - Add time period selection controls (weekly, monthly, quarterly views)
   - Provide deeper historical insights and longer-term trend analysis

## Deployment Considerations

### Production Deployment Setup
1. **Hosting Platform**: Vercel (recommended for Next.js apps)
   - Easy deployment from GitHub
   - Built-in environment variable management
   - Automatic HTTPS and CDN
   - Serverless functions for API routes

2. **Environment Configuration**
   - Move Jira API credentials to environment variables
   - Set up production database (consider Vercel Postgres or PlanetScale)
   - Configure proper CORS settings for API access

3. **Security Considerations**
   - Secure Jira API token storage
   - Add authentication/authorization if needed
   - Rate limiting for API endpoints
   - Input validation and sanitization

4. **Performance Optimizations**
   - Enable database caching for production
   - Optimize API response times
   - Consider CDN for static assets
   - Implement proper error handling and logging

5. **Data Management**
   - Set up automated data refresh schedules
   - Consider data backup strategies
   - Plan for database migrations in production

### Pre-Deployment Checklist
- [ ] Move hardcoded credentials to environment variables
- [ ] Test all API endpoints in production-like environment
- [ ] Verify database schema works with production database
- [ ] Add proper error boundaries and logging
- [ ] Test loading states and error handling
- [ ] Verify responsive design on mobile devices
- [ ] Set up monitoring and analytics

---
*Last updated: December 2024*
