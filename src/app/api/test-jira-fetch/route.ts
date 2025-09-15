import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Jira API fetch from Next.js context...');
    console.log('Environment variables:');
    console.log('JIRA_PROJECT_KEY:', process.env.JIRA_PROJECT_KEY);
    console.log('JIRA_EMAIL:', process.env.JIRA_EMAIL);
    console.log('JIRA_TOKEN length:', process.env.JIRA_TOKEN?.length || 0);
    
    const allIssues = await getAllIssuesForCycleAnalysis();
    
    console.log(`Fetched ${allIssues.length} issues from Next.js context`);
    
    // Show sample issue keys
    const sampleKeys = allIssues.slice(0, 10).map(issue => issue.key);
    console.log('Sample issue keys:', sampleKeys);
    
    // Check statuses
    const statuses = [...new Set(allIssues.map(issue => issue.fields.status.name))];
    console.log('Statuses found:', statuses);
    
    return NextResponse.json({
      success: true,
      data: {
        totalIssues: allIssues.length,
        sampleKeys,
        statuses,
        firstIssue: allIssues[0] ? {
          key: allIssues[0].key,
          status: allIssues[0].fields.status.name,
          created: allIssues[0].fields.created
        } : null,
        lastIssue: allIssues[allIssues.length - 1] ? {
          key: allIssues[allIssues.length - 1].key,
          status: allIssues[allIssues.length - 1].fields.status.name,
          created: allIssues[allIssues.length - 1].fields.created
        } : null
      }
    });
  } catch (error) {
    console.error('Error testing Jira API fetch:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test Jira API fetch',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
