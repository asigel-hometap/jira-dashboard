import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database-factory';
import { getDataProcessor } from '@/lib/data-processor';
import { getAllIssuesForCycleAnalysis } from '@/lib/jira-api';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();
    const dataProcessor = getDataProcessor();

    // Get all active issues from database
    const activeIssues = await dbService.getActiveIssues();
    console.log(`Fetched ${activeIssues.length} active issues from database`);

    // Filter for discovery, build, and beta projects
    const discoveryProjects = activeIssues.filter(issue =>
      issue.status === '02 Generative Discovery' ||
      issue.status === '04 Problem Discovery' ||
      issue.status === '05 Solution Discovery' ||
      issue.status === '06 Build' ||
      issue.status === '07 Beta'
    );
    console.log(`Filtered to ${discoveryProjects.length} discovery projects`);

    // Calculate discovery cycle info for each project
    const discoveryCycleDetails = await Promise.all(
      discoveryProjects.map(async (issue) => {
        const cycleInfo = await dataProcessor.calculateDiscoveryCycleInfo(issue.key);

        return {
          key: issue.key,
          name: issue.summary,
          assignee: issue.assignee,
          currentStatus: issue.status,
          discoveryStartDate: cycleInfo.discoveryStartDate?.toISOString() || null,
          discoveryEndDate: cycleInfo.discoveryEndDate?.toISOString() || null,
          endDateLogic: cycleInfo.endDateLogic,
          calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
          activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
          jiraUrl: `https://hometap.atlassian.net/browse/${issue.key}`
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: discoveryCycleDetails
    });

  } catch (error) {
    console.error('Error fetching discovery cycle details:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch discovery cycle details'
    }, { status: 500 });
  }
}
