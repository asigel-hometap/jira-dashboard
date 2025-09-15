import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

interface CustomRequest {
  issueKeys: string[];
  ranges: Array<{ start: number; end: number; label: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    const body: CustomRequest = await request.json();
    const { issueKeys = [], ranges = [] } = body;
    
    // Validate input limits
    if (issueKeys.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 specific issue keys allowed' },
        { status: 400 }
      );
    }
    
    if (ranges.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 priority ranges allowed' },
        { status: 400 }
      );
    }
    
    // Calculate total estimated issues
    const rangeIssues = ranges.reduce((total, range) => total + (range.end - range.start), 0);
    const totalEstimated = issueKeys.length + rangeIssues;
    
    if (totalEstimated > 500) {
      return NextResponse.json(
        { success: false, error: 'Total estimated issues exceeds 500. Please reduce the scope.' },
        { status: 400 }
      );
    }
    
    console.log(`Starting custom cache population...`);
    console.log(`Specific issues: ${issueKeys.length}`);
    console.log(`Range issues: ${rangeIssues}`);
    console.log(`Total estimated: ${totalEstimated}`);
    
    // Get all issues from Jira API
    const allIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Total issues available: ${allIssues.length}`);
    
    // Collect all issue keys to process
    const issueKeysToProcess = new Set<string>();
    
    // Add specific issue keys
    issueKeys.forEach(key => {
      if (key.trim()) {
        issueKeysToProcess.add(key.trim().toUpperCase());
      }
    });
    
    // Add issues from ranges
    ranges.forEach(range => {
      for (let i = range.start; i < range.end; i++) {
        const issueKey = `HT-${i}`;
        issueKeysToProcess.add(issueKey);
      }
    });
    
    console.log(`Total unique issues to process: ${issueKeysToProcess.size}`);
    
    // Process issues in batches to avoid timeouts
    const batchSize = 20;
    const issueKeysArray = Array.from(issueKeysToProcess);
    const totalBatches = Math.ceil(issueKeysArray.length / batchSize);
    
    let totalProcessed = 0;
    let totalDiscoveryCycles = 0;
    let skippedCached = 0;
    let notFound = 0;
    
    console.log(`Processing ${totalBatches} batches of up to ${batchSize} issues each...`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, issueKeysArray.length);
      const batchKeys = issueKeysArray.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batchKeys.length} issues)...`);
      
      let batchDiscoveryCycles = 0;
      
      for (const issueKey of batchKeys) {
        try {
          // Check if already cached
          const existingCache = await dbService.getCycleTimeCacheByIssue(issueKey);
          if (existingCache) {
            console.log(`Skipping ${issueKey} - already cached`);
            skippedCached++;
            continue;
          }
          
          // Find the issue in our data
          const issue = allIssues.find(i => i.key === issueKey);
          if (!issue) {
            console.log(`Issue ${issueKey} not found in Jira data`);
            notFound++;
            continue;
          }
          
          const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issueKey);
          
          // Cache the result
          const completionDate = cycleInfo.discoveryEndDate;
          const quarter = completionDate ? dataProcessor.getQuarterFromDate(completionDate) : null;
          
          await dbService.insertCycleTimeCache(issueKey, {
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
            console.log(`Found completed cycle: ${issueKey} (${quarter}) - ${cycleInfo.calendarDaysInDiscovery} days`);
          }
          
          totalProcessed++;
          
        } catch (error) {
          console.error(`Error processing ${issueKey}:`, error);
          // Continue with next project
        }
      }
      
      console.log(`Batch ${batchIndex + 1} complete: ${batchDiscoveryCycles} discovery cycles found`);
      
      // Small delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Custom cache population finished!`);
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Skipped (already cached): ${skippedCached}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Total discovery cycles found: ${totalDiscoveryCycles}`);
    
    return NextResponse.json({
      success: true,
      message: 'Custom cache population finished',
      data: {
        totalProcessed,
        skippedCached,
        notFound,
        totalDiscoveryCycles,
        totalBatches,
        requestedIssues: issueKeysToProcess.size
      }
    });
    
  } catch (error) {
    console.error('Error in custom cache population:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate custom cache',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
