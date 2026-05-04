import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      where: { restaurantId: 1 },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error("Categories GET error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, emoji, periodTag, sortOrder, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        restaurantId: 1,
        name: String(name),
        description: description ? String(description) : null,
        emoji: emoji ? String(emoji) : "🍽️",
        periodTag: periodTag ? String(periodTag) : null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error("Categories POST error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
