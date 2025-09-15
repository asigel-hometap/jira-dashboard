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

    console.log('Jira issue data:', {
      key: jiraIssue.key,
      summary: jiraIssue.fields.summary,
      assignee: jiraIssue.fields.assignee?.displayName,
      status: jiraIssue.fields.status.name
    });

    // Convert to proper Issue format
    const issue = {
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

    console.log('Converted issue:', {
      key: issue.key,
      summary: issue.summary,
      assignee: issue.assignee,
      status: issue.status,
      priority: issue.priority
    });

    try {
      await dbService.insertIssue(issue);
      console.log('Successfully inserted issue:', issue.key);
      
      // Verify it was inserted
      const insertedIssue = await dbService.getIssueByKey(issue.key);
      
      return NextResponse.json({
        success: true,
        message: 'Test insert successful',
        data: {
          issueKey: issue.key,
          summary: insertedIssue?.summary,
          assignee: insertedIssue?.assignee,
          status: insertedIssue?.status
        }
      });
    } catch (error) {
      console.error('Error inserting issue:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        issueData: issue
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
