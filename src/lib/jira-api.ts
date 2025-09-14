import { JiraIssue, JiraChangelog, JiraUser } from '@/types/jira';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://hometap.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || 'asigel@hometap.com';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'HT';

// Create basic auth header
const getAuthHeader = () => {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
  return `Basic ${credentials}`;
};

// Generic API request function
async function jiraRequest<T>(endpoint: string): Promise<T> {
  const url = `${JIRA_BASE_URL}/rest/api/3${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Jira API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Get all issues for the HT project (including completed ones)
export async function getAllIssuesForCycleAnalysis(): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let nextPageToken: string | undefined = undefined;
  const maxResults = 200;
  let attempts = 0;
  const maxAttempts = 50; // Allow more attempts for complete data
  const seenKeys = new Set<string>();

  while (attempts < maxAttempts) {
    console.log(`Fetching all issues batch ${attempts + 1}${nextPageToken ? `, nextPageToken: ${nextPageToken.substring(0, 20)}...` : ''}`);
    
    // Fetch ALL projects including Done status for cycle analysis
    let endpoint = `/search/jql?jql=project=${JIRA_PROJECT_KEY} ORDER BY key ASC&maxResults=${maxResults}&fields=summary,status,assignee,created,updated,customfield_10238,resolution,labels,customfield_10456,customfield_10150`;
    
    if (nextPageToken) {
      endpoint += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }
    
    const response = await jiraRequest<{
      issues: JiraIssue[];
      isLast?: boolean;
      nextPageToken?: string;
    }>(endpoint);

    if (!response.issues || response.issues.length === 0) {
      console.log('No more issues found');
      break;
    }

    // Filter out duplicates and add to results
    const newIssues = response.issues.filter(issue => !seenKeys.has(issue.key));
    newIssues.forEach(issue => seenKeys.add(issue.key));
    allIssues.push(...newIssues);

    console.log(`Received ${response.issues.length} issues, new unique: ${newIssues.length}, total unique: ${allIssues.length}`);

    // Check if we should continue
    if (response.isLast || !response.nextPageToken) {
      console.log('Reached last page');
      break;
    }
    
    nextPageToken = response.nextPageToken;
    attempts++;
  }

  console.log(`Found ${allIssues.length} total issues`);
  return allIssues;
}

// Get all issues for the HT project (active only)
export async function getAllIssues(): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 200; // Smaller batch size
  let hasMore = true;
  let attempts = 0;
  const maxAttempts = 20; // Allow more attempts but with smaller batches
  const seenKeys = new Set<string>(); // Track unique issue keys

  while (hasMore && attempts < maxAttempts) {
    console.log(`Fetching issues batch ${attempts + 1}, startAt: ${startAt}`);
    
    const endpoint = `/search/jql?jql=project=${JIRA_PROJECT_KEY} AND statusCategory NOT IN ("Done", "To Do") ORDER BY key ASC&startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,assignee,created,updated,customfield_10238,resolution,labels,customfield_10456,customfield_10150`;
    const response = await jiraRequest<{
      issues: JiraIssue[];
      total?: number;
      startAt: number;
      maxResults: number;
      isLast?: boolean;
    }>(endpoint);

    console.log(`Received ${response.issues.length} issues, total: ${response.total}, isLast: ${response.isLast}`);

    // Filter out unwanted statuses
    const filteredIssues = response.issues.filter(issue => {
      const status = issue.fields.status.name;
      return !["01 Inbox", "03 Committed", "09 Live", "Won't Do"].includes(status);
    });

    // Check for duplicates
    let newIssues = 0;
    for (const issue of filteredIssues) {
      if (!seenKeys.has(issue.key)) {
        allIssues.push(issue);
        seenKeys.add(issue.key);
        newIssues++;
      }
    }

    console.log(`New unique issues in this batch: ${newIssues}`);

    // If no issues returned, stop
    if (response.issues.length === 0) {
      hasMore = false;
    } 
    // If we got fewer issues than requested, we've reached the end
    else if (response.issues.length < maxResults) {
      hasMore = false;
    }
    // If isLast is explicitly true, stop
    else if (response.isLast === true) {
      hasMore = false;
    }
    // If we got the full batch but no new issues, we might have reached the end
    // but let's try one more page to be sure
    else if (newIssues === 0) {
      // Only stop if we've tried multiple pages with no new issues
      if (attempts > 2) {
        hasMore = false;
      } else {
        startAt += maxResults;
      }
    }
    else {
      startAt += maxResults;
    }
    
    attempts++;
  }

  console.log(`Total unique issues fetched: ${allIssues.length}`);
  return allIssues;
}

// Get a specific issue by key
export async function getIssue(issueKey: string): Promise<JiraIssue> {
  const endpoint = `/issue/${issueKey}`;
  return jiraRequest<JiraIssue>(endpoint);
}

// Get changelog for a specific issue
export async function getIssueChangelog(issueKey: string): Promise<JiraChangelog> {
  const allHistories: any[] = [];
  let startAt = 0;
  const maxResults = 100;
  let hasMore = true;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  // Debug logging for HT-156
  if (issueKey === 'HT-156') {
    console.log(`\n=== Fetching changelog for ${issueKey} ===`);
  }

  while (hasMore && attempts < maxAttempts) {
    await rateLimiter.waitIfNeeded();
    
    // Request changelog data (Jira API should return all available historical data by default)
    const endpoint = `/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`;
    
    if (issueKey === 'HT-156') {
      console.log(`Fetching changelog batch ${attempts + 1}: ${endpoint}`);
    }
    
    const response = await jiraRequest<any>(endpoint);
    
    if (issueKey === 'HT-156') {
      console.log(`Response for ${issueKey}:`, {
        hasValues: !!response.values,
        valuesLength: response.values?.length || 0,
        isLast: response.isLast,
        startAt: response.startAt,
        maxResults: response.maxResults
      });
    }
    
    if (response.values && Array.isArray(response.values)) {
      allHistories.push(...response.values);
      
      // Check if we have more data
      if (response.isLast === true || response.values.length < maxResults) {
        hasMore = false;
      } else {
        startAt += maxResults;
      }
    } else {
      hasMore = false;
    }
    
    attempts++;
  }

  // Return the changelog in the expected format
  return {
    histories: allHistories,
    values: allHistories
  };
}

// Get all users (for team member data)
export async function getAllUsers(): Promise<JiraUser[]> {
  const endpoint = '/users/search?maxResults=1000';
  return jiraRequest<JiraUser[]>(endpoint);
}

// Get issues with specific JQL query
export async function searchIssues(jql: string, fields?: string[]): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;
  let hasMore = true;

  const fieldsParam = fields ? `&fields=${fields.join(',')}` : '';

  while (hasMore) {
    const endpoint = `/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}${fieldsParam}`;
    const response = await jiraRequest<{
      issues: JiraIssue[];
      total: number;
      startAt: number;
      maxResults: number;
      isLast: boolean;
    }>(endpoint);

    allIssues.push(...response.issues);
    hasMore = !response.isLast;
    startAt += maxResults;
  }

  return allIssues;
}

// Get active projects (not archived, not in inactive statuses)
export async function getActiveProjects(): Promise<JiraIssue[]> {
  const jql = `project=${JIRA_PROJECT_KEY} AND status NOT IN ("01 Inbox", "03 Committed", "09 Live", "Won't Do") AND archived = false`;
  return searchIssues(jql);
}

// Get projects at risk (health = "At Risk" or "Off Track")
export async function getProjectsAtRisk(): Promise<JiraIssue[]> {
  const jql = `project=${JIRA_PROJECT_KEY} AND (cf[10238] = "At Risk" OR cf[10238] = "Off Track") AND archived = false`;
  return searchIssues(jql);
}

// Get projects in discovery status
export async function getDiscoveryProjects(): Promise<JiraIssue[]> {
  const jql = `project=${JIRA_PROJECT_KEY} AND status IN ("02 Generative Discovery", "04 Problem Discovery", "05 Solution Discovery") AND archived = false`;
  return searchIssues(jql);
}

// Rate limiting helper
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests = 500;
  private windowMs = 5 * 60 * 1000; // 5 minutes

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push(now);
  }
}

export const rateLimiter = new RateLimiter();
