import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) return NextResponse.json(null);
  return NextResponse.json(customer);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone = (body.phone || "").replace(/\D/g, "");
  const { name, address, complement } = body;

  if (!phone || !name)
    return NextResponse.json({ error: "phone e name obrigatórios" }, { status: 400 });

  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { name, address: address || null, complement: complement || null },
    create: { phone, name, address: address || null, complement: complement || null },
  });

  return NextResponse.json(customer, { status: 201 });
}
