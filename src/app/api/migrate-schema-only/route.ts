import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres-database';

export async function POST() {
  try {
    const client = await getPostgresPool().connect();
    
    try {
      // Only create tables if they don't exist - this preserves existing data
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
          discovery_complexity VARCHAR(255),
          discovery_complexity_id VARCHAR(255),
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
        )
      `);

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
        )
      `);

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
          UNIQUE(snapshot_date, issue_key)
        )
      `);

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

      await client.query(`
        CREATE TABLE IF NOT EXISTS cycle_time_cache (
          issue_key VARCHAR(255) PRIMARY KEY,
          discovery_start_date VARCHAR(255),
          discovery_end_date VARCHAR(255),
          end_date_logic VARCHAR(255),
          calendar_days_in_discovery INTEGER,
          active_days_in_discovery INTEGER,
          completion_quarter VARCHAR(255),
          calculated_at VARCHAR(255) NOT NULL
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS project_exclusions (
          id SERIAL PRIMARY KEY,
          issue_key VARCHAR(255) NOT NULL UNIQUE,
          excluded_by VARCHAR(255) NOT NULL,
          exclusion_reason TEXT,
          excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

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

      // Create indexes for better performance
      await client.query(`
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

      console.log('Schema migration completed successfully - data preserved');
      return NextResponse.json({ 
        success: true, 
        message: 'Schema migration completed successfully - existing data preserved' 
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error migrating schema:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
