// Genera los iconos de la PWA que derivan de public/app-icon-1024.png:
// - icon-maskable-{192,512}.png: el icono a pantalla completa con el dibujo
//   dentro de la zona segura (círculo central del 80 %), para que Android no
//   lo recorte al aplicar la máscara del launcher.
// - badge-96.png: silueta blanca sobre transparente (la cartera de lucide)
//   para la barra de estado de Android, que solo usa el canal alfa.
// Uso: node scripts/generate-pwa-icons.mjs (sharp viene con Next).
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = `${root}public/app-icon-1024.png`;
// Fondo del icono original (azul noche del cuadrado redondeado).
const background = { r: 4, g: 12, b: 28, alpha: 1 };
// Escala del dibujo: el punto más alejado de la cartera queda al 34 % del
// lado desde el centro, dentro del 40 % de la zona segura.
const CONTENT_SCALE = 0.8;

async function maskedSource() {
  // Quita las esquinas negras del cuadrado redondeado del original.
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <defs><filter id="f"><feGaussianBlur stdDeviation="40"/></filter></defs>
      <rect x="96" y="96" width="832" height="832" rx="240" fill="#fff" filter="url(#f)"/>
    </svg>`,
  );
  return sharp(source)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function maskable(size, art) {
  const content = Math.round(size * CONTENT_SCALE);
  const resized = await sharp(art).resize(content, content).png().toBuffer();
  const offset = Math.round((size - content) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(`${root}public/icon-maskable-${size}.png`);
}

async function badge() {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
      fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
    </svg>`,
  );
  await sharp(svg).png({ compressionLevel: 9 }).toFile(`${root}public/badge-96.png`);
}

const art = await maskedSource();
await maskable(512, art);
await maskable(192, art);
await badge();
console.log("PWA icons generated in public/");
