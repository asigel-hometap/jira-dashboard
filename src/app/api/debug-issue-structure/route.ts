import { NextResponse } from 'next/server';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET() {
  try {
    const allIssues = await getAllIssuesForCycleAnalysis();
    const testIssue = allIssues[0];

    return NextResponse.json({
      success: true,
      data: {
        issueKey: testIssue.key,
        fields: testIssue.fields,
        summary: testIssue.fields?.summary,
        assignee: testIssue.fields?.assignee,
        status: testIssue.fields?.status,
        created: testIssue.fields?.created,
        updated: testIssue.fields?.updated
      }
    });

  } catch (error: any) {
    console.error('Error debugging issue structure:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
