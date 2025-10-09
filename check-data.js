const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'suave_barbershop.db');
const db = new sqlite3.Database(dbPath);

console.log('=== SAMPLE DATA FROM suave_barbershop.db ===\n');

db.serialize(() => {
    // Check users table
    db.all("SELECT * FROM users LIMIT 5", (err, rows) => {
        if (err) {
            console.error('Error querying users:', err.message);
        } else {
            console.log('--- USERS TABLE (showing first 5) ---');
            rows.forEach(row => {
                console.log(`ID: ${row.id}, Email: ${row.email}, Role: ${row.role}, Name: ${row.full_name}, Phone: ${row.phone}`);
            });
        }
    });

    // Check barbers table
    db.all("SELECT * FROM barbers", (err, rows) => {
        if (err) {
            console.error('Error querying barbers:', err.message);
        } else {
            console.log('\n--- BARBERS TABLE ---');
            rows.forEach(row => {
                console.log(`ID: ${row.id}, Name: ${row.name}, Present: ${row.is_present}, Profile: ${row.profile_pic}`);
            });
        }
    });

    // Check bookings table
    db.all("SELECT * FROM bookings LIMIT 5", (err, rows) => {
        if (err) {
            console.error('Error querying bookings:', err.message);
        } else {
            console.log('\n--- BOOKINGS TABLE (showing first 5) ---');
            rows.forEach(row => {
                console.log(`ID: ${row.id}, User: ${row.user_id}, Service: ${row.service}, Barber: ${row.barber_id}, Date: ${row.booking_date}, Status: ${row.status}`);
            });
        }
    });

    // Check qr_settings table
    db.all("SELECT * FROM qr_settings", (err, rows) => {
        if (err) {
            console.error('Error querying qr_settings:', err.message);
        } else {
            console.log('\n--- QR SETTINGS TABLE ---');
            rows.forEach(row => {
                console.log(`ID: ${row.id}, Payment Method: ${row.payment_method}, QR Data: ${row.qr_code_data ? 'Present' : 'None'}`);
            });
        }
    });

    // Close after a short delay
    setTimeout(() => {
        db.close();
    }, 1000);
});