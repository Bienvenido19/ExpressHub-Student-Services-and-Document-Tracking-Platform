# ExpressHub Admin (staff side)

Node.js + Express + MySQL. Serves the staff workstation from your template and a JSON API.

## Run it
1. Install Node 18+ and MySQL (XAMPP's MySQL works).
2. `npm install`
3. Import `schema.sql` (phpMyAdmin or `mysql -u root < schema.sql`).
   - You already have a students table: delete that block from the file, then edit the
     `STUDENT_COLS` mapping at the top of `server.js` to match your real column names.
   - `document_requests.student_id` must match the type of your students primary key.
4. `cp .env.example .env`, then fill in DB details and a long random `SESSION_SECRET`.
5. `npm run seed` creates the first admin (password printed once).
   `npm run seed:demo` also adds sample data, but only if the students table is empty.
6. `npm start`, then open http://localhost:3000

## Connecting the student side
The student app should INSERT into `document_requests` (`request_no`, `student_id`, `document_type`,
`purpose`, `notes`; status defaults to `new`, `submitted_at` to now). Announcements marked
`is_published = 1` are what students should display. If you already store requests in your own table,
rename the columns in `server.js` queries or create a VIEW named `document_requests`.

## What each screen does
- Request Queue: live counts, filters, search (press `/`), status updates, flag, printable routing slip.
- Manage Announcements: create, edit, hide, delete.
- Verification Logs: audit trail of every status change and flag.
- System Telemetry: average turnaround (submitted to Ready) vs the 72 h baseline and 48 h target.
- Staff Settings: change password.

## Security notes
Passwords hashed with bcrypt, parameterized SQL only, login rate limit, HttpOnly session cookie,
all database text HTML-escaped on screen. For production: serve over HTTPS with `NODE_ENV=production`,
compile Tailwind instead of using the CDN (then tighten the CSP in `server.js`), and swap the in-memory
session store for a persistent one (e.g. express-mysql-session).
Turnaround is measured in calendar hours, not business days.
