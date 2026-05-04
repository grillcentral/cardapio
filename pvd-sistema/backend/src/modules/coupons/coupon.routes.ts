import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { withTenant } from '../../plugins/tenant';
import { NotFoundError, BusinessRuleError } from '../../lib/errors';

const couponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/, 'Use letras maiúsculas, números e hífen').transform(s => s.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  minOrder: z.number().min(0).default(0),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireTenant);

  // GET /coupons
  app.get('/', { onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')] }, async (request) => {
    const coupons = await prisma.couponCode.findMany({
      where: { tenantId: request.user!.tenantId! },
      orderBy: { createdAt: 'desc' },
    });
    return { coupons };
  });

  // POST /coupons
  app.post('/', { onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')] }, async (request, reply) => {
    const body = couponSchema.parse(request.body);
    const tenantId = request.user!.tenantId!;

    const exists = await prisma.couponCode.findFirst({ where: { tenantId, code: body.code } });
    if (exists) throw new BusinessRuleError(`Cupom "${body.code}" já existe`);

    const coupon = await prisma.couponCode.create({ data: { ...body, tenantId } });
    return reply.status(201).send({ coupon });
  });

  // PATCH /coupons/:id
  app.patch<{ Params: { id: string } }>('/:id', { onRequest: [app.requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN')] }, async (request) => {
    const body = couponSchema.partial().parse(request.body);
    const coupon = await prisma.couponCode.findFirst({
      where: { id: request.params.id, tenantId: request.user!.tenantId! },
    });
    if (!coupon) throw new NotFoundError('Cupom');
    const updated = await prisma.couponCode.update({ where: { id: coupon.id }, data: body });
    return { coupon: updated };
  });

  // DELETE /coupons/:id
  app.delete<{ Params: { id: string } }>('/:id', { onRequest: [app.requireRole('OWNER', 'SUPER_ADMIN')] }, async (request, reply) => {
    const coupon = await prisma.couponCode.findFirst({
      where: { id: request.params.id, tenantId: request.user!.tenantId! },
    });
    if (!coupon) throw new NotFoundError('Cupom');
    await prisma.couponCode.delete({ where: { id: coupon.id } });
    return reply.status(204).send();
  });

  // POST /coupons/validate — valida e retorna o desconto calculado
  app.post('/validate', async (request) => {
    const { code, orderTotal } = z.object({
      code: z.string(),
      orderTotal: z.number().positive(),
    }).parse(request.body);

    const coupon = await prisma.couponCode.findFirst({
      where: {
        tenantId: request.user!.tenantId!,
        code: code.toUpperCase(),
        isActive: true,
      },
    });

    if (!coupon) throw new BusinessRuleError('Cupom inválido ou inativo');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BusinessRuleError('Cupom expirado');
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new BusinessRuleError('Cupom esgotado');
    if (orderTotal < Number(coupon.minOrder)) {
      throw new BusinessRuleError(`Pedido mínimo de ${Number(coupon.minOrder).toFixed(2)} para este cupom`);
    }

    const discountAmount = coupon.type === 'PERCENTAGE'
      ? Math.min(orderTotal, (orderTotal * Number(coupon.value)) / 100)
      : Math.min(orderTotal, Number(coupon.value));

    return {
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description },
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalTotal: parseFloat((orderTotal - discountAmount).toFixed(2)),
    };
  });
};

export default routes;
