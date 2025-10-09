CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , profile_pic TEXT);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP, time_id INTEGER, barber_id INTEGER, payment_method TEXT, status TEXT DEFAULT 'Pending', booking_date DATE, is_walk_in BOOLEAN DEFAULT 0, confirmed_by_admin BOOLEAN DEFAULT 0, reference_number TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
CREATE TABLE barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
, profile_pic TEXT, is_present BOOLEAN DEFAULT 1);
CREATE TABLE timeslots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barber_id INTEGER,
      time TEXT, available_date DATE, is_available BOOLEAN DEFAULT 1,
      FOREIGN KEY (barber_id) REFERENCES barbers(id)
    );
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
CREATE TABLE qr_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
