import { Pool, PoolClient } from 'pg';
import { Issue, StatusTransition, HealthTransition, TeamMember, ProjectSnapshot, CapacityData } from '@/types/jira';

// Database connection pool
let pool: Pool | null = null;

// Initialize Postgres connection
export function initPostgresDatabase(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('Postgres connection string not found. Please set POSTGRES_URL or DATABASE_URL environment variable.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  });

  return pool;
}

// Get database pool
export function getPostgresPool(): Pool {
  if (!pool) {
    return initPostgresDatabase();
  }
  return pool;
}

// Create tables
export async function createPostgresTables(): Promise<void> {
  const client = await getPostgresPool().connect();
  
  try {
    // Issues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id VARCHAR(255) PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        summary TEXT NOT NULL,
        status VARCHAR(255) NOT NULL,
        status_id VARCHAR(255) NOT NULL,
        assignee VARCHAR(255),
        assignee_id VARCHAR(255),
        health VARCHAR(255),
        health_id VARCHAR(255),
        created TIMESTAMP NOT NULL,
        updated TIMESTAMP NOT NULL,
        duedate TIMESTAMP,
        priority VARCHAR(255) NOT NULL,
        labels TEXT,
        biz_champ VARCHAR(255),
        biz_champ_id VARCHAR(255),
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Status transitions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_transitions (
        id SERIAL PRIMARY KEY,
        issue_key VARCHAR(255) NOT NULL,
        from_status VARCHAR(255),
        to_status VARCHAR(255) NOT NULL,
        from_status_id VARCHAR(255),
        to_status_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        author VARCHAR(255) NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- FOREIGN KEY (issue_key) REFERENCES issues(key) -- Removed to allow processing directly from Jira API
      )
    `);

    // Health transitions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_transitions (
        id SERIAL PRIMARY KEY,
        issue_key VARCHAR(255) NOT NULL,
        from_health VARCHAR(255),
        to_health VARCHAR(255) NOT NULL,
        from_health_id VARCHAR(255),
        to_health_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        author VARCHAR(255) NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- FOREIGN KEY (issue_key) REFERENCES issues(key) -- Removed to allow processing directly from Jira API
      )
    `);

    // Team members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        display_name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project snapshots table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        issue_key VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        health VARCHAR(255),
        assignee VARCHAR(255),
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- FOREIGN KEY (issue_key) REFERENCES issues(key) -- Removed to allow processing directly from Jira API
        UNIQUE(snapshot_date, issue_key)
      )
    `);

    // Capacity data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS capacity_data (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        adam INTEGER DEFAULT 0,
        jennie INTEGER DEFAULT 0,
        jacqueline INTEGER DEFAULT 0,
        robert INTEGER DEFAULT 0,
        garima INTEGER DEFAULT 0,
        lizzy INTEGER DEFAULT 0,
        sanela INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cycle time cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cycle_time_cache (
        issue_key VARCHAR(255) PRIMARY KEY,
        discovery_start_date VARCHAR(255),
        discovery_end_date VARCHAR(255),
        end_date_logic VARCHAR(255),
        calendar_days_in_discovery INTEGER,
        active_days_in_discovery INTEGER,
        completion_quarter VARCHAR(255),
        inactive_periods JSONB,
        calculated_at VARCHAR(255) NOT NULL
        -- FOREIGN KEY (issue_key) REFERENCES issues(key) -- Removed to allow processing directly from Jira API
      )
    `);

    // Project exclusions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_exclusions (
        id SERIAL PRIMARY KEY,
        issue_key VARCHAR(255) NOT NULL UNIQUE,
        excluded_by VARCHAR(255) NOT NULL,
        exclusion_reason TEXT,
        excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project details cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_details_cache (
        id SERIAL PRIMARY KEY,
        quarter VARCHAR(255) NOT NULL,
        issue_key VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        assignee VARCHAR(255),
        discovery_start_date VARCHAR(255),
        calendar_days_in_discovery INTEGER,
        active_days_in_discovery INTEGER,
        calculated_at VARCHAR(255) NOT NULL,
        UNIQUE(quarter, issue_key)
      )
    `);

    // Create priority indexes for better performance
    await client.query(`
      -- Core lookup indexes (highest priority)
      CREATE INDEX IF NOT EXISTS idx_issues_key_lookup ON issues(key);
      CREATE INDEX IF NOT EXISTS idx_issues_active_lookup ON issues(is_archived, status, updated DESC);
      CREATE INDEX IF NOT EXISTS idx_status_transitions_issue_timestamp ON status_transitions(issue_key, timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_transitions_issue_timestamp ON health_transitions(issue_key, timestamp);
      CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_issue_lookup ON cycle_time_cache(issue_key);
      
      -- Basic indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee);
      CREATE INDEX IF NOT EXISTS idx_issues_health ON issues(health);
      CREATE INDEX IF NOT EXISTS idx_issues_archived ON issues(is_archived);
      CREATE INDEX IF NOT EXISTS idx_status_transitions_issue_key ON status_transitions(issue_key);
      CREATE INDEX IF NOT EXISTS idx_status_transitions_timestamp ON status_transitions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_transitions_issue_key ON health_transitions(issue_key);
      CREATE INDEX IF NOT EXISTS idx_health_transitions_timestamp ON health_transitions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_project_snapshots_date ON project_snapshots(snapshot_date);
      CREATE INDEX IF NOT EXISTS idx_project_snapshots_issue_key ON project_snapshots(issue_key);
      CREATE INDEX IF NOT EXISTS idx_capacity_data_date ON capacity_data(date);
      CREATE INDEX IF NOT EXISTS idx_cycle_time_cache_quarter ON cycle_time_cache(completion_quarter);
      CREATE INDEX IF NOT EXISTS idx_project_details_cache_quarter ON project_details_cache(quarter);
    `);

    console.log('Postgres tables created successfully');
  } finally {
    client.release();
  }
}

// Postgres Database Service
export class PostgresDatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = getPostgresPool();
  }

  // Issues methods
  async getIssues(): Promise<Issue[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM issues ORDER BY updated DESC');
      return result.rows.map(this.mapRowToIssue);
    } finally {
      client.release();
    }
  }

  async getActiveIssues(): Promise<Issue[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM issues 
        WHERE is_archived = FALSE 
        AND status NOT IN ('01 Inbox', '03 Committed', '08 Live', '09 Live', 'Won''t Do')
        ORDER BY updated DESC
      `);
      return result.rows.map(this.mapRowToIssue);
    } finally {
      client.release();
    }
  }

  async insertIssue(issue: Issue): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO issues (
          id, key, summary, status, status_id, assignee, assignee_id,
          health, health_id, created, updated, duedate, priority, labels,
          biz_champ, biz_champ_id, is_archived
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (key) DO UPDATE SET
          summary = EXCLUDED.summary,
          status = EXCLUDED.status,
          status_id = EXCLUDED.status_id,
          assignee = EXCLUDED.assignee,
          assignee_id = EXCLUDED.assignee_id,
          health = EXCLUDED.health,
          health_id = EXCLUDED.health_id,
          updated = EXCLUDED.updated,
          duedate = EXCLUDED.duedate,
          priority = EXCLUDED.priority,
          labels = EXCLUDED.labels,
          biz_champ = EXCLUDED.biz_champ,
          biz_champ_id = EXCLUDED.biz_champ_id,
          is_archived = EXCLUDED.is_archived,
          updated_at = CURRENT_TIMESTAMP
      `, [
        issue.id, issue.key, issue.summary, issue.status, issue.statusId,
        issue.assignee, issue.assigneeId, issue.health, issue.healthId,
        issue.created, issue.updated, issue.duedate, issue.priority,
        issue.labels, issue.bizChamp, issue.bizChampId, issue.isArchived
      ]);
    } finally {
      client.release();
    }
  }

  async getIssueByKey(issueKey: string): Promise<Issue | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM issues WHERE key = $1',
        [issueKey]
      );
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToIssue(result.rows[0]);
    } finally {
      client.release();
    }
  }

  // Helper method to map database rows to Issue objects
  private mapRowToIssue(row: any): Issue {
    return {
      id: row.id,
      key: row.key,
      summary: row.summary,
      status: row.status,
      statusId: row.status_id,
      assignee: row.assignee,
      assigneeId: row.assignee_id,
      health: row.health,
      healthId: row.health_id,
      created: new Date(row.created),
      updated: new Date(row.updated),
      duedate: row.duedate ? new Date(row.duedate) : null,
      priority: row.priority,
      labels: row.labels,
      bizChamp: row.biz_champ,
      bizChampId: row.biz_champ_id,
      isArchived: row.is_archived
    };
  }

  // Status transitions methods
  async insertStatusTransition(transition: StatusTransition): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO status_transitions (
          issue_key, from_status, to_status, from_status_id, to_status_id,
          timestamp, author, author_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        transition.issueKey, transition.fromStatus, transition.toStatus,
        transition.fromStatusId, transition.toStatusId,
        transition.timestamp, transition.author, transition.authorId
      ]);
    } finally {
      client.release();
    }
  }

  async getStatusTransitions(issueKey: string): Promise<StatusTransition[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM status_transitions WHERE issue_key = $1 ORDER BY timestamp ASC',
        [issueKey]
      );
      return result.rows.map(this.mapRowToStatusTransition);
    } finally {
      client.release();
    }
  }

  // Health transitions methods
  async insertHealthTransition(transition: HealthTransition): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO health_transitions (
          issue_key, from_health, to_health, from_health_id, to_health_id,
          timestamp, author, author_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        transition.issueKey, transition.fromHealth, transition.toHealth,
        transition.fromHealthId, transition.toHealthId,
        transition.timestamp, transition.author, transition.authorId
      ]);
    } finally {
      client.release();
    }
  }

  // Team members methods
  async insertTeamMember(member: TeamMember): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO team_members (id, name, email, display_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = CURRENT_TIMESTAMP
      `, [member.id, member.name, member.email, member.displayName, member.avatarUrl]);
    } finally {
      client.release();
    }
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM team_members ORDER BY display_name');
      return result.rows.map(this.mapRowToTeamMember);
    } finally {
      client.release();
    }
  }

  // Project snapshots methods
  async insertProjectSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO project_snapshots (snapshot_date, issue_key, status, health, assignee, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (snapshot_date, issue_key) DO UPDATE SET
          status = EXCLUDED.status,
          health = EXCLUDED.health,
          assignee = EXCLUDED.assignee,
          is_active = EXCLUDED.is_active
      `, [
        snapshot.snapshotDate.toISOString().split('T')[0],
        snapshot.issueKey, snapshot.status, snapshot.health, snapshot.assignee, snapshot.isActive
      ]);
    } finally {
      client.release();
    }
  }

  async getProjectSnapshots(startDate?: Date, endDate?: Date): Promise<ProjectSnapshot[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM project_snapshots';
      const params: any[] = [];

      if (startDate && endDate) {
        query += ' WHERE snapshot_date BETWEEN $1 AND $2';
        params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
      }

      query += ' ORDER BY snapshot_date DESC, issue_key';

      const result = await client.query(query, params);
      return result.rows.map(this.mapRowToProjectSnapshot);
    } finally {
      client.release();
    }
  }

  // Capacity data methods
  async insertCapacityData(capacity: CapacityData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO capacity_data (
          date, adam, jennie, jacqueline, robert, garima, lizzy, sanela, total, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (date) DO UPDATE SET
          adam = EXCLUDED.adam,
          jennie = EXCLUDED.jennie,
          jacqueline = EXCLUDED.jacqueline,
          robert = EXCLUDED.robert,
          garima = EXCLUDED.garima,
          lizzy = EXCLUDED.lizzy,
          sanela = EXCLUDED.sanela,
          total = EXCLUDED.total,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
      `, [
        capacity.date.toISOString().split('T')[0],
        capacity.adam, capacity.jennie, capacity.jacqueline, capacity.robert,
        capacity.garima, capacity.lizzy, capacity.sanela, capacity.total, capacity.notes
      ]);
    } finally {
      client.release();
    }
  }

  async getCapacityData(startDate?: Date, endDate?: Date): Promise<CapacityData[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM capacity_data';
      const params: any[] = [];

      if (startDate && endDate) {
        query += ' WHERE date BETWEEN $1 AND $2';
        params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
      }

      query += ' ORDER BY date ASC';

      const result = await client.query(query, params);
      return result.rows.map(this.mapRowToCapacityData);
    } finally {
      client.release();
    }
  }

  // Cycle time cache methods
  async insertCycleTimeCache(issueKey: string, cycleInfo: {
    discoveryStartDate: Date | null;
    discoveryEndDate: Date | null;
    endDateLogic: string;
    calendarDaysInDiscovery: number | null;
    activeDaysInDiscovery: number | null;
    completionQuarter: string | null;
    inactivePeriods?: Array<{start: Date, end: Date}>;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO cycle_time_cache (
          issue_key, discovery_start_date, discovery_end_date, end_date_logic,
          calendar_days_in_discovery, active_days_in_discovery, completion_quarter, inactive_periods, calculated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (issue_key) DO UPDATE SET
          discovery_start_date = EXCLUDED.discovery_start_date,
          discovery_end_date = EXCLUDED.discovery_end_date,
          end_date_logic = EXCLUDED.end_date_logic,
          calendar_days_in_discovery = EXCLUDED.calendar_days_in_discovery,
          active_days_in_discovery = EXCLUDED.active_days_in_discovery,
          completion_quarter = EXCLUDED.completion_quarter,
          inactive_periods = EXCLUDED.inactive_periods,
          calculated_at = EXCLUDED.calculated_at
      `, [
        issueKey, 
        cycleInfo.discoveryStartDate?.toISOString() || null, 
        cycleInfo.discoveryEndDate?.toISOString() || null, 
        cycleInfo.endDateLogic,
        cycleInfo.calendarDaysInDiscovery, 
        cycleInfo.activeDaysInDiscovery, 
        cycleInfo.completionQuarter,
        cycleInfo.inactivePeriods ? JSON.stringify(cycleInfo.inactivePeriods.map(p => ({
          start: p.start.toISOString(),
          end: p.end.toISOString()
        }))) : null,
        new Date().toISOString()
      ]);
    } finally {
      client.release();
    }
  }

  async getCycleTimeCacheByIssue(issueKey: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM cycle_time_cache WHERE issue_key = $1',
        [issueKey]
      );
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];
      return {
        issueKey: row.issue_key,
        discoveryStartDate: row.discovery_start_date ? new Date(row.discovery_start_date) : null,
        discoveryEndDate: row.discovery_end_date ? new Date(row.discovery_end_date) : null,
        endDateLogic: row.end_date_logic,
        calendarDaysInDiscovery: row.calendar_days_in_discovery,
        activeDaysInDiscovery: row.active_days_in_discovery,
        completionQuarter: row.completion_quarter,
        calculatedAt: new Date(row.calculated_at)
      };
    } finally {
      client.release();
    }
  }

  async getCycleTimeCache(): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM cycle_time_cache ORDER BY calculated_at DESC');
      return result.rows.map((row: any) => ({
        issueKey: row.issue_key,
        discoveryStartDate: row.discovery_start_date ? new Date(row.discovery_start_date) : null,
        discoveryEndDate: row.discovery_end_date ? new Date(row.discovery_end_date) : null,
        endDateLogic: row.end_date_logic,
        calendarDaysInDiscovery: row.calendar_days_in_discovery,
        activeDaysInDiscovery: row.active_days_in_discovery,
        completionQuarter: row.completion_quarter,
        calculatedAt: new Date(row.calculated_at)
      }));
    } finally {
      client.release();
    }
  }

  // Project details cache methods
  async insertProjectDetailsCache(details: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO project_details_cache (
          quarter, issue_key, summary, assignee, discovery_start_date,
          calendar_days_in_discovery, active_days_in_discovery, calculated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (quarter, issue_key) DO UPDATE SET
          summary = EXCLUDED.summary,
          assignee = EXCLUDED.assignee,
          discovery_start_date = EXCLUDED.discovery_start_date,
          calendar_days_in_discovery = EXCLUDED.calendar_days_in_discovery,
          active_days_in_discovery = EXCLUDED.active_days_in_discovery,
          calculated_at = EXCLUDED.calculated_at
      `, [
        details.quarter, details.issueKey, details.summary, details.assignee,
        details.discoveryStartDate, details.calendarDaysInDiscovery, details.activeDaysInDiscovery, details.calculatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getProjectDetailsCache(quarter: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT issue_key, summary, assignee, discovery_start_date, calendar_days_in_discovery, active_days_in_discovery FROM project_details_cache WHERE quarter = $1 ORDER BY calendar_days_in_discovery DESC',
        [quarter]
      );
      return result.rows.map((row: any) => ({
        issueKey: row.issue_key,
        summary: row.summary,
        assignee: row.assignee,
        discoveryStartDate: row.discovery_start_date,
        calendarDaysInDiscovery: row.calendar_days_in_discovery,
        activeDaysInDiscovery: row.active_days_in_discovery
      }));
    } finally {
      client.release();
    }
  }

  // Clear cache methods
  async clearCycleTimeCache(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM cycle_time_cache');
    } finally {
      client.release();
    }
  }

  async clearProjectDetailsCache(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM project_details_cache');
    } finally {
      client.release();
    }
  }

  async clearProjectDetailsCacheByQuarter(quarter: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM project_details_cache WHERE quarter = $1', [quarter]);
    } finally {
      client.release();
    }
  }

  // Project exclusions methods
  async getExcludedIssues(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT issue_key FROM project_exclusions');
      return result.rows.map((row: any) => row.issue_key);
    } finally {
      client.release();
    }
  }

  async addExclusion(issueKey: string, excludedBy: string, reason?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'INSERT INTO project_exclusions (issue_key, excluded_by, exclusion_reason) VALUES ($1, $2, $3) ON CONFLICT (issue_key) DO NOTHING',
        [issueKey, excludedBy, reason]
      );
    } finally {
      client.release();
    }
  }

  async removeExclusion(issueKey: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM project_exclusions WHERE issue_key = $1', [issueKey]);
    } finally {
      client.release();
    }
  }

  async toggleExclusion(issueKey: string, excludedBy: string, reason?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      // Check if already excluded
      const checkResult = await client.query('SELECT id FROM project_exclusions WHERE issue_key = $1', [issueKey]);
      
      if (checkResult.rows.length > 0) {
        // Remove exclusion
        await client.query('DELETE FROM project_exclusions WHERE issue_key = $1', [issueKey]);
        return false; // Now included
      } else {
        // Add exclusion
        await client.query(
          'INSERT INTO project_exclusions (issue_key, excluded_by, exclusion_reason) VALUES ($1, $2, $3)',
          [issueKey, excludedBy, reason]
        );
        return true; // Now excluded
      }
    } finally {
      client.release();
    }
  }

  // Helper methods to map database rows to objects
  private mapRowToStatusTransition(row: any): StatusTransition {
    return {
      issueKey: row.issue_key,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      fromStatusId: row.from_status_id,
      toStatusId: row.to_status_id,
      timestamp: new Date(row.timestamp),
      author: row.author,
      authorId: row.author_id
    };
  }

  private mapRowToHealthTransition(row: any): HealthTransition {
    return {
      issueKey: row.issue_key,
      fromHealth: row.from_health,
      toHealth: row.to_health,
      fromHealthId: row.from_health_id,
      toHealthId: row.to_health_id,
      timestamp: new Date(row.timestamp),
      author: row.author,
      authorId: row.author_id
    };
  }

  private mapRowToTeamMember(row: any): TeamMember {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url
    };
  }

  private mapRowToProjectSnapshot(row: any): ProjectSnapshot {
    return {
      id: row.id.toString(),
      snapshotDate: new Date(row.snapshot_date),
      issueKey: row.issue_key,
      status: row.status,
      health: row.health,
      assignee: row.assignee,
      isActive: row.is_active
    };
  }

  private mapRowToCapacityData(row: any): CapacityData {
    return {
      date: new Date(row.date),
      adam: row.adam,
      jennie: row.jennie,
      jacqueline: row.jacqueline,
      robert: row.robert,
      garima: row.garima,
      lizzy: row.lizzy,
      sanela: row.sanela,
      total: row.total,
      notes: row.notes
    };
  }
}

// Singleton instance
let _postgresDbService: PostgresDatabaseService | null = null;

// Get Postgres database service instance
export function getPostgresDbService(): PostgresDatabaseService {
  if (!_postgresDbService) {
    _postgresDbService = new PostgresDatabaseService();
  }
  return _postgresDbService;
}
