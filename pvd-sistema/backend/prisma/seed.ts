/**
 * Seed: popula o banco com dados iniciais.
 * - 1 super admin
 * - 1 tenant de demonstração (Lanche do Jailson)
 * - 1 loja
 * - Owner + Manager + Cashier + Waiter + Kitchen
 * - Categorias e produtos
 *
 * Uso: npm run prisma:seed
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ─────── Super admin ───────
  const superAdminPwd = await bcrypt.hash('admin123', 10);
  const existingSuper = await prisma.user.findFirst({
    where: { email: 'super@lanche-saas.com', tenantId: null },
  });
  const superAdmin = existingSuper ?? await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'super@lanche-saas.com',
      password: superAdminPwd,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✓ Super admin criado:', superAdmin.email);

  // ─────── Tenant de demo ───────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Lanche do Jailson',
      email: 'jailson@lanchedemo.com',
      phone: '(92) 99999-9999',
      plan: 'PRO',
      maxStores: 3,
      maxUsers: 20,
    },
  });
  console.log('✓ Tenant criado:', tenant.slug);

  // ─────── Loja ───────
  const store = await prisma.store.findFirst({ where: { tenantId: tenant.id } })
    ?? await prisma.store.create({
      data: {
        tenantId: tenant.id,
        name: 'Unidade Centro',
        address: 'Rua Central, 100 - Manaus/AM',
        phone: '(92) 99999-9999',
        taxFee: 5,
      },
    });
  console.log('✓ Loja criada:', store.name);

  // ─────── Usuários ───────
  const userPwd = await bcrypt.hash('senha123', 10);
  const users: { email: string; name: string; role: UserRole; pin?: string }[] = [
    { email: 'jailson@lanchedemo.com', name: 'Jailson (Dono)', role: 'OWNER',   pin: '1234' },
    { email: 'gerente@lanchedemo.com', name: 'Gerente',         role: 'MANAGER', pin: '2345' },
    { email: 'caixa@lanchedemo.com',   name: 'Caixa Maria',     role: 'CASHIER', pin: '3456' },
    { email: 'garcom@lanchedemo.com',  name: 'Garçom Pedro',    role: 'WAITER',  pin: '4567' },
    { email: 'cozinha@lanchedemo.com', name: 'Cozinha',         role: 'KITCHEN', pin: '5678' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        storeId: store.id,
        name: u.name,
        email: u.email,
        password: userPwd,
        role: u.role,
        pin: u.pin,
      },
    });
  }
  console.log(`✓ ${users.length} usuários criados (senha: senha123)`);

  // ─────── Categorias ───────
  const categories = [
    { name: 'Lanches',     icon: '🍔', color: '#E85D2F', displayOrder: 1, kitchenStation: 'grill' },
    { name: 'Bebidas',     icon: '🥤', color: '#2E86AB', displayOrder: 2, kitchenStation: 'bar' },
    { name: 'Porções',     icon: '🍟', color: '#F4A261', displayOrder: 3, kitchenStation: 'fryer' },
    { name: 'Sobremesas',  icon: '🍦', color: '#C77DFF', displayOrder: 4, kitchenStation: 'cold' },
  ];

  const catMap: Record<string, string> = {};
  for (const c of categories) {
    const existing = await prisma.category.findFirst({
      where: { tenantId: tenant.id, storeId: store.id, name: c.name, deletedAt: null },
    });
    const cat = existing ?? await prisma.category.create({
      data: { ...c, tenantId: tenant.id, storeId: store.id },
    });
    catMap[c.name] = cat.id;
  }
  console.log(`✓ ${categories.length} categorias criadas`);

  // ─────── Produtos ───────
  const products = [
    // Lanches
    { cat: 'Lanches', name: 'X-Burger',        price: 18, cost: 7,  stock: 50, desc: 'Pão, hambúrguer 120g, queijo, alface, tomate', prepTime: 10 },
    { cat: 'Lanches', name: 'X-Salada',        price: 22, cost: 9,  stock: 45, desc: 'Pão, hambúrguer 120g, queijo, alface, tomate, milho, ervilha', prepTime: 12 },
    { cat: 'Lanches', name: 'X-Bacon',         price: 25, cost: 11, stock: 30, desc: 'Pão, hambúrguer 120g, queijo, bacon, alface, tomate', prepTime: 12 },
    { cat: 'Lanches', name: 'X-Tudo',          price: 32, cost: 14, stock: 25, desc: 'Tudo + ovo + presunto', prepTime: 15 },
    { cat: 'Lanches', name: 'Hot Dog Simples', price: 12, cost: 4,  stock: 40, desc: 'Pão, salsicha, molhos', prepTime: 6 },
    { cat: 'Lanches', name: 'Hot Dog Completo',price: 16, cost: 6,  stock: 35, desc: 'Pão, 2 salsichas, queijo, batata palha', prepTime: 8 },
    // Bebidas
    { cat: 'Bebidas', name: 'Coca-Cola 350ml', price: 6,  cost: 3,  stock: 60, desc: 'Lata gelada', prepTime: 1 },
    { cat: 'Bebidas', name: 'Guaraná 350ml',   price: 6,  cost: 3,  stock: 55, desc: 'Lata gelada', prepTime: 1 },
    { cat: 'Bebidas', name: 'Suco Natural',    price: 8,  cost: 3,  stock: 20, desc: 'Laranja, maracujá ou abacaxi', prepTime: 3 },
    { cat: 'Bebidas', name: 'Água Mineral',    price: 4,  cost: 1.5,stock: 80, desc: 'Com ou sem gás', prepTime: 1 },
    // Porções
    { cat: 'Porções', name: 'Batata Frita P',  price: 12, cost: 4,  stock: 40, desc: '200g', prepTime: 8 },
    { cat: 'Porções', name: 'Batata Frita G',  price: 22, cost: 8,  stock: 30, desc: '500g', prepTime: 10 },
    { cat: 'Porções', name: 'Onion Rings',     price: 18, cost: 6,  stock: 20, desc: 'Anéis de cebola empanados', prepTime: 8 },
    // Sobremesas
    { cat: 'Sobremesas', name: 'Sorvete',      price: 10, cost: 4,  stock: 25, desc: 'Chocolate, morango ou baunilha', prepTime: 2 },
    { cat: 'Sobremesas', name: 'Pudim',        price: 9,  cost: 3,  stock: 15, desc: 'Pudim de leite caseiro', prepTime: 2 },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, storeId: store.id, name: p.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          categoryId: catMap[p.cat],
          name: p.name,
          description: p.desc,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          minStock: 5,
          prepTimeMinutes: p.prepTime,
        },
      });
    }
  }
  console.log(`✓ ${products.length} produtos criados`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Seed concluído!

Super Admin:
  email:  super@lanche-saas.com
  senha:  admin123

Tenant de demo (slug: "demo"):
  dono:     jailson@lanchedemo.com / senha123 / PIN: 1234
  gerente:  gerente@lanchedemo.com / senha123 / PIN: 2345
  caixa:    caixa@lanchedemo.com   / senha123 / PIN: 3456
  garçom:   garcom@lanchedemo.com  / senha123 / PIN: 4567
  cozinha:  cozinha@lanchedemo.com / senha123 / PIN: 5678
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
