import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

/**
 * Diagnostic endpoint to check current state of capacity_data table
 * This helps us understand what data exists before implementing the solution
 */
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get all capacity data
    const allCapacityData = await dbService.getCapacityData();
    
    // Calculate current week start
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    // Check for current week snapshot
    const currentWeekSnapshot = allCapacityData.find(d => {
      const snapshotDate = new Date(d.date);
      snapshotDate.setHours(0, 0, 0, 0);
      return snapshotDate.getTime() === weekStart.getTime();
    });
    
    return NextResponse.json({
      success: true,
      diagnostic: {
        totalSnapshots: allCapacityData.length,
        currentWeekStart: weekStart.toISOString().split('T')[0],
        hasCurrentWeekSnapshot: !!currentWeekSnapshot,
        currentWeekSnapshot: currentWeekSnapshot ? {
          date: currentWeekSnapshot.date.toISOString().split('T')[0],
          adam: currentWeekSnapshot.adam,
          jennie: currentWeekSnapshot.jennie,
          jacqueline: currentWeekSnapshot.jacqueline,
          robert: currentWeekSnapshot.robert,
          garima: currentWeekSnapshot.garima,
          lizzy: currentWeekSnapshot.lizzy,
          sanela: currentWeekSnapshot.sanela,
          total: currentWeekSnapshot.total,
          notes: currentWeekSnapshot.notes
        } : null,
        mostRecentSnapshot: allCapacityData.length > 0 ? {
          date: allCapacityData[allCapacityData.length - 1].date.toISOString().split('T')[0],
          adam: allCapacityData[allCapacityData.length - 1].adam,
          jennie: allCapacityData[allCapacityData.length - 1].jennie,
          jacqueline: allCapacityData[allCapacityData.length - 1].jacqueline,
          robert: allCapacityData[allCapacityData.length - 1].robert,
          garima: allCapacityData[allCapacityData.length - 1].garima,
          lizzy: allCapacityData[allCapacityData.length - 1].lizzy,
          sanela: allCapacityData[allCapacityData.length - 1].sanela,
          total: allCapacityData[allCapacityData.length - 1].total,
          notes: allCapacityData[allCapacityData.length - 1].notes
        } : null,
        allSnapshots: allCapacityData.map(d => ({
          date: d.date.toISOString().split('T')[0],
          total: d.total,
          notes: d.notes
        }))
      }
    });
    
  } catch (error) {
    console.error('Error in diagnostic:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run diagnostic',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

