#!/usr/bin/env node

/**
 * Database Backup Script
 * Creates a timestamped backup of the PostgreSQL database using Node.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');

async function backupDatabase() {
  try {
    // Load environment variables from .env.local if it exists
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !match[1].startsWith('#')) {
          process.env[match[1].trim()] = match[2].trim();
        }
      });
    }
    
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('POSTGRES_URL or DATABASE_URL not found in environment');
    }

    // Create backup directory
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(backupDir, `database_backup_${timestamp}.sql`);
    const compressedFile = `${backupFile}.gz`;

    console.log('Connecting to database...');
    const pool = new Pool({ connectionString });
    
    // Get all table names
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

    // Create backup file
    const writeStream = fs.createWriteStream(backupFile);
    const gzip = createGzip();
    const compressedStream = fs.createWriteStream(compressedFile);

    // Write header
    writeStream.write(`-- Database Backup\n`);
    writeStream.write(`-- Created: ${new Date().toISOString()}\n`);
    writeStream.write(`-- Tables: ${tables.length}\n\n`);

    // Backup each table
    for (const table of tables) {
      console.log(`Backing up table: ${table}...`);
      
      // Get table structure
      const structureResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      writeStream.write(`\n-- Table: ${table}\n`);
      writeStream.write(`CREATE TABLE IF NOT EXISTS ${table} (\n`);
      
      const columns = structureResult.rows.map((col, idx) => {
        let def = `  ${col.column_name} ${col.data_type}`;
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        if (col.column_default) def += ` DEFAULT ${col.column_default}`;
        return def;
      }).join(',\n');
      
      writeStream.write(`${columns}\n);\n\n`);

      // Get table data
      const dataResult = await pool.query(`SELECT * FROM ${table} ORDER BY 1;`);
      
      if (dataResult.rows.length > 0) {
        writeStream.write(`-- Data for ${table} (${dataResult.rows.length} rows)\n`);
        
        for (const row of dataResult.rows) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return val;
          }).join(', ');
          
          writeStream.write(`INSERT INTO ${table} (${columns}) VALUES (${values});\n`);
        }
        writeStream.write(`\n`);
      }
    }

    writeStream.end();
    
    // Wait for write to complete, then compress
    await new Promise((resolve) => writeStream.on('close', resolve));
    
    console.log('Compressing backup...');
    const readStream = fs.createReadStream(backupFile);
    await pipeline(readStream, gzip, compressedStream);
    
    // Remove uncompressed file
    fs.unlinkSync(backupFile);
    
    // Get file size
    const stats = fs.statSync(compressedFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✓ Backup created successfully: ${compressedFile}`);
    console.log(`  Size: ${fileSizeMB} MB`);
    
    // List recent backups
    console.log('\nRecent backups:');
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.sql.gz'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
    
    if (backups.length > 0) {
      backups.forEach(backup => {
        const size = (fs.statSync(backup.path).size / (1024 * 1024)).toFixed(2);
        console.log(`  ${backup.name} (${size} MB) - ${backup.time.toISOString()}`);
      });
    } else {
      console.log('  No previous backups found');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('Error creating backup:', error);
    process.exit(1);
  }
}

backupDatabase();

