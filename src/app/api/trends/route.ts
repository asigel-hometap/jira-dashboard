import { NextRequest } from 'next/server';
import { initializeDatabase } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { handleApiError, createSuccessResponse } from '@/lib/error-handler';

// Team member names (same as Team Workload page)
const TEAM_MEMBERS = [
  'Adam Sigel',
  'Jennie Goldenberg',
  'Jacqueline Gallagher',
  'Robert J. Johnson',
  'Garima Giri',
  'Lizzy Magill',
  'Sanela Smaka'
];

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dataProcessor = getDataProcessor();
    
    // Extract filter parameters
    const { searchParams } = new URL(request.url);
    const assignees = searchParams.getAll('assignee');
    
    // Default to team members if no filter specified
    const targetAssignees = assignees.length > 0 ? assignees : TEAM_MEMBERS;
    
    // Get trend data using snapshot data (same as sparkline) with health breakdown reconstruction
    const trendData = await dataProcessor.getTrendDataFromSnapshots({
      assignees: targetAssignees,
      teamMembersOnly: assignees.length === 0 // Only filter to team members if no explicit filter
    });
    
    // Get available filter options (only team members for now)
    const availableFilters = {
      assignees: TEAM_MEMBERS
    };
    
    return createSuccessResponse({
      trendData,
      availableFilters
    });
  } catch (error) {
    return handleApiError(error);
  }
}
