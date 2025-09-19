import { NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST() {
  try {
    const dbService = getDatabaseService();
    
    // Get all issues from Jira API
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Fetched ${allJiraIssues.length} issues from Jira`);
    
    // Get all issues from our database
    const dbIssues = await dbService.getActiveIssues();
    const dbIssueKeys = new Set(dbIssues.map(issue => issue.key));
    
    // Find issues that are in Jira but not in our database
    const missingIssues = allJiraIssues.filter(issue => !dbIssueKeys.has(issue.key));
    console.log(`Found ${missingIssues.length} issues missing from database`);
    
    let synced = 0;
    let errors = 0;
    
    // Sync missing issues in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < missingIssues.length; i += batchSize) {
      const batch = missingIssues.slice(i, i + batchSize);
      console.log(`Syncing batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(missingIssues.length / batchSize)} (${batch.length} issues)`);
      
      const batchPromises = batch.map(async (issue) => {
        try {
          await dbService.insertIssue({
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            statusId: issue.fields.status.id,
            assignee: issue.fields.assignee?.displayName || null,
            assigneeId: issue.fields.assignee?.accountId || null,
            health: issue.fields.customfield_10238?.value || null,
            healthId: issue.fields.customfield_10238?.id || null,
            discoveryComplexity: issue.fields.customfield_11081?.value || null,
            discoveryComplexityId: issue.fields.customfield_11081?.id || null,
            created: new Date(issue.fields.created),
            updated: new Date(issue.fields.updated),
            duedate: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
            priority: issue.fields.priority?.name || 'None',
            labels: issue.fields.labels || [],
            bizChamp: issue.fields.customfield_10150?.[0]?.displayName || null,
            bizChampId: issue.fields.customfield_10150?.[0]?.accountId || null,
            isArchived: Boolean(issue.fields.customfield_10456)
          });
          return { success: true };
        } catch (error) {
          console.error(`Error syncing issue ${issue.key}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      });
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < missingIssues.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Sync complete: ${synced} synced, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Synced ${synced} missing issues, ${errors} errors`,
      data: {
        synced,
        errors,
        totalMissing: missingIssues.length
      }
    });
    
  } catch (error: any) {
    console.error('Error syncing missing issues:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}