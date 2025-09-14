# Jira Dashboard Requirements

## Overview
Build a standalone web app to monitor team member workload, track discovery cycle time trends, and identify projects needing investigation or remediation.

## Data Sources
- Jira API (primary)
- PM Capacity Tracking.csv (historical data)

## Jira Configuration
- Jira project key: Hometap (HT)
- Combine with manually generated PM Capacity Tracking.csv for historical data from February 2025 through September 8, 2025

## Dashboard Components

### 1. Team Workload
- Active project counts per team member
- Sparklines showing workload trends over time
- Overload alerts when team members have too many active projects
- Health breakdown (On Track, At Risk, Off Track, On Hold, Mystery, Complete, Unknown)

### 2. Projects At Risk
- Table of projects that have been "At Risk" for multiple weeks
- Columns: Key, Name, Assignee, Current Health, Current Status, # of Weeks at Risk, Biz Champ
- Deep links to Jira

### 3. Trends Over Time
- Stacked bar charts showing health and status breakdowns over time
- Weekly snapshots
- Filtering by assignee, team, and business champion

### 4. Cycle Time Analysis
- Box-and-whisker plots for discovery cycle times
- Cohort by calendar quarters
- Toggle between calendar and active discovery times
- Outlier detection

### 5. Cycle Time Details
- Table of individual project cycle times
- Filtering capabilities
- Active and calendar discovery times

## Technical Requirements
- Next.js with TypeScript
- Tailwind CSS for styling
- Chart.js for visualizations
- SQLite database
- Vercel deployment

## Security
- Use environment variables for API credentials
- No hardcoded secrets in repository
