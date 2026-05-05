import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP;
if (!WHATSAPP_NUMBER) {
  throw new Error(
    "NEXT_PUBLIC_WHATSAPP não definido. Adicione ao .env:\nNEXT_PUBLIC_WHATSAPP=5500000000000"
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL || "admin@admin.com";
  const password = process.env.ADMIN_SEED_PASSWORD || "123456";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.restaurant.findFirst();

  if (existing) {
    // DB already seeded — just upsert the admin
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        restaurantId: existing.id,
        email,
        passwordHash,
        name: "Admin",
        role: "OWNER",
        isActive: true,
      },
    });
    console.log(`Admin upserted: ${admin.email}`);
    console.log("Database already seeded. Skipping restaurant/products.");
    return;
  }

  console.log("Seeding database...");

  // Create restaurant first so AdminUser FK is satisfied
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "grillcentral",
      name: "Grill Central",
      description: "Sabor das Carnes e Lanches",
      phone: "(48) 98836-2576",
      whatsapp: WHATSAPP_NUMBER,
      address: "www.grillcardapio.com.br",
      isActive: true,
    },
  });

  console.log(`Restaurant created: ${restaurant.name}`);

  // Create admin user now that restaurant exists
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: {
      restaurantId: restaurant.id,
      email,
      passwordHash,
      name: "Admin",
      role: "OWNER",
      isActive: true,
    },
  });
  console.log(`Admin upserted: ${admin.email}`);

  // Create opening hours (default: Mon-Sat lunch 11-15, every day dinner 19-23)
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  for (let day = 0; day < 7; day++) {
    await prisma.openingHour.create({
      data: {
        restaurantId: restaurant.id,
        dayOfWeek: day,
        openTime: day === 0 ? "19:00" : "11:00",
        closeTime: "23:00",
        isOpen: true,
        periodName: dayNames[day],
      },
    });
  }

  console.log("Opening hours created");

  // ── CATEGORIES ─────────────────────────────────────────────────────────────

  const catPratosExecutivos = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Pratos Executivos",
      description: "Almoço completo e saboroso",
      emoji: "🍽️",
      periodTag: "almoco",
      sortOrder: 1,
      isActive: true,
    },
  });

  const catCardapioNoite = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Cardápio da Noite",
      description: "Pratos especiais disponíveis das 19h às 23h",
      emoji: "🌙",
      periodTag: "noite",
      sortOrder: 2,
      isActive: true,
    },
  });

  const catCombos = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Combos",
      description: "Combos especiais da noite",
      emoji: "🤝",
      periodTag: "noite",
      sortOrder: 3,
      isActive: true,
    },
  });

  const catXSaladas = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "X-Saladas",
      description: "Lanches deliciosos",
      emoji: "🍔",
      periodTag: "noite",
      sortOrder: 4,
      isActive: true,
    },
  });

  const catKikao = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Kikão",
      description: "Pão de hot dog recheado artesanal",
      emoji: "🌭",
      periodTag: "noite",
      sortOrder: 5,
      isActive: true,
    },
  });

  const catPorcoesBatata = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Porções de Batata",
      description: "Batatas fritas crocantes",
      emoji: "🍟",
      periodTag: null,
      sortOrder: 6,
      isActive: true,
    },
  });

  const catPastelzinhos = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Porções de Pastelzinhos",
      description: "Pastelzinhos variados",
      emoji: "🥟",
      periodTag: null,
      sortOrder: 7,
      isActive: true,
    },
  });

  const catSucos = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Sucos Naturais",
      description: "100% naturais · Feitos na hora",
      emoji: "🍹",
      periodTag: null,
      sortOrder: 8,
      isActive: true,
    },
  });

  const catRefrigerantes = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Refrigerantes",
      description: "Bebidas geladas",
      emoji: "🥤",
      periodTag: null,
      sortOrder: 9,
      isActive: true,
    },
  });

  console.log("Categories created");

  // ── PRODUCTS ───────────────────────────────────────────────────────────────

  // Pratos Executivos
  const pratosItems = [
    { name: "Carne na Chapa", description: "arroz, macarrão, maionese, farofa, fritas e queijo coalho", price: 25, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770858678698d28b60e873_75_75.jpeg" },
    { name: "Filé de Frango Grelhado", description: "arroz, macarrão, maionese, fritas e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285114769ab8fcb8dc4f_75_75.jpeg" },
    { name: "Bife Acebolado", description: "arroz, macarrão, salada crua, farofa e fritas", price: 22, imageUrl: null },
    { name: "Bife a Cavalo", description: "arroz, macarrão, salada crua, farofa e fritas", price: 24, imageUrl: null },
    { name: "Strogonoff de Frango", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770859072698d2a406c4ff_75_75.jpeg" },
    { name: "Strogonoff de Carne", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319053969b0bd8b6e45c_75_75.jpeg" },
    { name: "Panqueca Gratinada de Frango", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285085369ab8ea52663c_75_75.jpeg" },
    { name: "Panqueca Gratinada de Carne", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319074969b0be5d60c55_75_75.jpeg" },
    { name: "Parmegiana de Frango", description: "arroz, purê e batata frita", price: 25, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285096469ab8f3c25e81_75_75.jpeg" },
    { name: "Parmegiana de Carne", description: "arroz, purê e batata frita", price: 25, imageUrl: null },
    { name: "Filé de Frango a Milanesa", description: "arroz, macarrão, feijão, maionese e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285102169ab8f69df2f8_75_75.jpeg" },
    { name: "Bisteca Bovina Grelhada", description: "arroz, macarrão, maionese e farofa", price: 22, imageUrl: null },
  ];

  for (let i = 0; i < pratosItems.length; i++) {
    const item = pratosItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catPratosExecutivos.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Cardápio da Noite
  const noiteItems = [
    { name: "Filé de Frango Grelhado", description: "arroz, macarrão, maionese, fritas e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285114769ab8fcb8dc4f_75_75.jpeg" },
    { name: "Tambaqui Frito", description: "baião e vinagrete", price: 25, imageUrl: null, isFeatured: true },
    { name: "Strogonoff de Frango", description: "arroz, purê, batata palha e farofa", price: 21, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770859072698d2a406c4ff_75_75.jpeg" },
    { name: "Carne na Chapa", description: "arroz, macarrão, maionese, farofa e batata fritas", price: 25, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770858678698d28b60e873_75_75.jpeg" },
    { name: "Panqueca de Carne", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319074969b0be5d60c55_75_75.jpeg" },
    { name: "Panqueca de Frango", description: "arroz, purê, batata palha e farofa", price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285085369ab8ea52663c_75_75.jpeg" },
    { name: "Parmegiana de Frango", description: "arroz, purê e batata frita", price: 25, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285096469ab8f3c25e81_75_75.jpeg" },
  ];

  for (let i = 0; i < noiteItems.length; i++) {
    const item = noiteItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catCardapioNoite.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl ?? null,
        isActive: true,
        isFeatured: (item as { isFeatured?: boolean }).isFeatured ?? false,
        sortOrder: i,
      },
    });
  }

  // Combos
  const combosItems = [
    { name: "Combo Solteirinho", description: "1 x-salada + 150g de batata + 1 coca em lata", price: 25, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285199369ab93f1b0a94_75_75.jpeg" },
    { name: "Combo Casadinho", description: "2 x-saladas + hot dog + fritas + 2 coca em lata", price: 30, imageUrl: null },
    { name: "Combo Triplo", description: "3 x-saladas + fritas + refrigerante", price: 40, imageUrl: null },
    { name: "Combo Família", description: "variedade de lanches + fritas + 1 refrigerante pet 2 litros", price: 70, imageUrl: null },
  ];

  for (let i = 0; i < combosItems.length; i++) {
    const item = combosItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catCombos.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // X-Saladas
  const xSaladasItems = [
    { name: "X-Salada", description: "pão, hamburger, alface, tomate, maionese", price: 8 },
    { name: "X-Salada Bacon", description: "pão, hamburger, bacon, alface, tomate, maionese, queijo", price: 15 },
    { name: "X-Tudo", description: "pão, hamburger, bacon, ovo, alface, tomate, maionese, queijo", price: 18 },
    { name: "X-Calabresa", description: "pão, calabresa, alface, tomate, maionese", price: 13 },
  ];

  for (let i = 0; i < xSaladasItems.length; i++) {
    const item = xSaladasItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catXSaladas.id,
        name: item.name,
        description: item.description,
        price: item.price,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Kikão
  const kikaoItems = [
    { name: "Kikão Simples", description: "pão de hot dog recheado artesanal", price: 8 },
    { name: "Kikão Especial", description: "pão de hot dog recheado premium", price: 10 },
  ];

  for (let i = 0; i < kikaoItems.length; i++) {
    const item = kikaoItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catKikao.id,
        name: item.name,
        description: item.description,
        price: item.price,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Porções de Batata
  const batatItems = [
    { name: "Batata Pequena (150g)", description: null, price: 10, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285215069ab94ce428b5_75_75.jpeg" },
    { name: "Batata Média (200g)", description: null, price: 15, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285219069ab94fe62de5_75_75.jpeg" },
    { name: "Batata Grande (300g)", description: null, price: 20, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285223569ab952793b5e_75_75.jpeg" },
    { name: "Batata com Bacon (300g)", description: "batata frita crocante com bacon", price: 25, imageUrl: null },
  ];

  for (let i = 0; i < batatItems.length; i++) {
    const item = batatItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catPorcoesBatata.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Pastelzinhos
  const pastelItems = [
    { name: "Pastelzinho de Carne (6 un)", price: 10 },
    { name: "Pastelzinho de Frango (6 un)", price: 10 },
    { name: "Pastelzinho de Queijo (6 un)", price: 10 },
  ];

  for (let i = 0; i < pastelItems.length; i++) {
    const item = pastelItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catPastelzinhos.id,
        name: item.name,
        price: item.price,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Sucos Naturais
  const sucosItems = [
    { name: "Taperebá 300ml", price: 7 },
    { name: "Cupuaçu 300ml", price: 7, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285273069ab9838f10ab_75_75.jpeg" },
    { name: "Graviola 300ml", price: 7, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285280369ab98c38b5c9_75_75.jpeg" },
    { name: "Manga 300ml", price: 7 },
    { name: "Goiaba 300ml", price: 7, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285291769ab994f5c5b6_75_75.jpeg" },
    { name: "Acerola 300ml", price: 7, imageUrl: "https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285263169ab97c3ab64e_75_75.jpeg" },
    { name: "Maracujá 300ml", price: 7 },
    { name: "Laranja 300ml", price: 7 },
    { name: "Morango 300ml", price: 7 },
    { name: "Abacaxi 300ml", price: 7 },
    { name: "Cupuaçu 500ml", price: 10 },
    { name: "Graviola 500ml", price: 10 },
    { name: "Manga 500ml", price: 10 },
    { name: "Goiaba 500ml", price: 10 },
    { name: "Acerola 500ml", price: 10 },
    { name: "Maracujá 500ml", price: 10 },
    { name: "Laranja 1 litro", price: 18 },
    { name: "Cupuaçu 1 litro", price: 18 },
    { name: "Graviola 1 litro", price: 18 },
    { name: "Manga 1 litro", price: 18 },
    { name: "Goiaba 1 litro", price: 18 },
    { name: "Maracujá 1 litro", price: 18 },
    { name: "Morango 1 litro", price: 18 },
  ];

  for (let i = 0; i < sucosItems.length; i++) {
    const item = sucosItems[i] as { name: string; price: number; imageUrl?: string };
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catSucos.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl ?? null,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  // Refrigerantes
  const refriItems = [
    { name: "Coca-Cola lata 350ml", price: 5 },
    { name: "Guaraná Antarctica lata 350ml", price: 5 },
    { name: "Fanta Laranja lata 350ml", price: 5 },
    { name: "Sprite lata 350ml", price: 5 },
    { name: "Coca-Cola 600ml", price: 8 },
    { name: "Guaraná Antarctica 600ml", price: 8 },
    { name: "Água mineral 500ml", price: 3 },
  ];

  for (let i = 0; i < refriItems.length; i++) {
    const item = refriItems[i];
    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: catRefrigerantes.id,
        name: item.name,
        price: item.price,
        isActive: true,
        isFeatured: false,
        sortOrder: i,
      },
    });
  }

  console.log("Products created");
  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
