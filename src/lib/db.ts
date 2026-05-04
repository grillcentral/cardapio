import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "lanche.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phone      TEXT    UNIQUE NOT NULL,
      name       TEXT    NOT NULL,
      address    TEXT,
      complement TEXT,
      created_at TEXT    DEFAULT (datetime('now','localtime')),
      updated_at TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER REFERENCES customers(id),
      items        TEXT    NOT NULL,
      subtotal     REAL    NOT NULL,
      delivery_fee REAL    NOT NULL DEFAULT 0,
      total        REAL    NOT NULL,
      order_type   TEXT    NOT NULL,
      payment      TEXT    NOT NULL,
      neighborhood TEXT,
      address_json TEXT,
      status       TEXT    DEFAULT 'recebido',
      created_at   TEXT    DEFAULT (datetime('now','localtime'))
    );
  `);

  return _db;
}

export default getDb;
