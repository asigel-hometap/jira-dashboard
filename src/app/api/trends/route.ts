import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, getDbService } from '@/lib/database';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const dataProcessor = getDataProcessor();
    
    // Extract filter parameters
    const { searchParams } = new URL(request.url);
    const assignee = searchParams.get('assignee') || '';
    const team = searchParams.get('team') || '';
    const bizChamp = searchParams.get('bizChamp') || '';
    
    // Get trend data for the past 12 weeks with filters
    const trendData = await dataProcessor.getTrendData({
      assignee,
      team,
      bizChamp
    });
    
    // Get available filter options
    const availableFilters = await dataProcessor.getAvailableFilters();
    
    return NextResponse.json({
      success: true,
      data: trendData,
      availableFilters
    });
  } catch (error) {
    console.error('Error fetching trend data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trend data'
      },
      { status: 500 }
    );
  }
}
