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
    
    // Get all cached cycle time data
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // Find issues that are cached but missing from database
    const cachedButMissing = cycleTimeCache.filter(cache => !dbIssueKeys.has(cache.issueKey));
    console.log(`Found ${cachedButMissing.length} cached issues missing from database`);
    
    let synced = 0;
    let errors = 0;
    
    // Sync missing issues in batches
    const batchSize = 10;
    for (let i = 0; i < cachedButMissing.length; i += batchSize) {
      const batch = cachedButMissing.slice(i, i + batchSize);
      console.log(`Syncing cached batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(cachedButMissing.length / batchSize)} (${batch.length} issues)`);
      
      const batchPromises = batch.map(async (cache) => {
        try {
          // Find the issue in Jira API
          const jiraIssue = allJiraIssues.find(issue => issue.key === cache.issueKey);
          
          if (!jiraIssue) {
            console.warn(`Issue ${cache.issueKey} not found in Jira API`);
            return { success: false, error: 'Not found in Jira API' };
          }
          
          await dbService.insertIssue({
            id: jiraIssue.id,
            key: jiraIssue.key,
            summary: jiraIssue.fields.summary,
            status: jiraIssue.fields.status.name,
            statusId: jiraIssue.fields.status.id,
            assignee: jiraIssue.fields.assignee?.displayName || null,
            assigneeId: jiraIssue.fields.assignee?.accountId || null,
            health: jiraIssue.fields.customfield_10238?.value || null,
            healthId: jiraIssue.fields.customfield_10238?.id || null,
            discoveryComplexity: jiraIssue.fields.customfield_11081?.value || null,
            discoveryComplexityId: jiraIssue.fields.customfield_11081?.id || null,
            created: new Date(jiraIssue.fields.created),
            updated: new Date(jiraIssue.fields.updated),
            duedate: jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : null,
            priority: jiraIssue.fields.priority?.name || 'None',
            labels: jiraIssue.fields.labels || [],
            bizChamp: jiraIssue.fields.customfield_10150?.[0]?.displayName || null,
            bizChampId: jiraIssue.fields.customfield_10150?.[0]?.accountId || null,
            isArchived: Boolean(jiraIssue.fields.customfield_10456)
          });
          return { success: true };
        } catch (error) {
          console.error(`Error syncing cached issue ${cache.issueKey}:`, error);
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
      
      // Small delay between batches
      if (i + batchSize < cachedButMissing.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Cached sync complete: ${synced} synced, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Synced ${synced} cached issues, ${errors} errors`,
      data: {
        synced,
        errors,
        totalCachedMissing: cachedButMissing.length
      }
    });
    
  } catch (error: any) {
    console.error('Error syncing cached issues:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
