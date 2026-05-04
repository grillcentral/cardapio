import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { UnauthorizedError, BusinessRuleError } from '../../lib/errors';

interface LoginInput {
  tenantSlug?: string;   // "burger-do-jailson"
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

interface LoginPinInput {
  tenantSlug: string;
  pin: string;
  userAgent?: string;
  ipAddress?: string;
}

export const authService = {
  /**
   * Login tradicional por email + senha.
   * tenantSlug define a lanchonete. SUPER_ADMIN pode logar sem slug.
   */
  async login({ tenantSlug, email, password, userAgent, ipAddress }: LoginInput) {
    // Busca tenant se foi informado
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug, deletedAt: null },
      });
      if (!tenant) throw new UnauthorizedError('Estabelecimento não encontrado');
      if (tenant.status === 'CANCELLED') throw new UnauthorizedError('Estabelecimento cancelado');
      if (tenant.status === 'TRIAL_EXPIRED') {
        throw new BusinessRuleError('Período de avaliação expirado. Contrate um plano.');
      }
      tenantId = tenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { email, tenantId, deletedAt: null, isActive: true },
      include: { tenant: true, store: true },
    });
    if (!user) throw new UnauthorizedError('Credenciais inválidas');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError('Credenciais inválidas');

    // Atualiza lastLoginAt (não esperar)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const refreshToken = await this.issueRefreshToken(user.id, userAgent, ipAddress);

    return {
      user: sanitizeUser(user),
      refreshToken,
    };
  },

  /**
   * Login rápido por PIN (para tablets no salão).
   * Precisa do tenantSlug pra saber de qual estabelecimento.
   */
  async loginByPin({ tenantSlug, pin, userAgent, ipAddress }: LoginPinInput) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug, deletedAt: null } });
    if (!tenant) throw new UnauthorizedError('Estabelecimento não encontrado');
    if (tenant.status === 'SUSPENDED' || tenant.status === 'TRIAL_EXPIRED') {
      throw new UnauthorizedError('Estabelecimento inativo');
    }

    // Busca todos os usuários com PIN definido (não compara no WHERE — PIN é hasheado)
    const candidates = await prisma.user.findMany({
      where: { tenantId: tenant.id, pin: { not: null }, deletedAt: null, isActive: true },
      include: { tenant: true, store: true },
    });

    // Compara PIN com bcrypt em cada candidato
    let user = null;
    for (const candidate of candidates) {
      if (candidate.pin && await bcrypt.compare(pin, candidate.pin)) {
        user = candidate;
        break;
      }
    }
    if (!user) throw new UnauthorizedError('PIN inválido');

    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const refreshToken = await this.issueRefreshToken(user.id, userAgent, ipAddress);

    return {
      user: sanitizeUser(user),
      refreshToken,
    };
  },

  /**
   * Troca refresh token por um novo access token (e rotaciona o refresh).
   */
  async refresh(refreshTokenValue: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: { user: { include: { tenant: true, store: true } } },
    });

    if (!stored || stored.revokedAt) throw new UnauthorizedError('Sessão inválida');
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Sessão expirada');
    }
    if (!stored.user.isActive || stored.user.deletedAt) {
      throw new UnauthorizedError('Usuário desativado');
    }

    // Rotaciona (invalida o antigo, cria novo)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const newRefresh = await this.issueRefreshToken(stored.userId);

    return {
      user: sanitizeUser(stored.user),
      refreshToken: newRefresh,
    };
  },

  async logout(refreshTokenValue: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshTokenValue, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async issueRefreshToken(userId: string, userAgent?: string, ipAddress?: string) {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date();
    // Parse "7d", "30d" — simples
    const m = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
    if (m) {
      const [, n, u] = m;
      const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[u as 's'|'m'|'h'|'d'];
      expiresAt.setTime(expiresAt.getTime() + Number(n) * ms);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    await prisma.refreshToken.create({
      data: { token, userId, expiresAt, userAgent, ipAddress },
    });
    return token;
  },

  async hashPassword(plain: string) {
    return bcrypt.hash(plain, 10);
  },
};

function sanitizeUser(user: any) {
  const { password, pin, ...rest } = user;
  return rest;
}
