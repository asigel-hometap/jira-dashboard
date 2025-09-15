# Jira Dashboard

A comprehensive dashboard for monitoring team workload, discovery cycle times, and project health using Jira data.

## Features

- **Team Workload**: Monitor active project counts per team member with overload alerts (≥6 projects)
- **Projects At Risk**: Identify projects with 2+ consecutive weeks at risk
- **Trends Over Time**: Stacked bar charts showing project health and status trends
- **Cycle Time Analysis**: Box-and-whisker plots for discovery cycle times by quarter
- **Cycle Time Details**: Table view of active discovery projects with cycle time metrics

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Node.js with SQLite database
- **Data Source**: Jira REST API
- **Hosting**: Vercel (free tier compatible)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

The first time you run the application, you need to initialize the database with historical data:

```bash
npm run init-db
```

This will:
- Create SQLite database tables
- Load PM Capacity Tracking CSV data (Feb-Sep 2025)
- Fetch current data from Jira API
- Create initial weekly snapshot

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Data Sources

### Jira API
- **Server**: https://hometap.atlassian.net
- **Project**: HT (Hometap)
- **Authentication**: Basic Auth with API token
- **Rate Limit**: 500 requests per 5 minutes

### Historical Data
- **PM Capacity Tracking.csv**: Historical workload data from February 2025 through September 8, 2025
- **Weekly Snapshots**: Automated snapshots of current project state

## Key Definitions

- **Active Projects**: Status not in (01 Inbox, 03 Committed, 09 Live, Won't Do); not archived; Health ≠ 'On hold'
- **Discovery Cycle Start**: First transition to Discovery status (02, 04, or 05)
- **Discovery Cycle End**: First transition to Build status (06) or Won't Do
- **Calendar Discovery Cycle Time**: Total weeks between discovery start and end
- **Active Discovery Cycle Time**: Calendar time excluding weeks when project health = 'On hold' or status in inactive states

## Status Values

- **Statuses**: 01 Inbox, 02 Generative Discovery, 03 Committed, 04 Problem Discovery, 05 Solution Discovery, 06 Build, 07 Beta, 08 Live, Won't Do
- **Health**: On Track, At Risk, Off Track, On Hold, Mystery, Complete

## API Endpoints

- `POST /api/init` - Initialize database and load data
- `GET /api/workload` - Get team workload data
- `GET /api/projects-at-risk` - Get projects at risk
- `GET /api/trends` - Get trend data
- `GET /api/cycle-time` - Get cycle time analysis
- `GET /api/cycle-details` - Get cycle time details

## Development

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/                   # Core libraries
│   ├── database.ts        # SQLite database service
│   ├── jira-api.ts        # Jira API integration
│   └── data-processor.ts  # Data processing logic
├── scripts/               # Utility scripts
│   └── init-db.ts         # Database initialization
└── types/                 # TypeScript type definitions
    └── jira.ts            # Jira data types
```

### Database Schema

- **issues**: Current state of all Jira issues
- **status_transitions**: History of status changes
- **health_transitions**: History of health changes
- **team_members**: Team member information
- **project_snapshots**: Weekly snapshots of project state
- **capacity_data**: Historical capacity data from CSV

## Deployment

The application is designed to be deployed on Vercel with the following considerations:

1. **Database**: SQLite database is stored in `/tmp` directory (ephemeral)
2. **Data Refresh**: Manual refresh via UI or scheduled API calls
3. **Environment Variables**: Jira credentials should be stored as environment variables in production

## Working Agreement

- Test as we go, isolate variables when debugging
- Keep it simple
- Don't get overconfident
- Ask for manual testing when necessary
- Ask for clarification when needed

## Next Steps

1. **Phase 1**: ✅ Foundation & Data Pipeline
2. **Phase 2**: Core Dashboard Components
3. **Phase 3**: Historical Data & Trends
4. **Phase 4**: Cycle Time Analysis
5. **Phase 5**: Polish & Deployment# Force deployment Mon Sep 15 14:31:57 EDT 2025
