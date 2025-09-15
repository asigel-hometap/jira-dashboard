import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    // Get one issue from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    const jiraIssue = allIssues[0]; // Get first issue

    // Convert JiraIssue to Issue format
    const testIssue = {
      id: jiraIssue.id,
      key: jiraIssue.key,
      summary: jiraIssue.fields.summary,
      status: jiraIssue.fields.status.name,
      statusId: jiraIssue.fields.status.id,
      assignee: jiraIssue.fields.assignee?.displayName || null,
      assigneeId: jiraIssue.fields.assignee?.accountId || null,
      health: jiraIssue.fields.customfield_10238?.value || null,
      healthId: null,
      created: new Date(jiraIssue.fields.created),
      updated: new Date(jiraIssue.fields.updated),
      duedate: null,
      priority: 'Unknown', // Default since not in API response
      labels: jiraIssue.fields.labels || [],
      bizChamp: jiraIssue.fields.customfield_10150?.map((user: any) => user.displayName).join(', ') || null,
      bizChampId: null,
      isArchived: false
    };

    console.log('Testing insert with issue:', testIssue.key);

    try {
      await dbService.insertIssue(testIssue);
      console.log('Successfully inserted issue:', testIssue.key);
      
      // Verify it was inserted
      const insertedIssue = await dbService.getIssueByKey(testIssue.key);
      
      return NextResponse.json({
        success: true,
        message: 'Test insert successful',
        data: {
          issueKey: testIssue.key,
          summary: insertedIssue?.summary,
          assignee: insertedIssue?.assignee
        }
      });
    } catch (error) {
      console.error('Error inserting issue:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        issueData: {
          key: testIssue.key,
          summary: testIssue.summary,
          assignee: testIssue.assignee
        }
      });
    }

  } catch (error: any) {
    console.error('Error in test:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
