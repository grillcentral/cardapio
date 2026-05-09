# ARCHITECTURE.md
> Fluxo completo do sistema Grill Central — atualizado 2026-05-09

---

## Visão macro

```
CLIENTE WHATSAPP
      │
      ▼
┌─────────────────┐
│  Evolution API  │  http://24.144.95.205:8080
│ instância:      │  (container Docker interno: evolution-api:8080)
│ grillcentral    │  WhatsApp: +55 48 98836-2576
└────────┬────────┘
         │ webhook MESSAGES_UPSERT
         ▼
┌─────────────────┐
│     n8n         │  http://24.144.95.205:5678
│  LancheFlow V3  │  Workflow ID: S0pDUdOIqPNoozru
│  (24 nós)       │
└────────┬────────┘
         │ state machine + LLM fallback
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
┌──────────┐          ┌──────────────┐
│ OpenAI   │          │ Grill Central│  https://grillcardapio.com.br
│ GPT-4o   │          │    API       │  Railway (66.33.22.241)
│ (fallback│          │              │
│  LLM)    │          │ GET /api/menu│
└──────────┘          │ POST /api/   │
                      │    orders    │
                      └──────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  PostgreSQL DB │  Railway managed
                    │  (Prisma ORM)  │
                    └──────┬─────────┘
                           │
              ┌────────────┴─────────────┐
              │                          │
              ▼                          ▼
   ┌─────────────────┐       ┌─────────────────┐
   │  /admin/pedidos │       │    /cozinha      │
   │  (painel admin) │       │  (tela cozinha)  │
   └────────┬────────┘       └────────┬─────────┘
            │                         │
            ▼                         ▼
   ┌─────────────────┐       ┌─────────────────┐
   │   Impressora    │       │   Impressora    │
   │ térmica 80mm    │       │ térmica 80mm    │
   │ (window.print)  │       │ (window.print)  │
   └─────────────────┘       └─────────────────┘
```

---

## Fluxo detalhado — pedido via WhatsApp

```
1. Cliente envia mensagem no WhatsApp
        │
        ▼
2. Evolution API (grillcentral)
   • Recebe mensagem
   • Dispara webhook POST → n8n /webhook/lancheflow
        │
        ▼
3. n8n — nó "Normalizar"
   • Extrai: remoteJid, mensagem, pushName, messageType, localização
   • Detecta: fromMe, isGroup, isNewsletter
   • Limpa número: remove @s.whatsapp.net
   • Verifica bloqueio por atendimento humano (30min após msg do admin)
   • Define: podeResponder = true/false
        │
        ▼
4. n8n — nó "Pode Responder?"
   • SE podeResponder = false → para execução (sem resposta)
   • SE podeResponder = true → continua
        │
        ▼
5. n8n — nó "Motor de Estado" (Code)
   • Lê staticData.sessoes[remoteJid]
   • Determina rota: menu_principal | processador | humano
   • Primeira visita → menu_principal (saudação)
   • Com sessão ativa → processador
        │
        ├─── rota: menu_principal
        │         └── Resposta de boas-vindas + link cardápio
        │
        └─── rota: processador
                  │
                  ▼
6. n8n — nó "Processador IA" (Code — ~1000 linhas JS)
   │
   ├── BOOT: busca GET /api/menu (cache 5min em staticData.menuCache)
   │         fallback: MOCK_PRODUCTS_FALLBACK (21 produtos, IDs reais)
   │
   ├── STATE MACHINE (cliente.etapa):
   │   nova_conversa
   │   aguardando_item       → MenuService.findProductByText(msg)
   │   aguardando_complemento→ mais itens ou "pode fechar"
   │   aguardando_tipo_entrega→ "retirada" ou "delivery"
   │   aguardando_endereco   → texto ou GPS (__LOCALIZACAO__)
   │   aguardando_pagamento  → Pix | Dinheiro | Cartão
   │   aguardando_tipo_cartao→ Crédito | Débito
   │   aguardando_confirmacao→ "sim" → cria pedido | "não" → reinicia
   │   pedido_fechado        → agradece, reset
   │
   ├── INTENÇÕES FIXAS (regex):
   │   cardápio → link grillcardapio.com.br
   │   horário → status aberto/fechado (heurística por hora)
   │   endereço → maps link
   │   pagamento → lista formas aceitas
   │   status/humano → transfere para atendente
   │
   ├── SE aguardando_confirmacao + "sim":
   │   POST https://grillcardapio.com.br/api/orders
   │   • normalizePhone (strip DDI 55)
   │   • productId: integer direto (API) ou MOCK_TO_REAL_ID (fallback)
   │   • obs: array.join(', ')
   │   • Retorna orderId → "Pedido #N confirmado!"
   │
   └── FALLBACK LLM: se não entrou em nenhum estado/intenção
             │
             ▼
7. n8n — nó "Verificar chamarLLM"
   • SE chamarLLM = false → pula OpenAI
   • SE chamarLLM = true  → chama OpenAI
        │
        ▼
8. n8n — nó "OpenAI_TESTE" → GPT-4o-mini
   • System prompt: atendente humanizado Grill Central
   • Histórico: últimas 12 mensagens da sessão
   • max_tokens: 150, temperature: 0.55
        │
        ▼
9. n8n — nó "Enviar Resposta"
   POST http://evolution-api:8080/message/sendText/grillcentral
   { number: "DDI+DDD+número", text: "textoResposta" }
        │
        ▼
10. WhatsApp entrega mensagem ao cliente
```

---

## Fluxo detalhado — pedido via site

```
1. Cliente acessa grillcardapio.com.br
        │
        ▼
2. src/app/page.tsx (Next.js, "use client", ~1500 linhas)
   • Busca GET /api/menu
   • Monta categorias + produtos
   • Gerencia carrinho (localStorage: grillcentral_cart)
   • IntersectionObserver: destaque de categoria ativa no scroll
        │
   [adiciona itens ao carrinho]
        │
        ▼
3. CartSidebar ou src/app/carrinho/page.tsx
   • Coleta: nome, telefone, tipo entrega, endereço/GPS, pagamento
   • Anti-duplo-envio: button desabilitado + flag isSubmitting
        │
        ▼
4. POST /api/orders (src/app/api/orders/route.ts)
   Validações:
   • customer_phone: 10–11 dígitos
   • payment: enum exato
   • items[].qty: integer ≥ 1
   • address (delivery): endereço OU GPS
   
   Processamento:
   • Lookup de produtos no banco → recalcula preços reais
   • Upsert do Customer (phone único)
   • Checa autoAcceptOrders + isRestaurantOpen → status inicial
   • Cria Order + OrderItems
        │
        ▼
5. Retorna Order completo (status 201)
   → Frontend exibe confirmação
```

---

## Fluxo detalhado — operação na cozinha

```
Pedido criado (status: RECEIVED)
        │
        ▼
┌──────────────────────────────────────────┐
│  /admin/pedidos  OU  /cozinha            │
│                                          │
│  Polling GET /api/admin/pedidos (15s)    │
│  OU GET público /api/orders              │
│                                          │
│  Novo pedido → toca som                  │
│              → highlight visual          │
└──────────┬───────────────────────────────┘
           │
           ▼
  Admin clica "Confirmar"
   PATCH /api/admin/pedidos/:id { status: "CONFIRMED" }
           │
           ▼
  Admin clica "Preparando"
   PATCH /api/admin/pedidos/:id { status: "PREPARING" }
           │
           ▼
  Admin clica "Pronto"
   PATCH /api/admin/pedidos/:id { status: "READY" }
           │
           ├── [opcional] Clica impressora
           │      └── printOrder() → window.open + window.print
           │          Layout HTML 80mm, Courier New
           │          Cabe em impressora térmica 58mm e 80mm
           │
           ▼
  Admin clica "Entregue"
   PATCH /api/admin/pedidos/:id { status: "DELIVERED" }
```

---

## Estrutura de dados

### Order (banco)
```
Order {
  id, restaurantId, customerName, customerPhone
  orderType: "delivery" | "retirada" | "whatsapp_direct"
  payment: "Pix" | "Dinheiro" | "Cartão de Crédito" | "Cartão de Débito" | ...
  subtotal, deliveryFee, total
  addressJson: JSON string { endereco, complemento, bairro, lat?, lng? }
  status: "RECEIVED" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED"
  autoAccepted: boolean
  notes, createdAt, updatedAt
  items: OrderItem[]
}

OrderItem {
  id, orderId, productId (nullable FK), name, price, qty, obs
}
```

### staticData do LancheFlow (n8n, persiste entre execuções)
```javascript
staticData = {
  sessoes: {
    "554888362576@s.whatsapp.net": {
      estado: "pedido" | "inicio" | "humano",
      historico: [...],   // últimas 12 msgs para LLM
      ultimaAtividade: timestamp
    }
  },
  memoriaClientes: {
    "554888362576@s.whatsapp.net": {
      etapa: "aguardando_item" | ...,
      orderState: {
        items: [{ productId, name, quantity, unitPrice, observations[], subtotal }],
        deliveryType, address, gpsLocation, paymentMethod, itemsTotal, grandTotal
      },
      lastItemAdded: productId,
      ultima_interacao: timestamp,
      atendimentoHumano: boolean
    }
  },
  menuCache: {
    ts: timestamp,
    products: [{ id, name, price, category, searchable }]  // 35 produtos da API
  },
  errosPedido: [{ numero, timestamp, erro, payload }]  // últimos 50 erros
}
```

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend API | Next.js Route Handlers (Edge-compatible) |
| ORM | Prisma + `@prisma/adapter-pg` (driver nativo, sem pooler) |
| Banco | PostgreSQL (Railway managed) |
| Autenticação admin | JWT via `jose`, cookie HTTP-only |
| Autenticação cliente | localStorage only |
| Deploy | Railway (RAILPACK builder) |
| Bot WhatsApp | n8n (self-hosted no VPS) + Evolution API |
| LLM | GPT-4o-mini (fallback conversacional) |
| Impressão | `window.open` + `window.print`, HTML/CSS 80mm |
| DNS | A record grillcardapio.com.br → 66.33.22.241, sem Cloudflare proxy |

---

## URLs de acesso

| Recurso | URL |
|---|---|
| Cardápio (público) | https://grillcardapio.com.br |
| Admin | https://grillcardapio.com.br/admin |
| Cozinha | https://grillcardapio.com.br/cozinha |
| n8n | http://24.144.95.205:5678 |
| Evolution API | http://24.144.95.205:8080 |
| API menu | https://grillcardapio.com.br/api/menu |
| API orders | https://grillcardapio.com.br/api/orders |
