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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pedido #${order.id}</title>
<style>
  /* ── Reset ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Tamanho da página — DEVE ficar no nível raiz, não dentro de @media ── */
  @page {
    size: 80mm auto;
    margin: 0mm;
  }

  /* ── Corpo base: sempre 80mm ── */
  html, body {
    width: 80mm;
    max-width: 80mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.3;
    color: #000;
    background: #fff;
  }

  body {
    padding: 3mm 3mm 5mm;
  }

  /* ── Preview em tela: receipt centralizado num fundo cinza ── */
  @media screen {
    html {
      background: #ccc;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 10px;
    }
    body {
      background: #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,0.35);
      border-radius: 2px;
      min-height: 40px;
    }
  }

  /* ── Impressão: garante 80mm, sem margens, sem sombra ── */
  @media print {
    html, body {
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 !important;
      padding: 2mm 3mm 4mm !important;
      background: #fff !important;
      box-shadow: none !important;
    }
  }

  /* ── Elementos ── */
  .center { text-align: center; }
  .brand  { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .sub    { font-size: 9px; color: #555; margin-top: 1px; }

  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 3px 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin: 1px 0;
    gap: 4px;
  }
  .row-label { flex-shrink: 0; }
  .row-value { text-align: right; word-break: break-word; }

  .bold          { font-weight: bold; }
  .section-title { font-weight: bold; font-size: 10px; letter-spacing: 0.4px; margin-bottom: 2px; }

  /* Itens */
  .item-row  { display: flex; gap: 2px; margin: 1px 0; align-items: flex-start; }
  .item-qty  { min-width: 20px; flex-shrink: 0; font-weight: bold; }
  .item-name { flex: 1; word-break: break-word; }
  .item-price{ min-width: 58px; text-align: right; flex-shrink: 0; }
  .obs       { font-size: 10px; margin-left: 22px; font-style: italic; color: #444; }

  /* Total */
  .total-row {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
    font-size: 13px;
    margin-top: 1px;
  }

  .footer { font-size: 9px; color: #666; }
</style>
</head>
<body>

<div class="center">
  <div class="brand">GRILL CENTRAL</div>
  <div class="sub">Cozinha / Balcão</div>
</div>
<hr class="divider">
<div class="row">
  <span class="bold">PEDIDO #${order.id}</span>
  <span style="font-size:10px;">${fmtDatetime(order.createdAt)}</span>
</div>
<hr class="divider">
${order.customerName  ? `<div class="row"><span class="row-label">Cliente</span><span class="row-value bold">${order.customerName}</span></div>` : ""}
${order.customerPhone ? `<div class="row"><span class="row-label">Tel</span><span class="row-value">${order.customerPhone}</span></div>` : ""}
<div class="row"><span class="row-label">Tipo</span><span class="row-value">${typeLabel}</span></div>
${address ? `<div class="row"><span class="row-label">End.</span><span class="row-value">${address}</span></div>` : ""}
<div class="row"><span class="row-label">Pgto</span><span class="row-value">${order.payment}</span></div>
<hr class="divider">
<div class="section-title">ITENS</div>
${rows}
<hr class="divider">
${deliveryBlock}
<div class="total-row">
  <span>TOTAL</span>
  <span>${fmtMoney(order.total)}</span>
</div>
${order.notes ? `<hr class="divider"><div class="section-title">OBS</div><div style="font-size:10px;">${order.notes}</div>` : ""}
<hr class="divider">
<div class="center footer">Obrigado pela preferencia!</div>

</body>
</html>`;

  // 80mm ≈ 302px a 96dpi; 340px dá margem para scroll e sombra no preview
  const win = window.open(
    "",
    "_blank",
    "width=340,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
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
