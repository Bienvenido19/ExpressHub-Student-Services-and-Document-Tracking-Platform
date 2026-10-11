require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET in .env (see .env.example).');
  process.exit(1);
}

/* ------------------------------------------------------------------
 * STUDENT TABLE MAPPING
 * You already have a students table. If your table/column names differ,
 * change ONLY these values; every query below uses them.
 * ------------------------------------------------------------------ */
const STUDENTS_TABLE = 'students';
const STUDENT_COLS = {
  id: 'id',                 // primary key referenced by document_requests.student_id
  student_no: 'student_no',
  full_name: 'full_name',
  email: 'email',
  department: 'department',
};
const S = (c) => `s.${STUDENT_COLS[c]}`;
const STUDENT_JOIN = `JOIN ${STUDENTS_TABLE} s ON ${S('id')} = r.student_id`;

const STATUSES = ['new', 'processing', 'ready', 'completed'];
const STATUS_LABELS = {
  new: 'Received',
  processing: 'In review and document preparation',
  ready: 'Ready for claiming / digital dispatch',
  completed: 'Completed and archived',
};
const CATEGORIES = ['general', 'enrollment', 'schedule', 'deadline', 'event'];

/* ------------------------------ DB ------------------------------ */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'expresshub',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+08:00', // Philippine time, so "Completed Today" matches the staff's day
});
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+08:00'"));
/* ----------------------------- Email ----------------------------- */
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendStatusEmail(r, newStatus) {
  const subject = `[ExpressHub] ${r.request_no}: ${STATUS_LABELS[newStatus]}`;
  const text =
    `Hello ${r.student_name},\n\n` +
    `Your request ${r.request_no} (${r.document_type}) is now: ${STATUS_LABELS[newStatus]}.\n\n` +
    `You can check the details anytime in ExpressHub.\n\n- University Registrar`;
  let result = 'logged_only';
  let error = null;
  try {
    if (mailer) {
      await mailer.sendMail({ from: process.env.MAIL_FROM, to: r.student_email, subject, text });
      result = 'sent';
    } else {
      console.log(`[email not configured] would send to ${r.student_email}: ${subject}`);
    }
  } catch (e) {
    result = 'failed';
    error = String(e.message).slice(0, 250);
    console.error('Email error:', e.message);
  }
  await pool.query(
    'INSERT INTO email_log (request_id, to_email, subject, result, error) VALUES (?,?,?,?,?)',
    [r.id, r.student_email, subject, result, error]
  );
  return result;
}

/* ----------------------------- App ----------------------------- */
const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // The Tailwind Play CDN needs inline/eval. For production, compile Tailwind and remove these.
        scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ['https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(
  session({
    name: 'eh.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // one shift
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const requireAuth = (req, res, next) =>
  req.session.staff ? next() : res.status(401).json({ error: 'Not signed in' });
const asId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/* ------------------------------ Auth ------------------------------ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

// Pre-computed hash so unknown emails take the same time as wrong passwords
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

app.post(
  '/api/login',
  loginLimiter,
  wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, department FROM staff WHERE email = ? AND is_active = 1',
      [email]
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password' });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Could not start session' });
      req.session.staff = {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
      };
      res.json({ staff: req.session.staff });
    });
  })
);

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('eh.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ staff: req.session.staff }));

app.put(
  '/api/me/password',
  requireAuth,
  wrap(async (req, res) => {
    const current = String(req.body.current || '');
    const next = String(req.body.next || '');
    if (next.length < 10 || next.length > 72)
      return res.status(400).json({ error: 'New password must be 10 to 72 characters' });
    const [rows] = await pool.query('SELECT password_hash FROM staff WHERE id = ?', [req.session.staff.id]);
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash)))
      return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(next, 12);
    await pool.query('UPDATE staff SET password_hash = ? WHERE id = ?', [hash, req.session.staff.id]);
    res.json({ ok: true });
  })
);

/* ------------------------- Dashboard / queue ------------------------- */
app.get(
  '/api/summary',
  requireAuth,
  wrap(async (req, res) => {
    const [[row]] = await pool.query(`
      SELECT
        COALESCE(SUM(status = 'new'), 0)        AS new_count,
        COALESCE(SUM(status = 'processing'), 0) AS processing_count,
        COALESCE(SUM(DATE(ready_at) = CURDATE()), 0) AS completed_today,
        COALESCE(SUM(status <> 'completed'), 0) AS open_count,
        COUNT(*) AS total
      FROM document_requests`);
    res.json({
      newCount: Number(row.new_count),
      processingCount: Number(row.processing_count),
      completedToday: Number(row.completed_today),
      openCount: Number(row.open_count),
      total: Number(row.total),
    });
  })
);

app.get(
  '/api/requests',
  requireAuth,
  wrap(async (req, res) => {
    const where = [];
    const params = [];
    const filter = String(req.query.status || 'all');
    if (filter !== 'all') {
      const status = filter === 'pending' ? 'new' : filter;
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
      where.push('r.status = ?');
      params.push(status);
    }
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      where.push(`(r.request_no LIKE ? OR ${S('student_no')} LIKE ? OR ${S('full_name')} LIKE ?)`);
      params.push(like, like, like);
    }
    const [rows] = await pool.query(
      `SELECT r.id, r.request_no, r.document_type, r.status, r.flagged, r.submitted_at,
              ${S('student_no')} AS student_no, ${S('full_name')} AS student_name
         FROM document_requests r ${STUDENT_JOIN}
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY (r.status = 'completed') ASC, r.flagged DESC, r.submitted_at ASC
        LIMIT 200`,
      params
    );
    res.json({ requests: rows });
  })
);

app.get(
  '/api/requests/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query(
      `SELECT r.id, r.request_no, r.document_type, r.purpose, r.notes, r.status, r.flagged,
              r.submitted_at, r.processing_started_at, r.ready_at, r.completed_at,
              ${S('student_no')} AS student_no, ${S('full_name')} AS student_name,
              ${S('email')} AS student_email, ${S('department')} AS department
         FROM document_requests r ${STUDENT_JOIN}
        WHERE r.id = ?`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: rows[0] });
  })
);

app.patch(
  '/api/requests/:id/status',
  requireAuth,
  wrap(async (req, res) => {
    const id = asId(req.params.id);
    const status = String(req.body.status || '');
    const notify = req.body.notify === true;
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const conn = await pool.getConnection();
    let row;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT r.id, r.request_no, r.document_type, r.status, r.ready_at,
                ${S('full_name')} AS student_name, ${S('email')} AS student_email
           FROM document_requests r ${STUDENT_JOIN}
          WHERE r.id = ? FOR UPDATE`,
        [id]
      );
      row = rows[0];
      if (!row) {
        await conn.rollback();
        return res.status(404).json({ error: 'Request not found' });
      }
      if (row.status === status) {
        await conn.rollback();
        return res.status(400).json({ error: 'Request is already in that status' });
      }

      const sets = ['status = ?', 'handled_by = ?'];
      const params = [status, req.session.staff.id];
      if (status === 'new') sets.push('processing_started_at = NULL', 'ready_at = NULL', 'completed_at = NULL');
      if (status === 'processing') {
        sets.push('processing_started_at = COALESCE(processing_started_at, NOW())', 'ready_at = NULL', 'completed_at = NULL');
      }
      if (status === 'ready') sets.push('ready_at = COALESCE(ready_at, NOW())', 'completed_at = NULL');
      if (status === 'completed') sets.push('ready_at = COALESCE(ready_at, NOW())', 'completed_at = NOW()');

      await conn.query(`UPDATE document_requests SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      await conn.query(
        'INSERT INTO request_logs (request_id, staff_id, action, old_status, new_status) VALUES (?,?,?,?,?)',
        [id, req.session.staff.id, 'status_change', row.status, status]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    let email = 'skipped';
    if (notify) email = await sendStatusEmail(row, status);
    res.json({ ok: true, status, email });
  })
);

app.patch(
  '/api/requests/:id/flag',
  requireAuth,
  wrap(async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const flagged = req.body.flagged === true ? 1 : 0;
    const [r] = await pool.query('UPDATE document_requests SET flagged = ? WHERE id = ?', [flagged, id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Request not found' });
    await pool.query('INSERT INTO request_logs (request_id, staff_id, action) VALUES (?,?,?)', [
      id,
      req.session.staff.id,
      flagged ? 'flagged' : 'unflagged',
    ]);
    res.json({ ok: true, flagged: !!flagged });
  })
);

/* --------------------------- Announcements --------------------------- */
function validateAnnouncement(body) {
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  const category = String(body.category || 'general');
  if (!title || title.length > 150) return { error: 'Title is required (max 150 characters)' };
  if (!text || text.length > 5000) return { error: 'Message is required (max 5000 characters)' };
  if (!CATEGORIES.includes(category)) return { error: 'Invalid category' };
  return { title, body: text, category, is_published: body.is_published === false ? 0 : 1 };
}

app.get(
  '/api/announcements',
  requireAuth,
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.body, a.category, a.is_published, a.created_at, a.updated_at,
              st.full_name AS author
         FROM announcements a LEFT JOIN staff st ON st.id = a.created_by
        ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json({ announcements: rows });
  })
);

app.post(
  '/api/announcements',
  requireAuth,
  wrap(async (req, res) => {
    const v = validateAnnouncement(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const [r] = await pool.query(
      'INSERT INTO announcements (title, body, category, is_published, created_by) VALUES (?,?,?,?,?)',
      [v.title, v.body, v.category, v.is_published, req.session.staff.id]
    );
    res.status(201).json({ id: r.insertId });
  })
);

app.put(
  '/api/announcements/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = asId(req.params.id);
    const v = validateAnnouncement(req.body);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    if (v.error) return res.status(400).json({ error: v.error });
    const [r] = await pool.query(
      'UPDATE announcements SET title=?, body=?, category=?, is_published=? WHERE id=?',
      [v.title, v.body, v.category, v.is_published, id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ ok: true });
  })
);

app.delete(
  '/api/announcements/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const [r] = await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ ok: true });
  })
);

/* ------------------- Verification logs and telemetry ------------------- */
app.get(
  '/api/logs',
  requireAuth,
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT l.id, l.action, l.old_status, l.new_status, l.created_at,
              r.request_no, st.full_name AS staff_name
         FROM request_logs l
         JOIN document_requests r ON r.id = l.request_id
         LEFT JOIN staff st ON st.id = l.staff_id
        ORDER BY l.created_at DESC, l.id DESC LIMIT 150`
    );
    res.json({ logs: rows });
  })
);

// Measures the project objective: average turnaround (submitted -> ready), baseline 72h, target 48h.
app.get(
  '/api/telemetry',
  requireAuth,
  wrap(async (req, res) => {
    const [[all]] = await pool.query(
      `SELECT COUNT(*) AS n, AVG(TIMESTAMPDIFF(MINUTE, submitted_at, ready_at)) / 60 AS avg_h
         FROM document_requests WHERE ready_at IS NOT NULL`
    );
    const [[recent]] = await pool.query(
      `SELECT COUNT(*) AS n, AVG(TIMESTAMPDIFF(MINUTE, submitted_at, ready_at)) / 60 AS avg_h
         FROM document_requests
        WHERE ready_at IS NOT NULL AND ready_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [byType] = await pool.query(
      `SELECT document_type, COUNT(*) AS n, AVG(TIMESTAMPDIFF(MINUTE, submitted_at, ready_at)) / 60 AS avg_h
         FROM document_requests WHERE ready_at IS NOT NULL
        GROUP BY document_type ORDER BY n DESC`
    );
    const r1 = (v) => (v === null ? null : Math.round(Number(v) * 10) / 10);
    res.json({
      baselineHours: 72,
      targetHours: 48,
      allTime: { count: Number(all.n), avgHours: r1(all.avg_h) },
      last30Days: { count: Number(recent.n), avgHours: r1(recent.avg_h) },
      byType: byType.map((t) => ({ documentType: t.document_type, count: Number(t.n), avgHours: r1(t.avg_h) })),
    });
  })
);

/* ------------------------------ Errors ------------------------------ */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`ExpressHub admin running on http://localhost:${port}`));
