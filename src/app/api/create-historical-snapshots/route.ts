import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

/**
 * Create snapshots for historical weeks
 * 
 * This endpoint can create snapshots for:
 * - A specific date
 * - A range of dates
 * - All missing weeks since a start date
 * 
 * Note: Historical reconstruction is slow, so this may take time
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();
    
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, specificDates } = body;
    
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
    
    // Determine which dates to process
    let datesToProcess: Date[] = [];
    
    if (specificDates && Array.isArray(specificDates)) {
      // Specific dates provided
      datesToProcess = specificDates.map((d: string) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
      });
    } else if (startDate && endDate) {
      // Range provided - generate all Sundays (week starts) in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      // Find first Sunday on or before start
      const firstSunday = new Date(start);
      firstSunday.setDate(start.getDate() - start.getDay());
      
      const current = new Date(firstSunday);
      while (current <= end) {
        datesToProcess.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
    } else {
      // Default: find missing weeks since September 15, 2025
      const existingSnapshots = await dbService.getCapacityData();
      const existingDates = new Set(existingSnapshots.map(s => s.date.toISOString().split('T')[0]));
      
      const start = new Date('2025-09-15');
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      
      // Find first Sunday on or after start
      const firstSunday = new Date(start);
      firstSunday.setDate(start.getDate() - start.getDay());
      
      const current = new Date(firstSunday);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (!existingDates.has(dateStr)) {
          datesToProcess.push(new Date(current));
        }
        current.setDate(current.getDate() + 7);
      }
    }
    
    console.log(`[create-historical-snapshots] Processing ${datesToProcess.length} dates`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each date
    for (const targetDate of datesToProcess) {
      const dateStr = targetDate.toISOString().split('T')[0];
      console.log(`[create-historical-snapshots] Processing ${dateStr}...`);
      
      try {
        const startTime = Date.now();
        
        // Get all issues (we need this to check assignees at historical dates)
        const jiraIssues = await getAllIssuesForCycleAnalysis();
        
        // Filter for active projects (same logic as current snapshot)
        const activeProjects = jiraIssues.filter(issue => {
          const status = issue.fields.status.name;
          const isArchived = issue.fields.customfield_10454;
          const archivedOn = issue.fields.customfield_10456;
          
          if (isArchived || archivedOn) {
            return false;
          }
          
          const isActiveStatus = status === '02 Generative Discovery' ||
                                status === '04 Problem Discovery' ||
                                status === '05 Solution Discovery' ||
                                status === '06 Build' ||
                                status === '07 Beta';
          
          return isActiveStatus;
        });
        
        // Calculate counts for each team member at this historical date
        const teamMemberCounts: Record<string, number> = {
          adam: 0,
          jennie: 0,
          jacqueline: 0,
          robert: 0,
          garima: 0,
          lizzy: 0,
          sanela: 0
        };
        
        for (const [fullName, shortName] of Object.entries(teamMemberMap)) {
          let count = 0;
          
          // For each project, check if it was assigned to this member at the target date
          for (const issue of activeProjects) {
            try {
              // Check if assigned to this member at target date
              const wasAssigned = await dataProcessor.wasIssueAssignedToMemberAtDate(
                issue.key, 
                fullName, 
                targetDate,
                issue
              );
              
              if (!wasAssigned) {
                continue;
              }
              
              // Check if project was in active status at target date
              const projectState = await dataProcessor.getProjectStateAtDate(issue, targetDate);
              
              if (projectState) {
                const isActive = projectState.status === '02 Generative Discovery' ||
                                projectState.status === '04 Problem Discovery' ||
                                projectState.status === '05 Solution Discovery' ||
                                projectState.status === '06 Build' ||
                                projectState.status === '07 Beta';
                
                if (isActive) {
                  count++;
                }
              }
            } catch (error) {
              console.warn(`Error processing ${issue.key} for ${fullName} at ${dateStr}:`, error);
            }
          }
          
          teamMemberCounts[shortName] = count;
        }
        
        // Create capacity data entry
        const capacityData = {
          date: targetDate,
          adam: teamMemberCounts.adam,
          jennie: teamMemberCounts.jennie,
          jacqueline: teamMemberCounts.jacqueline,
          robert: teamMemberCounts.robert,
          garima: teamMemberCounts.garima,
          lizzy: teamMemberCounts.lizzy,
          sanela: teamMemberCounts.sanela,
          total: Object.values(teamMemberCounts).reduce((sum, count) => sum + count, 0),
          notes: `Historical snapshot created ${new Date().toISOString()} - Reconstructed from changelog data`
        };
        
        // Store the snapshot
        await dbService.insertCapacityData(capacityData);
        
        const duration = Date.now() - startTime;
        successCount++;
        
        results.push({
          date: dateStr,
          success: true,
          duration: `${duration}ms`,
          counts: teamMemberCounts
        });
        
        console.log(`[create-historical-snapshots] ✓ ${dateStr} completed in ${duration}ms`);
        
      } catch (error) {
        errorCount++;
        console.error(`[create-historical-snapshots] ✗ Error processing ${dateStr}:`, error);
        results.push({
          date: dateStr,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${datesToProcess.length} dates: ${successCount} successful, ${errorCount} errors`,
      results,
      summary: {
        total: datesToProcess.length,
        successful: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('Error creating historical snapshots:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create historical snapshots',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

