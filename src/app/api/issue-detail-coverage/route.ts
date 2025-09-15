import { NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET() {
  try {
    const dbService = getDatabaseService();
    
    // Get all issues from Jira API
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    const jiraIssueKeys = new Set(allJiraIssues.map(issue => issue.key));
    
    // Get all issues from our database
    const dbIssues = await dbService.getActiveIssues();
    const dbIssueKeys = new Set(dbIssues.map(issue => issue.key));
    
    // Get all cached cycle time data
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const cachedIssueKeys = new Set(cycleTimeCache.map(cache => cache.issueKey));
    
    // Calculate coverage metrics
    const totalJiraIssues = allJiraIssues.length;
    const totalDbIssues = dbIssues.length;
    const totalCachedIssues = cycleTimeCache.length;
    
    // Issues in Jira but not in our database
    const missingFromDb = allJiraIssues.filter(issue => !dbIssueKeys.has(issue.key));
    
    // Issues in cycle time cache but not in our database
    const cachedButMissingFromDb = cycleTimeCache.filter(cache => !dbIssueKeys.has(cache.issueKey));
    
    // Issues with complete details (in both DB and cache)
    const completeDetails = cycleTimeCache.filter(cache => dbIssueKeys.has(cache.issueKey));
    
    // Issues with partial details (in cache but missing from DB)
    const partialDetails = cachedButMissingFromDb;
    
    // Issues with no details (in Jira but not cached)
    const noDetails = allJiraIssues.filter(issue => !cachedIssueKeys.has(issue.key));
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalJiraIssues,
          totalDbIssues,
          totalCachedIssues,
          completeDetails: completeDetails.length,
          partialDetails: partialDetails.length,
          noDetails: noDetails.length
        },
        coverage: {
          dbCoverage: Math.round((totalDbIssues / totalJiraIssues) * 100),
          cacheCoverage: Math.round((totalCachedIssues / totalJiraIssues) * 100),
          completeCoverage: Math.round((completeDetails.length / totalJiraIssues) * 100)
        },
        missingFromDb: missingFromDb.slice(0, 10).map(issue => ({
          key: issue.key,
          status: issue.fields.status.name,
          summary: issue.fields.summary
        })),
        cachedButMissingFromDb: partialDetails.slice(0, 10).map(cache => ({
          key: cache.issueKey,
          endDateLogic: cache.endDateLogic
        })),
        noDetails: noDetails.slice(0, 10).map(issue => ({
          key: issue.key,
          status: issue.fields.status.name,
          summary: issue.fields.summary
        }))
      }
    });
    
  } catch (error: any) {
    console.error('Error checking issue detail coverage:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
