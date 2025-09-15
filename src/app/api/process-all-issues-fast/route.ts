import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';
import { DataProcessor } from '@/lib/data-processor';

export async function POST(request: Request) {
  try {
    const { waitTime = 15, batchSize = 5, startFromIssue = 1 } = await request.json();
    
    // Validate parameters
    const validatedWaitTime = Math.max(5, Math.min(60, waitTime));
    const validatedBatchSize = Math.max(1, Math.min(20, batchSize));
    const validatedStartFromIssue = Math.max(1, Math.min(522, startFromIssue));
    
    console.log(`Starting fast processing with wait time: ${validatedWaitTime}s, batch size: ${validatedBatchSize}, start from: ${validatedStartFromIssue}`);
    
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = new DataProcessor();
    
    // Get all issues from Jira
    const allIssues = await getAllIssuesForCycleAnalysis();
    console.log(`Fetched ${allIssues.length} issues from Jira`);
    
    // Start from the specified issue index
    const issuesToProcess = allIssues.slice(validatedStartFromIssue - 1);
    console.log(`Processing ${issuesToProcess.length} issues starting from issue ${validatedStartFromIssue}`);
    
    let processed = 0;
    let cached = 0;
    let errors = 0;
    
    // Process issues in batches
    for (let i = 0; i < issuesToProcess.length; i += validatedBatchSize) {
      const batch = issuesToProcess.slice(i, i + validatedBatchSize);
      const batchNumber = Math.ceil((i + 1) / validatedBatchSize);
      const totalBatches = Math.ceil(issuesToProcess.length / validatedBatchSize);
      
      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} issues):`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (issue) => {
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
          
          return { success: true, cached: !!(cycleInfo.discoveryStartDate && cycleInfo.discoveryEndDate) };
        } catch (error) {
          console.error(`Error processing ${issue.key}:`, error);
          return { success: false, cached: false };
        }
      });
      
      const results = await Promise.all(batchPromises);
      
      // Update counters
      results.forEach(result => {
        if (result.success) {
          processed++;
          if (result.cached) {
            cached++;
          }
        } else {
          errors++;
        }
      });
      
      // Progress update
      const progress = Math.round(((i + batch.length) / issuesToProcess.length) * 100);
      console.log(`  📊 Processed: ${processed}, Cached: ${cached}, Errors: ${errors}, Progress: ${progress}%`);
      
      // Wait between batches (except for the last batch)
      if (i + validatedBatchSize < issuesToProcess.length) {
        console.log(`⏳ Waiting ${validatedWaitTime} seconds before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, validatedWaitTime * 1000));
      }
    }
    
    console.log(`\n✅ Fast processing complete!`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successfully cached: ${cached}`);
    console.log(`   Errors: ${errors}`);
    
    return NextResponse.json({
      success: true,
      message: `Fast processing completed: ${processed} processed, ${cached} cached, ${errors} errors`,
      data: {
        processed,
        cached,
        errors,
        waitTime: validatedWaitTime,
        batchSize: validatedBatchSize,
        startFromIssue: validatedStartFromIssue
      }
    });
    
  } catch (error: any) {
    console.error('Error in fast processing:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
