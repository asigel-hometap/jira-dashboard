import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    
    if (!quarter) {
      return NextResponse.json({ success: false, error: 'Quarter parameter required' }, { status: 400 });
    }

    await initializeDatabase();
    const dbService = getDatabaseService();

    console.log(`Syncing issues for ${quarter}...`);

    // Get cycle time cache for the specific quarter
    const cycleTimeCache = await dbService.getCycleTimeCache();
    const quarterIssues = cycleTimeCache.filter(cached => 
      cached.completionQuarter === quarter &&
      cached.discoveryStartDate && 
      cached.discoveryEndDate && 
      cached.endDateLogic !== 'Still in Discovery' &&
      cached.endDateLogic !== 'No Discovery' &&
      cached.endDateLogic !== 'Direct to Build'
    );

    console.log(`Found ${quarterIssues.length} projects for ${quarter}`);

    // Get all issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    const issueMap = new Map(allIssues.map(issue => [issue.key, issue]));

    // Find missing issues for this quarter
    const missingIssues = [];
    for (const cached of quarterIssues) {
      try {
        const existingIssue = await dbService.getIssueByKey(cached.issueKey);
        if (!existingIssue) {
          const jiraIssue = issueMap.get(cached.issueKey);
          if (jiraIssue) {
            missingIssues.push(jiraIssue);
          }
        }
      } catch (error) {
        // Issue not found, try to get from Jira
        const jiraIssue = issueMap.get(cached.issueKey);
        if (jiraIssue) {
          missingIssues.push(jiraIssue);
        }
      }
    }

    console.log(`Found ${missingIssues.length} missing issues for ${quarter}`);

    // Insert missing issues (limit to 20 to avoid timeouts)
    const issuesToInsert = missingIssues.slice(0, 20);
    let insertedCount = 0;

    for (const jiraIssue of issuesToInsert) {
      try {
        // Convert JiraIssue to Issue format
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
          discoveryComplexity: jiraIssue.fields.customfield_11081?.value || null,
          discoveryComplexityId: jiraIssue.fields.customfield_11081?.id || null,
          created: new Date(jiraIssue.fields.created),
          updated: new Date(jiraIssue.fields.updated),
          duedate: null,
          priority: 'Unknown', // Default since not in API response
          labels: jiraIssue.fields.labels || [],
          bizChamp: jiraIssue.fields.customfield_10150?.map((user: any) => user.displayName).join(', ') || null,
          bizChampId: null,
          isArchived: false
        };
        
        await dbService.insertIssue(issue);
        insertedCount++;
        console.log(`Inserted ${issue.key}: ${issue.summary}`);
      } catch (error) {
        console.error(`Error inserting issue ${jiraIssue.key}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${insertedCount} issues for ${quarter}`,
      data: {
        quarter,
        totalInQuarter: quarterIssues.length,
        missingFound: missingIssues.length,
        inserted: insertedCount,
        remaining: missingIssues.length - insertedCount
      }
    });

  } catch (error: any) {
    console.error('Error syncing quarter issues:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
