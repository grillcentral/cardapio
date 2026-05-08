# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Node >=24 required)
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run check        # lint + typecheck + build (run before deploying)

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema to DB without migration (dev only)
npm run db:seed      # Seed initial restaurant/admin data
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_JWT_SECRET` | Signs admin JWT tokens (has hardcoded fallback — change in prod) |

## Architecture

### Data flow — dual menu strategy
`src/app/page.tsx` fetches `/api/menu` on mount. If the DB returns data, it uses it; otherwise it falls back to hardcoded arrays (`ALMOCO`, `NOITE`, `SEMPRE`) defined at the top of the same file. All API routes are hardcoded to `restaurantId: 1`.

### Auth — two separate systems
- **Admin** (`/admin/*`): JWT in HTTP-only `admin_token` cookie. Middleware at `src/middleware.ts` protects all `/admin` routes. Token signed/verified in `src/lib/auth.ts` using `jose`.
- **Customer**: localStorage only (`grillcentral_users`, `grillcentral_current_user`). No server-side session.

### Frontend
`src/app/page.tsx` is a single monolithic `"use client"` component (~1500 lines). It contains the cart logic, all modals (AuthModal, ItemModal, CartSidebar), WhatsApp quick-order, geolocation, and `IntersectionObserver`-based active category tracking. Cart state persists in localStorage (`grillcentral_cart`).

### Database
Prisma with `@prisma/adapter-pg` (native PostgreSQL driver, no ORM translation layer). All models are restaurant-scoped by `restaurantId`. Key models: `Restaurant`, `AdminUser`, `Category`, `Product`, `Order`, `OrderItem`, `OpeningHour`, `Banner`, `Customer`.

### Deployment
Railway with RAILPACK builder. Build command: `npm ci && npm run db:generate && npm run build`. Domain: `grillcardapio.com.br` — A record `66.33.22.241` DNS-only (no Cloudflare proxy), `www` CNAME to `cardapio-production-cf58.up.railway.app`.
