/**
 * Notificações sonoras via Web Audio API.
 * Não precisa de arquivo .mp3 — gera os sons diretamente no browser.
 *
 * Política do Chrome: áudio só toca após interação do usuário.
 * Solução: chamar unlockAudio() no primeiro clique da página.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

/** Chame no primeiro evento de clique do app para desbloquear áudio no Chrome */
export function unlockAudio() {
  if (unlocked) return;
  try {
    const c = getCtx();
    if (c.state === 'suspended') {
      c.resume();
    }
    // Toca silêncio de 1ms para garantir desbloqueio
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  } catch {
    // browser sem suporte — ignora silenciosamente
  }
}

/**
 * Toca uma sequência de notas.
 * @param notes Array de { freq, duration, volume? }
 */
function playNotes(notes: Array<{ freq: number; duration: number; volume?: number }>) {
  try {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();

    let t = c.currentTime;
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);

      osc.frequency.setValueAtTime(n.freq, t);
      osc.type = 'sine';

      const vol = n.volume ?? 0.35;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.duration);

      osc.start(t);
      osc.stop(t + n.duration);
      t += n.duration;
    }
  } catch {
    // sem suporte — ignora
  }
}

/** 🛵 Pedido delivery pronto para sair — 3 bips ascendentes */
export function playDeliveryReady() {
  playNotes([
    { freq: 523, duration: 0.12 }, // Dó
    { freq: 659, duration: 0.12 }, // Mi
    { freq: 784, duration: 0.25 }, // Sol
  ]);
}

/** 🍽️ Novo pedido chegou na cozinha — 2 bips */
export function playOrderKitchen() {
  playNotes([
    { freq: 440, duration: 0.1 },
    { freq: 440, duration: 0.1 },
  ]);
}

/** ✅ Confirmação genérica — 1 bip curto */
export function playConfirm() {
  playNotes([{ freq: 660, duration: 0.15, volume: 0.25 }]);
}

/** ⚠️ Alerta / urgência — 3 bips rápidos agudos */
export function playAlert() {
  playNotes([
    { freq: 880, duration: 0.08 },
    { freq: 880, duration: 0.08 },
    { freq: 880, duration: 0.12 },
  ]);
}
