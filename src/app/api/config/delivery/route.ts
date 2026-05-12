import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/config/delivery
 * Public endpoint — no auth required.
 * Used by the WhatsApp bot (LancheFlow) to fetch delivery configuration.
 */
export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: 1 },
      select: {
        deliveryMaxKm: true,
        deliveryPricePerKm: true,
        restaurantLat: true,
        restaurantLng: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    return NextResponse.json({
      deliveryMaxKm: restaurant.deliveryMaxKm,
      deliveryPricePerKm: restaurant.deliveryPricePerKm,
      restaurantLat: restaurant.restaurantLat,
      restaurantLng: restaurant.restaurantLng,
      hasLocation: restaurant.restaurantLat !== null && restaurant.restaurantLng !== null,
    });
  } catch (error) {
    console.error("GET /api/config/delivery error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
