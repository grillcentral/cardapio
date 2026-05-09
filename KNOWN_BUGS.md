# KNOWN_BUGS.md
> Lista viva — atualizar ao resolver ou descobrir bugs
> Formato: problema → causa → solução → arquivo afetado

---

## 🟢 Resolvidos (histórico)

### BUG-001 — PDVAdapter.createOrder() era stub
- **Problema**: Bot processava pedido inteiro mas nunca criava no banco. `createOrder()` tinha `return { id: 'MOCK_' + Date.now() }` hardcoded
- **Causa**: Desenvolvimento incremental, PDV real não integrado ainda
- **Solução**: Substituído por `POST https://grillcardapio.com.br/api/orders` real com mapeamento de campos correto
- **Arquivo**: `CLAUDE PEGUE AQUI/LancheFlow_V2.json` → nó `Processador IA`
- **Data**: 2026-05-09

### BUG-002 — Phone com DDI 55 causava erro 400 no /api/orders
- **Problema**: Bot enviava `customer_phone: "554888362576"` (12 dígitos). API valida 10–11 dígitos
- **Causa**: `remoteJid` do WhatsApp inclui DDI 55. API espera só DDD + número
- **Solução**: `normalizePhone()` — strip prefixo `55` se string tiver 12–13 dígitos
- **Arquivo**: `Processador IA` (jsCode), função `normalizePhone()`
- **Data**: 2026-05-09

### BUG-003 — MOCK_PRODUCTS usava IDs string ('xs001'), banco espera integer
- **Problema**: `orderItems` criados com `productId: 'xs001'` → banco rejeitava (FK integer)
- **Causa**: IDs de desenvolvimento eram strings arbitrárias
- **Solução**: `MOCK_TO_REAL_ID` mapeando string→integer; depois em V3 produtos da API já têm integer
- **Arquivo**: `Processador IA` (jsCode) — `MOCK_TO_REAL_ID` e fix `typeof i.productId`
- **Data**: 2026-05-09

### BUG-004 — Pagamento "cartão" genérico causava erro 400
- **Problema**: Cliente dizia "cartão" → bot enviava `payment: "Cartão"` → API rejeitava (enum exige "Cartão de Crédito" ou "Cartão de Débito")
- **Causa**: Enum da API é restrito; bot não pedia especificação
- **Solução**: Estado intermediário `aguardando_tipo_cartao` que pergunta crédito/débito
- **Arquivo**: `Processador IA` (jsCode)
- **Data**: 2026-05-09

### BUG-005 — `isActive === null` bloqueava todos os produtos da API
- **Problema**: `GET /api/menu` não retorna o campo `isActive` (vem null). Código fazia `if (!p.isActive) continue` → todos os 35 produtos ignorados → fallback sempre ativo → preços errados
- **Causa**: API não serializa campos null por padrão; código assumia `isActive: true` para produtos ativos
- **Solução**: Mudou condição para `if (p.isActive === false) continue` — null/undefined = tratar como ativo
- **Arquivo**: `Processador IA` (jsCode) — bloco MENU SERVICE, LancheFlow V3
- **Data**: 2026-05-09

### BUG-006 — `obs` como array em vez de string
- **Problema**: Bot montava `obs: ["sem milho", "sem ervilha"]` (array). API espera `obs: string | null`
- **Causa**: `extractObservations()` retorna array; código não fazia join antes de enviar
- **Solução**: `obs: (i.observations && i.observations.length) ? i.observations.join(', ') : null`
- **Arquivo**: `Processador IA` (jsCode) — bloco `aguardando_confirmacao`
- **Data**: 2026-05-09

### BUG-013 — Human trigger routing: "atendente" ia para Menu Principal em vez de Processador IA
- **Problema**: Mensagens com trigger de atendente humano ("quero falar com atendente") de novos visitantes iam para o nó `Menu Principal` (saudação) em vez de `Processador IA` — Change 5 nunca disparava
- **Causa**: `Motor de Estado` roteia para `menu_principal` quando `sessao.estado === 'inicio' && !temHistorico` (primeira visita). O trigger estava apenas no Processador IA, nunca alcançado
- **Solução**: (a) Detectar keywords humanas no `Normalizar` e emitir flag `isHumanTrigger=true`; (b) `Motor de Estado` faz override para `rota='processador'` quando `isHumanTrigger` for true
- **Arquivo**: `Normalizar` (Change 6), `Motor de Estado` (Change 7) — `LancheFlow_V4_WORKING.json`
- **Data**: 2026-05-09

### BUG-014 — Regex "quero" do handler de pedidos capturava trigger humano antes do bloco dedicado
- **Problema**: "quero falar com um atendente" acionava o handler `/quero( pedir)?|.../` (que inclui `quero` sem lookahead) antes de chegar na regex de trigger humano, respondendo "Boa! Me diz que eu anoto 😊" em vez de "Entendido!"
- **Causa**: Ordem de verificação no Processador IA — handler "quero pedir" (linha ~417) vinha antes do trigger humano (linha ~467)
- **Solução**: Adicionado check `if (dados.isHumanTrigger)` no início do Processador IA (após REATIVACAO block), usando o flag pré-calculado pelo Normalizar — executa antes de qualquer outro handler
- **Arquivo**: `Processador IA` (Change 8) — `LancheFlow_V4_WORKING.json`
- **Data**: 2026-05-09

### BUG-015 — Código duplicado no Processador IA (INTENÇÕES FIXAS duplicado + braces órfãos)
- **Problema**: A seção INTENÇÕES FIXAS (cardápio, quero pedir, horário, etc.) aparecia duas vezes no jsCode do Processador IA. Linha 477 tinha `}   }` (brace extra) causando `SyntaxError: Unexpected token '}'` que derrubava todas as execuções
- **Causa**: Inserção incorreta do Change 5 na sessão anterior — o bloco de trigger humano foi inserido com braces sobrando, e a seção de intenções não foi deduplcada corretamente
- **Solução**: Removidas as linhas 478-546 (braces órfãos + cópia duplicada da seção INTENÇÕES FIXAS). Linha 477 corrigida de `}   }` para `}`
- **Arquivo**: `Processador IA` (jsCode) — `LancheFlow_V4_WORKING.json`
- **Data**: 2026-05-09

---

## 🔴 Abertos

### BUG-007 — /cozinha sem autenticação
- **Problema**: Qualquer pessoa com o link pode acessar `/cozinha`, ver todos os pedidos e mover status
- **Causa**: Página foi criada para ser aberta em tablet na cozinha; autenticação não foi adicionada
- **Impacto**: Alto — expõe dados de clientes e permite alterar pedidos
- **Solução sugerida**: PIN de 4 dígitos em sessionStorage, ou reutilizar cookie `admin_token`
- **Arquivo**: `src/app/cozinha/page.tsx`

### BUG-008 — Frete delivery sempre R$0,00
- **Problema**: Bot informa ao cliente que "taxa depende do bairro" mas nunca calcula. `deliveryFee` é sempre 0
- **Causa**: Lógica de frete por bairro/distância nunca foi implementada
- **Impacto**: Médio — restaurante pode cobrar frete na entrega mas não no app
- **Solução sugerida**: Tabela de bairros→taxa em `staticData` no LancheFlow; ou campo na Order para admin preencher
- **Arquivo**: `Processador IA` jsCode (linha `cliente.orderState.deliveryFee = 0`), `src/app/api/orders/route.ts` (linha `const deliveryFee = 0`)

### BUG-009 — n8n API key expira em 2026-05-18
- **Problema**: JWT da API do n8n tem `exp: 1779159600` = 18/05/2026. Após isso, deploys via PowerShell falham
- **Causa**: Tokens n8n têm validade configurável
- **Impacto**: Alto — impossibilita updates remotos do LancheFlow sem nova key
- **Solução**: Acessar `http://24.144.95.205:5678/settings/api` e gerar novo token antes do vencimento
- **Arquivo**: `CLAUDE.md` (atualizar a key após renovar)

### BUG-010 — Auto-aceite pode não funcionar em produção
- **Problema**: `autoAcceptOrders` e `autoPrintOnAccept` estão no `schema.prisma` mas não confirmado se `prisma db push` foi rodado no Railway
- **Causa**: Deploy de schema no Railway requer comando explícito; pode ter ficado pendente
- **Impacto**: Médio — feature de auto-aceite silenciosamente inativa. Query `select: { autoAcceptOrders: true }` retorna `undefined` sem erro
- **Solução**: Rodar `npm run db:push` no Railway via Railway CLI ou dashboard
- **Arquivo**: `prisma/schema.prisma`, `src/app/api/orders/route.ts`

### BUG-011 — Sem rate limiting em /api/orders
- **Problema**: Endpoint público sem autenticação, sem rate limit. Qualquer script pode criar N pedidos por segundo
- **Causa**: Não implementado — foco estava em funcionalidade
- **Impacto**: Médio — spam, poluição de dados, custo de DB
- **Solução sugerida**: Middleware com rate limit por IP (ex: 5 pedidos/minuto). Ou validar `customer_phone` contra blacklist
- **Arquivo**: `src/app/api/orders/route.ts`, `src/middleware.ts`

### BUG-012 — Preços no resumo do bot podem diferir do banco
- **Problema**: Quando `GET /api/menu` falha e o fallback é usado, bot mostra preços do `MOCK_PRODUCTS_FALLBACK` (desatualizados). `/api/orders` recalcula do banco e usa preços reais. Cliente vê preço X no chat e paga Y
- **Causa**: Fallback tem preços hardcoded de 2026-05-09
- **Impacto**: Baixo — `/api/orders` sempre usa preço correto; discrepância é só na confirmação no chat
- **Solução**: Monitorar se `GET /api/menu` está falhando (ver `staticData.errosPedido` ou logs n8n). Atualizar `MOCK_PRODUCTS_FALLBACK` quando preços mudarem
- **Arquivo**: `Processador IA` jsCode — bloco `MOCK_PRODUCTS_FALLBACK`

---

## 📋 Template para novo bug

```
### BUG-XXX — Título curto
- **Problema**: O que acontece de errado, com exemplo concreto
- **Causa**: Por que acontece tecnicamente
- **Impacto**: Alto / Médio / Baixo — consequência para o negócio
- **Solução**: O que foi ou deve ser feito
- **Arquivo**: Caminho e linha específica
- **Data**: AAAA-MM-DD
```
