import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    console.log('Starting weekly historical sync...');
    const startTime = Date.now();
    
    // Get the last historical data point from CSV
    const capacityData = await dbService.getCapacityData();
    const lastHistoricalDate = capacityData.length > 0 
      ? capacityData[capacityData.length - 1].date 
      : new Date('2025-02-10');
    
    console.log(`Last historical data point: ${lastHistoricalDate.toISOString().split('T')[0]}`);
    
    // Calculate weeks since last historical data
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate.getTime() - lastHistoricalDate.getTime()) / (24 * 60 * 60 * 1000));
    const weeksNeeded = Math.max(0, Math.floor(daysDiff / 7));
    
    console.log(`Weeks of real-time data needed: ${weeksNeeded}`);
    
    // Team member mapping
    const teamMemberMap = {
      'Adam Sigel': 'adam',
      'Jennie Goldenberg': 'jennie', 
      'Jacqueline Gallagher': 'jacqueline',
      'Robert J. Johnson': 'robert',
      'Garima Giri': 'garima',
      'Lizzy Magill': 'lizzy',
      'Sanela Smaka': 'sanela'
    };
    
    let weeksProcessed = 0;
    let errors = 0;
    
    // Process each week with historical accuracy
    for (let weekOffset = 1; weekOffset <= weeksNeeded; weekOffset++) {
      const targetDate = new Date(lastHistoricalDate);
      targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
      
      // Only process completed weeks
      if (targetDate <= currentDate) {
        console.log(`Processing week of ${targetDate.toISOString().split('T')[0]}`);
        
        try {
          const weekData: any = {
            date: targetDate,
            adam: 0,
            jennie: 0,
            jacqueline: 0,
            robert: 0,
            garima: 0,
            lizzy: 0,
            sanela: 0,
            adam_active: 0,
            jennie_active: 0,
            jacqueline_active: 0,
            robert_active: 0,
            garima_active: 0,
            lizzy_active: 0,
            sanela_active: 0,
            total: 0,
            notes: 'Historical sync data',
            dataSource: 'historical_sync'
          };
          
          // Calculate workload for each team member AT THE SPECIFIC DATE
          for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
            try {
              const healthBreakdown = await dataProcessor.getActiveHealthBreakdownForTeamMemberAtDate(fullName, targetDate);
              const totalProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                       healthBreakdown.offTrack + healthBreakdown.onHold + 
                                       healthBreakdown.mystery + healthBreakdown.complete + 
                                       healthBreakdown.unknown;
              
              const activeProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                       healthBreakdown.offTrack + healthBreakdown.onHold + 
                                       healthBreakdown.mystery + healthBreakdown.unknown;
              
              weekData[shortName] = totalProjectCount;
              weekData[`${shortName}_active`] = activeProjectCount;
              weekData.total += totalProjectCount;
            } catch (error) {
              console.warn(`Error calculating workload for ${fullName} at ${targetDate.toISOString()}:`, error);
              errors++;
            }
          }
          
          // Insert or update the week data
          await dbService.insertCapacityData(weekData);
          weeksProcessed++;
          
        } catch (error) {
          console.error(`Error processing week ${targetDate.toISOString()}:`, error);
          errors++;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`Weekly historical sync completed in ${duration}ms: ${weeksProcessed} weeks processed, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Weekly historical sync completed: ${weeksProcessed} weeks processed, ${errors} errors`,
      data: {
        weeksProcessed: weeksProcessed,
        errors: errors,
        duration: duration,
        lastHistoricalDate: lastHistoricalDate.toISOString().split('T')[0]
      }
    });
    
  } catch (error) {
    console.error('Error in weekly historical sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
