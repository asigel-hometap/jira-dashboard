import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting complete cache population...');
    
    // Clear existing cache
    await dbService.clearCycleTimeCache();
    console.log('Cleared existing cache');
    
    // Get ALL issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Total issues to process: ${allIssues.length}`);
    
    // Process in batches to avoid timeouts
    const batchSize = 50;
    const totalBatches = Math.ceil(allIssues.length / batchSize);
    let totalProcessed = 0;
    let totalDiscoveryCycles = 0;
    
    console.log(`Processing ${totalBatches} batches of ${batchSize} projects each...`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allIssues.length);
      const batchIssues = allIssues.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (projects ${startIndex + 1}-${endIndex})...`);
      
      let batchDiscoveryCycles = 0;
      
      for (const issue of batchIssues) {
        try {
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
          }
          
          totalProcessed++;
          
          // Log progress every 10 projects
          if (totalProcessed % 10 === 0) {
            console.log(`Progress: ${totalProcessed}/${allIssues.length} projects processed, ${totalDiscoveryCycles} discovery cycles found`);
          }
          
        } catch (error) {
          console.error(`Error processing ${issue.key}:`, error);
          // Continue with next project
        }
      }
      
      console.log(`Batch ${batchIndex + 1} complete: ${batchDiscoveryCycles} discovery cycles found`);
      
      // Small delay between batches to avoid overwhelming the API
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Complete cache population finished!`);
    console.log(`Total projects processed: ${totalProcessed}`);
    console.log(`Total discovery cycles found: ${totalDiscoveryCycles}`);
    
    return NextResponse.json({
      success: true,
      message: 'Complete cache population finished',
      data: {
        totalProcessed,
        totalDiscoveryCycles,
        totalBatches
      }
    });
    
  } catch (error) {
    console.error('Error in complete cache population:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate complete cache',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
