import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();

    // Get specific issue keys from request body
    const { issueKeys } = await request.json();
    
    if (!issueKeys || !Array.isArray(issueKeys)) {
      return NextResponse.json({
        success: false,
        error: 'Please provide an array of issue keys'
      }, { status: 400 });
    }

    console.log(`Refreshing specific issues: ${issueKeys.join(', ')}`);

    // Get all issues from Jira (this will include the new Discovery Complexity field)
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    
    // Filter for the specific issues we want to refresh
    const issuesToRefresh = allJiraIssues.filter(issue => 
      issueKeys.includes(issue.key)
    );

    console.log(`Found ${issuesToRefresh.length} issues to refresh`);

    // Process and update each issue
    for (const jiraIssue of issuesToRefresh) {
      const issue = dataProcessor.mapJiraIssueToIssue(jiraIssue);
      await dbService.insertIssue(issue);
      console.log(`Updated ${issue.key} with Discovery Complexity: ${issue.discoveryComplexity}`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully refreshed ${issuesToRefresh.length} issues`,
      data: {
        refreshedIssues: issuesToRefresh.map(issue => ({
          key: issue.key,
          discoveryComplexity: issue.fields.customfield_11081?.value || null
        }))
      }
    });

  } catch (error) {
    console.error('Error refreshing specific issues:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh specific issues'
    }, { status: 500 });
  }
}
