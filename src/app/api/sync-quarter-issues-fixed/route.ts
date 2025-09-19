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

    // Find missing issues for this quarter and convert to proper Issue format
    const missingIssues = [];
    for (const cached of quarterIssues) {
      try {
        const existingIssue = await dbService.getIssueByKey(cached.issueKey);
        if (!existingIssue) {
          const jiraIssue = issueMap.get(cached.issueKey);
          if (jiraIssue) {
            // Convert Jira API format to Issue format
            const issue = {
              id: jiraIssue.id,
              key: jiraIssue.key,
              summary: jiraIssue.fields.summary,
              status: jiraIssue.fields.status.name,
              statusId: jiraIssue.fields.status.id,
              assignee: jiraIssue.fields.assignee?.displayName || null,
              assigneeId: jiraIssue.fields.assignee?.accountId || null,
              health: jiraIssue.fields.customfield_10238?.value || null,
              healthId: null, // Not available in this API response
              created: new Date(jiraIssue.fields.created),
              updated: new Date(jiraIssue.fields.updated),
              duedate: null, // Not available in this API response
              priority: 'Unknown', // Default since not in API response
              labels: jiraIssue.fields.labels || [],
              bizChamp: jiraIssue.fields.customfield_10150?.map((user: any) => user.displayName).join(', ') || null,
              bizChampId: null, // Not available in this API response
              isArchived: false
            };
            missingIssues.push(issue);
          }
        }
      } catch (error) {
        // Issue not found, try to get from Jira
        const jiraIssue = issueMap.get(cached.issueKey);
        if (jiraIssue) {
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
          missingIssues.push(issue);
        }
      }
    }

    console.log(`Found ${missingIssues.length} missing issues for ${quarter}`);
    console.log('Sample missing issues:', missingIssues.slice(0, 3).map(i => ({ key: i.key, summary: i.summary })));

    // Insert missing issues (limit to 10 to avoid timeouts)
    const issuesToInsert = missingIssues.slice(0, 10);
    let insertedCount = 0;

    console.log(`Attempting to insert ${issuesToInsert.length} issues...`);

    for (const issue of issuesToInsert) {
      try {
        console.log(`Inserting ${issue.key}: ${issue.summary}`);
        await dbService.insertIssue(issue);
        insertedCount++;
        console.log(`Successfully inserted ${issue.key}`);
      } catch (error) {
        console.error(`Error inserting issue ${issue.key}:`, error);
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
