# PROJECT_STATUS.md
> Atualizado: 2026-05-09 | Ambiente: produção em Railway + VPS 24.144.95.205

---

## Visão geral

| Módulo | Status | Observação |
|---|---|---|
| Cardápio web (cliente) | ✅ Produção | grillcardapio.com.br |
| Admin panel | ✅ Produção | /admin/* protegido por JWT |
| Tela Cozinha | ✅ Produção | /cozinha — sem autenticação |
| API pedidos | ✅ Produção | POST /api/orders validado |
| WhatsApp Bot (LancheFlow) | ✅ Produção | V3 ativo no n8n |
| Impressão térmica 80mm | ✅ Produção | printOrder.ts via window.print() |
| Auto-aceite de pedidos | ⚠️ Parcial | Código pronto, schema pendente no Railway |
| Frete por bairro | ❌ Não implementado | deliveryFee fixo em 0 |
| Notificação push | ❌ Não implementado | Som local funciona, push não |

---

## ✅ Pronto — em produção

### Cardápio Web
- Menu completo com categorias, busca, filtros por período (almoço/noite/sempre)
- Carrinho com persistência em localStorage (`grillcentral_cart`)
- Modal de item com complementos e observações
- Autenticação de cliente via localStorage (sem servidor)
- Geolocalização para pedido delivery
- WhatsApp quick-order
- Anti-duplo-envio no checkout (button disable + flag)

### Admin Panel (`/admin`)
- Login JWT (HTTP-only cookie `admin_token`)
- Dashboard com resumo diário
- Gestão de pedidos: kanban de status + impressão por pedido
- Som de alerta para pedido novo (`/public/sounds/`)
- Gestão de produtos (CRUD + upload de imagem)
- Gestão de categorias
- Configurações do restaurante (nome, logo, horários, auto-aceite)

### Tela Cozinha (`/cozinha`)
- Status RECEIVED → CONFIRMED → PREPARING → READY
- Polling a cada 15s
- Impressão de comanda térmica 80mm
- Glow / destaque visual por status

### Bot WhatsApp (LancheFlow V3)
- Instância Evolution API: `grillcentral` (+55 48 98836-2576)
- Webhook: `http://24.144.95.205:5678/webhook/lancheflow`
- Catálogo real via `GET /api/menu` com cache 5 min
- Busca fuzzy 3 níveis com STOP_WORDS
- Criação real de pedido via `POST /api/orders`
- State machine completa (7 estados)
- Proteção contra atendimento humano (bloqueia bot por 30min após msg do admin)
- Fallback para GPT-4o-mini quando não entra em fluxo fixo

---

## ⚠️ Pendente / Em progresso

### Auto-aceite de pedidos
- **O quê**: Quando `autoAcceptOrders = true` no restaurante e está dentro do horário de funcionamento, pedido entra como `CONFIRMED` diretamente
- **Status**: Código implementado no `POST /api/orders` (`src/app/api/orders/route.ts`)
- **Bloqueio**: As colunas `autoAcceptOrders` e `autoPrintOnAccept` existem no `prisma/schema.prisma` mas podem não estar na DB do Railway ainda
- **Ação necessária**: Rodar `npm run db:push` ou `npm run db:migrate` no Railway
- **Risco**: Sem esse push, a query `prisma.restaurant.findUnique({ select: { autoAcceptOrders: true }})` pode silenciosamente retornar undefined, mantendo status RECEIVED sempre

### Frete por bairro
- **O quê**: Calcular `deliveryFee` dinamicamente com base no bairro/distância
- **Status**: Hardcoded como `0` em toda a stack (bot + API)
- **Impacto atual**: Pedidos delivery saem sem frete cobrado

### Impressão automática no aceite
- **O quê**: Quando `autoPrintOnAccept = true`, imprimir comanda automaticamente ao confirmar pedido
- **Status**: Campo existe no schema, UI em `/admin/configuracoes` já tem toggle, mas a lógica de trigger não está implementada no frontend da cozinha

---

## ❌ Não implementado (backlog)

| Feature | Notas |
|---|---|
| Notificação push (mobile) | Som local funciona; push nativo requer PWA + service worker |
| Histórico de clientes | Model `Customer` existe, upsert já acontece no POST /api/orders |
| Relatórios / export | Dashboard só mostra resumo do dia |
| Multi-restaurante | `restaurantId` existe em todos os models mas UI usa `id: 1` hardcoded |
| Confirmação via WhatsApp | Bot confirma o pedido; restaurante confirmar de volta via WhatsApp não existe |
| Taxa de entrega no bot | LancheFlow responde "taxa depende do bairro" mas não calcula |
| Transcrição de áudio (Whisper) | Nós de áudio existem no LancheFlow mas não integrados ao fluxo de pedido |
| Integração com impressora na rede | Impressão atual é browser → pop-up → print. Impressão direta via ESC/POS não implementada |

---

## 🚨 Riscos ativos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| n8n API key expirada (JWT exp: 2026-05-18) | Alta em ~9 dias | Bot para de ser deployável via API | Gerar nova API key no n8n antes de expirar |
| Schema desatualizado no Railway | Média | Auto-aceite falha silenciosamente | Rodar `db:push` agora |
| staticData do n8n perdido em restart do VPS | Baixa | Sessões de clientes resetam | Aceitar como comportamento esperado |
| Sem rate limit no POST /api/orders | Média | Spam de pedidos falsos | Adicionar rate limiting por IP/telefone |
| /cozinha sem autenticação | Alta | Qualquer pessoa pode ver e mover pedidos | Adicionar PIN ou sessão simples |

---

## 📅 Próximos passos recomendados (prioridade)

1. **[URGENTE]** Rodar `npm run db:push` no Railway — garante schema atualizado
2. **[URGENTE]** Renovar API key do n8n antes de 2026-05-18
3. **[MÉDIO]** Adicionar autenticação na `/cozinha` (PIN simples)
4. **[MÉDIO]** Implementar frete por bairro no bot + API
5. **[BAIXO]** Rate limiting em `/api/orders`
6. **[BAIXO]** Exportar relatório de pedidos por período
