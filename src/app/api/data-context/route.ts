import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    // Try to get real data context
    try {
      const capacityData = await getDatabaseService().getCapacityData();
      const latestData = capacityData[capacityData.length - 1];
      
      if (latestData) {
        const dataContext = {
          lastUpdated: latestData.date,
          dataSource: 'PM Capacity Tracking CSV (Historical Data)'
        };
        
        return NextResponse.json({ 
          success: true, 
          data: dataContext 
        });
      }
    } catch (error) {
      console.log('No capacity data available, using fallback');
    }
    
    // Fallback
    const fallbackDataContext = {
      lastUpdated: new Date(),
      dataSource: 'No Data Available'
    };
    
    return NextResponse.json({ 
      success: true, 
      data: fallbackDataContext 
    });
  } catch (error) {
    console.error('Error fetching data context:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
