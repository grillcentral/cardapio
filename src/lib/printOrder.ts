// ── Impressão de pedido — layout térmico 58mm/80mm ────────────────────────────
// Usa window.open() + window.print(). Sem dependências externas.

export interface PrintOrderData {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  orderType: string;
  payment: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addressJson: string | null;
  notes: string | null;
  createdAt: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    obs: string | null;
  }>;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery:        "Entrega",
  retirada:        "Retirada",
  whatsapp_direct: "WhatsApp",
};

function fmtMoney(n: number) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function parseAddress(json: string | null): string | null {
  try {
    if (!json) return null;
    const a = JSON.parse(json);
    return [a.endereco, a.complemento, a.bairro].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}

export function printOrder(order: PrintOrderData): void {
  const address = parseAddress(order.addressJson);
  const typeLabel = ORDER_TYPE_LABELS[order.orderType] ?? order.orderType;

  const rows = order.items
    .map((item) => {
      const lineTotal = fmtMoney(item.price * item.qty);
      const obs = item.obs ? `<div class="obs">↳ ${item.obs}</div>` : "";
      return `
        <div class="item-row">
          <span class="item-qty">${item.qty}x</span>
          <span class="item-name">${item.name}</span>
          <span class="item-price">${lineTotal}</span>
        </div>${obs}`;
    })
    .join("");

  const deliveryBlock =
    order.deliveryFee > 0
      ? `<div class="row"><span>Subtotal</span><span>${fmtMoney(order.subtotal)}</span></div>
         <div class="row"><span>Taxa entrega</span><span>${fmtMoney(order.deliveryFee)}</span></div>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${order.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    padding: 6mm 5mm;
    width: 80mm;
  }
  .center { text-align: center; }
  .brand  { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .sub    { font-size: 10px; color: #444; margin-top: 1px; }
  .divider{ border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .row    { display: flex; justify-content: space-between; margin: 1px 0; }
  .bold   { font-weight: bold; }
  .section-title { font-weight: bold; font-size: 11px; letter-spacing: 0.5px; margin-bottom: 3px; }

  /* Itens */
  .item-row   { display: flex; gap: 2px; margin: 2px 0; }
  .item-qty   { min-width: 22px; flex-shrink: 0; }
  .item-name  { flex: 1; word-break: break-word; }
  .item-price { min-width: 62px; text-align: right; flex-shrink: 0; }
  .obs        { font-size: 11px; margin-left: 24px; font-style: italic; color: #333; }

  /* Total */
  .total-row  { display: flex; justify-content: space-between;
                font-weight: bold; font-size: 15px; margin-top: 2px; }

  .footer     { font-size: 10px; color: #555; margin-top: 2px; }

  @page { size: 80mm auto; margin: 0; }
  @media print {
    body { width: 100%; padding: 4mm 4mm; }
  }
</style>
</head>
<body>

<div class="center">
  <div class="brand">GRILL CENTRAL</div>
  <div class="sub">Cozinha / Balcão</div>
</div>

<hr class="divider">

<div class="row">
  <span class="bold" style="font-size:14px;">PEDIDO #${order.id}</span>
  <span style="font-size:11px;">${fmtDatetime(order.createdAt)}</span>
</div>

<hr class="divider">

${order.customerName ? `<div class="row"><span>Cliente</span><span class="bold">${order.customerName}</span></div>` : ""}
${order.customerPhone ? `<div class="row"><span>Telefone</span><span>${order.customerPhone}</span></div>` : ""}
<div class="row"><span>Tipo</span><span>${typeLabel}</span></div>
${address ? `<div class="row" style="align-items:flex-start;"><span style="flex-shrink:0;margin-right:4px;">Endereço</span><span style="text-align:right;word-break:break-word;">${address}</span></div>` : ""}
<div class="row"><span>Pagamento</span><span>${order.payment}</span></div>

<hr class="divider">

<div class="section-title">ITENS</div>
${rows}

<hr class="divider">

${deliveryBlock}
<div class="total-row">
  <span>TOTAL</span>
  <span>${fmtMoney(order.total)}</span>
</div>

${order.notes ? `<hr class="divider"><div class="section-title">OBS GERAL</div><div>${order.notes}</div>` : ""}

<hr class="divider">
<div class="center footer">Obrigado pela preferência!</div>

</body>
</html>`;

  const win = window.open(
    "",
    "_blank",
    "width=420,height=650,menubar=no,toolbar=no,location=no,status=no"
  );
  if (!win) {
    alert("Pop-up bloqueado. Permita pop-ups para este site e tente novamente.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Pequeno delay para garantir que o documento foi renderizado antes de imprimir
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 300);
}
