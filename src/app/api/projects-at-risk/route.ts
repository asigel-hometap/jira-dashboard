import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    // Get projects that have been At Risk or Off Track for 2+ consecutive weeks
    const activeIssues = await dbService.getActiveIssues();
    
    // Filter for projects with At Risk or Off Track health
    const atRiskProjects = activeIssues.filter(issue => 
      issue.health === 'At Risk' || issue.health === 'Off Track'
    );
    
    // Calculate weeks at risk for each project
    const projectsAtRisk = await Promise.all(
      atRiskProjects.map(async (issue) => {
        const weeksAtRisk = await dataProcessor.calculateWeeksAtRisk(issue.key);
        
        return {
          key: issue.key,
          name: issue.summary,
          assignee: issue.assignee,
          currentHealth: issue.health,
          currentStatus: issue.status,
          weeksAtRisk: weeksAtRisk,
          bizChamp: issue.bizChamp || 'Not Assigned',
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
