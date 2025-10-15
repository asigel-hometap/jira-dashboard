import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get counts from both sources
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    const dbIssues = await dbService.getIssues(); // Use all issues, not just active ones
    
    // Calculate sync metrics
    const jiraIssueKeys = new Set(jiraIssues.map(issue => issue.key));
    const dbIssueKeys = new Set(dbIssues.map(issue => issue.key));
    
    const missingFromDb = jiraIssues.filter(issue => !dbIssueKeys.has(issue.key));
    const extraInDb = dbIssues.filter(issue => !jiraIssueKeys.has(issue.key));
    
    // Check for health discrepancies
    const healthDiscrepancies = [];
    for (const jiraIssue of jiraIssues) {
      if (dbIssueKeys.has(jiraIssue.key)) {
        const dbIssue = dbIssues.find(issue => issue.key === jiraIssue.key);
        const jiraHealth = jiraIssue.fields.customfield_10238?.value;
        const dbHealth = dbIssue?.health;
        
        // Check if health status has changed (treat undefined and null as equivalent)
        const normalizedJiraHealth = jiraHealth || null;
        const normalizedDbHealth = dbHealth || null;
        
        if (normalizedJiraHealth !== normalizedDbHealth) {
          healthDiscrepancies.push({
            key: jiraIssue.key,
            jiraHealth: jiraHealth || 'null',
            dbHealth: dbHealth || 'null'
          });
        }
      }
    }
    
    // Calculate sync health score
    const totalIssues = jiraIssues.length;
    const syncedIssues = totalIssues - missingFromDb.length;
    const healthAccurateIssues = totalIssues - healthDiscrepancies.length;
    
    const syncScore = Math.round((syncedIssues / totalIssues) * 100);
    const healthScore = Math.round((healthAccurateIssues / totalIssues) * 100);
    const overallScore = Math.round((syncScore + healthScore) / 2);
    
    // Determine sync status
    let status = 'healthy';
    if (overallScore < 80) status = 'critical';
    else if (overallScore < 95) status = 'warning';
    
    return NextResponse.json({
      success: true,
      data: {
        status: status,
        overallScore: overallScore,
        syncScore: syncScore,
        healthScore: healthScore,
        metrics: {
          totalJiraIssues: totalIssues,
          totalDbIssues: dbIssues.length,
          missingFromDb: missingFromDb.length,
          extraInDb: extraInDb.length,
          healthDiscrepancies: healthDiscrepancies.length
        },
        issues: {
          missingFromDb: missingFromDb.slice(0, 10).map(issue => ({
            key: issue.key,
            summary: issue.fields.summary,
            assignee: issue.fields.assignee?.displayName
          })),
          healthDiscrepancies: healthDiscrepancies.slice(0, 10)
        },
        lastChecked: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
