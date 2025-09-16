import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dataProcessor = getDataProcessor();
    
    // Extract filter parameters
    const { searchParams } = new URL(request.url);
    const assignees = searchParams.getAll('assignee');
    const bizChamp = searchParams.get('bizChamp') || '';
    
    // Get trend data for the past 12 weeks with filters
    const trendData = await dataProcessor.getTrendData({
      assignees,
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
