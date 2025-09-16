import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    // Get hybrid data context
    try {
      const capacityData = await getDatabaseService().getCapacityData();
      const lastHistoricalData = capacityData[capacityData.length - 1];
      const currentDate = new Date();
      
      if (lastHistoricalData) {
        // Calculate if we have real-time data
        const daysSinceLastHistorical = Math.floor(
          (currentDate.getTime() - lastHistoricalData.date.getTime()) / (24 * 60 * 60 * 1000)
        );
        const hasRealTimeData = daysSinceLastHistorical >= 7;
        
        const dataContext = {
          lastUpdated: hasRealTimeData ? currentDate : lastHistoricalData.date,
          dataSource: hasRealTimeData 
            ? 'Hybrid: Historical CSV + Real-time Jira Data' 
            : 'PM Capacity Tracking CSV (Historical Data)',
          historicalDataThrough: lastHistoricalData.date,
          realTimeDataAvailable: hasRealTimeData
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
