import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const hours = await prisma.openingHour.findMany({
      where: { restaurantId: 1 },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(hours);
  } catch (err) {
    console.error("Hours GET error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { hours } = body as {
      hours: Array<{
        dayOfWeek: number;
        openTime?: string;
        closeTime?: string;
        isOpen: boolean;
        periodName?: string;
      }>;
    };

    if (!Array.isArray(hours)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }

    // Delete existing and recreate
    await prisma.openingHour.deleteMany({ where: { restaurantId: 1 } });
    const created = await prisma.openingHour.createMany({
      data: hours.map((h) => ({
        restaurantId: 1,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime || null,
        closeTime: h.closeTime || null,
        isOpen: h.isOpen,
        periodName: h.periodName || null,
      })),
    });

    return NextResponse.json({ success: true, count: created.count });
  } catch (err) {
    console.error("Hours PUT error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
