const HALL_PALETTE = [
  '#34e2a3', // radar yesili
  '#f5a623', // amber
  '#5b8cff', // indigo
  '#f2545b', // mercan kirmizi
  '#22d3ee', // cyan
  '#c084fc', // menekse
  '#facc15', // sari
  '#fb7185', // pembe
];

export function getHallColor(hallId: string): string {
  let hash = 0;
  for (let i = 0; i < hallId.length; i++) {
    hash = (hash << 5) - hash + hallId.charCodeAt(i);
    hash |= 0;
  }
  return HALL_PALETTE[Math.abs(hash) % HALL_PALETTE.length];
}
