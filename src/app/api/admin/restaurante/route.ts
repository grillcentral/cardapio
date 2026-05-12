import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAdminFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: 1 },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        phone: true,
        whatsapp: true,
        address: true,
        logoUrl: true,
        bannerUrl: true,
        isActive: true,
        autoAcceptOrders: true,
        autoPrintOnAccept: true,
        deliveryMaxKm: true,
        deliveryPricePerKm: true,
        restaurantLat: true,
        restaurantLng: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
    }

    return NextResponse.json(restaurant);
  } catch (err) {
    console.error("Restaurant GET error:", err);
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
    const { name, description, phone, whatsapp, address, logoUrl, bannerUrl,
            autoAcceptOrders, autoPrintOnAccept,
            deliveryMaxKm, deliveryPricePerKm, restaurantLat, restaurantLng } = body;

    const updated = await prisma.restaurant.update({
      where: { id: 1 },
      data: {
        name: name !== undefined ? String(name) : undefined,
        description: description !== undefined ? (description || null) : undefined,
        phone: phone !== undefined ? (phone || null) : undefined,
        whatsapp: whatsapp !== undefined ? String(whatsapp) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        logoUrl: logoUrl !== undefined ? (logoUrl || null) : undefined,
        bannerUrl: bannerUrl !== undefined ? (bannerUrl || null) : undefined,
        autoAcceptOrders:  autoAcceptOrders  !== undefined ? Boolean(autoAcceptOrders)  : undefined,
        autoPrintOnAccept: autoPrintOnAccept !== undefined ? Boolean(autoPrintOnAccept) : undefined,
        deliveryMaxKm:     deliveryMaxKm     !== undefined ? Number(deliveryMaxKm)      : undefined,
        deliveryPricePerKm: deliveryPricePerKm !== undefined ? Number(deliveryPricePerKm) : undefined,
        restaurantLat: restaurantLat !== undefined ? (restaurantLat === null ? null : Number(restaurantLat)) : undefined,
        restaurantLng: restaurantLng !== undefined ? (restaurantLng === null ? null : Number(restaurantLng)) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Restaurant PUT error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
