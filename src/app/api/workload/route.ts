import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await initializeDatabase();
    
    // Try to get real data from capacity tracking
    try {
      const capacityData = await getDatabaseService().getCapacityData();
      // Look for 9/8/2025 data specifically, or fall back to latest
      const targetData = capacityData.find(d => d.date.toISOString().startsWith('2025-09-08')) || capacityData[capacityData.length - 1];
      
      if (targetData) {
        const dataProcessor = getDataProcessor();
        
        // Get real health breakdown data for each team member
        const teamMembers = [
          'Adam Sigel',
          'Jennie Goldenberg', 
          'Jacqueline Gallagher',
          'Robert J. Johnson',
          'Garima Giri',
          'Lizzy Magill',
          'Sanela Smaka'
        ];
        
        const workloadData = await Promise.all(teamMembers.map(async (member) => {
          const healthBreakdown = await dataProcessor.getHealthBreakdownForTeamMember(member);
          const activeProjectCount = healthBreakdown.onTrack + healthBreakdown.atRisk + 
                                   healthBreakdown.offTrack + healthBreakdown.onHold + 
                                   healthBreakdown.mystery + healthBreakdown.complete + 
                                   healthBreakdown.unknown;
          
          return {
            teamMember: member,
            activeProjectCount,
            isOverloaded: activeProjectCount >= 6,
            healthBreakdown
          };
        }));
        
        return NextResponse.json({ 
          success: true, 
          data: workloadData 
        });
      }
    } catch (error) {
      console.log('No capacity data available, using mock data');
    }
    
    // Fallback to mock data
    const mockWorkloadData = [
      {
        teamMember: 'Adam Sigel',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Jennie Goldenberg',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Jacqueline Gallagher',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Robert Johnson',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Garima Giri',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Lizzy Magill',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      },
      {
        teamMember: 'Sanela Smaka',
        activeProjectCount: 0,
        isOverloaded: false,
        healthBreakdown: {
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          onHold: 0,
          mystery: 0,
          complete: 0
        }
      }
    ];
    
    return NextResponse.json({ 
      success: true, 
      data: mockWorkloadData 
    });
  } catch (error) {
    console.error('Error fetching workload data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
