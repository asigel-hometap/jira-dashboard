# Jira Dashboard Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (free tier available)
- Jira API credentials

## Step 1: Prepare Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Jira API Configuration
JIRA_BASE_URL=https://hometap.atlassian.net
JIRA_EMAIL=your-email@hometap.com
JIRA_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=HT
```

## Step 2: Push to GitHub

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a new repository on GitHub
3. Push your code:
   ```bash
   git remote add origin https://github.com/yourusername/jira-dashboard.git
   git push -u origin main
   ```

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add each variable from your `.env.local` file
5. Click "Deploy"

## Step 4: Configure Database

The app currently uses SQLite which won't work in production. You have two options:

### Option A: Vercel Postgres (Recommended)
1. Add Vercel Postgres to your project
2. Update database connection in `src/lib/database.ts`
3. Run database migrations

### Option B: Keep SQLite (Temporary)
- The app will work but data won't persist between deployments
- Good for testing and demos

## Step 5: Test Deployment

1. Visit your Vercel URL
2. Test all pages and functionality
3. Verify Jira API integration works
4. Check that data loads correctly

## Production Considerations

- **Security**: Consider adding authentication
- **Performance**: Enable caching for better performance
- **Monitoring**: Set up error tracking and analytics
- **Data Refresh**: Consider automated data refresh schedules

## Troubleshooting

- **Build Errors**: Check environment variables are set correctly
- **API Errors**: Verify Jira credentials and permissions
- **Database Issues**: Ensure database connection is properly configured
- **CORS Issues**: Check API endpoint configurations

## Data Flow Documentation

For detailed information about how data flows through the system, see [DATA_FLOW.md](./DATA_FLOW.md). This document covers:
- Data sources and consistency strategy
- API endpoint purposes and data sources
- Filtering logic for active vs archived projects
- Troubleshooting data inconsistencies
- Weekly snapshot process

## Next Steps

After successful deployment:
1. Share the URL with your team
2. Gather feedback
3. Iterate based on user needs
4. Consider adding authentication for security
5. Set up automated weekly snapshots for historical data
