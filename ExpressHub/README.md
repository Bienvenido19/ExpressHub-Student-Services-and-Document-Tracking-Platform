# ExpressHub starter

This project originally started as a **visual Next.js starter** and did not include a connected database layer. The database and admin-side data operations were intentionally not hooked up.

## Database setup

A MySQL connection layer and an importable starter schema are included.

1. In phpMyAdmin, select **Import**, choose `database/expresshub.sql`, and run the import. It creates an `expresshub` database and starter tables for admin/staff accounts, document types, document requests, announcements, and academic schedules. The document catalog is preloaded; no default admin account or password is created.
2. Copy `.env.example` to `.env.local`.
3. Set the database connection values:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=expresshub_user
   DB_PASSWORD=your_secret_password
   DB_NAME=expresshub
   ```

4. Give that MySQL user access to the database, then start the app and visit `http://localhost:3000/api/admin/health` to test the connection.

If your administrator already has a database, ask them for its host, port, database name, and a dedicated MySQL username/password. Importing this file creates a separate `expresshub` database; it does not merge with or modify an existing admin database. Connecting directly to an existing admin database requires matching its actual table names and schema. Do not use the MySQL root account in the app or commit `.env.local`.

## Open in Visual Studio Code

1. Extract the ZIP.
2. In Visual Studio Code, choose **File → Open Folder...** and select `expresshub-starter`.
3. Open **Terminal → New Terminal** and run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`.

Use Node.js 20 or newer. To verify the source, run `npm run build`, `npx tsc --noEmit`, and `npm run lint`.

The university contact details, location, address, and privacy wording are marked `REVIEW REQUIRED` in `lib/site-config.ts` or on the request page. Confirm them with the university before publishing.
