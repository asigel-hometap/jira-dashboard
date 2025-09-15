import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getIssueChangelog } from '@/lib/jira-api';

export async function GET() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    console.log('=== Debugging HT-156 Active Discovery Time ===');

    // Get the issue from database
    const issue = await dbService.getIssueByKey('HT-156');
    console.log('Issue from database:', {
      key: issue?.key,
      summary: issue?.summary,
      status: issue?.status,
      health: issue?.health,
      created: issue?.created,
      updated: issue?.updated
    });

    // Get changelog data
    const changelog = await getIssueChangelog('HT-156');
    console.log('Changelog entries:', changelog.values?.length || 0);

    // Find the specific transitions mentioned
    const histories = changelog.values || changelog.histories || [];
    const statusChanges = histories
      .filter((history: any) => 
        history.items.some((item: any) => item.field === 'status')
      )
      .map((history: any) => {
        const statusItem = history.items.find((item: any) => item.field === 'status');
        return {
          date: new Date(history.created),
          from: statusItem?.fromString || null,
          to: statusItem?.toString || null
        };
      })
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    console.log('Status changes:');
    statusChanges.forEach((change, index) => {
      console.log(`${index + 1}. ${change.date.toISOString().split('T')[0]}: ${change.from} -> ${change.to}`);
    });

    // Find the specific transitions mentioned
    const april30Transition = statusChanges.find(change => 
      change.date.toISOString().split('T')[0] === '2025-04-30' &&
      change.from === '03 Committed' &&
      change.to === '04 Problem Discovery'
    );

    const july1Transition = statusChanges.find(change => 
      change.date.toISOString().split('T')[0] === '2025-07-01' &&
      change.from === '05 Solution Discovery' &&
      change.to === '06 Build'
    );

    console.log('April 30 transition found:', !!april30Transition);
    console.log('July 1 transition found:', !!july1Transition);

    if (april30Transition && july1Transition) {
      const discoveryStart = april30Transition.date;
      const discoveryEnd = july1Transition.date;
      const calendarDays = Math.ceil((discoveryEnd.getTime() - discoveryStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`Calendar days between transitions: ${calendarDays}`);
    }

    // Get cached cycle time data
    const cachedData = await dbService.getCycleTimeCacheByIssue('HT-156');
    console.log('Cached cycle time data:', cachedData);

    return NextResponse.json({
      success: true,
      data: {
        issue,
        statusChanges: statusChanges.slice(0, 10), // First 10 changes
        april30Transition: april30Transition,
        july1Transition: july1Transition,
        cachedData
      }
    });

  } catch (error: any) {
    console.error('Error debugging HT-156:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
