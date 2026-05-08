/**
 * Utilitário centralizado de WhatsApp — Grill Central.
 * FONTE ÚNICA da verdade para o número do restaurante.
 */

export const RESTAURANT_WA = "5548988362576";

/**
 * Abre o WhatsApp do restaurante com a mensagem de pedido.
 *
 * Usa <a>.click() em vez de window.open() para garantir funcionamento
 * em contextos assíncronos (iOS Safari bloqueia window.open pós-await).
 *
 * @param message  Texto puro não-codificado. A função faz encodeURIComponent.
 */
export function openRestaurantWhatsApp(message: string): void {
  const url = `https://wa.me/${RESTAURANT_WA}?text=${encodeURIComponent(message)}`;

  // eslint-disable-next-line no-console
  console.log("WHATSAPP_URL_PEDIDO", url);

  // Método <a>.click() é o mais confiável cross-browser (incluindo iOS Safari async)
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
