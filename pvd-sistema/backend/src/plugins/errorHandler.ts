import fp from 'fastify-plugin';
import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { Prisma } from '@prisma/client';

export default fp(async (app) => {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, error.message);

    // Erros de validação Zod
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: error.flatten(),
      });
    }

    // Nossos erros de domínio
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    // Erros do Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const fields = (error.meta?.target as string[]) ?? [];
        // Constraint de orderNumber = conflito de numeração sequencial
        if (fields.includes('orderNumber')) {
          return reply.status(409).send({
            error: 'CONFLICT',
            message: 'Conflito de numeração — tente novamente',
          });
        }
        return reply.status(409).send({
          error: 'CONFLICT',
          message: 'Registro duplicado',
          fields,
        });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Registro não encontrado' });
      }
      if (error.code === 'P2034') {
        // Transaction conflict — retry seguro no client
        return reply.status(409).send({ error: 'TRANSACTION_CONFLICT', message: 'Conflito de transação, tente novamente' });
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Dados inválidos para o banco de dados' });
    }

    // Rate limit do Fastify
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: 'RATE_LIMITED', message: 'Muitas requisições, tente novamente em instantes.' });
    }

    // Erro genérico — não vazar stack em produção
    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: isProd ? 'Erro interno do servidor' : error.message,
      ...(isProd ? {} : { stack: error.stack }),
    });
  });
});
