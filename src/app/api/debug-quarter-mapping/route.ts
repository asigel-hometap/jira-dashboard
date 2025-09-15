import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    // Get cycle time cache for Q2_2025
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const quarterIssues = cycleTimeCache.filter(cached => 
      cached.completionQuarter === 'Q2_2025' &&
      cached.discoveryStartDate && 
      cached.discoveryEndDate && 
      cached.endDateLogic !== 'Still in Discovery' &&
      cached.endDateLogic !== 'No Discovery' &&
      cached.endDateLogic !== 'Direct to Build'
    );

    console.log(`Found ${quarterIssues.length} projects for Q2_2025`);

    // Get all issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    const issueMap = new Map(allIssues.map(issue => [issue.key, issue]));

    console.log(`Jira API returned ${allIssues.length} issues`);

    // Check first few quarter issues
    const sampleIssues = quarterIssues.slice(0, 5);
    const results = [];

    for (const cached of sampleIssues) {
      const jiraIssue = issueMap.get(cached.issueKey);
      const existingIssue = await dbService.getIssueByKey(cached.issueKey);
      
      results.push({
        issueKey: cached.issueKey,
        inJiraApi: !!jiraIssue,
        inDatabase: !!existingIssue,
        jiraSummary: jiraIssue?.fields?.summary,
        dbSummary: existingIssue?.summary
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        quarterIssuesCount: quarterIssues.length,
        jiraApiCount: allIssues.length,
        sampleResults: results
      }
    });

  } catch (error: any) {
    console.error('Error debugging quarter mapping:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
