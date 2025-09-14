import { NextRequest, NextResponse } from 'next/server';
import { getDataProcessor } from '@/lib/data-processor';
import { getDatabaseService, initializeDatabase } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting cycle time cache population...');
    
    // This will populate the cache by processing a few projects
    const cycleTimeData = await dataProcessor.calculateCompletedDiscoveryCycles('calendar');
    
    console.log('Cycle time cache populated successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Cycle time cache populated successfully',
      data: cycleTimeData
    });
  } catch (error) {
    console.error('Error populating cycle time cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate cycle time cache'
      },
      { status: 500 }
    );
  }
}
