-- ============================================================
-- Migration: Performance indexes + índices para produção
-- Data: 2026-04-19
-- ============================================================

-- Índices de orders (queries mais frequentes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_store_date_status
  ON orders ("tenantId", "storeId", "businessDate", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_cash_session
  ON orders ("cashSessionId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_by
  ON orders ("createdById");

-- Índice para queries de itens pendentes (KDS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_status
  ON order_items ("orderId", status);

-- Índice para delivery dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_status_created
  ON deliveries (status, "createdAt");

-- Índice para busca de clientes por telefone (delivery)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone_tenant
  ON customers (phone, "tenantId")
  WHERE phone IS NOT NULL;

-- Índice para produtos ativos por loja (PDV grid)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_store_active
  ON products ("storeId", "isActive", "displayOrder")
  WHERE "deletedAt" IS NULL;

-- Índice para refresh tokens por userId (logout de todos os dispositivos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_user_expires
  ON refresh_tokens ("userId", "expiresAt")
  WHERE "revokedAt" IS NULL;

-- Índice para auditoria por entidade
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_entity
  ON audit_logs ("tenantId", "entityType", "entityId", "createdAt" DESC);
