import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

/**
 * Debug endpoint to see what snapshot date workload-weekly is using
 */
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get current date and determine start of current week (Sunday)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    // Get ALL capacity data
    const allCapacityData = await dbService.getCapacityData();
    
    // Find snapshot for current week
    const currentWeekSnapshot = allCapacityData.find(d => {
      const snapshotDate = new Date(d.date);
      snapshotDate.setHours(0, 0, 0, 0);
      return snapshotDate.getTime() === weekStart.getTime();
    });
    
    // Get most recent snapshot
    const mostRecentSnapshot = allCapacityData.length > 0 
      ? allCapacityData[allCapacityData.length - 1] 
      : null;
    
    return NextResponse.json({
      success: true,
      currentWeek: {
        weekStart: weekStart.toISOString().split('T')[0],
        dayOfWeek: weekStart.getDay(), // 0 = Sunday
        hasSnapshot: !!currentWeekSnapshot,
        snapshotDate: currentWeekSnapshot?.date.toISOString().split('T')[0] || null
      },
      mostRecentSnapshot: mostRecentSnapshot ? {
        date: mostRecentSnapshot.date.toISOString().split('T')[0],
        adam: mostRecentSnapshot.adam,
        jennie: mostRecentSnapshot.jennie,
        jacqueline: mostRecentSnapshot.jacqueline,
        robert: mostRecentSnapshot.robert,
        garima: mostRecentSnapshot.garima,
        lizzy: mostRecentSnapshot.lizzy,
        sanela: mostRecentSnapshot.sanela,
        notes: mostRecentSnapshot.notes
      } : null,
      allSnapshots: allCapacityData.map(d => ({
        date: d.date.toISOString().split('T')[0],
        total: d.total
      })),
      totalSnapshots: allCapacityData.length
    });
    
  } catch (error) {
    console.error('Error in debug:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run debug',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

