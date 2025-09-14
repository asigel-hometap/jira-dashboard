# SQLite → Postgres Migration Plan

## Current SQLite Schema Analysis

### Tables to Migrate:
1. **issues** - Main project data
2. **status_transitions** - Status change history
3. **health_transitions** - Health change history  
4. **team_members** - Team member data
5. **project_snapshots** - Weekly trend snapshots
6. **capacity_data** - Historical capacity data
7. **cycle_time_cache** - Discovery cycle calculations
8. **project_details_cache** - Quarter-based project details

## Migration Strategy

### Phase 1: Setup Postgres Provider
- [ ] Choose provider (Vercel Postgres recommended)
- [ ] Set up database instance
- [ ] Get connection string

### Phase 2: Create Postgres Schema
- [ ] Convert SQLite schema to Postgres
- [ ] Handle data type differences (TEXT → VARCHAR, DATETIME → TIMESTAMP)
- [ ] Update AUTOINCREMENT → SERIAL
- [ ] Add proper indexes

### Phase 3: Update Database Layer
- [ ] Replace sqlite3 with pg (Postgres driver)
- [ ] Update connection logic
- [ ] Update query syntax (SQLite → Postgres)
- [ ] Handle environment variables

### Phase 4: Data Migration
- [ ] Export existing SQLite data
- [ ] Transform data for Postgres
- [ ] Import to Postgres
- [ ] Verify data integrity

### Phase 5: Testing & Deployment
- [ ] Test locally with Postgres
- [ ] Update Vercel environment variables
- [ ] Deploy and verify

## Key Differences SQLite → Postgres

| SQLite | Postgres | Notes |
|--------|----------|-------|
| `TEXT` | `VARCHAR` or `TEXT` | Both work, VARCHAR for length limits |
| `DATETIME` | `TIMESTAMP` | Better timezone support |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Auto-incrementing |
| `BOOLEAN` | `BOOLEAN` | Same |
| `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP` | Same |
| `UNIQUE` constraints | `UNIQUE` constraints | Same |
| `FOREIGN KEY` | `FOREIGN KEY` | Same |

## Environment Variables Needed

```bash
# Postgres connection
DATABASE_URL=postgresql://user:password@host:port/database
# or individual components
POSTGRES_HOST=host
POSTGRES_PORT=5432
POSTGRES_DATABASE=database
POSTGRES_USER=user
POSTGRES_PASSWORD=password
```
