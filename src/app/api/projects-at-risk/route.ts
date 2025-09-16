import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    // Get all active issues from Jira API (using the working function)
    const { getAllIssuesForCycleAnalysis } = await import('@/lib/jira-api');
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    
    // Filter for projects that are currently At Risk or Off Track using real-time data
    const atRiskProjects = allJiraIssues
      .filter(jiraIssue => {
        const status = jiraIssue.fields.status.name;
        const health = jiraIssue.fields.customfield_10238?.value;
        
        // Exclude inactive/archived projects
        if (['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'].includes(status)) {
          return false;
        }
        
        // Only include projects that are At Risk or Off Track
        return health === 'At Risk' || health === 'Off Track';
      })
      .map(jiraIssue => ({
        key: jiraIssue.key,
        summary: jiraIssue.fields.summary,
        assignee: jiraIssue.fields.assignee?.displayName || 'Unassigned',
        health: jiraIssue.fields.customfield_10238?.value || 'Unknown',
        status: jiraIssue.fields.status.name
      }));
    
    // Calculate additional risk data for each project
    const projectsAtRisk = await Promise.all(
      atRiskProjects.map(async (issue) => {
        const [firstRiskDate, riskHistory] = await Promise.all([
          dataProcessor.getFirstRiskDate(issue.key),
          dataProcessor.getRiskHistoryVisualization(issue.key)
        ]);
        
        return {
          key: issue.key,
          name: issue.summary,
          assignee: issue.assignee,
          currentHealth: issue.health,
          currentStatus: issue.status,
          firstRiskDate: firstRiskDate,
          riskHistory: riskHistory.summary,
          riskHistoryDetails: riskHistory.history,
          jiraUrl: `https://hometap.atlassian.net/browse/${issue.key}`
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: projectsAtRisk
    });
    
  } catch (error) {
    console.error('Error fetching projects at risk:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch projects at risk data'
    }, { status: 500 });
  }
}
