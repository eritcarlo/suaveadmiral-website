PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , profile_pic TEXT);
INSERT INTO users VALUES(4,'admin@example.com','$2b$10$JwcpPMeyc97pAfx5xUiwv.7jBqIOF/JmEtTJRzxRFSt51R6uZ8j56',NULL,NULL,'ADMIN','2025-09-15 14:09:57',NULL);
INSERT INTO users VALUES(5,'superadmin@example.com','$2b$10$5E.E7mhe2JfRiwujxXfkbObjna8bUJGhWUGwxJg5TserK.EveJ0F6',NULL,NULL,'SUPERADMIN','2025-09-15 14:09:57',NULL);
INSERT INTO users VALUES(10,'carlocute@gmail.com','$2b$10$MRD/jpjCY8qfvnJC1pBMd.xfGYdA1uNMV1PsD.uvt8U2jlLzLHxum',NULL,NULL,'USER','2025-09-15 15:35:58',NULL);
INSERT INTO users VALUES(11,'gelocute@gmail.com','$2b$10$NKJYhvxeW1P8VhI6dlbrQeHQrJWadKT9S18LVKK1sTNLpbaPAkuMO',NULL,NULL,'USER','2025-09-18 13:33:28',NULL);
INSERT INTO users VALUES(12,'meeko@gmail.com','$2b$10$UXLxdNyxkgOnWDsIvL3XUuPWHLQTa2AEvz3P2C0fUJdcYqH8gggyq',NULL,NULL,'USER','2025-09-18 20:24:32',NULL);
INSERT INTO users VALUES(13,'miko@gmail.com','$2b$10$rdF40GGCUrsUZbZe/yqWxuxMmciH.hYn1faoz0yL7SyqRpOb8krU6',NULL,NULL,'USER','2025-09-18 20:25:20',NULL);
INSERT INTO users VALUES(14,'sheed@gmail.com','$2b$10$ICwkEUXau8ZtiLAGbU3vw.LsMxIwK0K1XWOhP5iwD8NhmUM2s.kUa',NULL,NULL,'USER','2025-09-19 10:39:10',NULL);
INSERT INTO users VALUES(15,'marco@gmail.com','$2b$10$nfyWI9XPJOsLt4TQI9IYGOpDCHej1.fdwk2lhwDaSp4/Ex68spf/G',NULL,NULL,'USER','2025-09-19 10:40:24',NULL);
INSERT INTO users VALUES(16,'ocram@gmail.com','$2b$10$gKq5kgKXLEM0Mi4VNWFRJuZJ34nuXv46Yu7qyqQEZIlLMSJnZxN7C',NULL,NULL,'USER','2025-09-19 10:59:19',NULL);
INSERT INTO users VALUES(17,'jd@gmail.com','$2b$10$BndrCSWLx3.MramS5/.wZOAVZIjfKtNSrnPeWaJpwp.vGem3QCRUi',NULL,NULL,'USER','2025-09-19 11:07:42',NULL);
INSERT INTO users VALUES(18,'samsam@gmail.com','$2b$10$zpfdv54QaZh6475FneYoOecST.GTIVURIayIivCeOTN3HSXZPxQ9y',NULL,NULL,'USER','2025-09-19 11:15:40',NULL);
INSERT INTO users VALUES(19,'carlothecute@gmail.com','$2b$10$t3UHz//3jerpMOmgqX5cD.cR12m0SreRXoF1MVL/rb4UOxrMSjUii',NULL,NULL,'USER','2025-09-19 11:38:04',NULL);
INSERT INTO users VALUES(20,'tita@gmail.com','$2b$10$aW0vpM0p3.CUOneXzxkug.ZhFtOUTuCvHVa0OPGiu/SD2ySwil6Fy',NULL,NULL,'USER','2025-09-19 11:44:25',NULL);
INSERT INTO users VALUES(21,'naruto@gmail.com','$2b$10$OcsGZXOgvnxKW6SfdJNPMOyNN5sJA4lf37LiugrloPI.TQc7fb7CC',NULL,NULL,'USER','2025-09-19 11:52:44',NULL);
INSERT INTO users VALUES(22,'saske@gmail.com','$2b$10$jscZrzvegiiiGCoUSRPJnOkkrmo.7i34u/gNUzJqX/aYDj68UO.Jy',NULL,NULL,'USER','2025-09-19 11:57:47',NULL);
INSERT INTO users VALUES(24,'admin@suave.com','$2b$10$q2HyadIeRe0wiA.XdfSquOioEY2lfdqq9zzQlYzwqbymV7w/KcK1K',NULL,NULL,'ADMIN','2025-09-19 15:40:40',NULL);
INSERT INTO users VALUES(25,'carlolovesmikai@suave.com','$2b$10$YrFj.bifq9AvqvMXJbSI2evGulKHQFlxSwvrOWHzffNV.qPhw4AP.',NULL,NULL,'ADMIN','2025-09-19 15:43:00',NULL);
INSERT INTO users VALUES(26,'user@example.com','$2b$10$I0vCNpBHMRqtGjH9hNabjO7gUw2RbxtYsHwhOgJHr1EixpCr69zCS',NULL,NULL,'USER','2025-09-21 00:49:20',NULL);
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP, time_id INTEGER, barber_id INTEGER, payment_method TEXT, status TEXT DEFAULT 'Pending', booking_date DATE, is_walk_in BOOLEAN DEFAULT 0, confirmed_by_admin BOOLEAN DEFAULT 0, reference_number TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
INSERT INTO bookings VALUES(15,18,'Haircut','2025-09-19 11:15:55',39,15,'CASH','Paid',NULL,0,0,NULL);
INSERT INTO bookings VALUES(17,20,'Haircut','2025-09-19 11:44:54',32,18,'PAYMAYA','Done',NULL,0,0,NULL);
INSERT INTO bookings VALUES(18,21,'Haircut','2025-09-19 11:53:04',43,16,'GCASH','Done',NULL,0,0,NULL);
INSERT INTO bookings VALUES(26,10,'CUT AND SHAVE','2025-09-19 15:00:52',21,14,'GCASH','Confirmed',NULL,0,1,NULL);
INSERT INTO bookings VALUES(35,26,'HAIRCUT','2025-09-21 01:25:40',27,16,'gcash','Done','2025-09-21',0,1,'123457890');
CREATE TABLE barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
, profile_pic TEXT, is_present BOOLEAN DEFAULT 1);
INSERT INTO barbers VALUES(13,'Carlo the Barber','/uploads/barbers/barber-1758462686732-883195060.png',1);
INSERT INTO barbers VALUES(14,'Sheed the Barber',NULL,1);
INSERT INTO barbers VALUES(15,'Gelo the Barber',NULL,1);
INSERT INTO barbers VALUES(16,'Marco the Barber',NULL,1);
INSERT INTO barbers VALUES(17,'Ferdinand the Barber',NULL,1);
INSERT INTO barbers VALUES(18,'Erit The Carlo',NULL,1);
CREATE TABLE timeslots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barber_id INTEGER,
      time TEXT, available_date DATE, is_available BOOLEAN DEFAULT 1,
      FOREIGN KEY (barber_id) REFERENCES barbers(id)
    );
INSERT INTO timeslots VALUES(17,13,'09:00 AM',NULL,1);
INSERT INTO timeslots VALUES(18,13,'10:00 AM',NULL,1);
INSERT INTO timeslots VALUES(19,13,'11:00 AM',NULL,1);
INSERT INTO timeslots VALUES(20,14,'01:00 PM','2025-09-21',1);
INSERT INTO timeslots VALUES(21,14,'02:00 PM','2025-09-21',1);
INSERT INTO timeslots VALUES(22,14,'03:00 PM',NULL,1);
INSERT INTO timeslots VALUES(23,15,'09:30 AM',NULL,1);
INSERT INTO timeslots VALUES(24,15,'10:30 AM',NULL,1);
INSERT INTO timeslots VALUES(25,15,'11:30 AM',NULL,1);
INSERT INTO timeslots VALUES(26,16,'01:30 PM',NULL,1);
INSERT INTO timeslots VALUES(27,16,'02:30 PM',NULL,1);
INSERT INTO timeslots VALUES(28,17,'03:00 PM',NULL,1);
INSERT INTO timeslots VALUES(29,17,'04:00 PM',NULL,1);
INSERT INTO timeslots VALUES(30,18,'11:00 AM','2025-09-22',0);
INSERT INTO timeslots VALUES(31,18,'01:00 PM',NULL,1);
INSERT INTO timeslots VALUES(32,18,'05:00 PM',NULL,1);
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
INSERT INTO notifications VALUES(1,26,'Your booking for HAIRCUT on 2025-09-21 has been confirmed!','booking',0,'2025-09-21 00:53:32');
INSERT INTO notifications VALUES(2,10,'Your booking has been confirmed by admin!','confirmation',0,'2025-09-21 01:06:04');
INSERT INTO notifications VALUES(3,26,'Your booking for HAIRCUT on 2025-09-21 has been confirmed!','booking',0,'2025-09-21 01:20:30');
INSERT INTO notifications VALUES(4,26,'Your booking has been confirmed by admin!','confirmation',0,'2025-09-21 01:20:58');
INSERT INTO notifications VALUES(5,26,'Your booking for HAIRCUT on 2025-09-21 has been confirmed!','booking',0,'2025-09-21 01:25:40');
INSERT INTO notifications VALUES(6,26,'Your booking has been confirmed by admin!','confirmation',0,'2025-09-21 01:26:10');
CREATE TABLE qr_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO qr_settings VALUES(6,'paymaya','https://2.img-dpreview.com/files/p/E~C1000x0S4000x4000T1200x1200~articles/3925134721/0266554465.jpeg','2025-09-21 01:16:05');
INSERT INTO qr_settings VALUES(7,'gcash','https://clients.web.com.ph/index.php?rp=/images/kb/98_webgcash.png','2025-09-21 01:17:53');
INSERT INTO sqlite_sequence VALUES('users',26);
INSERT INTO sqlite_sequence VALUES('bookings',35);
INSERT INTO sqlite_sequence VALUES('barbers',18);
INSERT INTO sqlite_sequence VALUES('timeslots',48);
INSERT INTO sqlite_sequence VALUES('notifications',6);
INSERT INTO sqlite_sequence VALUES('qr_settings',23);
COMMIT;
