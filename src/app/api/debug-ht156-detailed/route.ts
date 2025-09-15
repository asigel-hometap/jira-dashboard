import { NextResponse } from 'next/server';
import { initializeDatabase, getDatabaseService } from '@/lib/database-factory';
import { getIssueChangelog } from '@/lib/jira-api';

export async function GET() {
  try {
    await initializeDatabase();
    const dbService = getDatabaseService();

    console.log('=== Detailed Debug of HT-156 Active Discovery Calculation ===');

    // Get changelog data
    const changelog = await getIssueChangelog('HT-156');
    const histories = changelog.values || changelog.histories || [];
    
    console.log(`Total changelog entries: ${histories.length}`);

    // Find discovery start and end
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

    // Find discovery start (first transition to discovery status)
    const discoveryStart = statusChanges.find(change => 
      change.to && (
        change.to.includes('02 Generative Discovery') ||
        change.to.includes('04 Problem Discovery') ||
        change.to.includes('05 Solution Discovery')
      )
    );

    // Find discovery end (transition from discovery status to build)
    const discoveryEnd = statusChanges.find(change => 
      change.from && (
        change.from.includes('02 Generative Discovery') ||
        change.from.includes('04 Problem Discovery') ||
        change.from.includes('05 Solution Discovery')
      ) && change.to && change.to.includes('06 Build')
    );

    console.log('Discovery start:', discoveryStart);
    console.log('Discovery end:', discoveryEnd);

    if (!discoveryStart || !discoveryEnd) {
      return NextResponse.json({ success: false, error: 'Could not find discovery start or end' });
    }

    // Now let's manually calculate active discovery days
    const discoveryStartDate = discoveryStart.date;
    const discoveryEndDate = discoveryEnd.date;
    
    console.log(`Discovery period: ${discoveryStartDate.toISOString()} to ${discoveryEndDate.toISOString()}`);
    
    // Get all transitions during discovery period
    const discoveryTransitions = histories
      .filter((history: any) => {
        const transitionDate = new Date(history.created);
        return transitionDate >= discoveryStartDate && transitionDate <= discoveryEndDate;
      })
      .sort((a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime());

    console.log(`Transitions during discovery period: ${discoveryTransitions.length}`);

    // Track status and health changes
    let currentStatus = discoveryStart.to;
    let currentHealth = 'Unknown';
    let lastTransitionDate = discoveryStartDate;
    let totalInactiveDays = 0;
    let isCurrentlyActive = true;

    console.log('\n=== Processing Transitions ===');
    
    for (const history of discoveryTransitions) {
      const transitionDate = new Date(history.created);
      console.log(`\nTransition at ${transitionDate.toISOString()}:`);
      
      if (history.items) {
        for (const item of history.items) {
          if (item.field === 'status' && item.toString) {
            console.log(`  Status: ${currentStatus} -> ${item.toString}`);
            currentStatus = item.toString;
          }
          if ((item.field === 'Health' || item.field === 'customfield_10238') && item.toString) {
            console.log(`  Health: ${currentHealth} -> ${item.toString}`);
            currentHealth = item.toString;
          }
        }
      }

      // Check if project became inactive
      const inactiveStatuses = ['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'];
      const onHoldHealth = 'On Hold';
      
      const isInactiveStatus = inactiveStatuses.includes(currentStatus);
      const isOnHoldHealth = currentHealth === onHoldHealth;
      const isNowInactive = isInactiveStatus || isOnHoldHealth;
      
      console.log(`  Status inactive: ${isInactiveStatus}, Health on hold: ${isOnHoldHealth}, Now inactive: ${isNowInactive}`);
      
      if (isCurrentlyActive && isNowInactive) {
        // Project became inactive
        const activeDays = Math.ceil((transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  -> Became inactive: counting ${activeDays} active days`);
        isCurrentlyActive = false;
        lastTransitionDate = transitionDate;
      } else if (!isCurrentlyActive && !isNowInactive) {
        // Project became active
        const inactiveDays = Math.ceil((transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += Math.max(0, inactiveDays);
        console.log(`  -> Became active: counting ${inactiveDays} inactive days (total: ${totalInactiveDays})`);
        isCurrentlyActive = true;
        lastTransitionDate = transitionDate;
      } else if (!isCurrentlyActive && isNowInactive) {
        // Project was inactive and is still inactive
        const inactiveDays = Math.ceil((transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += Math.max(0, inactiveDays);
        console.log(`  -> Still inactive: counting ${inactiveDays} inactive days (total: ${totalInactiveDays})`);
        lastTransitionDate = transitionDate;
      } else {
        // Project was active and is still active
        console.log(`  -> Still active`);
        lastTransitionDate = transitionDate;
      }
    }

    // Add final period
    const finalPeriodDays = Math.ceil((discoveryEndDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24));
    const isCurrentlyInactive = ['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'].includes(currentStatus) || currentHealth === 'On Hold';
    
    if (isCurrentlyInactive) {
      totalInactiveDays += Math.max(0, finalPeriodDays);
      console.log(`Final inactive period: ${finalPeriodDays} days`);
    } else {
      console.log(`Final active period: ${finalPeriodDays} days`);
    }

    const totalCalendarDays = Math.ceil((discoveryEndDate.getTime() - discoveryStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const activeDays = Math.max(0, totalCalendarDays - totalInactiveDays);

    console.log(`\n=== Final Calculation ===`);
    console.log(`Total Calendar Days: ${totalCalendarDays}`);
    console.log(`Total Inactive Days: ${totalInactiveDays}`);
    console.log(`Active Days: ${activeDays}`);

    return NextResponse.json({
      success: true,
      data: {
        discoveryStart: discoveryStart,
        discoveryEnd: discoveryEnd,
        totalCalendarDays,
        totalInactiveDays,
        activeDays,
        currentStatus,
        currentHealth,
        isCurrentlyActive
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
