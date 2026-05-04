import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const assets = [
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/stores/background/177300151669addb2ca88b5.png', dest: 'images/header-banner.png' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/stores/logo/177300082169add875292aa_medium.jpeg', dest: 'images/restaurant-logo.jpeg' },
  // Menu item images
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770858678698d28b60e873_75_75.jpeg', dest: 'images/items/carne-na-chapa.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285114769ab8fcb8dc4f_75_75.jpeg', dest: 'images/items/file-frango-grelhado.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/1770859072698d2a406c4ff_75_75.jpeg', dest: 'images/items/strogonoff-frango.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319053969b0bd8b6e45c_75_75.jpeg', dest: 'images/items/strogonoff-carne.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285085369ab8ea52663c_75_75.jpeg', dest: 'images/items/panqueca-frango.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177319074969b0be5d60c55_75_75.jpeg', dest: 'images/items/panqueca-carne.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285096469ab8f3c25e81_75_75.jpeg', dest: 'images/items/parmegiana-frango.jpeg' },
  { url: 'https://instadelivery-public.nyc3.cdn.digitaloceanspaces.com/itens/177285102169ab8f69df2f8_75_75.jpeg', dest: 'images/items/file-milanesa.jpeg' },
];

async function downloadAsset(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const fullPath = join(publicDir, dest);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, Buffer.from(buf));
    console.log(`✓ ${dest}`);
  } catch (e) {
    console.error(`✗ ${dest}: ${e.message}`);
  }
}

// Download in batches of 4
async function downloadAll() {
  const batchSize = 4;
  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    await Promise.all(batch.map(a => downloadAsset(a.url, a.dest)));
  }
  console.log('Done!');
}

downloadAll();
