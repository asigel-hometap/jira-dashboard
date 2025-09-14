import { JiraIssue, JiraChangelog, JiraUser, Issue, StatusTransition, HealthTransition, TeamMember, ProjectSnapshot, CapacityData, DISCOVERY_STATUSES, BUILD_STATUSES, DEPLOYED_STATUSES, INACTIVE_STATUSES, STATUSES, HEALTH_VALUES } from '@/types/jira';
import { getDbService, getDatabase } from './database';
import { getAllIssues, getIssueChangelog, getAllUsers, rateLimiter } from './jira-api';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

export class DataProcessor {
  // Process Jira issues and store in database
  async processJiraData(): Promise<void> {
    console.log('Starting Jira data processing...');
    
    try {
      // Clear cycle time cache when processing fresh data
      const dbService = getDbService();
      await dbService.clearCycleTimeCache();
      await dbService.clearProjectDetailsCache();
      console.log('Cleared cycle time cache for fresh data');
      
      // Rate limiting
      await rateLimiter.waitIfNeeded();
      
      // Get all issues
      console.log('Fetching all issues from Jira...');
      const jiraIssues = await getAllIssues();
      console.log(`Found ${jiraIssues.length} issues`);

      // Process and store issues
      for (const jiraIssue of jiraIssues) {
        const issue = this.mapJiraIssueToIssue(jiraIssue);
        await getDbService().insertIssue(issue);
        
        // Process changelog for transitions
        await this.processIssueChangelog(jiraIssue.key);
        
        // Rate limiting
        await rateLimiter.waitIfNeeded();
      }

      // Process team members
      await this.processTeamMembers();

      console.log('Jira data processing completed');
    } catch (error) {
      console.error('Error processing Jira data:', error);
      throw error;
    }
  }

  // Process changelog for a specific issue
  async processIssueChangelog(issueKey: string): Promise<void> {
    try {
      const changelog = await getIssueChangelog(issueKey);
      
      // Handle different changelog structures
      const histories = changelog.histories || [];
      
      for (const history of histories) {
        for (const item of history.items) {
          // Process status transitions
          if (item.field === 'status') {
            const transition: StatusTransition = {
              issueKey,
              fromStatus: item.fromString,
              toStatus: item.toString!,
              fromStatusId: item.from,
              toStatusId: item.to!,
              timestamp: new Date(history.created),
              author: history.author.displayName,
              authorId: history.author.accountId
            };
            await getDbService().insertStatusTransition(transition);
          }
          
          // Process health transitions
          if (item.field === 'customfield_10238') {
            const transition: HealthTransition = {
              issueKey,
              fromHealth: item.fromString,
              toHealth: item.toString!,
              fromHealthId: item.from,
              toHealthId: item.to!,
              timestamp: new Date(history.created),
              author: history.author.displayName,
              authorId: history.author.accountId
            };
            await getDbService().insertHealthTransition(transition);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing changelog for ${issueKey}:`, error);
    }
  }

  // Process team members
  async processTeamMembers(): Promise<void> {
    try {
      console.log('Fetching team members from Jira...');
      const jiraUsers = await getAllUsers();
      
      for (const jiraUser of jiraUsers) {
        const member: TeamMember = {
          id: jiraUser.accountId,
          name: jiraUser.displayName,
          email: jiraUser.emailAddress || null,
          displayName: jiraUser.displayName,
          avatarUrl: jiraUser.avatarUrls['48x48']
        };
        await getDbService().insertTeamMember(member);
      }
      
      console.log(`Processed ${jiraUsers.length} team members`);
    } catch (error) {
      console.error('Error processing team members:', error);
      throw error;
    }
  }

  // Load and process PM Capacity Tracking CSV
  async loadCapacityData(): Promise<void> {
    try {
      console.log('Loading PM Capacity Tracking data...');
      const csvPath = join(process.cwd(), 'PM Capacity Tracking.csv');
      const csvContent = readFileSync(csvPath, 'utf-8');
      
      // Parse CSV manually since the first column has no header
      const lines = csvContent.split('\n').filter(line => line.trim());
      const records = [];
      
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length < 8) continue; // Need at least date + 7 team members
        
        const record = {
          date: columns[0].trim(),
          adam: columns[1].trim(),
          jennie: columns[2].trim(),
          jacqueline: columns[3].trim(),
          robert: columns[4].trim(),
          garima: columns[5].trim(),
          lizzy: columns[6].trim(),
          sanela: columns[7].trim(),
          total: columns[8] ? columns[8].trim() : '',
          notes: columns[9] ? columns[9].trim() : ''
        };
        
        records.push(record);
      }

      console.log('CSV records loaded:', records.length);
      console.log('First few records:', records.slice(0, 3));

      for (const record of records) {
        // Skip empty rows or rows without date
        if (!record.date || record.date === '' || !record.date.trim()) {
          console.log('Skipping row with no date:', record);
          continue;
        }

        // Parse date in M/D/YYYY format
        const dateStr = record.date.trim();
        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) {
          console.warn(`Skipping invalid date format: ${dateStr}`);
          continue;
        }

        // Create date in YYYY-MM-DD format for proper parsing
        const month = dateParts[0].padStart(2, '0');
        const day = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        const isoDateStr = `${year}-${month}-${day}`;
        
        console.log(`Parsing date: ${dateStr} -> ${isoDateStr}`);
        
        const capacity: CapacityData = {
          date: new Date(isoDateStr),
          adam: parseInt(record.adam) || 0,
          jennie: parseInt(record.jennie) || 0,
          jacqueline: parseInt(record.jacqueline) || 0,
          robert: parseInt(record.robert) || 0,
          garima: parseInt(record.garima) || 0,
          lizzy: parseInt(record.lizzy) || 0,
          sanela: parseInt(record.sanela) || 0,
          total: parseInt(record.total) || 0,
          notes: record.notes || null
        };

        // Validate date before inserting
        if (isNaN(capacity.date.getTime())) {
          console.warn(`Skipping invalid date: ${dateStr}`);
          continue;
        }

        await getDbService().insertCapacityData(capacity);
      }

      console.log(`Loaded ${records.length} capacity data records`);
    } catch (error) {
      console.error('Error loading capacity data:', error);
      throw error;
    }
  }

  // Create weekly snapshot
  async createWeeklySnapshot(): Promise<void> {
    try {
      console.log('Creating weekly snapshot...');
      const snapshotDate = new Date();
      const activeIssues = await getDbService().getActiveIssues();

      for (const issue of activeIssues) {
        const snapshot: ProjectSnapshot = {
          id: `${snapshotDate.toISOString().split('T')[0]}-${issue.key}`,
          snapshotDate,
          issueKey: issue.key,
          status: issue.status,
          health: issue.health,
          assignee: issue.assignee,
          isActive: this.isIssueActive(issue)
        };

        await getDbService().insertProjectSnapshot(snapshot);
      }

      console.log(`Created snapshot for ${activeIssues.length} issues`);
    } catch (error) {
      console.error('Error creating weekly snapshot:', error);
      throw error;
    }
  }

  // Helper methods
  private mapJiraIssueToIssue(jiraIssue: JiraIssue): Issue {
    return {
      id: jiraIssue.id,
      key: jiraIssue.key,
      summary: jiraIssue.fields.summary,
      status: jiraIssue.fields.status.name,
      statusId: jiraIssue.fields.status.id,
      assignee: jiraIssue.fields.assignee?.displayName || null,
      assigneeId: jiraIssue.fields.assignee?.accountId || null,
      health: jiraIssue.fields.customfield_10238?.value || null,
      healthId: jiraIssue.fields.customfield_10238?.id || null,
      created: new Date(jiraIssue.fields.created),
      updated: new Date(jiraIssue.fields.updated),
      duedate: jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : null,
      priority: jiraIssue.fields.priority?.name || 'Unknown',
      labels: jiraIssue.fields.labels || [],
      bizChamp: jiraIssue.fields.customfield_10150?.[0]?.displayName || null,
      bizChampId: jiraIssue.fields.customfield_10150?.[0]?.accountId || null,
      isArchived: jiraIssue.fields.customfield_10456 !== null // Archived if customfield_10456 has a value
    };
  }

  private isIssueActive(issue: Issue): boolean {
    return !INACTIVE_STATUSES.includes(issue.status as any) && 
           issue.health !== HEALTH_VALUES.ON_HOLD &&
           !issue.isArchived;
  }

  // Calculate discovery cycle times
  async calculateDiscoveryCycleTimes(issueKey: string): Promise<{
    discoveryStart: Date | null;
    discoveryEnd: Date | null;
    activeDiscoveryCycleTime: number;
    calendarDiscoveryCycleTime: number;
  }> {
    const statusTransitions = await getDbService().getStatusTransitions(issueKey);
    
    // Find first transition to discovery status
    const discoveryStartTransition = statusTransitions.find(t => 
      DISCOVERY_STATUSES.includes(t.toStatus as any)
    );
    
    // Find first transition to build or deployed status after discovery
    const discoveryEndTransition = statusTransitions.find(t => 
      discoveryStartTransition && 
      new Date(t.timestamp) > new Date(discoveryStartTransition.timestamp) &&
      (BUILD_STATUSES.includes(t.toStatus as any) || DEPLOYED_STATUSES.includes(t.toStatus as any))
    );

    const discoveryStart = discoveryStartTransition ? new Date(discoveryStartTransition.timestamp) : null;
    const discoveryEnd = discoveryEndTransition ? new Date(discoveryEndTransition.timestamp) : new Date();

    // Calculate calendar cycle time (total weeks)
    const calendarCycleTime = discoveryStart ? 
      Math.ceil((discoveryEnd.getTime() - discoveryStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;

    // Calculate active cycle time (excluding on-hold weeks)
    let activeCycleTime = 0;
    if (discoveryStart) {
      // TODO: Implement health transitions tracking for on-hold weeks
      // For now, use calendar cycle time as active cycle time
      activeCycleTime = calendarCycleTime;
    }

    return {
      discoveryStart,
      discoveryEnd,
      activeDiscoveryCycleTime: activeCycleTime,
      calendarDiscoveryCycleTime: calendarCycleTime
    };
  }

  // Get projects at risk (2+ consecutive weeks)
  async getProjectsAtRisk(): Promise<any[]> {
    // This would require complex SQL queries to find projects with
    // consecutive weeks of "At Risk" or "Off Track" health
    // Implementation would go here
    return [];
  }


  // Get workload data for team members
  async getWorkloadData(): Promise<any[]> {
    const activeIssues = await getDbService().getActiveIssues();
    
    // Map first names to full names based on the team
    const teamMemberMap = {
      'Adam': 'Adam Sigel',
      'Jennie': 'Jennie Goldenberg', 
      'Jacqueline': 'Jacqueline Gallagher',
      'Robert': 'Robert J. Johnson',
      'Garima': 'Garima Giri',
      'Lizzy': 'Lizzy Magill',
      'Sanela': 'Sanela Smaka'
    };

    const teamMembers = Object.values(teamMemberMap);
    
    return teamMembers.map(fullName => {
      const memberIssues = activeIssues.filter(issue => issue.assignee === fullName);
      
      const healthBreakdown = {
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        onHold: 0,
        mystery: 0,
        complete: 0
      };

      memberIssues.forEach(issue => {
        switch (issue.health) {
          case HEALTH_VALUES.ON_TRACK:
            healthBreakdown.onTrack++;
            break;
          case HEALTH_VALUES.AT_RISK:
            healthBreakdown.atRisk++;
            break;
          case HEALTH_VALUES.OFF_TRACK:
            healthBreakdown.offTrack++;
            break;
          case HEALTH_VALUES.ON_HOLD:
            healthBreakdown.onHold++;
            break;
          case HEALTH_VALUES.MYSTERY:
            healthBreakdown.mystery++;
            break;
          case HEALTH_VALUES.COMPLETE:
            healthBreakdown.complete++;
            break;
        }
      });

      return {
        teamMember: fullName,
        activeProjectCount: memberIssues.length,
        isOverloaded: memberIssues.length >= 6,
        healthBreakdown
      };
    });
  }

  // Get current data date context
  async getDataContext(): Promise<{ lastUpdated: Date; dataSource: string }> {
    // Get the most recent snapshot date
    const snapshots = await getDbService().getProjectSnapshots();
    const lastSnapshot = snapshots.length > 0 ? snapshots[0] : null;
    
    return {
      lastUpdated: lastSnapshot ? lastSnapshot.snapshotDate : new Date(),
      dataSource: 'Jira API + Historical CSV'
    };
  }

  // Get health breakdown for a specific team member
  async getHealthBreakdownForTeamMember(teamMemberName: string): Promise<{
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  }> {
    const dbService = getDbService();
    const issues = await dbService.getActiveIssues();
    
    // Filter issues by assignee
    const memberIssues = issues.filter(issue => issue.assignee === teamMemberName);
    
    const breakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };

    for (const issue of memberIssues) {
      switch (issue.health) {
        case 'On Track':
          breakdown.onTrack++;
          break;
        case 'At Risk':
          breakdown.atRisk++;
          break;
        case 'Off Track':
          breakdown.offTrack++;
          break;
        case 'On Hold':
          breakdown.onHold++;
          break;
        case 'Mystery':
          breakdown.mystery++;
          break;
        case 'Complete':
          breakdown.complete++;
          break;
        default:
          // If health is null or unknown, count as unknown
          breakdown.unknown++;
          break;
      }
    }

    return breakdown;
  }

  // Calculate weeks at risk for an issue based on changelog data
  async calculateWeeksAtRisk(issueKey: string): Promise<number> {
    try {
      const changelog = await getIssueChangelog(issueKey);
      // The changelog response has a 'values' property containing the histories
      const histories = changelog.values || changelog.histories || [];
      
      // Filter for health field changes
      const healthChanges = histories
        .filter((history: any) => 
          history.items.some((item: any) => 
            item.field === 'Health' || 
            item.fieldId === 'customfield_10238' ||
            (item.fieldtype === 'custom' && item.fieldId === 'customfield_10238')
          )
        )
        .map((history: any) => {
          const healthItem = history.items.find((item: any) => 
            item.field === 'Health' || 
            item.fieldId === 'customfield_10238' ||
            (item.fieldtype === 'custom' && item.fieldId === 'customfield_10238')
          );
          return {
            date: new Date(history.created),
            from: healthItem?.fromString || null,
            to: healthItem?.toString || null
          };
        })
        .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
      
      if (healthChanges.length === 0) {
        return 0;
      }
      
      // Find the most recent transition to "At Risk" or "Off Track"
      const riskTransitions = healthChanges.filter(change => 
        change.to === 'At Risk' || change.to === 'Off Track'
      );
      
      if (riskTransitions.length === 0) {
        return 0;
      }
      
      // Get the most recent risk transition
      const lastRiskTransition = riskTransitions[riskTransitions.length - 1];
      const riskStartDate = lastRiskTransition.date;
      
      // Calculate weeks since the risk transition
      const now = new Date();
      const weeksDiff = Math.ceil((now.getTime() - riskStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      
      // If it's been less than a week, return 1
      return Math.max(1, weeksDiff);
      
    } catch (error) {
      console.error(`Error calculating weeks at risk for ${issueKey}:`, error);
      return 1; // Default to 1 week if calculation fails
    }
  }

  async calculateDiscoveryCycleInfo(issueKey: string): Promise<{
    discoveryStartDate: Date | null;
    discoveryEndDate: Date | null;
    endDateLogic: string;
    calendarDaysInDiscovery: number | null;
    activeDaysInDiscovery: number | null;
  }> {
    try {
      const changelog = await getIssueChangelog(issueKey);
      const histories = changelog.values || changelog.histories || [];
      
      // Debug logging for HT-218
      if (issueKey === 'HT-218') {
        console.log(`\n=== Processing HT-218 ===`);
        console.log(`Changelog histories: ${histories.length}`);
        console.log(`First few histories:`, histories.slice(0, 5).map(h => ({
          date: h.created,
          items: h.items?.map(i => ({ field: i.field, from: i.fromString, to: i.toString }))
        })));
      }
      
      // Filter for status changes
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
      
      if (statusChanges.length === 0) {
        return {
          discoveryStartDate: null,
          discoveryEndDate: null,
          endDateLogic: 'No status changes found',
          calendarDaysInDiscovery: null,
          activeDaysInDiscovery: null
        };
      }
      
      // Find discovery start (first transition to any discovery status)
      const discoveryStart = statusChanges.find((change: any) => 
        change.to && (
          change.to.includes('02 Generative Discovery') ||
          change.to.includes('04 Problem Discovery') ||
          change.to.includes('05 Solution Discovery')
        )
      );
      
      if (!discoveryStart) {
        // Check if this project went directly to Build without discovery
        const directToBuild = statusChanges.find((change: any) => 
          change.to && change.to.includes('06 Build')
        );
        
        if (directToBuild) {
          return {
            discoveryStartDate: null,
            discoveryEndDate: directToBuild.date,
            endDateLogic: 'Direct to Build',
            calendarDaysInDiscovery: null,
            activeDaysInDiscovery: null
          };
        }
        
        return {
          discoveryStartDate: null,
          discoveryEndDate: null,
          endDateLogic: 'No Discovery',
          calendarDaysInDiscovery: null,
          activeDaysInDiscovery: null
        };
      }
      
      const discoveryStartDate = discoveryStart.date;
      
      // Find discovery end (transition from discovery status to completion status)
      const discoveryEnd = statusChanges.find((change: any) => 
        change.from && (
          change.from.includes('02 Generative Discovery') ||
          change.from.includes('04 Problem Discovery') ||
          change.from.includes('05 Solution Discovery')
        ) && change.to && (
          change.to.includes('06 Build') ||
          change.to.includes('Won\'t Do') ||
          change.to.includes('09 Live') ||
          change.to.includes('Done') ||
          change.to.includes('Resolved')
        )
      );
      
      if (discoveryEnd) {
        let endReason = 'Unknown transition';
        if (discoveryEnd.to.includes('06 Build')) {
          endReason = 'Build Transition';
        } else if (discoveryEnd.to.includes('Won\'t Do')) {
          endReason = 'Won\'t Do';
        } else if (discoveryEnd.to.includes('09 Live')) {
          endReason = 'Live';
        } else if (discoveryEnd.to.includes('Done') || discoveryEnd.to.includes('Resolved')) {
          endReason = 'Completed';
        }
        
        const calendarDays = Math.ceil((discoveryEnd.date.getTime() - discoveryStartDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Adjust discovery start date if it's before the first changelog entry
        let adjustedDiscoveryStart = discoveryStartDate;
        if (histories.length > 0) {
          const firstChangelogDate = new Date(histories[0].created);
          if (discoveryStartDate < firstChangelogDate) {
            if (issueKey === 'HT-156') {
              console.log(`Adjusting discovery start from ${discoveryStartDate.toISOString()} to ${firstChangelogDate.toISOString()}`);
            }
            adjustedDiscoveryStart = firstChangelogDate;
          }
        }
        
        const activeDays = this.calculateActiveDiscoveryDays(histories, adjustedDiscoveryStart, discoveryEnd.date, issueKey);
        
        return {
          discoveryStartDate,
          discoveryEndDate: discoveryEnd.date,
          endDateLogic: endReason,
          calendarDaysInDiscovery: calendarDays,
          activeDaysInDiscovery: activeDays
        };
      }
      
      // Check if archived (would need to check customfield_10456, but for now assume still active)
      // For now, use current date as end date
      const now = new Date();
      const calendarDays = Math.ceil((now.getTime() - discoveryStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Adjust discovery start date if it's before the first changelog entry
      let adjustedDiscoveryStart = discoveryStartDate;
      if (histories.length > 0) {
        const firstChangelogDate = new Date(histories[0].created);
        if (discoveryStartDate < firstChangelogDate) {
          if (issueKey === 'HT-156') {
            console.log(`Adjusting discovery start from ${discoveryStartDate.toISOString()} to ${firstChangelogDate.toISOString()}`);
          }
          adjustedDiscoveryStart = firstChangelogDate;
        }
      }
      
      const activeDays = this.calculateActiveDiscoveryDays(histories, adjustedDiscoveryStart, now, issueKey);
      
      return {
        discoveryStartDate,
        discoveryEndDate: now,
        endDateLogic: 'Still in Discovery',
        calendarDaysInDiscovery: calendarDays,
        activeDaysInDiscovery: activeDays
      };
      
    } catch (error) {
      console.error(`Error calculating discovery cycle info for ${issueKey}:`, error);
      return {
        discoveryStartDate: null,
        discoveryEndDate: null,
        endDateLogic: 'Error',
        calendarDaysInDiscovery: null,
        activeDaysInDiscovery: null
      };
    }
  }

  /**
   * Calculate active discovery days by analyzing changelog for on-hold and inactive periods
   */
  private calculateActiveDiscoveryDays(
    histories: any[], 
    discoveryStartDate: Date, 
    discoveryEndDate: Date,
    issueKey?: string
  ): number {
    // Sort histories by date
    const sortedHistories = histories
      .filter(h => h.created)
      .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
    
    // Debug logging for specific issues
    const isDebugIssue = issueKey === 'HT-218';
    
    // If discovery start is before the first changelog entry, adjust it
    if (sortedHistories.length > 0) {
      const firstChangelogDate = new Date(sortedHistories[0].created);
      if (discoveryStartDate < firstChangelogDate) {
        if (isDebugIssue) {
          console.log(`Discovery start (${discoveryStartDate.toISOString()}) is before first changelog entry (${firstChangelogDate.toISOString()}), adjusting`);
        }
        discoveryStartDate = firstChangelogDate;
      }
    }
    
    // Track periods when project was inactive or on hold
    const inactiveStatuses = ['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'];
    const onHoldHealth = 'On Hold';
    
    let currentStatus = '';
    let currentHealth = '';
    let lastTransitionDate = discoveryStartDate;
    let totalInactiveDays = 0;
    
    // Initialize as active - projects start active when discovery begins
    // We'll track transitions to inactive states
    let isCurrentlyActive = true;
    
    
    // If we have no changelog data within the discovery period, assume it was all active
    if (sortedHistories.length === 0) {
      const totalCalendarDays = Math.ceil(
        (discoveryEndDate.getTime() - discoveryStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return totalCalendarDays;
    }

    // Projects start active when discovery begins
    // We'll process transitions to determine when they become inactive
    
    if (isDebugIssue) {
      console.log(`\n=== DEBUG: Active Discovery Calculation ===`);
      console.log(`Discovery Start: ${discoveryStartDate.toISOString()}`);
      console.log(`Discovery End: ${discoveryEndDate.toISOString()}`);
      console.log(`Total Histories: ${sortedHistories.length}`);
    }
    
    // Process each transition during discovery period
    for (const history of sortedHistories) {
      const transitionDate = new Date(history.created);
      
      // Only process transitions within discovery period
      if (transitionDate < discoveryStartDate || transitionDate > discoveryEndDate) {
        continue;
      }
      
      if (isDebugIssue) {
        console.log(`\nProcessing transition at ${transitionDate.toISOString()}`);
        console.log(`Before: status=${currentStatus}, health=${currentHealth}, active=${isCurrentlyActive}`);
      }
      
      if (history.items) {
        for (const item of history.items) {
          if (item.field === 'status' && item.toString) {
            currentStatus = item.toString;
            if (isDebugIssue) {
              console.log(`Status change at ${transitionDate.toISOString()}: ${item.fromString} -> ${item.toString}`);
            }
          }
          if ((item.field === 'Health' || item.fieldId === 'customfield_10238') && item.toString) {
            currentHealth = item.toString;
            if (isDebugIssue) {
              console.log(`Health change at ${transitionDate.toISOString()}: ${item.fromString} -> ${item.toString}`);
            }
          }
        }
      }
      
      // Determine new active state based on BOTH status and health
      const isInactiveStatus = inactiveStatuses.includes(currentStatus);
      const isOnHoldHealth = currentHealth === onHoldHealth;
      const wasActive = isCurrentlyActive;
      const isNowInactive = isInactiveStatus || isOnHoldHealth;
      
      if (isDebugIssue) {
        console.log(`After: status=${currentStatus} (inactive: ${isInactiveStatus}), health=${currentHealth} (on hold: ${isOnHoldHealth}), active=${isNowInactive ? 'inactive' : 'active'}`);
      }
      
      // Handle state changes
      if (wasActive && isNowInactive) {
        // Project became inactive - count the active period before this transition
        const activeDays = Math.ceil(
          (transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (isDebugIssue) {
          console.log(`  → Became inactive: counting ${activeDays} active days`);
        }
        isCurrentlyActive = false;
        lastTransitionDate = transitionDate;
      } else if (!wasActive && !isNowInactive) {
        // Project became active - count the inactive period before this transition
        const inactiveDays = Math.ceil(
          (transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalInactiveDays += Math.max(0, inactiveDays);
        if (isDebugIssue) {
          console.log(`  → Became active: counting ${inactiveDays} inactive days (total: ${totalInactiveDays})`);
        }
        isCurrentlyActive = true;
        lastTransitionDate = transitionDate;
      } else if (!wasActive && isNowInactive) {
        // Project was inactive and is still inactive - count the inactive period
        const inactiveDays = Math.ceil(
          (transitionDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalInactiveDays += Math.max(0, inactiveDays);
        if (isDebugIssue) {
          console.log(`  → Still inactive: counting ${inactiveDays} inactive days (total: ${totalInactiveDays})`);
        }
        lastTransitionDate = transitionDate;
      } else {
        // Project was active and is still active - just update the date
        if (isDebugIssue) {
          console.log(`  → Still active`);
        }
        lastTransitionDate = transitionDate;
      }
    }
    
    // Add any remaining time from last transition to discovery end
    const finalPeriodDays = Math.ceil(
      (discoveryEndDate.getTime() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if project was inactive/on hold at the end
    const isCurrentlyInactive = inactiveStatuses.includes(currentStatus) || currentHealth === onHoldHealth;
    if (isCurrentlyInactive) {
      totalInactiveDays += Math.max(0, finalPeriodDays);
      if (isDebugIssue) {
        console.log(`Final inactive period: ${finalPeriodDays} days`);
      }
    } else if (isCurrentlyActive) {
      if (isDebugIssue) {
        console.log(`Final active period: ${finalPeriodDays} days`);
      }
    }
    
    // Active days = total calendar days - inactive days
    const totalCalendarDays = Math.ceil(
      (discoveryEndDate.getTime() - discoveryStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const activeDays = Math.max(0, totalCalendarDays - totalInactiveDays);
    
    if (isDebugIssue) {
      console.log(`Total Calendar Days: ${totalCalendarDays}`);
      console.log(`Total Inactive Days: ${totalInactiveDays}`);
      console.log(`Active Days: ${activeDays}`);
      console.log(`=== END DEBUG ===\n`);
    }
    
    return activeDays;
  }

  /**
   * Calculate completed discovery cycles grouped by quarter of completion
   * Returns data suitable for box-and-whisker analysis
   */
  async calculateCompletedDiscoveryCycles(timeType: 'calendar' | 'active' = 'calendar'): Promise<{
    cohorts: {
      [quarter: string]: {
        quarter: string;
        data: number[];
        outliers: number[];
        size: number;
        stats: {
          min: number;
          q1: number;
          median: number;
          q3: number;
          max: number;
        };
      };
    };
  }> {
    try {
      const dbService = getDbService();
      
      // First, try to get cached data
      const cachedData = await dbService.getAllCycleTimeCache();
      
      if (cachedData.length > 0) {
        console.log(`Using cached cycle time data for ${cachedData.length} projects`);
        
        // Process cached data
        const completedCycles: Array<{
          key: string;
          discoveryStartDate: Date;
          discoveryEndDate: Date;
          cycleTimeDays: number;
          completionQuarter: string;
        }> = [];

        for (const cached of cachedData) {
          // Only include projects with completed discovery cycles
          if (cached.discoveryStartDate && 
              cached.discoveryEndDate && 
              cached.endDateLogic !== 'Still in Discovery' &&
              cached.endDateLogic !== 'No Discovery' &&
              cached.endDateLogic !== 'Direct to Build' &&
              cached.completionQuarter &&
              ['Q1_2025', 'Q2_2025', 'Q3_2025'].includes(cached.completionQuarter)) {
            
            completedCycles.push({
              key: cached.issueKey,
              discoveryStartDate: cached.discoveryStartDate,
              discoveryEndDate: cached.discoveryEndDate,
              cycleTimeDays: timeType === 'active' 
                ? (cached.activeDaysInDiscovery || 0)
                : (cached.calendarDaysInDiscovery || 0),
              completionQuarter: cached.completionQuarter
            });
          }
        }

        return this.processCompletedCycles(completedCycles);
      }

      // If no cached data, fetch from Jira API and cache it
      console.log('No cached data found, fetching from Jira API...');
      const { getAllIssuesForCycleAnalysis } = await import('./jira-api');
      const allIssues = await getAllIssuesForCycleAnalysis();
      console.log(`Fetched ${allIssues.length} total projects for cycle analysis`);
      
      const completedCycles: Array<{
        key: string;
        discoveryStartDate: Date;
        discoveryEndDate: Date;
        cycleTimeDays: number;
        completionQuarter: string;
      }> = [];

      // Process each issue to find completed discovery cycles
      let processedCount = 0;
      let completedCount = 0;
      const totalIssues = allIssues.length;
      
      console.log(`Processing ${totalIssues} projects for cycle time analysis...`);
      
      for (const issue of allIssues) {
        processedCount++;
        
        // Log progress every 50 projects
        if (processedCount % 50 === 0 || processedCount === totalIssues) {
          console.log(`Progress: ${processedCount}/${totalIssues} projects processed (${Math.round(processedCount/totalIssues*100)}%)`);
        }
        
        const cycleInfo = await this.calculateDiscoveryCycleInfo(issue.key);
        
        // Cache the result
        const completionDate = cycleInfo.discoveryEndDate;
        const quarter = completionDate ? this.getQuarterFromDate(completionDate) : null;
        
        await dbService.insertCycleTimeCache(issue.key, {
          discoveryStartDate: cycleInfo.discoveryStartDate,
          discoveryEndDate: cycleInfo.discoveryEndDate,
          endDateLogic: cycleInfo.endDateLogic,
          calendarDaysInDiscovery: cycleInfo.calendarDaysInDiscovery,
          activeDaysInDiscovery: cycleInfo.activeDaysInDiscovery,
          completionQuarter: quarter
        });
        
        // Only include projects with completed discovery cycles
        if (cycleInfo.discoveryStartDate && 
            cycleInfo.discoveryEndDate && 
            cycleInfo.endDateLogic !== 'Still in Discovery' &&
            cycleInfo.endDateLogic !== 'No Discovery' &&
            cycleInfo.endDateLogic !== 'Direct to Build') {
          
          // Only include Q1, Q2, Q3 2025
          if (['Q1_2025', 'Q2_2025', 'Q3_2025'].includes(quarter || '')) {
            const cycleTimeDays = timeType === 'active' 
              ? (cycleInfo.activeDaysInDiscovery || 0)
              : (cycleInfo.calendarDaysInDiscovery || 0);
            
            completedCycles.push({
              key: issue.key,
              discoveryStartDate: cycleInfo.discoveryStartDate,
              discoveryEndDate: cycleInfo.discoveryEndDate,
              cycleTimeDays,
              completionQuarter: quarter!
            });
            
            completedCount++;
            console.log(`Found completed cycle: ${issue.key} (${quarter}) - ${cycleTimeDays} days`);
          }
        }
      }
      
      console.log(`Cycle analysis complete: ${completedCount} completed cycles found from ${totalIssues} total projects`);

      return this.processCompletedCycles(completedCycles);
    } catch (error) {
      console.error('Error calculating completed discovery cycles:', error);
      return { cohorts: {} };
    }
  }

  /**
   * Process completed cycles into quarter cohorts
   */
  private processCompletedCycles(completedCycles: Array<{
    key: string;
    discoveryStartDate: Date;
    discoveryEndDate: Date;
    cycleTimeDays: number;
    completionQuarter: string;
  }>): {
    cohorts: {
      [quarter: string]: {
        quarter: string;
        data: number[];
        outliers: number[];
        size: number;
        stats: {
          min: number;
          q1: number;
          median: number;
          q3: number;
          max: number;
        };
      };
    };
  } {
    // Group by quarter and calculate statistics
    const cohorts: any = {};
    const quarters = ['Q1_2025', 'Q2_2025', 'Q3_2025'];
    
    for (const quarter of quarters) {
      const quarterData = completedCycles
        .filter(cycle => cycle.completionQuarter === quarter)
        .map(cycle => cycle.cycleTimeDays);
      
      if (quarterData.length > 0) {
        const stats = this.calculateBoxPlotStats(quarterData);
        const { data, outliers } = this.separateOutliers(quarterData, stats);
        
        cohorts[quarter] = {
          quarter,
          data,
          outliers,
          size: quarterData.length,
          stats
        };
      } else {
        // Empty cohort
        cohorts[quarter] = {
          quarter,
          data: [],
          outliers: [],
          size: 0,
          stats: { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
        };
      }
    }

    return { cohorts };
  }

  /**
   * Get quarter string from date (Q1_2025, Q2_2025, etc.)
   */
  private getQuarterFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-indexed
    
    if (month >= 1 && month <= 3) return `Q1_${year}`;
    if (month >= 4 && month <= 6) return `Q2_${year}`;
    if (month >= 7 && month <= 9) return `Q3_${year}`;
    if (month >= 10 && month <= 12) return `Q4_${year}`;
    
    return `Q1_${year}`; // fallback
  }

  /**
   * Calculate box plot statistics (min, Q1, median, Q3, max)
   */
  private calculateBoxPlotStats(data: number[]): {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  } {
    if (data.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;

    const getPercentile = (arr: number[], p: number): number => {
      const index = (p / 100) * (arr.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;
      
      if (lower === upper) return arr[lower];
      return arr[lower] * (1 - weight) + arr[upper] * weight;
    };

    return {
      min: sorted[0],
      q1: getPercentile(sorted, 25),
      median: getPercentile(sorted, 50),
      q3: getPercentile(sorted, 75),
      max: sorted[n - 1]
    };
  }

  /**
   * Separate outliers from main data using IQR method
   */
  private separateOutliers(data: number[], stats: { q1: number; q3: number }): {
    data: number[];
    outliers: number[];
  } {
    const iqr = stats.q3 - stats.q1;
    const lowerBound = stats.q1 - 1.5 * iqr;
    const upperBound = stats.q3 + 1.5 * iqr;

    const mainData: number[] = [];
    const outliers: number[] = [];

    for (const value of data) {
      if (value < lowerBound || value > upperBound) {
        outliers.push(value);
      } else {
        mainData.push(value);
      }
    }

    return { data: mainData, outliers };
  }

  /**
   * Get trend data for the past 12 weeks
   * Analyzes historical changelog data to determine project counts by health and status
   */
  async getTrendData(filters: {
    assignee?: string;
    team?: string;
    bizChamp?: string;
  } = {}): Promise<Array<{
    week: string;
    totalProjects: number;
    healthBreakdown: {
      onTrack: number;
      atRisk: number;
      offTrack: number;
      onHold: number;
      mystery: number;
      complete: number;
      unknown: number;
    };
    statusBreakdown: {
      generativeDiscovery: number;
      problemDiscovery: number;
      solutionDiscovery: number;
      build: number;
      beta: number;
      live: number;
      wonDo: number;
      unknown: number;
    };
  }>> {
    try {
      const dbService = getDbService();
      
      // Get all issues with their current state
      let allIssues = await dbService.getActiveIssues();
      console.log(`Analyzing trends for ${allIssues.length} issues`);
      
      // Apply filters
      if (filters.assignee) {
        allIssues = allIssues.filter(issue => issue.assignee === filters.assignee);
        console.log(`Filtered by assignee '${filters.assignee}': ${allIssues.length} issues`);
      }
      
      // Note: Team filtering not implemented - no team data in current Issue type
      if (filters.team) {
        console.log(`Team filtering requested but not implemented: '${filters.team}'`);
      }
      
      if (filters.bizChamp) {
        allIssues = allIssues.filter(issue => issue.bizChamp === filters.bizChamp);
        console.log(`Filtered by biz champ '${filters.bizChamp}': ${allIssues.length} issues`);
      }
      
      // Generate past 12 weeks (Monday-based)
      const weeks = this.generatePast12Weeks();
      
      const trendData = [];
      
      // Check if we have any filters applied
      const hasFilters = filters.assignee || filters.team || filters.bizChamp;
      
      if (hasFilters) {
        // Use historical analysis for filtered data (slower but accurate)
        console.log('Using historical analysis for filtered data');
        for (const week of weeks) {
          console.log(`Processing week beginning ${week.toISOString().split('T')[0]}`);
          const weekData = await this.analyzeWeekData(allIssues, week);
          
          trendData.push({
            week: week.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            totalProjects: weekData.totalProjects,
            healthBreakdown: weekData.healthBreakdown,
            statusBreakdown: weekData.statusBreakdown
          });
        }
      } else {
        // Use simplified historical analysis for default view (faster but still shows trends)
        console.log('Using simplified historical analysis for default view');
        for (const week of weeks) {
          console.log(`Processing week beginning ${week.toISOString().split('T')[0]}`);
          const weekData = await this.analyzeWeekDataSimplified(allIssues, week);
          
          trendData.push({
            week: week.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            totalProjects: weekData.totalProjects,
            healthBreakdown: weekData.healthBreakdown,
            statusBreakdown: weekData.statusBreakdown
          });
        }
      }
      
      return trendData;
    } catch (error) {
      console.error('Error generating trend data:', error);
      throw error;
    }
  }

  /**
   * Generate past 12 weeks starting from Monday of current week
   */
  private generatePast12Weeks(): Date[] {
    const weeks = [];
    const now = new Date();
    
    // Find the Monday of current week
    const currentMonday = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, so go back 6 days
    currentMonday.setDate(now.getDate() + daysToMonday);
    currentMonday.setHours(0, 0, 0, 0);
    
    // Generate 12 weeks going backwards
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(currentMonday.getDate() - (i * 7));
      weeks.push(weekStart);
    }
    
    return weeks.reverse(); // Return in chronological order
  }

  /**
   * Analyze project data for a specific week using historical changelog data
   * This determines the actual state of projects at that point in time
   */
  private async analyzeWeekData(issues: any[], weekStart: Date): Promise<{
    totalProjects: number;
    healthBreakdown: any;
    statusBreakdown: any;
  }> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week
    
    const healthBreakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };

    const statusBreakdown = {
      generativeDiscovery: 0,
      problemDiscovery: 0,
      solutionDiscovery: 0,
      build: 0,
      beta: 0,
      live: 0,
      wonDo: 0,
      unknown: 0
    };

    let activeProjects = 0;

    // For each issue, determine its state at the end of the week
    for (const issue of issues) {
      // Skip archived projects
      if (issue.isArchived) continue;
      
      // Skip projects that weren't created yet
      if (new Date(issue.created) > weekEnd) continue;

      // Determine the project's state at the end of the week
      const stateAtWeekEnd = await this.getProjectStateAtDate(issue, weekEnd);
      
      if (!stateAtWeekEnd) continue;
      
      // Only count active projects (not in inactive statuses)
      if (['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'].includes(stateAtWeekEnd.status)) {
        continue;
      }

      activeProjects++;

      // Count by health
      switch (stateAtWeekEnd.health) {
        case 'On Track':
          healthBreakdown.onTrack++;
          break;
        case 'At Risk':
          healthBreakdown.atRisk++;
          break;
        case 'Off Track':
          healthBreakdown.offTrack++;
          break;
        case 'On Hold':
          healthBreakdown.onHold++;
          break;
        case 'Mystery':
          healthBreakdown.mystery++;
          break;
        case 'Complete':
          healthBreakdown.complete++;
          break;
        default:
          healthBreakdown.unknown++;
      }

      // Count by status
      switch (stateAtWeekEnd.status) {
        case '02 Generative Discovery':
          statusBreakdown.generativeDiscovery++;
          break;
        case '04 Problem Discovery':
          statusBreakdown.problemDiscovery++;
          break;
        case '05 Solution Discovery':
          statusBreakdown.solutionDiscovery++;
          break;
        case '06 Build':
          statusBreakdown.build++;
          break;
        case '07 Beta':
          statusBreakdown.beta++;
          break;
        case '08 Live':
          statusBreakdown.live++;
          break;
        case 'Won\'t Do':
          statusBreakdown.wonDo++;
          break;
        default:
          statusBreakdown.unknown++;
      }
    }

    return {
      totalProjects: activeProjects,
      healthBreakdown,
      statusBreakdown
    };
  }

  /**
   * Analyze current project data (fast mode for default view)
   * Uses current project states instead of historical analysis
   */
  private analyzeCurrentWeekData(issues: any[]): {
    totalProjects: number;
    healthBreakdown: any;
    statusBreakdown: any;
  } {
    const healthBreakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };

    const statusBreakdown = {
      generativeDiscovery: 0,
      problemDiscovery: 0,
      solutionDiscovery: 0,
      build: 0,
      beta: 0,
      live: 0,
      wonDo: 0,
      unknown: 0
    };

    // Filter to active projects (not archived, not in inactive statuses)
    const activeProjects = issues.filter(issue => 
      !issue.isArchived && 
      !['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'].includes(issue.status)
    );

    // Count by health
    activeProjects.forEach(issue => {
      switch (issue.health) {
        case 'On Track':
          healthBreakdown.onTrack++;
          break;
        case 'At Risk':
          healthBreakdown.atRisk++;
          break;
        case 'Off Track':
          healthBreakdown.offTrack++;
          break;
        case 'On Hold':
          healthBreakdown.onHold++;
          break;
        case 'Mystery':
          healthBreakdown.mystery++;
          break;
        case 'Complete':
          healthBreakdown.complete++;
          break;
        default:
          healthBreakdown.unknown++;
      }
    });

    // Count by status
    activeProjects.forEach(issue => {
      switch (issue.status) {
        case '02 Generative Discovery':
          statusBreakdown.generativeDiscovery++;
          break;
        case '04 Problem Discovery':
          statusBreakdown.problemDiscovery++;
          break;
        case '05 Solution Discovery':
          statusBreakdown.solutionDiscovery++;
          break;
        case '06 Build':
          statusBreakdown.build++;
          break;
        case '07 Beta':
          statusBreakdown.beta++;
          break;
        case '08 Live':
          statusBreakdown.live++;
          break;
        case 'Won\'t Do':
          statusBreakdown.wonDo++;
          break;
        default:
          statusBreakdown.unknown++;
      }
    });

    return {
      totalProjects: activeProjects.length,
      healthBreakdown,
      statusBreakdown
    };
  }

  /**
   * Analyze project data for a specific week using simplified logic
   * Uses project creation dates to simulate historical variation
   */
  private async analyzeWeekDataSimplified(issues: any[], weekStart: Date): Promise<{
    totalProjects: number;
    healthBreakdown: any;
    statusBreakdown: any;
  }> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week
    
    const healthBreakdown = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      onHold: 0,
      mystery: 0,
      complete: 0,
      unknown: 0
    };

    const statusBreakdown = {
      generativeDiscovery: 0,
      problemDiscovery: 0,
      solutionDiscovery: 0,
      build: 0,
      beta: 0,
      live: 0,
      wonDo: 0,
      unknown: 0
    };

    let activeProjects = 0;

    // For each issue, determine if it existed during this week
    for (const issue of issues) {
      // Skip archived projects
      if (issue.isArchived) continue;
      
      // Skip projects that weren't created yet
      if (new Date(issue.created) > weekEnd) continue;

      // Skip projects that were completed before this week
      if (issue.resolution && new Date(issue.resolution) < weekStart) continue;

      // Only count active projects (not in inactive statuses)
      if (['01 Inbox', '03 Committed', '09 Live', 'Won\'t Do'].includes(issue.status)) {
        continue;
      }

      activeProjects++;

      // Use current health/status for now (simplified approach)
      // In a more sophisticated version, we could use creation date to estimate early states
      switch (issue.health) {
        case 'On Track':
          healthBreakdown.onTrack++;
          break;
        case 'At Risk':
          healthBreakdown.atRisk++;
          break;
        case 'Off Track':
          healthBreakdown.offTrack++;
          break;
        case 'On Hold':
          healthBreakdown.onHold++;
          break;
        case 'Mystery':
          healthBreakdown.mystery++;
          break;
        case 'Complete':
          healthBreakdown.complete++;
          break;
        default:
          healthBreakdown.unknown++;
      }

      switch (issue.status) {
        case '02 Generative Discovery':
          statusBreakdown.generativeDiscovery++;
          break;
        case '04 Problem Discovery':
          statusBreakdown.problemDiscovery++;
          break;
        case '05 Solution Discovery':
          statusBreakdown.solutionDiscovery++;
          break;
        case '06 Build':
          statusBreakdown.build++;
          break;
        case '07 Beta':
          statusBreakdown.beta++;
          break;
        case '08 Live':
          statusBreakdown.live++;
          break;
        case 'Won\'t Do':
          statusBreakdown.wonDo++;
          break;
        default:
          statusBreakdown.unknown++;
      }
    }

    return {
      totalProjects: activeProjects,
      healthBreakdown,
      statusBreakdown
    };
  }

  /**
   * Get the state of a project at a specific date by analyzing its changelog
   */
  private async getProjectStateAtDate(issue: any, targetDate: Date): Promise<{
    status: string;
    health: string;
  } | null> {
    try {
      // Get the changelog for this issue
      const changelog = await this.getIssueChangelog(issue.key);
      
      if (!changelog || !changelog.values) {
        // No changelog data, use current state
        return {
          status: issue.status,
          health: issue.health || 'Unknown'
        };
      }

      // Find the most recent transition before or at the target date
      let currentStatus = issue.status;
      let currentHealth = issue.health || 'Unknown';

      // Sort changelog entries by date (oldest first)
      const sortedEntries = changelog.values
        .filter((entry: any) => new Date(entry.created) <= targetDate)
        .sort((a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime());

      // Process each changelog entry to find the state at the target date
      for (const entry of sortedEntries) {
        if (!entry.items) continue;

        for (const item of entry.items) {
          if (item.field === 'status' && item.toString) {
            currentStatus = item.toString;
          } else if ((item.field === 'Health' || item.fieldId === 'customfield_10238') && item.toString) {
            currentHealth = item.toString;
          }
        }
      }

      return {
        status: currentStatus,
        health: currentHealth
      };
    } catch (error) {
      console.error(`Error getting state for ${issue.key} at ${targetDate.toISOString()}:`, error);
      // Fallback to current state
      return {
        status: issue.status,
        health: issue.health || 'Unknown'
      };
    }
  }

  /**
   * Get changelog for a specific issue
   */
  private async getIssueChangelog(issueKey: string): Promise<any> {
    try {
      const { getIssueChangelog } = await import('./jira-api');
      return await getIssueChangelog(issueKey);
    } catch (error) {
      console.error(`Error fetching changelog for ${issueKey}:`, error);
      return null;
    }
  }

  /**
   * Get available filter options for the trends page
   */
  async getAvailableFilters(): Promise<{
    assignees: string[];
    teams: string[];
    bizChamps: string[];
  }> {
    try {
      const dbService = getDbService();
      const allIssues = await dbService.getActiveIssues();
      
      // Extract unique values for each filter (force rebuild)
      const assignees = [...new Set(allIssues.map(issue => issue.assignee).filter(Boolean))].sort() as string[];
      const bizChamps = [...new Set(allIssues.map(issue => issue.bizChamp).filter(Boolean))].sort() as string[];
      
      return {
        assignees,
        teams: [], // Team filtering not implemented - no team data in current Issue type
        bizChamps
      };
    } catch (error) {
      console.error('Error getting available filters:', error);
      return {
        assignees: [],
        teams: [],
        bizChamps: []
      };
    }
  }
}

// Lazy-loaded data processor to avoid database initialization issues
let _dataProcessor: DataProcessor | null = null;

export function getDataProcessor(): DataProcessor {
  if (!_dataProcessor) {
    _dataProcessor = new DataProcessor();
  }
  return _dataProcessor;
}

// Don't export dataProcessor directly to avoid instantiation at module load
