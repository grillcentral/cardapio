/**
 * Verifica se o restaurante está aberto no momento dado.
 *
 * Regra de segurança: na dúvida (sem horários cadastrados, dia sem entrada,
 * dia marcado como fechado) retorna FALSE — pedidos NÃO são auto-aceitos.
 *
 * Timezone: openTime/closeTime são "HH:mm" no fuso do restaurante (UTC-3, Brasil).
 * O servidor roda em UTC, então subtraímos 3 h antes de comparar.
 */

interface OpeningHour {
  dayOfWeek: number;    // 0 = domingo … 6 = sábado
  openTime:  string | null; // "11:00"
  closeTime: string | null; // "23:00"
  isOpen:    boolean;
}

export function isRestaurantOpen(
  hours: OpeningHour[],
  now: Date = new Date()
): boolean {
  // Sem horários cadastrados → não auto-aceitar (seguro por omissão)
  if (!hours || hours.length === 0) return false;

  // Converter UTC → UTC-3 (horário de Brasília)
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const dow  = brt.getUTCDay(); // 0–6
  const hhmm =
    String(brt.getUTCHours()).padStart(2, "0") +
    ":" +
    String(brt.getUTCMinutes()).padStart(2, "0");

  const today = hours.find((h) => h.dayOfWeek === dow);

  // Dia não cadastrado ou explicitamente fechado → não auto-aceitar
  if (!today || !today.isOpen || !today.openTime || !today.closeTime) return false;

  // Comparação lexicográfica de "HH:mm" — funciona para horários no mesmo dia
  // Horários que cruzam meia-noite NÃO são suportados (ex: 22:00–02:00).
  // Nesses casos retorna false por segurança.
  if (today.openTime >= today.closeTime) return false;

  return hhmm >= today.openTime && hhmm < today.closeTime;
}
