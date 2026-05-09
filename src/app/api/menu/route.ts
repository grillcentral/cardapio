import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: 1 },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        whatsapp: true,
        address: true,
        logoUrl: true,
        bannerUrl: true,
      },
    });

    const categories = await prisma.category.findMany({
      where: { restaurantId: 1, isActive: true },
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            ingredients: true,
            isFeatured: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const result = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      emoji: cat.emoji,
      periodTag: cat.periodTag,
      sortOrder: cat.sortOrder,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        imageUrl: p.imageUrl,
        ingredients: p.ingredients ? (() => { try { return JSON.parse(p.ingredients as string); } catch { return []; } })() : [],
        isFeatured: p.isFeatured,
        sortOrder: p.sortOrder,
      })),
    }));

    return NextResponse.json({
      restaurant,
      categories: result,
    });
  } catch (err) {
    console.error("Menu GET error:", err);
    return NextResponse.json({ error: "Erro ao carregar cardápio." }, { status: 500 });
  }
}
