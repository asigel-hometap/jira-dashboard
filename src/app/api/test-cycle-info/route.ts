import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const dataProcessor = getDataProcessor();
    
    // Test with HT-475 which is in "06 Build" status
    const issueKey = 'HT-475';
    console.log(`Testing cycle info for ${issueKey}...`);
    
    const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issueKey);
    
    return NextResponse.json({
      success: true,
      data: {
        issueKey,
        cycleInfo,
        quarter: cycleInfo.discoveryEndDate ? dataProcessor.getQuarterFromDate(cycleInfo.discoveryEndDate) : null
      }
    });
  } catch (error) {
    console.error('Error testing cycle info:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test cycle info'
      },
      { status: 500 }
    );
  }
}
