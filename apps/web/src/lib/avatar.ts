/**
 * Avatares generados: un degradé determinístico a partir del @usuario (siempre el mismo para la misma
 * persona). Hasta que se puedan subir imágenes (Fase 2), todas las cuentas usan este.
 * Todos los degradés son claros: la inicial va en el color de fondo (#07060e) con contraste ≥ 4,5:1.
 */
export const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#ff5c7a", "#ff9a3d"],
  ["#c6ff3d", "#2bd99f"],
  ["#8b5cff", "#2ee6ff"],
  ["#2ee6ff", "#1fa6c0"],
  ["#ffd36b", "#ff5c7a"],
  ["#3dc4a0", "#2ee6ff"],
  ["#ff5cc8", "#8b5cff"],
  ["#ffd36b", "#2bd99f"],
] as const;

/** Hash FNV-1a de 32 bits: simple, estable entre servidor y navegador. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function avatarGradient(seed: string): readonly [string, string] {
  return AVATAR_GRADIENTS[hash(seed.toLowerCase()) % AVATAR_GRADIENTS.length] as readonly [string, string];
}

export function avatarInitial(displayName: string, username: string): string {
  const source = displayName.trim() || username.trim();
  return (Array.from(source)[0] ?? "?").toUpperCase();
}
