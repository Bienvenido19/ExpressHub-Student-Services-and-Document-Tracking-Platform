// Usage:
//   npm run seed         -> creates the first admin account (password printed once)
//   npm run seed:demo    -> also inserts sample students/requests/announcements (only if students is empty)
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@qcu.edu.ph').toLowerCase();
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Registrar Admin';

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expresshub',
  });

  const [existing] = await db.query('SELECT id FROM staff WHERE email = ?', [ADMIN_EMAIL]);
  if (existing.length) {
    console.log(`Admin ${ADMIN_EMAIL} already exists. Nothing changed.`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO staff (full_name, email, password_hash, role, department) VALUES (?,?,?,?,?)',
      [ADMIN_NAME, ADMIN_EMAIL, hash, 'admin', 'Credential Services']
    );
    console.log('\nAdmin account created.');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${password}   <- shown once; change it in Staff Settings\n`);
  }

  if (process.argv.includes('--demo')) {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM students');
    if (n > 0) {
      console.log('Students table is not empty; skipping demo data so your real records are untouched.');
    } else {
      const students = [
        ['25-0001', 'Maria Santos', 'maria.santos@example.com', 'College of Computer Studies'],
        ['25-0002', 'Juan Dela Cruz', 'juan.delacruz@example.com', 'College of Business'],
        ['24-0310', 'Ana Reyes', 'ana.reyes@example.com', 'College of Education'],
        ['23-0145', 'Carlo Mendoza', 'carlo.mendoza@example.com', 'College of Engineering'],
        ['22-0877', 'Liza Garcia', 'liza.garcia@example.com', 'College of Computer Studies'],
      ];
      for (const s of students)
        await db.query('INSERT INTO students (student_no, full_name, email, department) VALUES (?,?,?,?)', s);
      const [ids] = await db.query('SELECT id FROM students ORDER BY id');
      const reqs = [
        ['Official Academic Transcript', 'Graduate school application', 'Please include grading system.', 'processing', 6],
        ['Certificate of Enrollment', 'Scholarship requirement', null, 'new', 4],
        ['Graduation Clearance', 'Final semester clearance', 'Missing library clearance.', 'new', 3],
        ['Letter of Good Standing', 'Internship application', null, 'ready', 30],
        ['Official Transcript (Hard Copy)', 'Employment', null, 'new', 1],
      ];
      const year = new Date().getFullYear();
      for (let i = 0; i < reqs.length; i++) {
        const [type, purpose, notes, status, hoursAgo] = reqs[i];
        const reqNo = `REQ-${year}-${String(i + 1).padStart(3, '0')}`;
        await db.query(
          `INSERT INTO document_requests (request_no, student_id, document_type, purpose, notes, status, flagged, submitted_at, ready_at)
           VALUES (?,?,?,?,?,?,?, DATE_SUB(NOW(), INTERVAL ? HOUR),
                   IF(? = 'ready', DATE_SUB(NOW(), INTERVAL 2 HOUR), NULL))`,
          [reqNo, ids[i].id, type, purpose, notes, status, i === 2 ? 1 : 0, hoursAgo, status]
        );
      }
      await db.query(
        `INSERT INTO announcements (title, body, category) VALUES
         ('Enrollment schedule for next term', 'Enrollment opens on the date set by the Registrar. Check your college schedule.', 'enrollment'),
         ('Document request turnaround', 'Requests submitted through ExpressHub are targeted for release within 2 business days.', 'general')`
      );
      console.log('Demo students, requests, and announcements inserted.');
    }
  }
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
