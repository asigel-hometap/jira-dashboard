/**
 * Database Index Optimization Strategy
 * 
 * This file contains the optimized index definitions for the Jira Dashboard database.
 * Since Jira data only refreshes once daily, we can focus on read performance optimization.
 */

export const OPTIMIZED_INDEXES = [
  // Issues table - Most frequently queried table
  'CREATE INDEX IF NOT EXISTS idx_issues_status_archived ON issues(status, is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_issues_assignee_archived ON issues(assignee, is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_issues_health_archived ON issues(health, is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_issues_updated_desc ON issues(updated DESC)',
  'CREATE INDEX IF NOT EXISTS idx_issues_created_desc ON issues(created DESC)',
  'CREATE INDEX IF NOT EXISTS idx_issues_key_lookup ON issues(key)',
  'CREATE INDEX IF NOT EXISTS idx_issues_assignee_status ON issues(assignee, status)',
  'CREATE INDEX IF NOT EXISTS idx_issues_health_status ON issues(health, status)',
  
  // Status transitions - Critical for cycle time analysis
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_issue_timestamp ON status_transitions(issue_key, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_from_status ON status_transitions(from_status)',
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_to_status ON status_transitions(to_status)',
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_timestamp_desc ON status_transitions(timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_issue_from_to ON status_transitions(issue_key, from_status, to_status)',
  
  // Health transitions - Important for health tracking
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_issue_timestamp ON health_transitions(issue_key, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_from_health ON health_transitions(from_health)',
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_to_health ON health_transitions(to_health)',
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_timestamp_desc ON health_transitions(timestamp DESC)',
  
  // Project snapshots - Used for trend analysis
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_date_desc ON project_snapshots(snapshot_date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_issue_date ON project_snapshots(issue_key, snapshot_date)',
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_assignee_date ON project_snapshots(assignee, snapshot_date)',
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_status_date ON project_snapshots(status, snapshot_date)',
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_health_date ON project_snapshots(health, snapshot_date)',
  'CREATE INDEX IF NOT EXISTS idx_project_snapshots_active_date ON project_snapshots(is_active, snapshot_date)',
  
  // Cycle time cache - Critical for performance
  'CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_quarter ON cycle_time_cache(completion_quarter)',
  'CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_calculated ON cycle_time_cache(calculated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_issue_lookup ON cycle_time_cache(issue_key)',
  
  // Project details cache - Used for cycle time details
  'CREATE INDEX IF NOT EXISTS idx_project_details_cache_quarter ON project_details_cache(quarter)',
  'CREATE INDEX IF NOT EXISTS idx_project_details_cache_assignee ON project_details_cache(assignee)',
  'CREATE INDEX IF NOT EXISTS idx_project_details_cache_calendar_days ON project_details_cache(calendar_days_in_discovery DESC)',
  'CREATE INDEX IF NOT EXISTS idx_project_details_cache_active_days ON project_details_cache(active_days_in_discovery DESC)',
  'CREATE INDEX IF NOT EXISTS idx_project_details_cache_quarter_assignee ON project_details_cache(quarter, assignee)',
  
  // Project exclusions - Used for filtering
  'CREATE INDEX IF NOT EXISTS idx_project_exclusions_issue_key ON project_exclusions(issue_key)',
  'CREATE INDEX IF NOT EXISTS idx_project_exclusions_excluded_by ON project_exclusions(excluded_by)',
  
  // Capacity data - Used for historical analysis
  'CREATE INDEX IF NOT EXISTS idx_capacity_data_date_desc ON capacity_data(date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_capacity_data_date_asc ON capacity_data(date ASC)',
  
  // Team members - Used for user lookups
  'CREATE INDEX IF NOT EXISTS idx_team_members_display_name ON team_members(display_name)',
  'CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON team_members(account_id)',
];

/**
 * Composite indexes for complex queries
 * These are specifically designed for the most common query patterns
 */
export const COMPOSITE_INDEXES = [
  // For getActiveIssues() - most common query
  'CREATE INDEX IF NOT EXISTS idx_issues_active_lookup ON issues(is_archived, status, updated DESC)',
  
  // For cycle time analysis by assignee and quarter
  'CREATE INDEX IF NOT EXISTS idx_cycle_time_assignee_quarter ON cycle_time_cache(completion_quarter, issue_key)',
  
  // For trend analysis by assignee and date range
  'CREATE INDEX IF NOT EXISTS idx_snapshots_assignee_date_range ON project_snapshots(assignee, snapshot_date, is_active)',
  
  // For status transition analysis
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_analysis ON status_transitions(issue_key, from_status, to_status, timestamp)',
  
  // For health transition analysis
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_analysis ON health_transitions(issue_key, from_health, to_health, timestamp)',
];

/**
 * Partial indexes for specific use cases
 * These indexes only include rows that match certain conditions
 */
export const PARTIAL_INDEXES = [
  // Only index active issues (most common query)
  'CREATE INDEX IF NOT EXISTS idx_issues_active_only ON issues(assignee, status, health) WHERE is_archived = FALSE',
  
  // Only index discovery status transitions
  'CREATE INDEX IF NOT EXISTS idx_status_discovery_transitions ON status_transitions(issue_key, timestamp) WHERE to_status IN (\'02 Generative Discovery\', \'04 Problem Discovery\', \'05 Solution Discovery\')',
  
  // Only index build status transitions
  'CREATE INDEX IF NOT EXISTS idx_status_build_transitions ON status_transitions(issue_key, timestamp) WHERE to_status = \'06 Build\'',
  
  // Only index recent snapshots (last 6 months)
  'CREATE INDEX IF NOT EXISTS idx_snapshots_recent ON project_snapshots(assignee, snapshot_date) WHERE snapshot_date >= CURRENT_DATE - INTERVAL \'6 months\'',
];

/**
 * All indexes combined for easy application
 */
export const ALL_INDEXES = [
  ...OPTIMIZED_INDEXES,
  ...COMPOSITE_INDEXES,
  ...PARTIAL_INDEXES,
];

/**
 * Indexes that should be created first (dependencies)
 */
export const PRIORITY_INDEXES = [
  // Core lookup indexes
  'CREATE INDEX IF NOT EXISTS idx_issues_key_lookup ON issues(key)',
  'CREATE INDEX IF NOT EXISTS idx_issues_active_lookup ON issues(is_archived, status, updated DESC)',
  'CREATE INDEX IF NOT EXISTS idx_status_transitions_issue_timestamp ON status_transitions(issue_key, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_health_transitions_issue_timestamp ON health_transitions(issue_key, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_issue_lookup ON cycle_time_cache(issue_key)',
];

/**
 * Performance monitoring queries
 * Use these to check index usage and performance
 */
export const PERFORMANCE_QUERIES = {
  // Check index usage
  checkIndexUsage: `
    SELECT 
      schemaname,
      tablename,
      indexname,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
  `,
  
  // Check slow queries
  checkSlowQueries: `
    SELECT 
      query,
      calls,
      total_time,
      mean_time,
      rows
    FROM pg_stat_statements 
    WHERE mean_time > 1000
    ORDER BY mean_time DESC
    LIMIT 10;
  `,
  
  // Check table sizes
  checkTableSizes: `
    SELECT 
      tablename,
      pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(tablename::regclass) DESC;
  `,
};
