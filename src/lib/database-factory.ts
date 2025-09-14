import { getDbService } from './database'; // SQLite service
import { getPostgresDbService } from './postgres-database'; // Postgres service

// Environment variable to control which database to use
const USE_POSTGRES = process.env.USE_POSTGRES === 'true' && process.env.POSTGRES_URL;

// Factory function to get the appropriate database service
export function getDatabaseService() {
  if (USE_POSTGRES) {
    console.log('Using Postgres database');
    return getPostgresDbService();
  } else {
    console.log('Using SQLite database');
    return getDbService();
  }
}

// Initialize the appropriate database
export async function initializeDatabase() {
  if (USE_POSTGRES) {
    const { initPostgresDatabase, createPostgresTables } = await import('./postgres-database');
    await initPostgresDatabase();
    await createPostgresTables();
  } else {
    const { initDatabase, createTables } = await import('./database');
    await initDatabase();
    await createTables();
  }
}
