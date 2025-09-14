import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { initDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const dataProcessor = getDataProcessor();
    
    const { searchParams } = new URL(request.url);
    const timeType = searchParams.get('timeType') || 'calendar';
    
    const cycleTimeData = await dataProcessor.calculateCompletedDiscoveryCycles(timeType as 'calendar' | 'active');
    
    return NextResponse.json({
      success: true,
      data: cycleTimeData
    });
  } catch (error) {
    console.error('Error fetching cycle time analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cycle time analysis data'
      },
      { status: 500 }
    );
  }
}
