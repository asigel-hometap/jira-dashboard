import { getPostgresDbService } from './postgres-database'; // Postgres service

// Factory function to get the database service (Postgres only)
export function getDatabaseService() {
  console.log('Using Postgres database');
  return getPostgresDbService();
}

// Initialize the database
export async function initializeDatabase() {
  const { initPostgresDatabase, createPostgresTables } = await import('./postgres-database');
  await initPostgresDatabase();
  await createPostgresTables();
}
