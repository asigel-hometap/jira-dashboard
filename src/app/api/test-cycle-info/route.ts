import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const dataProcessor = getDataProcessor();
    
    // Get issue key from query parameter, default to HT-475
    const { searchParams } = new URL(request.url);
    const issueKey = searchParams.get('issueKey') || 'HT-475';
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
