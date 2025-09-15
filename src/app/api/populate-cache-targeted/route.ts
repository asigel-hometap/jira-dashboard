import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting targeted cache population...');
    
    // Get ALL issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Total issues available: ${allIssues.length}`);
    
    // Sort issues by creation date (newest first) to prioritize recent projects
    const sortedIssues = allIssues.sort((a, b) => 
      new Date(b.fields.created).getTime() - new Date(a.fields.created).getTime()
    );
    
    console.log('Processing issues in reverse chronological order (newest first)...');
    
    let totalProcessed = 0;
    let totalDiscoveryCycles = 0;
    const batchSize = 20;
    
    for (let i = 0; i < sortedIssues.length; i += batchSize) {
      const batchIssues = sortedIssues.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(sortedIssues.length / batchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (issues ${i + 1}-${Math.min(i + batchSize, sortedIssues.length)})...`);
      
      let batchDiscoveryCycles = 0;
      
      for (const issue of batchIssues) {
        try {
          // Check if already cached
          const existingCache = await dbService.getCycleTimeCacheByIssue(issue.key);
          if (existingCache) {
            console.log(`Skipping ${issue.key} - already cached`);
            continue;
          }
          
          const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issue.key);
          
          // Cache the result
          const completionDate = cycleInfo.discoveryEndDate;
          const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
          
          await dbService.insertCycleTimeCache(issue.key, {
            discoveryStartDate: cycleInfo.discoveryStartDate,
            discoveryEndDate: cycleInfo.discoveryEndDate,
            endDateLogic: cycleInfo.endDateLogic,
            calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
            activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
            completionQuarter: quarter
          });
          
          // Count completed discovery cycles
          if (cycleInfo.discoveryStartDate &&
              cycleInfo.discoveryEndDate &&
              cycleInfo.endDateLogic !== 'Still in Discovery' &&
              cycleInfo.endDateLogic !== 'No Discovery' &&
              cycleInfo.endDateLogic !== 'Direct to Build') {
            batchDiscoveryCycles++;
            totalDiscoveryCycles++;
            console.log(`Found completed cycle: ${issue.key} (${quarter}) - ${cycleInfo.calendarDaysInDiscovery} days`);
          }
          
          totalProcessed++;
          
        } catch (error) {
          console.error(`Error processing ${issue.key}:`, error);
          // Continue with next project
        }
      }
      
      console.log(`Batch ${batchNumber} complete: ${batchDiscoveryCycles} discovery cycles found`);
      console.log(`Total progress: ${totalProcessed} processed, ${totalDiscoveryCycles} discovery cycles found`);
      
      // Small delay between batches
      if (i + batchSize < sortedIssues.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Targeted cache population finished!`);
    console.log(`Total projects processed: ${totalProcessed}`);
    console.log(`Total discovery cycles found: ${totalDiscoveryCycles}`);
    
    return NextResponse.json({
      success: true,
      message: 'Targeted cache population finished',
      data: {
        totalProcessed,
        totalDiscoveryCycles,
        totalIssues: sortedIssues.length
      }
    });
    
  } catch (error) {
    console.error('Error in targeted cache population:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate targeted cache',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
