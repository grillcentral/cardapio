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

`/api/menu` response format: `{ restaurant: {...}, categories: [{ id, name, products: [{ id, name, price, description, isActive?, ... }] }] }`.
Note: `isActive` is **not returned** by the menu API (comes as null) — treat null as active.

### Auth — two separate systems
- **Admin** (`/admin/*`): JWT in HTTP-only `admin_token` cookie. Middleware at `src/middleware.ts` protects all `/admin` routes. Token signed/verified in `src/lib/auth.ts` using `jose`.
- **Customer**: localStorage only (`grillcentral_users`, `grillcentral_current_user`). No server-side session.

### Frontend
`src/app/page.tsx` is a single monolithic `"use client"` component (~1500 lines). It contains the cart logic, all modals (AuthModal, ItemModal, CartSidebar), WhatsApp quick-order, geolocation, and `IntersectionObserver`-based active category tracking. Cart state persists in localStorage (`grillcentral_cart`).

### Database
Prisma with `@prisma/adapter-pg` (native PostgreSQL driver, no ORM translation layer). All models are restaurant-scoped by `restaurantId`. Key models: `Restaurant`, `AdminUser`, `Category`, `Product`, `Order`, `OrderItem`, `OpeningHour`, `Banner`, `Customer`.

### Deployment
Railway with RAILPACK builder. Build command: `npm ci && npm run db:generate && npm run build`. Domain: `grillcardapio.com.br` — A record `66.33.22.241` DNS-only (no Cloudflare proxy), `www` CNAME to `cardapio-production-cf58.up.railway.app`.

### `/api/orders` validation rules (critical)
- `customer_phone`: digits only, 10–11 chars (strip DDI 55 before sending)
- `payment`: exact enum — `"Pix"`, `"Dinheiro"`, `"Cartão de Crédito"`, `"Cartão de Débito"`, `"Vale Alimentação"`, `"A confirmar"`
- `items[].qty`: integer ≥ 1 (NOT `quantity`)
- `items[].obs`: string or null (NOT array)
- `order_type`: `"delivery"`, `"retirada"`, or `"whatsapp_direct"`
- Prices are **recalculated from DB** when `productId` is provided — client-sent price is ignored

---

## VPS Infrastructure

| Service | Address |
|---|---|
| VPS IP | `24.144.95.205` |
| n8n | `http://24.144.95.205:5678` |
| Evolution API | `http://24.144.95.205:8080` (external) / `http://evolution-api:8080` (internal Docker) |

### n8n
- **API Key** (in PS history): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3OTA4ZjY4Zi0zOTlhLTRiY2UtYWY2Ni0zMWExMTExYTFhOGQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2M4MWYxOWItMDYyNy00YmZmLWJkNTgtYjQwZTYxN2Q1MWY5IiwiaWF0IjoxNzc2NjQ4NDE4LCJleHAiOjE3NzkxNTk2MDB9.KssibdfEkvOkMsoLUrjU5IM0V2lgjIxTmlmWmZq6xEs`
- **PUT workflow**: `PUT /api/v1/workflows/{id}` — body must contain only `name`, `nodes`, `connections`, `settings`. The `active` field is read-only. Settings only accepts `executionOrder` and `callerPolicy` (no `binaryMode`, no `availableInMCP`).
- **Activate**: `POST /api/v1/workflows/{id}/activate`

### Evolution API
- **API Key**: `ea6325bd7f51e1143bb659457870010cec875fb6f32997f6`
- **Instance grillcentral**: WhatsApp number `+55 48 98836-2576` — active, connected
- **Instance viatec**: separate instance — DO NOT touch
- **Webhook** configured on grillcentral: `http://24.144.95.205:5678/webhook/lancheflow`, event `MESSAGES_UPSERT`

---

## LancheFlow — WhatsApp Bot

### Files
| File | Description |
|---|---|
| `CLAUDE PEGUE AQUI/LancheFlow.json` | Original with `{{PLACEHOLDERS}}` |
| `CLAUDE PEGUE AQUI/LancheFlow_READY.json` | Placeholders replaced, imported to n8n |
| `CLAUDE PEGUE AQUI/LancheFlow_V2.json` | Priority 1 applied (real order creation) |
| `CLAUDE PEGUE AQUI/LancheFlow_V3.json` | Priority 2 applied (real catalog) |
| `CLAUDE PEGUE AQUI/LancheFlow_V3_WORKING.json` | **Immutable snapshot** of V3 (MD5: A7585E9EE146DFFE118BCBC51E827777) |
| `CLAUDE PEGUE AQUI/LancheFlow_V4_HUMANO_DRAFT.json` | Working copy — human/manual mode |
| `CLAUDE PEGUE AQUI/LancheFlow_V4_WORKING.json` | **Immutable snapshot** of V4 production (MD5: FD078892E124079A355038C51D3D3FAD) |

### n8n Workflow
- **ID**: `S0pDUdOIqPNoozru`
- **Name**: LancheFlow
- **Status**: ✅ Active
- **Current version**: V4 (human/manual mode)

### State machine (cliente.etapa)
```
nova_conversa → aguardando_item → aguardando_complemento
  → aguardando_tipo_entrega → aguardando_endereco
  → aguardando_pagamento → aguardando_tipo_cartao (se "cartão" genérico)
  → aguardando_confirmacao → pedido_fechado
```

### Priority 1 — Real order creation ✅ (deployed)
- Replaced `PDVAdapter.createOrder()` stub with real `POST https://grillcardapio.com.br/api/orders`
- Phone normalization: strip DDI 55 prefix if 12–13 digits
- `MOCK_TO_REAL_ID` mapping (string mock IDs → real integer DB IDs)
- Payment disambiguation: `"cartão"` alone → asks crédito/débito (state `aguardando_tipo_cartao`)

### Priority 3 — Modo humano/manual ✅ (deployed 2026-05-09)
Human mode lets a real operator take over a WhatsApp conversation:
- **Client trigger**: "quero falar com atendente/humano/pessoa/gerente/falar com alguém/quero falar com" → bot replies "Entendido!" and sets `atendimentoHumano=true` + `sessao.estado='humano'`
- **Blocking**: subsequent client messages silently dropped (`podeResponder=false`) while in human mode
- **Operator reactivation**: operator sends `fromMe=true` message with `/auto`, `voltar bot`, `reativar atendimento`, or `reativar bot` → `atendimentoHumano=false`
- **Client reactivation**: client sends "bot", "voltar bot", "reativar atendimento", "reativar bot", "atendimento automático/automatico", `/auto` → same reset
- **Auto-reset**: 30 min of operator inactivity → `atendimentoHumano=false` automatically
- **Dual flag**: both `staticData.memoriaClientes[jid].atendimentoHumano` AND `staticData.sessoes[jid].estado='humano'` are set
- **Routing fix**: `isHumanTrigger` flag in Normalizar forces routing to Processador IA even for first-visit sessions (bypasses Menu Principal)
- **Logs**: all human mode events logged in `staticData.logsHumano` (last 200 entries)

**Changes in V4 (vs V3):**
- Normalizar (Change 1): expanded `PALAVRAS_RESET_BOT` list
- Normalizar (Change 2): `fromMe` block — operator reactivation via `/auto`/`voltar bot` etc.
- Normalizar (Change 3): `bloqueadoPorHumano` block — logs reactivation events
- Normalizar (Change 6): `isHumanTrigger` flag detection pre-routing
- Motor de Estado (Change 7): routing override — `isHumanTrigger` forces `rota='processador'`
- Processador IA (Change 4): REATIVACAO BOT block at top of code
- Processador IA (Change 8): `dados.isHumanTrigger` early check (before "quero pedir" regex can fire)
- Processador IA (Change 5): enhanced human trigger at line ~467 (backup regex check)

### Priority 2 — Real catalog via API ✅ (deployed 2026-05-09)
- Fetches `GET /api/menu` with 5-min cache in `staticData.menuCache`
- `MOCK_PRODUCTS_FALLBACK` with real integer IDs as safety net
- Fuzzy matching 3 tiers: exact name → contained → word scoring with STOP_WORDS
- `isActive === false` check (NOT `!isActive` — API returns null for active products)
- `productId` is integer-safe: `(typeof i.productId === 'number') ? i.productId : MOCK_TO_REAL_ID[...]`

### Known MOCK_TO_REAL_ID mapping (fallback still valid)
```
xs001→67  xc001→68  xcal001→69  xcos001→70  xb001→71
xfm001→72  xa001→73  xf001→74
pan001→83  pan002→84  pan003→85
batm001→92  batg001→93  batbm001→94  batbg001→95
cer001→96  cer002→97  ref001→98  ref002→99  ref003→100  agua001→101
```

### Real product prices (from DB, 2026-05-09)
Xis Salada (67) = R$25,50 | Xis Coração (68) = R$29,50
Note: fallback prices differ from DB — fallback is last resort only.

### Test results
- **Order #12** created 2026-05-09: Xis Salada (67) + Pão de Alho Negro Costela (85) + Refrigerante Lata (98) | Total R$71,40 | Retirada | Pix ✅
- Fake phone numbers (e.g. 5548911111111) cause Evolution API 400 on send, but order IS created in DB

### n8n Code node tips
- Use `await this.helpers.httpRequest({...})` for HTTP calls (not fetch/axios)
- Use `$getWorkflowStaticData('global')` for persistent state across executions
- `staticData` IS persisted even when execution fails (confirmed)
- PowerShell: ALL transformations must run in ONE command block — variables do NOT persist between tool calls

---

## Pending Tasks

| Task | Status | Notes |
|---|---|---|
| Deploy auto-accept schema to Railway | ⏳ Pending | 3 new columns: `autoAcceptOrders`, `autoPrintOnAccept`, `autoAccepted` — need `prisma db push` on Railway |
| LancheFlow Priority 3 (frete por bairro) | 🔜 Future | Currently `deliveryFee = 0` hardcoded |
| LancheFlow Priority 4 (audio/Whisper) | 🔜 Future | Nodes exist but not integrated with order flow |
