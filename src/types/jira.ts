// Jira API response types
export interface JiraUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
  };
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraHealth {
  self: string;
  value: string;
  id: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: JiraStatus;
    assignee: JiraUser | null;
    customfield_10238: JiraHealth | null; // Health field
    customfield_10456: string | null; // Idea archived on
    customfield_10150: JiraUser[] | null; // Business champion (array)
    created: string;
    updated: string;
    duedate?: string | null;
    priority?: {
      id: string;
      name: string;
    };
    labels?: string[];
    resolution?: {
      id: string;
      name: string;
    } | null;
  };
  changelog?: {
    histories: JiraChangelogEntry[];
  };
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraChangelogEntry {
  id: string;
  created: string;
  author: JiraUser;
  items: JiraChangelogItem[];
}

export interface JiraChangelog {
  histories: JiraChangelogEntry[];
  values?: JiraChangelogEntry[]; // API v3 uses 'values' instead of 'histories'
}

// Internal data models
export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusId: string;
  assignee: string | null;
  assigneeId: string | null;
  health: string | null;
  healthId: string | null;
  created: Date;
  updated: Date;
  duedate: Date | null;
  priority: string;
  labels: string[];
  bizChamp: string | null;
  bizChampId: string | null;
  isArchived: boolean;
}

export interface StatusTransition {
  issueKey: string;
  fromStatus: string | null;
  toStatus: string;
  fromStatusId: string | null;
  toStatusId: string;
  timestamp: Date;
  author: string;
  authorId: string;
}

export interface HealthTransition {
  issueKey: string;
  fromHealth: string | null;
  toHealth: string;
  fromHealthId: string | null;
  toHealthId: string;
  timestamp: Date;
  author: string;
  authorId: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  displayName: string;
  avatarUrl: string;
}

export interface ProjectSnapshot {
  id: string;
  snapshotDate: Date;
  issueKey: string;
  status: string;
  health: string | null;
  assignee: string | null;
  isActive: boolean;
}

export interface CapacityData {
  date: Date;
  adam: number;
  jennie: number;
  jacqueline: number;
  robert: number;
  garima: number;
  lizzy: number;
  sanela: number;
  total: number;
  notes: string | null;
}

// Dashboard specific types
export interface WorkloadData {
  teamMember: string;
  activeProjectCount: number;
  isOverloaded: boolean;
  healthBreakdown: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    mystery: number;
    complete: number;
    unknown: number;
  };
}

export interface ProjectAtRisk {
  key: string;
  name: string;
  assignee: string | null;
  currentHealth: string | null;
  currentStatus: string;
  weeksAtRisk: number;
  bizChamp: string | null;
}

export interface CycleTimeData {
  issueKey: string;
  issueName: string;
  assignee: string | null;
  activeDiscoveryCycleTime: number; // weeks
  calendarDiscoveryCycleTime: number; // weeks
  discoveryStart: Date | null;
  discoveryEnd: Date | null;
  isOverdue: boolean; // > 4 weeks
}

export interface TrendData {
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
    inbox: number;
    generativeDiscovery: number;
    committed: number;
    problemDiscovery: number;
    solutionDiscovery: number;
    build: number;
    beta: number;
    live: number;
    wontDo: number;
    unknown: number;
  };
}

// Constants
export const STATUSES = {
  INBOX: '01 Inbox',
  GENERATIVE_DISCOVERY: '02 Generative Discovery',
  COMMITTED: '03 Committed',
  PROBLEM_DISCOVERY: '04 Problem Discovery',
  SOLUTION_DISCOVERY: '05 Solution Discovery',
  BUILD: '06 Build',
  BETA: '07 Beta',
  LIVE: '08 Live',
  WONT_DO: 'Won\'t Do'
} as const;

export const HEALTH_VALUES = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  OFF_TRACK: 'Off Track',
  ON_HOLD: 'On Hold',
  MYSTERY: 'Mystery',
  COMPLETE: 'Complete'
} as const;

export const DISCOVERY_STATUSES = [
  STATUSES.GENERATIVE_DISCOVERY,
  STATUSES.PROBLEM_DISCOVERY,
  STATUSES.SOLUTION_DISCOVERY
];

export const BUILD_STATUSES = [STATUSES.BUILD];

export const DEPLOYED_STATUSES = [STATUSES.BETA, STATUSES.LIVE];

export const INACTIVE_STATUSES = [
  STATUSES.INBOX,
  STATUSES.COMMITTED,
  STATUSES.LIVE,
  STATUSES.WONT_DO
];

