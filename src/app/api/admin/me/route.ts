import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        restaurantId: true,
        isActive: true,
        restaurant: {
          select: { name: true, slug: true, logoUrl: true },
        },
      },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    return NextResponse.json(admin);
  } catch (err) {
    console.error("Me error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
