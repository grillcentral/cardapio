import type { Server, Socket } from 'socket.io';
import { createVerifier } from 'fast-jwt';
import { env } from './env';

const jwtVerify = createVerifier({ key: env.JWT_SECRET });

/**
 * Estrutura de rooms:
 *   tenant:<id>              → todos daquele tenant
 *   tenant:<id>:store:<id>   → loja específica
 *   tenant:<id>:role:KITCHEN → todos os cozinheiros de um tenant
 *   tenant:<id>:store:<id>:role:CASHIER → caixas de uma loja
 *
 * Eventos emitidos pelo servidor:
 *   order:created
 *   order:updated
 *   order:item-ready
 *   delivery:status-changed
 *   product:stock-low
 *   cash-session:opened / closed
 */

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    tenantId: string;
    storeId?: string;
    role: string;
  };
}

export function registerSocketHandlers(io: Server) {
  // ─── Middleware de autenticação ───
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Token ausente'));
    try {
      const payload = jwtVerify(token) as {
        sub: string; tenantId: string; storeId?: string; role: string;
      };
      (socket as AuthedSocket).data = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        storeId: payload.storeId,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  // ─── Conexão ───
  io.on('connection', (socket) => {
    const { tenantId, storeId, role, userId } = (socket as AuthedSocket).data;

    // Entra nas rooms relevantes
    socket.join(`tenant:${tenantId}`);
    if (storeId) socket.join(`tenant:${tenantId}:store:${storeId}`);
    socket.join(`tenant:${tenantId}:role:${role}`);
    if (storeId) socket.join(`tenant:${tenantId}:store:${storeId}:role:${role}`);

    console.log(`[Socket] conectado user=${userId} tenant=${tenantId} store=${storeId} role=${role}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] desconectado user=${userId}`);
    });
  });
}

// ─── Helpers para emitir eventos de qualquer lugar do backend ───
let ioInstance: Server | null = null;
export const setIO = (io: Server) => { ioInstance = io; };
export const getIO = (): Server => {
  if (!ioInstance) throw new Error('Socket.io não inicializado');
  return ioInstance;
};

export function emitToTenant(tenantId: string, event: string, data: unknown) {
  getIO().to(`tenant:${tenantId}`).emit(event, data);
}
export function emitToStore(tenantId: string, storeId: string, event: string, data: unknown) {
  getIO().to(`tenant:${tenantId}:store:${storeId}`).emit(event, data);
}
export function emitToRole(tenantId: string, role: string, event: string, data: unknown) {
  getIO().to(`tenant:${tenantId}:role:${role}`).emit(event, data);
}
export function emitToKitchen(tenantId: string, storeId: string, data: unknown) {
  const io = getIO();
  // Envia para cozinheiros daquela loja E para cozinheiros sem loja fixa do tenant
  io.to(`tenant:${tenantId}:store:${storeId}:role:KITCHEN`).emit('order:kitchen', data);
  io.to(`tenant:${tenantId}:role:KITCHEN`).emit('order:kitchen', data);
}

export function emitToDeliverers(tenantId: string, storeId: string, event: string, data: unknown) {
  const io = getIO();
  // Envia para motoboys daquela loja E para motoboys sem loja fixa do tenant
  io.to(`tenant:${tenantId}:store:${storeId}:role:DELIVERER`).emit(event, data);
  io.to(`tenant:${tenantId}:role:DELIVERER`).emit(event, data);
}
