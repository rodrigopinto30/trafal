const GENRE_PALETTES: Record<string, readonly [string, string]> = {
  platformer: ["#2a1670", "#0b2f45"],
  arcade: ["#5c0f4a", "#ff5c7a"],
  puzzle: ["#062a3a", "#1fa6c0"],
  narrative: ["#0b3d2e", "#1f8f6a"],
  roguelike: ["#1a1a1a", "#6e6a80"],
  cozy: ["#4a1e0b", "#ff9a3d"],
  horror: ["#0a0a12", "#4a1020"],
  rhythm: ["#3b0f5c", "#ff5cc8"],
  racing: ["#3a2410", "#b07a45"],
  adventure: ["#06303a", "#3dc4a0"],
  strategy: ["#1b1050", "#8b5cff"],
  shooter: ["#1a0b3d", "#5c8bff"],
  simulation: ["#12402a", "#6be0a0"],
  sports: ["#2e3a0b", "#8db32a"],
  fighting: ["#4a0b1e", "#d9486b"],
  idle: ["#3a2a0b", "#e0a84a"],
  other: ["#1b1050", "#6e6a80"],
};

const GLOW_COLORS = ["139, 92, 255", "46, 230, 255", "255, 92, 200"] as const;

export type CoverArt = {
  background: string;
  iconOffset: { x: number; y: number };
};

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hasCoverPalette(genreId: string): boolean {
  return genreId in GENRE_PALETTES;
}

/** Arte de portada generado: degradé del género más un destello de color que cambia según el juego. */
export function coverArt(genreId: string | null, seed: string): CoverArt {
  const [from, to] = GENRE_PALETTES[genreId ?? "other"] ?? GENRE_PALETTES.other!;
  const bits = hash(seed);
  const angle = 115 + (bits % 50);
  const glow = GLOW_COLORS[(bits >>> 8) % GLOW_COLORS.length];
  const glowX = 15 + ((bits >>> 12) % 70);
  const glowY = 10 + ((bits >>> 20) % 60);

  return {
    background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(${glow}, 0.38), transparent 55%), linear-gradient(${angle}deg, ${from}, ${to})`,
    iconOffset: { x: 55 + ((bits >>> 4) % 25), y: 35 + ((bits >>> 16) % 30) },
  };
}
