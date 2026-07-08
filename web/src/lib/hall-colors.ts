// dataviz skill referans paleti (dark mode), #0a0e14 yuzeyine karsi dogrulanmis
// (node scripts/validate_palette.js ... --mode dark --surface "#0a0e14" -> ALL CHECKS PASS).
// Sira CVD-guvenlik mekanizmasidir, degistirilmemeli.
const HALL_PALETTE = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
];

export function getHallColor(hallId: string): string {
  let hash = 0;
  for (let i = 0; i < hallId.length; i++) {
    hash = (hash << 5) - hash + hallId.charCodeAt(i);
    hash |= 0;
  }
  return HALL_PALETTE[Math.abs(hash) % HALL_PALETTE.length];
}
