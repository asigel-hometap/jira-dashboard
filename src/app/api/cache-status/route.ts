import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get comprehensive data
    const jiraIssues = await getAllIssuesForCycleAnalysis();
    const allDbIssues = await dbService.getIssues();
    const activeDbIssues = await dbService.getActiveIssues();
    
    // Calculate sync metrics
    const jiraIssueKeys = new Set(jiraIssues.map(issue => issue.key));
    const dbIssueKeys = new Set(allDbIssues.map(issue => issue.key));
    
    const missingFromDb = jiraIssues.filter(issue => !dbIssueKeys.has(issue.key));
    const extraInDb = allDbIssues.filter(issue => !jiraIssueKeys.has(issue.key));
    
    // Check for health discrepancies (with proper null/undefined handling)
    const healthDiscrepancies = [];
    for (const jiraIssue of jiraIssues) {
      if (dbIssueKeys.has(jiraIssue.key)) {
        const dbIssue = allDbIssues.find(issue => issue.key === jiraIssue.key);
        const jiraHealth = jiraIssue.fields.customfield_10238?.value;
        const dbHealth = dbIssue?.health;
        
        // Normalize undefined and null to be equivalent
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
    
    // Calculate comprehensive scores
    const totalIssues = jiraIssues.length;
    const syncedIssues = totalIssues - missingFromDb.length;
    const healthAccurateIssues = totalIssues - healthDiscrepancies.length;
    
    const syncScore = Math.round((syncedIssues / totalIssues) * 100);
    const healthScore = Math.round((healthAccurateIssues / totalIssues) * 100);
    const overallScore = Math.round((syncScore + healthScore) / 2);
    
    // Determine overall status
    let status = 'healthy';
    let statusColor = 'green';
    if (overallScore < 80) {
      status = 'critical';
      statusColor = 'red';
    } else if (overallScore < 95) {
      status = 'warning';
      statusColor = 'yellow';
    }
    
    // Calculate cache completion
    const cacheProgress = Math.round((syncedIssues / totalIssues) * 100);
    
    // Analyze issue distribution by status
    const statusDistribution = {
      active: activeDbIssues.length,
      archived: allDbIssues.length - activeDbIssues.length,
      missing: missingFromDb.length,
      extra: extraInDb.length
    };
    
    // Health status breakdown
    const healthBreakdown = {
      onTrack: activeDbIssues.filter(issue => issue.health === 'On Track').length,
      atRisk: activeDbIssues.filter(issue => issue.health === 'At Risk').length,
      offTrack: activeDbIssues.filter(issue => issue.health === 'Off Track').length,
      onHold: activeDbIssues.filter(issue => issue.health === 'On Hold').length,
      mystery: activeDbIssues.filter(issue => issue.health === 'Mystery').length,
      complete: activeDbIssues.filter(issue => issue.health === 'Complete').length,
      unknown: activeDbIssues.filter(issue => issue.health === 'Unknown' || !issue.health).length
    };
    
    return NextResponse.json({
      success: true,
      data: {
        // Overall status
        status: {
          level: status,
          color: statusColor,
          overallScore: overallScore,
          lastChecked: new Date().toISOString()
        },
        
        // Sync metrics
        sync: {
          score: syncScore,
          totalJiraIssues: totalIssues,
          totalDbIssues: allDbIssues.length,
          missingFromDb: missingFromDb.length,
          extraInDb: extraInDb.length,
          cacheProgress: cacheProgress
        },
        
        // Health metrics
        health: {
          score: healthScore,
          discrepancies: healthDiscrepancies.length,
          breakdown: healthBreakdown
        },
        
        // Issue distribution
        distribution: statusDistribution,
        
        // Actionable insights
        insights: {
          needsSync: missingFromDb.length > 0,
          needsHealthUpdate: healthDiscrepancies.length > 0,
          hasExtraData: extraInDb.length > 0,
          cacheComplete: cacheProgress === 100,
          recommendations: generateRecommendations(missingFromDb.length, healthDiscrepancies.length, extraInDb.length, cacheProgress)
        },
        
        // Sample issues for debugging
        samples: {
          missingFromDb: missingFromDb.slice(0, 5).map(issue => ({
            key: issue.key,
            summary: issue.fields.summary,
            assignee: issue.fields.assignee?.displayName
          })),
          healthDiscrepancies: healthDiscrepancies.slice(0, 5),
          extraInDb: extraInDb.slice(0, 5).map(issue => ({
            key: issue.key,
            summary: issue.summary,
            assignee: issue.assignee
          }))
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting cache status:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      data: {
        status: { level: 'error', color: 'red', overallScore: 0 },
        sync: { score: 0, totalJiraIssues: 0, totalDbIssues: 0, missingFromDb: 0, extraInDb: 0, cacheProgress: 0 },
        health: { score: 0, discrepancies: 0, breakdown: {} },
        distribution: { active: 0, archived: 0, missing: 0, extra: 0 },
        insights: { needsSync: false, needsHealthUpdate: false, hasExtraData: false, cacheComplete: false, recommendations: [] }
      }
    }, { status: 500 });
  }
}

function generateRecommendations(missing: number, healthDiscrepancies: number, extra: number, cacheProgress: number): string[] {
  const recommendations = [];
  
  if (missing > 0) {
    recommendations.push(`Run Daily Sync to add ${missing} missing issues`);
  }
  
  if (healthDiscrepancies > 0) {
    recommendations.push(`Run Daily Sync to update ${healthDiscrepancies} health statuses`);
  }
  
  if (extra > 0) {
    recommendations.push(`Review ${extra} extra issues in database`);
  }
  
  if (cacheProgress < 100) {
    recommendations.push(`Complete cache processing (${100 - cacheProgress}% remaining)`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Database is fully synced and healthy');
  }
  
  return recommendations;
}
