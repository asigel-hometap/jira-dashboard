import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Issue, StatusTransition, HealthTransition, TeamMember, ProjectSnapshot, CapacityData } from '@/types/jira';

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/jira-dashboard.db' 
  : './jira-dashboard.db';

let db: sqlite3.Database | null = null;

// Initialize database connection
export function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        resolve(db!);
      }
    });
  });
}

// Get database instance
export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Promisify database methods
export function promisifyDb() {
  const database = getDatabase();
  return {
    run: promisify(database.run.bind(database)),
    get: promisify(database.get.bind(database)),
    all: promisify(database.all.bind(database)),
  };
}

// Create tables
export async function createTables(): Promise<void> {
  const db = await initDatabase();
  const run = promisify(db.run.bind(db));

  // Issues table
  await run(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      status_id TEXT NOT NULL,
      assignee TEXT,
      assignee_id TEXT,
      health TEXT,
      health_id TEXT,
      created DATETIME NOT NULL,
      updated DATETIME NOT NULL,
      duedate DATETIME,
      priority TEXT NOT NULL,
      labels TEXT,
      biz_champ TEXT,
      biz_champ_id TEXT,
      is_archived BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add biz_champ columns if they don't exist (for existing databases)
  try {
    await run(`ALTER TABLE issues ADD COLUMN biz_champ TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    await run(`ALTER TABLE issues ADD COLUMN biz_champ_id TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

  // Status transitions table
  await run(`
    CREATE TABLE IF NOT EXISTS status_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_key TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      from_status_id TEXT,
      to_status_id TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      author TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_key) REFERENCES issues(key)
    )
  `);

  // Health transitions table
  await run(`
    CREATE TABLE IF NOT EXISTS health_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_key TEXT NOT NULL,
      from_health TEXT,
      to_health TEXT NOT NULL,
      from_health_id TEXT,
      to_health_id TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      author TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_key) REFERENCES issues(key)
    )
  `);

  // Team members table
  await run(`DROP TABLE IF EXISTS team_members`);
  await run(`
    CREATE TABLE team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Project snapshots table (weekly snapshots)
  await run(`
    CREATE TABLE IF NOT EXISTS project_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date DATE NOT NULL,
      issue_key TEXT NOT NULL,
      status TEXT NOT NULL,
      health TEXT,
      assignee TEXT,
      is_active BOOLEAN NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_key) REFERENCES issues(key),
      UNIQUE(snapshot_date, issue_key)
    )
  `);

  // Capacity data table (from CSV)
  await run(`
    CREATE TABLE IF NOT EXISTS capacity_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Cycle time cache table for caching completed discovery cycles
  await run(`
    CREATE TABLE IF NOT EXISTS cycle_time_cache (
      issue_key TEXT PRIMARY KEY,
      discovery_start_date TEXT,
      discovery_end_date TEXT,
      end_date_logic TEXT,
      calendar_days_in_discovery INTEGER,
      active_days_in_discovery INTEGER,
      completion_quarter TEXT,
      calculated_at TEXT NOT NULL,
      FOREIGN KEY (issue_key) REFERENCES issues(key)
    )
  `);

  // Add active_days_in_discovery column if it doesn't exist (for existing databases)
  try {
    await run(`ALTER TABLE cycle_time_cache ADD COLUMN active_days_in_discovery INTEGER`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Project details cache table for caching quarter-specific project details
  await run(`
    CREATE TABLE IF NOT EXISTS project_details_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quarter TEXT NOT NULL,
      issue_key TEXT NOT NULL,
      summary TEXT NOT NULL,
      assignee TEXT,
      discovery_start_date TEXT,
      calendar_days_in_discovery INTEGER,
      active_days_in_discovery INTEGER,
      calculated_at TEXT NOT NULL,
      UNIQUE(quarter, issue_key)
    )
  `);

  // Create indexes for better performance
  await run(`CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_issues_health ON issues(health)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_status_transitions_issue ON status_transitions(issue_key)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_status_transitions_timestamp ON status_transitions(timestamp)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_health_transitions_issue ON health_transitions(issue_key)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_health_transitions_timestamp ON health_transitions(timestamp)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_date ON project_snapshots(snapshot_date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_issue ON project_snapshots(issue_key)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_capacity_date ON capacity_data(date)`);

  console.log('Database tables created successfully');
}

// Database operations
export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    this.db = getDatabase();
  }

  // Issues
  async insertIssue(issue: Issue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO issues (
          id, key, summary, status, status_id, assignee, assignee_id,
          health, health_id, created, updated, duedate, priority, labels, biz_champ, biz_champ_id, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        issue.id, issue.key, issue.summary, issue.status, issue.statusId,
        issue.assignee, issue.assigneeId, issue.health, issue.healthId,
        issue.created.toISOString(), issue.updated.toISOString(),
        issue.duedate?.toISOString() || null, issue.priority,
        JSON.stringify(issue.labels), issue.bizChamp, issue.bizChampId, issue.isArchived
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getIssues(): Promise<Issue[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string) => Promise<any[]>;
    const rows = await all('SELECT * FROM issues ORDER BY updated DESC');
    return rows.map(this.mapRowToIssue);
  }

  async getActiveIssues(): Promise<Issue[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string) => Promise<any[]>;
    const rows = await all(`
      SELECT * FROM issues 
      WHERE is_archived = FALSE 
      AND status NOT IN ('01 Inbox', '03 Committed', '09 Live', 'Won''t Do')
      ORDER BY updated DESC
    `);
    return rows.map(this.mapRowToIssue);
  }

  // Status transitions
  async insertStatusTransition(transition: StatusTransition): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<void>;
    await run(`
      INSERT INTO status_transitions (
        issue_key, from_status, to_status, from_status_id, to_status_id,
        timestamp, author, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transition.issueKey, transition.fromStatus, transition.toStatus,
      transition.fromStatusId, transition.toStatusId,
      transition.timestamp.toISOString(), transition.author, transition.authorId
    ]);
  }

  async getStatusTransitions(issueKey: string): Promise<StatusTransition[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string, params: any[]) => Promise<any[]>;
    const rows = await all(
      'SELECT * FROM status_transitions WHERE issue_key = ? ORDER BY timestamp ASC',
      [issueKey]
    );
    return rows.map(this.mapRowToStatusTransition);
  }

  // Health transitions
  async insertHealthTransition(transition: HealthTransition): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<void>;
    await run(`
      INSERT INTO health_transitions (
        issue_key, from_health, to_health, from_health_id, to_health_id,
        timestamp, author, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transition.issueKey, transition.fromHealth, transition.toHealth,
      transition.fromHealthId, transition.toHealthId,
      transition.timestamp.toISOString(), transition.author, transition.authorId
    ]);
  }

  // Team members
  async insertTeamMember(member: TeamMember): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<void>;
    await run(`
      INSERT OR REPLACE INTO team_members (id, name, email, display_name, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `, [member.id, member.name, member.email, member.displayName, member.avatarUrl]);
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string) => Promise<any[]>;
    const rows = await all('SELECT * FROM team_members ORDER BY display_name');
    return rows.map(this.mapRowToTeamMember);
  }

  // Project snapshots
  async insertProjectSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<void>;
    await run(`
      INSERT OR REPLACE INTO project_snapshots (
        snapshot_date, issue_key, status, health, assignee, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      snapshot.snapshotDate.toISOString().split('T')[0],
      snapshot.issueKey, snapshot.status, snapshot.health, snapshot.assignee, snapshot.isActive
    ]);
  }

  async getProjectSnapshots(startDate?: Date, endDate?: Date): Promise<ProjectSnapshot[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string, params: any[]) => Promise<any[]>;
    let query = 'SELECT * FROM project_snapshots';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE snapshot_date BETWEEN ? AND ?';
      params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
    }

    query += ' ORDER BY snapshot_date DESC, issue_key';

    const rows = await all(query, params);
    return rows.map(this.mapRowToProjectSnapshot);
  }

  // Capacity data
  async insertCapacityData(capacity: CapacityData): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<void>;
    await run(`
      INSERT OR REPLACE INTO capacity_data (
        date, adam, jennie, jacqueline, robert, garima, lizzy, sanela, total, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      capacity.date.toISOString().split('T')[0],
      capacity.adam, capacity.jennie, capacity.jacqueline, capacity.robert,
      capacity.garima, capacity.lizzy, capacity.sanela, capacity.total, capacity.notes
    ]);
  }

  async getCapacityData(startDate?: Date, endDate?: Date): Promise<CapacityData[]> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string, params: any[]) => Promise<any[]>;
    let query = 'SELECT * FROM capacity_data';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE date BETWEEN ? AND ?';
      params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
    }

    query += ' ORDER BY date ASC';

    const rows = await all(query, params);
    return rows.map(this.mapRowToCapacityData);
  }

  // Helper methods to map database rows to objects
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
      labels: JSON.parse(row.labels || '[]'),
      bizChamp: row.biz_champ,
      bizChampId: row.biz_champ_id,
      isArchived: Boolean(row.is_archived)
    };
  }

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
      id: row.id,
      snapshotDate: new Date(row.snapshot_date),
      issueKey: row.issue_key,
      status: row.status,
      health: row.health,
      assignee: row.assignee,
      isActive: Boolean(row.is_active)
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

  // Cycle time cache methods
  async insertCycleTimeCache(issueKey: string, cycleInfo: {
    discoveryStartDate: Date | null;
    discoveryEndDate: Date | null;
    endDateLogic: string;
    calendarDaysInDiscovery: number | null;
    activeDaysInDiscovery: number | null;
    completionQuarter: string | null;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO cycle_time_cache 
        (issue_key, discovery_start_date, discovery_end_date, end_date_logic, 
         calendar_days_in_discovery, active_days_in_discovery, completion_quarter, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        issueKey,
        cycleInfo.discoveryStartDate?.toISOString() || null,
        cycleInfo.discoveryEndDate?.toISOString() || null,
        cycleInfo.endDateLogic,
        cycleInfo.calendarDaysInDiscovery,
        cycleInfo.activeDaysInDiscovery,
        cycleInfo.completionQuarter,
        new Date().toISOString()
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getCycleTimeCache(issueKey: string): Promise<{
    discoveryStartDate: Date | null;
    discoveryEndDate: Date | null;
    endDateLogic: string;
    calendarDaysInDiscovery: number | null;
    completionQuarter: string | null;
    calculatedAt: Date;
  } | null> {
    const get = promisify(this.db.get.bind(this.db)) as (sql: string, params: any[]) => Promise<any>;
    const row = await get('SELECT * FROM cycle_time_cache WHERE issue_key = ?', [issueKey]) as any;
    
    if (!row) return null;
    
    return {
      discoveryStartDate: row?.discovery_start_date ? new Date(row.discovery_start_date) : null,
      discoveryEndDate: row?.discovery_end_date ? new Date(row.discovery_end_date) : null,
      endDateLogic: row?.end_date_logic,
      calendarDaysInDiscovery: row?.calendar_days_in_discovery,
      completionQuarter: row?.completion_quarter,
      calculatedAt: new Date(row?.calculated_at)
    };
  }

  async getAllCycleTimeCache(): Promise<Array<{
    issueKey: string;
    discoveryStartDate: Date | null;
    discoveryEndDate: Date | null;
    endDateLogic: string;
    calendarDaysInDiscovery: number | null;
    activeDaysInDiscovery: number | null;
    completionQuarter: string | null;
    calculatedAt: Date;
  }>> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string) => Promise<any[]>;
    const rows = await all('SELECT * FROM cycle_time_cache ORDER BY calculated_at DESC');
    
    return rows.map((row: any) => ({
      issueKey: row.issue_key,
      discoveryStartDate: row.discovery_start_date ? new Date(row.discovery_start_date) : null,
      discoveryEndDate: row.discovery_end_date ? new Date(row.discovery_end_date) : null,
      endDateLogic: row.end_date_logic,
      calendarDaysInDiscovery: row.calendar_days_in_discovery,
      activeDaysInDiscovery: row.active_days_in_discovery,
      completionQuarter: row.completion_quarter,
      calculatedAt: new Date(row.calculated_at)
    }));
  }

  async clearCycleTimeCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cycle_time_cache', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Project details cache methods
  async insertProjectDetailsCache(quarter: string, projects: Array<{
    issueKey: string;
    summary: string;
    assignee: string;
    discoveryStartDate: string;
    calendarDaysInDiscovery: number;
    activeDaysInDiscovery: number;
  }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO project_details_cache 
        (quarter, issue_key, summary, assignee, discovery_start_date, calendar_days_in_discovery, active_days_in_discovery, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      let completed = 0;
      
      if (projects.length === 0) {
        resolve();
        return;
      }
      
      projects.forEach(project => {
        stmt.run([
          quarter,
          project.issueKey,
          project.summary,
          project.assignee,
          project.discoveryStartDate,
          project.calendarDaysInDiscovery,
          project.activeDaysInDiscovery,
          now
        ], (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === projects.length) {
            stmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  async getProjectDetailsCache(quarter: string): Promise<Array<{
    issueKey: string;
    summary: string;
    assignee: string;
    discoveryStartDate: string;
    calendarDaysInDiscovery: number;
    activeDaysInDiscovery: number;
  }>> {
    const all = promisify(this.db.all.bind(this.db)) as (sql: string, params: any[]) => Promise<any[]>;
    const rows = await all(
      'SELECT issue_key, summary, assignee, discovery_start_date, calendar_days_in_discovery, active_days_in_discovery FROM project_details_cache WHERE quarter = ? ORDER BY calendar_days_in_discovery DESC',
      [quarter]
    );
    
    return rows.map((row: any) => ({
      issueKey: row.issue_key,
      summary: row.summary,
      assignee: row.assignee,
      discoveryStartDate: row.discovery_start_date,
      calendarDaysInDiscovery: row.calendar_days_in_discovery,
      activeDaysInDiscovery: row.active_days_in_discovery
    }));
  }

  async clearProjectDetailsCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM project_details_cache', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Lazy-loaded database service to avoid initialization issues
let _dbService: DatabaseService | null = null;

export function getDbService(): DatabaseService {
  if (!_dbService) {
    _dbService = new DatabaseService();
  }
  return _dbService;
}

// Don't export dbService directly to avoid instantiation at module load
