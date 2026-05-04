import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { restaurant: true },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const token = await signToken({
      sub: String(admin.id),
      email: admin.email,
      name: admin.name,
      role: admin.role,
      restaurantId: admin.restaurantId,
    });

    const res = NextResponse.json({
      ok: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        restaurantId: admin.restaurantId,
        restaurantName: admin.restaurant.name,
      },
    });

    res.cookies.set("admin_token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 8 * 3600,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function GET() {
  // Logout
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", "", {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
