import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';
import { DataProcessor } from '@/lib/data-processor';

export async function POST(request: Request) {
  try {
    const { waitTime = 15, startFromIssue = 1 } = await request.json();
    
    // Validate parameters
    const validatedWaitTime = Math.max(5, Math.min(60, waitTime));
    const validatedStartFromIssue = Math.max(1, Math.min(522, startFromIssue));
    
    console.log(`Starting systematic processing with wait time: ${validatedWaitTime}s, start from: ${validatedStartFromIssue}`);
    
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
    
    // Process each issue with the specified wait time
    for (let i = 0; i < issuesToProcess.length; i++) {
      const issue = issuesToProcess[i];
      const progress = `[${i + 1}/${issuesToProcess.length}]`;
      
      console.log(`${progress} Processing ${issue.key} (${issue.fields.status.name})...`);
      
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
        
        processed++;
        if (cycleInfo.discoveryStartDate && cycleInfo.discoveryEndDate) {
          cached++;
        }
        
        console.log(`${progress} Completed ${issue.key}: ${cycleInfo.endDateLogic}`);
        
      } catch (error) {
        console.error(`${progress} Error processing ${issue.key}:`, error);
        errors++;
      }
      
      // Show progress every 10 issues
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progress Update:`);
        console.log(`   Processed: ${processed}`);
        console.log(`   Cached: ${cached}`);
        console.log(`   Errors: ${errors}`);
        console.log(`   Progress: ${Math.round(((i + 1) / issuesToProcess.length) * 100)}%`);
      }
      
      // Wait before next issue (except for the last one)
      if (i < issuesToProcess.length - 1) {
        console.log(`⏳ Waiting ${validatedWaitTime} seconds before next issue...\n`);
        await new Promise(resolve => setTimeout(resolve, validatedWaitTime * 1000));
      }
    }
    
    console.log(`\n✅ Systematic processing complete!`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successfully cached: ${cached}`);
    console.log(`   Errors: ${errors}`);
    
    return NextResponse.json({
      success: true,
      message: `Systematic processing completed: ${processed} processed, ${cached} cached, ${errors} errors`,
      data: {
        processed,
        cached,
        errors,
        waitTime: validatedWaitTime,
        startFromIssue: validatedStartFromIssue
      }
    });
    
  } catch (error: any) {
    console.error('Error in systematic processing:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
