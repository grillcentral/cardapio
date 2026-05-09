import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    const where: Record<string, unknown> = { restaurantId: 1 };

    if (categoryId) where.categoryId = Number(categoryId);
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, emoji: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const result = products.map((p) => ({
      ...p,
      price: Number(p.price),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Products GET error:", err);
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
    const { name, description, price, categoryId, imageUrl, ingredients, isActive, isFeatured, sortOrder } = body;

    if (!name || !price || !categoryId) {
      return NextResponse.json({ error: "Nome, preço e categoria são obrigatórios." }, { status: 400 });
    }

    // ingredients: vem como string[] do form, salva como JSON
    const ingredientsJson = Array.isArray(ingredients) && ingredients.length > 0
      ? JSON.stringify(ingredients.map(String).filter(Boolean))
      : null;

    const product = await prisma.product.create({
      data: {
        restaurantId: 1,
        categoryId: Number(categoryId),
        name: String(name),
        description: description ? String(description) : null,
        price: Number(price),
        imageUrl: imageUrl ? String(imageUrl) : null,
        ingredients: ingredientsJson,
        isActive: isActive !== false,
        isFeatured: isFeatured === true,
        sortOrder: Number(sortOrder) || 0,
      },
      include: { category: { select: { id: true, name: true, emoji: true } } },
    });

    return NextResponse.json({ ...product, price: Number(product.price) }, { status: 201 });
  } catch (err) {
    console.error("Products POST error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
