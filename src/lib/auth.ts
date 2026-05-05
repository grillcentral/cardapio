import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "grillcentral_super_secret_jwt_2025_change_in_production"
);

export interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  restaurantId: number;
}

export async function signToken(payload: AdminTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

export async function getAdminFromRequest(req: NextRequest): Promise<AdminTokenPayload | null> {
  const cookie = req.cookies.get("admin_token");
  if (!cookie?.value) return null;
  return verifyToken(cookie.value);
}
