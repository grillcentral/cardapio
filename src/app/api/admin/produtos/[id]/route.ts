import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: { id: Number(id), restaurantId: 1 },
      include: { category: { select: { id: true, name: true, emoji: true } } },
    });

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ...product, price: Number(product.price) });
  } catch (err) {
    console.error("Product GET error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, price, categoryId, imageUrl, isActive, isFeatured, sortOrder } = body;

    const existing = await prisma.product.findFirst({
      where: { id: Number(id), restaurantId: 1 },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? String(name) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        categoryId: categoryId !== undefined ? Number(categoryId) : undefined,
        imageUrl: imageUrl !== undefined ? (imageUrl ? String(imageUrl) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      },
      include: { category: { select: { id: true, name: true, emoji: true } } },
    });

    return NextResponse.json({ ...updated, price: Number(updated.price) });
  } catch (err) {
    console.error("Product PUT error:", err);
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
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    const existing = await prisma.product.findFirst({
      where: { id: Number(id), restaurantId: 1 },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    if (hard) {
      await prisma.product.delete({ where: { id: Number(id) } });
    } else {
      await prisma.product.update({
        where: { id: Number(id) },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Product DELETE error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
