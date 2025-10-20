# Jira Dashboard Data Flow Documentation

## Overview

This document explains how data flows through the Jira Dashboard system, ensuring consistency between different components and data sources.

## Data Sources

### 1. Historical Data (CSV)
- **Source**: `PM Capacity Tracking.csv`
- **Date Range**: Up to September 8, 2025
- **Purpose**: Provides historical project counts for trend analysis
- **Storage**: Loaded into `capacity_data` table in PostgreSQL

### 2. Live Jira Data
- **Source**: Jira API (`getAllIssuesForCycleAnalysis`)
- **Purpose**: Real-time project counts and health status
- **Filtering**: Active projects only (discovery, build, beta statuses)
- **Archived Projects**: Excluded using `customfield_10454` and `customfield_10456`

### 3. Weekly Snapshots
- **Source**: Live Jira data captured weekly
- **Purpose**: Historical data for weeks after September 8, 2025
- **Storage**: `capacity_data` table with `notes: 'Weekly snapshot'`

## Data Flow Architecture

```
Jira API → Live Data Processing → Dashboard Components
    ↓
Historical CSV → Database Storage → Trends API
    ↓
Weekly Snapshots → Database Storage → Trends API
```

## API Endpoints

### 1. `/api/workload-live`
- **Purpose**: Real-time workload data for dashboard
- **Data Source**: Live Jira API
- **Filtering**: Active projects, excludes archived
- **Used By**: Dashboard main cards

### 2. `/api/workload`
- **Purpose**: Cached workload data
- **Data Source**: Database (may be stale)
- **Used By**: Fallback for dashboard

### 3. `/api/extended-trends`
- **Purpose**: Historical trends for sparklines
- **Data Source**: 
  - Historical weeks: Stored capacity data
  - Current week: Live Jira data (updated in real-time)
- **Used By**: Sparkline graphs

### 4. `/api/debug-capacity`
- **Purpose**: Debug stored capacity data
- **Data Source**: `capacity_data` table
- **Used By**: Troubleshooting

## Data Consistency Strategy

### Problem Solved
Previously, the system had inconsistencies between:
- Dashboard counts (live Jira data)
- Sparkline data (stale stored data)
- Actual Jira counts

### Solution Implemented
1. **Live Data for Current Week**: Trends API now uses live Jira data for the most recent week
2. **Historical Data for Past Weeks**: Uses stored capacity data for historical accuracy
3. **Consistent Filtering**: All live data uses the same filtering logic (active projects, exclude archived)

## Filtering Logic

### Active Projects
Projects are considered "active" if they have status:
- `02 Generative Discovery`
- `04 Problem Discovery`
- `05 Solution Discovery`
- `06 Build`
- `07 Beta`

### Archived Projects
Projects are excluded if they have:
- `customfield_10454` (Idea archived) = true
- `customfield_10456` (Idea archived on) = any value

## Data Processing Flow

### 1. Live Data Processing
```typescript
// In /api/workload-live
const jiraIssues = await getAllIssuesForCycleAnalysis();
const activeProjects = jiraIssues.filter(issue => {
  const status = issue.fields.status.name;
  const isArchived = issue.fields.customfield_10454;
  const archivedOn = issue.fields.customfield_10456;
  
  if (isArchived || archivedOn) return false;
  
  return ['02 Generative Discovery', '04 Problem Discovery', 
          '05 Solution Discovery', '06 Build', '07 Beta'].includes(status);
});
```

### 2. Historical Data Processing
```typescript
// In /api/extended-trends
// For historical weeks: use stored capacity data
// For current week: update with live Jira data
if (mostRecentWeek.date >= weekAgo) {
  // Update with live data
  const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMember(fullName);
  mostRecentWeek[shortName] = calculateTotalProjects(healthBreakdown);
}
```

## Weekly Snapshot Process

### Creating Snapshots
1. Fetch live Jira data
2. Apply consistent filtering (active projects, exclude archived)
3. Calculate project counts per team member
4. Store in `capacity_data` table with `notes: 'Weekly snapshot'`

### Snapshot API
- **Endpoint**: `/api/create-weekly-snapshot`
- **Method**: POST
- **Purpose**: Create weekly snapshot for historical data

## Troubleshooting Data Inconsistencies

### 1. Check Live Data
```bash
curl "http://localhost:3000/api/workload-live" | jq '.data[] | {teamMember, activeProjectCount}'
```

### 2. Check Stored Data
```bash
curl "http://localhost:3000/api/debug-capacity" | jq '.data.last5Entries'
```

### 3. Check Trends Data
```bash
curl "http://localhost:3000/api/extended-trends" | jq '.data | {jennie: .jennie[-1], garima: .garima[-1], sanela: .sanela[-1]}'
```

### 4. Verify Filtering
```bash
curl "http://localhost:3000/api/debug-filtering" | jq '.data'
```

## Team Member Mapping

```typescript
const teamMemberMap = {
  'Adam Sigel': 'adam',
  'Jennie Goldenberg': 'jennie', 
  'Jacqueline Gallagher': 'jacqueline',
  'Robert J. Johnson': 'robert',
  'Garima Giri': 'garima',
  'Lizzy Magill': 'lizzy',
  'Sanela Smaka': 'sanela'
};
```

## Database Schema

### capacity_data Table
```sql
CREATE TABLE capacity_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  adam INTEGER DEFAULT 0,
  jennie INTEGER DEFAULT 0,
  jacqueline INTEGER DEFAULT 0,
  robert INTEGER DEFAULT 0,
  garima INTEGER DEFAULT 0,
  lizzy INTEGER DEFAULT 0,
  sanela INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Maintenance Tasks

### Weekly
1. Create weekly snapshot using `/api/create-weekly-snapshot`
2. Verify data consistency across all endpoints
3. Check for any new archived projects

### Monthly
1. Review historical data accuracy
2. Update team member mappings if needed
3. Clean up old debug data

## Future Improvements

1. **Automated Snapshots**: Schedule weekly snapshots automatically
2. **Data Validation**: Add automated checks for data consistency
3. **Caching Strategy**: Implement smart caching for better performance
4. **Real-time Updates**: Consider WebSocket updates for live data changes
