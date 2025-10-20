import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    
    // Get the last 5 capacity data entries
    const capacityData = await dbService.getCapacityData();
    const last5 = capacityData.slice(-5);
    
    return NextResponse.json({
      success: true,
      data: {
        totalEntries: capacityData.length,
        last5Entries: last5.map(entry => ({
          date: entry.date.toISOString().split('T')[0],
          adam: entry.adam,
          jennie: entry.jennie,
          jacqueline: entry.jacqueline,
          robert: entry.robert,
          garima: entry.garima,
          lizzy: entry.lizzy,
          sanela: entry.sanela,
          total: entry.total,
          notes: entry.notes
        }))
      }
    });
    
  } catch (error) {
    console.error('Error getting capacity data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get capacity data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
