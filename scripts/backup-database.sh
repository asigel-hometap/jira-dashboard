#!/bin/bash

# Database Backup Script
# Creates a timestamped backup of the PostgreSQL database

set -e

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Get database connection string
DB_URL="${POSTGRES_URL:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo "Error: POSTGRES_URL or DATABASE_URL not found in environment"
  exit 1
fi

# Extract database name from connection string
# Format: postgresql://user:password@host:port/database
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_NAME" ]; then
  echo "Error: Could not extract database name from connection string"
  exit 1
fi

# Create backup directory if it doesn't exist
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/database_backup_${TIMESTAMP}.sql"

echo "Backing up database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"

# Create backup using pg_dump
pg_dump "$DB_URL" > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "✓ Backup created successfully: $BACKUP_FILE"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# List recent backups
echo ""
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -5 || echo "No previous backups found"

