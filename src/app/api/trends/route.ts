import { NextRequest } from 'next/server';
import { initializeDatabase } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { handleApiError, createSuccessResponse } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dataProcessor = getDataProcessor();
    
    // Extract filter parameters
    const { searchParams } = new URL(request.url);
    const assignees = searchParams.getAll('assignee');
    
    // Get trend data for the past 12 weeks with filters
    const trendData = await dataProcessor.getTrendData({
      assignees
    });
    
    // Get available filter options
    const availableFilters = await dataProcessor.getAvailableFilters();
    
    return createSuccessResponse({
      trendData,
      availableFilters
    });
  } catch (error) {
    return handleApiError(error);
  }
}
