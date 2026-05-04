import { NextRequest, NextResponse } from "next/server";
import type { RunResult } from "better-sqlite3";
import getDb from "@/lib/db";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const db = getDb();
  const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
  if (!customer) return NextResponse.json(null);
  return NextResponse.json(customer);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone = (body.phone || "").replace(/\D/g, "");
  const { name, address, complement } = body;

  if (!phone || !name) return NextResponse.json({ error: "phone e name obrigatórios" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE customers SET name = ?, address = ?, complement = ?, updated_at = datetime('now','localtime')
      WHERE phone = ?
    `).run(name, address || null, complement || null, phone);
    const updated = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
    return NextResponse.json(updated);
  }

  const result = db.prepare(`
    INSERT INTO customers (phone, name, address, complement) VALUES (?, ?, ?, ?)
  `).run(phone, name, address || null, complement || null) as RunResult;

  const created = db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
