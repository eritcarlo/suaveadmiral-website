const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Check suave_barbershop.db
const dbPath = path.join(__dirname, 'suave_barbershop.db');
console.log('Examining database:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Database opened successfully');
});

db.serialize(() => {
    // Get all tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error getting tables:', err.message);
            return;
        }
        
        console.log('\n=== TABLES IN suave_barbershop.db ===');
        if (tables.length === 0) {
            console.log('No tables found in database');
            db.close();
            return;
        }
        
        tables.forEach(table => {
            console.log(`\nTable: ${table.name}`);
        });
        
        // Get schema for each table
        let tableCount = 0;
        tables.forEach(table => {
            db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
                if (err) {
                    console.error(`Error getting schema for ${table.name}:`, err.message);
                } else {
                    console.log(`\n--- Schema for ${table.name} ---`);
                    columns.forEach(col => {
                        console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
                    });
                    
                    // Get row count
                    db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
                        if (err) {
                            console.error(`Error counting rows in ${table.name}:`, err.message);
                        } else {
                            console.log(`  Rows: ${result.count}`);
                        }
                        
                        tableCount++;
                        if (tableCount === tables.length) {
                            db.close();
                        }
                    });
                }
            });
        });
    });
});