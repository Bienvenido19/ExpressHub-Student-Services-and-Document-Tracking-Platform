import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "expresshub",
  ssl:
    process.env.DB_HOST && process.env.DB_HOST !== "localhost"
      ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
      : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params as any[]);
  return Array.isArray(rows) ? (rows as T[]) : ([rows] as T[]);
}

export async function ping() {
  const [rows] = await pool.execute("SELECT 1 AS ok");
  return rows;
}

export default pool;
