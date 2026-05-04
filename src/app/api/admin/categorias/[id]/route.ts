import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, emoji, periodTag, sortOrder, isActive } = body;

    const existing = await prisma.category.findFirst({
      where: { id: Number(id), restaurantId: 1 },
    });

    if (!existing) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    const updated = await prisma.category.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? String(name) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
        emoji: emoji !== undefined ? String(emoji) : undefined,
        periodTag: periodTag !== undefined ? (periodTag ? String(periodTag) : null) : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Category PUT error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.category.findFirst({
      where: { id: Number(id), restaurantId: 1 },
    });

    if (!existing) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    // Check if has products
    const productCount = await prisma.product.count({
      where: { categoryId: Number(id) },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Esta categoria tem ${productCount} produto(s). Mova ou remova os produtos primeiro.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Category DELETE error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
