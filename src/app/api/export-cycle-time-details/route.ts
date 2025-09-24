import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
import { initPostgresDatabase } from '@/lib/postgres-database';

export async function GET(request: NextRequest) {
  try {
    // Initialize database connection without creating tables (they should already exist)
    initPostgresDatabase();
    const dbService = getDatabaseService();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const complexity = searchParams.get('complexity');
    const timeType = searchParams.get('timeType') || 'calendar';

    // Get all cycle time cache entries
    const cycleTimeCache = await dbService.getCycleTimeCache();
    
    // We'll fetch issues individually as needed
    
    // Get excluded issues
    const excludedIssues = await dbService.getExcludedIssues();
    
    // Filter for completed discovery cycles and build export data
    const exportData = [];
    
    for (const cached of cycleTimeCache) {
      // Skip excluded issues
      if (excludedIssues.includes(cached.issueKey)) {
        continue;
      }
      
      // Only include projects with completed discovery cycles
      if (cached.discoveryStartDate && 
          cached.discoveryEndDate && 
          cached.endDateLogic !== 'Still in Discovery' &&
          cached.endDateLogic !== 'No Discovery' &&
          cached.endDateLogic !== 'Direct to Build') {
        
        // Get the issue details
        let issue = null;
        try {
          issue = await dbService.getIssueByKey(cached.issueKey);
        } catch (error) {
          // Issue not in database, skip
          continue;
        }
        
        if (!issue) continue;
        
        // Only include projects with valid cycle time data
        const calendarDays = cached.calendarDaysInDiscovery || 0;
        const activeDays = cached.activeDaysInDiscovery || 0;
        
        if (calendarDays > 0 && activeDays > 0 && activeDays <= calendarDays) {
          // Determine completion quarter
          const completionDate = cached.discoveryEndDate ? new Date(cached.discoveryEndDate) : null;
          const completionQuarter = completionDate 
            ? `Q${Math.ceil((completionDate.getMonth() + 1) / 3)} ${completionDate.getFullYear()}`
            : 'N/A';
          
          // Apply filters
          let includeProject = true;
          
          // Filter by quarter if specified
          if (quarter && completionQuarter !== quarter) {
            includeProject = false;
          }
          
          // Filter by complexity if specified
          if (complexity && issue.discoveryComplexity !== complexity) {
            includeProject = false;
          }
          
          if (includeProject) {
            // Format dates for CSV
            const discoveryStartDate = cached.discoveryStartDate 
              ? new Date(cached.discoveryStartDate).toLocaleDateString('en-US')
              : 'N/A';
            const discoveryEndDate = cached.discoveryEndDate 
              ? new Date(cached.discoveryEndDate).toLocaleDateString('en-US')
              : 'N/A';
            
            exportData.push({
              'Project Key': cached.issueKey,
              'Project Name': issue.summary || 'N/A',
              'Assignee': issue.assignee || 'Unassigned',
              'Current Status': issue.status || 'N/A',
              'Discovery Complexity': issue.discoveryComplexity || 'Not Set',
              'Discovery Start Date': discoveryStartDate,
              'Discovery End Date': discoveryEndDate,
              'Completion Quarter': completionQuarter,
              'End Date Logic': cached.endDateLogic || 'N/A',
              'Calendar Days in Discovery': calendarDays,
              'Active Days in Discovery': activeDays,
              'Jira URL': `https://hometap.atlassian.net/browse/${cached.issueKey}`
            });
          }
        }
      }
    }
    
    // Sort by discovery start date (most recent first)
    exportData.sort((a, b) => {
      const dateA = new Date(a['Discovery Start Date'] === 'N/A' ? '1900-01-01' : a['Discovery Start Date']);
      const dateB = new Date(b['Discovery Start Date'] === 'N/A' ? '1900-01-01' : b['Discovery Start Date']);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Convert to CSV
    if (exportData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data available for export' },
        { status: 404 }
      );
    }
    
    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape CSV values that contain commas, quotes, or newlines
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="discovery-cycle-times-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    
  } catch (error) {
    console.error('Error exporting cycle time details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export cycle time details' },
      { status: 500 }
    );
  }
}
