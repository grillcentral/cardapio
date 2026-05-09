/**
 * scripts/import-menu.ts
 * Importa o cardápio real do Grill Central para o banco PostgreSQL via Prisma.
 * Fonte: menuData extraído de sistema_pedidos_iframe_print.html
 *
 * Uso local:
 *   npx tsx --env-file=.env scripts/import-menu.ts
 *
 * Uso Railway (no shell do serviço):
 *   npx tsx scripts/import-menu.ts
 *
 * Idempotente: pode ser rodado várias vezes sem duplicar dados.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const RESTAURANT_ID = 1;

interface MenuProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  ingredients: string[];
}

// ─── Dados extraídos do menuData do HTML ────────────────────────────────────

const menuData: Record<string, MenuProduct[]> = {
  "XIS": [
    {
      id: "xis_salada",
      name: "Xis Salada",
      price: 25.50,
      description: "Pão, hambúrguer (180g), presunto, ovo, queijo, maionese, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["presunto", "ovo", "queijo", "maionese", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_coracao",
      name: "Xis Coração",
      price: 29.50,
      description: "Pão, coração (180g), presunto, ovo, queijo, maionese, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["presunto", "ovo", "queijo", "maionese", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_calabresa",
      name: "Xis Calabresa",
      price: 29.50,
      description: "Pão, calabresa, hambúrguer (180g), presunto, ovo, queijo, maionese, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["calabresa", "presunto", "ovo", "queijo", "maionese", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_costelao",
      name: "Xis Costelão",
      price: 31.50,
      description: "Pão, 150g de costela desfiada, presunto, ovo, queijo, maionese, molho, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["costela desfiada", "presunto", "ovo", "queijo", "maionese", "molho", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_bacon",
      name: "Xis Bacon",
      price: 29.50,
      description: "Pão, hambúrguer (180g), bacon, presunto, ovo, queijo, maionese, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["bacon", "presunto", "ovo", "queijo", "maionese", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_file_mignon",
      name: "Xis Filé Mignon",
      price: 41.50,
      description: "Pão, bife de filé mignon, ovo, queijo, presunto, tomate, alface, milho, ervilha, batata palha, e maionese caseira.",
      ingredients: ["bife de filé mignon", "ovo", "queijo", "presunto", "tomate", "alface", "milho", "ervilha", "batata palha", "maionese caseira"],
    },
    {
      id: "xis_alcatra",
      name: "Xis Alcatra",
      price: 29.50,
      description: "Pão, 150g de iscas de alcatra, presunto, ovo, queijo, maionese, molho, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["iscas de alcatra", "presunto", "ovo", "queijo", "maionese", "molho", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_frango",
      name: "Xis Frango",
      price: 28.50,
      description: "Pão, frango (180g), presunto, ovo, queijo, maionese, molho, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["frango", "presunto", "ovo", "queijo", "maionese", "molho", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_palmito",
      name: "Xis Palmito",
      price: 31.50,
      description: "Pão, hambúrguer (180g), presunto, palmito, ovo, queijo, maionese, batata palha, alface, tomate, ervilha, milho.",
      ingredients: ["palmito", "presunto", "ovo", "queijo", "maionese", "batata palha", "alface", "tomate", "ervilha", "milho"],
    },
    {
      id: "xis_kids",
      name: "Xis Kids",
      price: 21.50,
      description: "Pão, carne (180g), molho, batata frita.",
      ingredients: ["molho", "batata frita"],
    },
    {
      id: "xis_camarao",
      name: "Xis Camarão",
      price: 41.40,
      description: "Pão, camarão (150g), requeijão Catupiry, 4 queijos, mussarela, maionese caseira, alface, tomate, ervilha, milho, acompanhado de maionese de alho negro.",
      ingredients: ["requeijão Catupiry", "4 queijos", "mussarela", "maionese caseira", "alface", "tomate", "ervilha", "milho", "maionese de alho negro"],
    },
  ],

  "HAMBÚRGUER ARTESANAL": [
    {
      id: "burguer_classico",
      name: "Burguer Clássico",
      price: 27.90,
      description: "Pão brioche, hambúrguer 180g, queijo, bacon crocante e maionese caseira.",
      ingredients: ["queijo", "bacon crocante", "maionese caseira"],
    },
    {
      id: "grill_bbq_premium",
      name: "Grill BBQ Premium",
      price: 32.00,
      description: "Hambúrguer 180g grelhado, queijo prato, bacon crocante, pimentão vermelho, cebola roxa, molho barbecue e maionese artesanal de alho negro no pão brioche.",
      ingredients: ["queijo prato", "bacon crocante", "pimentão vermelho", "cebola roxa", "molho barbecue", "maionese artesanal de alho negro"],
    },
    {
      id: "grill_doce_de_leite",
      name: "Grill Doce de Leite",
      price: 27.00,
      description: "Hambúrguer 180g suculento com queijo coalho, pão brioche selado e finalizado com doce de leite cremoso. Uma explosão de sabor agridoce!",
      ingredients: ["queijo coalho", "doce de leite cremoso"],
    },
    {
      id: "grill_coalho_black",
      name: "Grill Coalho Black",
      price: 35.00,
      description: "Pão brioche, hambúrguer 180g, queijo coalho empanado, alface e maionese de alho negro.",
      ingredients: ["queijo coalho empanado", "alface", "maionese de alho negro"],
    },
    {
      id: "grill_black_garlic",
      name: "Grill Black Garlic",
      price: 42.00,
      description: "Hambúrguer premium com blend de 180g, pão brioche, maionese de alho negro, cheddar, bacon e cebola caramelizada, servido com batata frita com bacon.",
      ingredients: ["maionese de alho negro", "cheddar", "bacon", "cebola caramelizada", "batata frita com bacon"],
    },
  ],

  "LINHA ALHO NEGRO": [
    {
      id: "pao_alho_negro_alcatra",
      name: "Pão de Alho Negro com Alcatra",
      price: 35.00,
      description: "Pão de parmesão com orégano, nossa pasta exclusiva de alho negro, 180g de alcatra bovina em iscas e queijo mussarela gratinado.",
      ingredients: ["pasta de alho negro", "alcatra bovina", "queijo mussarela", "orégano"],
    },
    {
      id: "pao_alho_negro_coracao_bacon",
      name: "Pão de Alho Negro com Coração e Bacon",
      price: 38.90,
      description: "Pão de parmesão com orégano, pasta de alho negro cremosa, 180g de coraçãozinho temperado, bacon crocante e mussarela gratinada.",
      ingredients: ["pasta de alho negro", "coraçãozinho", "bacon crocante", "mussarela", "orégano"],
    },
    {
      id: "pao_alho_negro_costela",
      name: "Pão de Alho Negro com Costela Desfiada",
      price: 39.90,
      description: "Pão de parmesão com orégano, pasta de alho negro artesanal, 180g de costela bovina desfiada lentamente e queijo gratinado derretendo.",
      ingredients: ["pasta de alho negro", "costela desfiada", "queijo gratinado", "orégano"],
    },
  ],

  "PORÇÕES": [
    {
      id: "camarao_m",
      name: "Camarão à Milanesa M (250g)",
      price: 45.00,
      description: "Porção média de camarão empanado e frito, crocante por fora e suculento por dentro.",
      ingredients: [],
    },
    {
      id: "camarao_g",
      name: "Camarão à Milanesa G (500g)",
      price: 75.00,
      description: "Porção grande de camarão à milanesa.",
      ingredients: [],
    },
    {
      id: "isca_tainha_m",
      name: "Isca de Tainha M (250g)",
      price: 28.00,
      description: "Iscas (filés) de tainha empanadas, porção média.",
      ingredients: [],
    },
    {
      id: "isca_tainha_g",
      name: "Isca de Tainha G (500g)",
      price: 45.00,
      description: "Porção grande de iscas de tainha empanadas.",
      ingredients: [],
    },
    {
      id: "pasteis_costela",
      name: "6 Pastéis de Costela c/ Catupiry",
      price: 28.00,
      description: "Seis pastéis recheados com costela bovina desfiada e catupiry 4 queijos.",
      ingredients: [],
    },
    {
      id: "pasteis_camarao",
      name: "6 Pastéis de Camarão c/ Catupiry",
      price: 36.00,
      description: "Seis pastéis recheados com camarão e queijo Catupiry.",
      ingredients: [],
    },
    {
      id: "batata_m",
      name: "Porção de Batata M (200g)",
      price: 15.00,
      description: "Porção média de batatas fritas, crocantes e douradas.",
      ingredients: [],
    },
    {
      id: "batata_g",
      name: "Porção de Batata G (400g)",
      price: 22.00,
      description: "Porção grande de batatas fritas.",
      ingredients: [],
    },
    {
      id: "batata_bacon_m",
      name: "Batata com Bacon M (200g)",
      price: 22.00,
      description: "Porção média de batatas fritas com bacon crocante.",
      ingredients: [],
    },
    {
      id: "batata_bacon_g",
      name: "Batata com Bacon G (400g)",
      price: 29.00,
      description: "Porção grande de batatas fritas com bacon crocante, ideal para compartilhar.",
      ingredients: [],
    },
  ],

  "BEBIDAS GELADAS": [
    {
      id: "cerveja_long_neck",
      name: "Cervejas Long Neck",
      price: 12.00,
      description: "Heineken, Corona.",
      ingredients: [],
    },
    {
      id: "cerveja_lata",
      name: "Cerveja em Lata",
      price: 7.00,
      description: "Original, bem gelada, lata.",
      ingredients: [],
    },
    {
      id: "refri_lata",
      name: "Refrigerante Lata (350ml)",
      price: 6.00,
      description: "Coca-Cola, Guaraná Antarctica.",
      ingredients: [],
    },
    {
      id: "coca_600",
      name: "Refrigerante Coca-Cola (600ml)",
      price: 9.00,
      description: "Coca-Cola, bem gelada.",
      ingredients: [],
    },
    {
      id: "coca_2l",
      name: "Refrigerante Coca-Cola (2L)",
      price: 15.00,
      description: "Coca-Cola, bem gelada.",
      ingredients: [],
    },
    {
      id: "agua_mineral",
      name: "Água Mineral (500ml)",
      price: 5.00,
      description: "Com e sem gás.",
      ingredients: [],
    },
  ],
};

// ─── Metadados das categorias ────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  "XIS": "🥪",
  "HAMBÚRGUER ARTESANAL": "🍔",
  "LINHA ALHO NEGRO": "🧄",
  "PORÇÕES": "🍟",
  "BEBIDAS GELADAS": "🥤",
};

const CATEGORY_SORT: Record<string, number> = {
  "XIS": 1,
  "HAMBÚRGUER ARTESANAL": 2,
  "LINHA ALHO NEGRO": 3,
  "PORÇÕES": 4,
  "BEBIDAS GELADAS": 5,
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔄  Importando cardápio real do Grill Central...\n");

  let catsCreated = 0;
  let catsUpdated = 0;
  let prodsCreated = 0;
  let prodsUpdated = 0;
  const upsertedProductIds: number[] = [];

  for (const [catName, items] of Object.entries(menuData)) {
    // ── Categoria ──────────────────────────────────────────────────────────
    let category = await prisma.category.findFirst({
      where: { restaurantId: RESTAURANT_ID, name: catName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          restaurantId: RESTAURANT_ID,
          name: catName,
          emoji: CATEGORY_EMOJI[catName] ?? "🍽️",
          sortOrder: CATEGORY_SORT[catName] ?? 99,
          isActive: true,
        },
      });
      catsCreated++;
      console.log(`  ✅ Categoria criada: ${catName}`);
    } else {
      await prisma.category.update({
        where: { id: category.id },
        data: {
          emoji: CATEGORY_EMOJI[catName] ?? category.emoji,
          sortOrder: CATEGORY_SORT[catName] ?? category.sortOrder,
          isActive: true,
        },
      });
      catsUpdated++;
      console.log(`  🔄 Categoria atualizada: ${catName}`);
    }

    // ── Produtos ───────────────────────────────────────────────────────────
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ingredientsJson =
        item.ingredients.length > 0 ? JSON.stringify(item.ingredients) : null;

      let product = await prisma.product.findFirst({
        where: {
          restaurantId: RESTAURANT_ID,
          categoryId: category.id,
          name: item.name,
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            restaurantId: RESTAURANT_ID,
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: item.price,
            ingredients: ingredientsJson,
            isActive: true,
            isFeatured: false,
            sortOrder: i,
          },
        });
        prodsCreated++;
        console.log(`    ✅  ${item.name} — R$ ${item.price.toFixed(2)}`);
      } else {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            description: item.description,
            price: item.price,
            ingredients: ingredientsJson,
            isActive: true,
            sortOrder: i,
          },
        });
        prodsUpdated++;
        console.log(`    🔄  ${item.name} — R$ ${item.price.toFixed(2)}`);
      }

      upsertedProductIds.push(product.id);
    }
  }

  // ── Desativar produtos antigos (categorias gerenciadas, fora da nova lista) ──
  const managedCategoryNames = Object.keys(menuData);
  const managedCategories = await prisma.category.findMany({
    where: {
      restaurantId: RESTAURANT_ID,
      name: { in: managedCategoryNames },
    },
    select: { id: true },
  });
  const managedCategoryIds = managedCategories.map((c) => c.id);

  const stale = await prisma.product.updateMany({
    where: {
      restaurantId: RESTAURANT_ID,
      categoryId: { in: managedCategoryIds },
      id: { notIn: upsertedProductIds },
      isActive: true,
    },
    data: { isActive: false },
  });

  // ── Desativar categorias antigas que não estão na nova lista ──────────────
  const staleCategories = await prisma.category.updateMany({
    where: {
      restaurantId: RESTAURANT_ID,
      name: { notIn: managedCategoryNames },
      isActive: true,
    },
    data: { isActive: false },
  });

  // ── Relatório ─────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log("✅  Importação concluída!");
  console.log(`   📂  Categorias: ${catsCreated} criadas, ${catsUpdated} atualizadas`);
  console.log(`   🍔  Produtos:   ${prodsCreated} criados, ${prodsUpdated} atualizados`);
  if (stale.count > 0)
    console.log(`   ⚠️   ${stale.count} produto(s) antigo(s) desativados`);
  if (staleCategories.count > 0)
    console.log(`   ⚠️   ${staleCategories.count} categoria(s) antiga(s) desativadas`);
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante importação:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
