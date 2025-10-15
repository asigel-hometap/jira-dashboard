import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';
import { getDataProcessor } from '@/lib/data-processor';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting daily sync...');
    const startTime = Date.now();
    
    // Get all issues from Jira API
    const allJiraIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Fetched ${allJiraIssues.length} issues from Jira`);
    
    // Get all issues from database (including archived/inactive)
    const dbIssues = await dbService.getIssues();
    const dbIssueKeys = new Set(dbIssues.map(issue => issue.key));
    console.log(`Found ${dbIssues.length} issues in database`);
    
    // Find missing issues
    const missingIssues = allJiraIssues.filter(issue => !dbIssueKeys.has(issue.key));
    console.log(`Found ${missingIssues.length} missing issues`);
    
    // Find issues that need health updates (exist in both but may have different health)
    const issuesToUpdate = [];
    for (const jiraIssue of allJiraIssues) {
      if (dbIssueKeys.has(jiraIssue.key)) {
        const dbIssue = dbIssues.find(issue => issue.key === jiraIssue.key);
        const jiraHealth = jiraIssue.fields.customfield_10238?.value;
        const dbHealth = dbIssue?.health;
        
        // Check if health status has changed (treat undefined and null as equivalent)
        const normalizedJiraHealth = jiraHealth || null;
        const normalizedDbHealth = dbHealth || null;
        
        if (normalizedJiraHealth !== normalizedDbHealth) {
          issuesToUpdate.push(jiraIssue);
        }
      }
    }
    console.log(`Found ${issuesToUpdate.length} issues needing health updates`);
    
    let syncedCount = 0;
    let updatedCount = 0;
    let errors = 0;
    
    // Sync missing issues in batches
    const batchSize = 10;
    for (let i = 0; i < missingIssues.length; i += batchSize) {
      const batch = missingIssues.slice(i, i + batchSize);
      console.log(`Syncing missing issues batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingIssues.length/batchSize)}`);
      
      for (const jiraIssue of batch) {
        try {
          const issue = dataProcessor.mapJiraIssueToIssue(jiraIssue);
          await dbService.insertIssue(issue);
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing ${jiraIssue.key}:`, error);
          errors++;
        }
      }
    }
    
    // Update existing issues with new health data
    for (const jiraIssue of issuesToUpdate) {
      try {
        const issue = dataProcessor.mapJiraIssueToIssue(jiraIssue);
        await dbService.insertIssue(issue); // This will update existing records
        updatedCount++;
      } catch (error) {
        console.error(`Error updating ${jiraIssue.key}:`, error);
        errors++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`Daily sync completed in ${duration}ms: ${syncedCount} synced, ${updatedCount} updated, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Daily sync completed: ${syncedCount} synced, ${updatedCount} updated, ${errors} errors`,
      data: {
        synced: syncedCount,
        updated: updatedCount,
        errors: errors,
        duration: duration,
        totalIssues: allJiraIssues.length,
        databaseIssues: dbIssues.length
      }
    });
    
  } catch (error) {
    console.error('Error in daily sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
