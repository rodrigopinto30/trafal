const DEFAULT_RATIO = { width: 16, height: 9 } as const;

export type DisplayRatio = { width: number; height: number };

export function parseDisplayRatio(value: string): DisplayRatio {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value);
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  return width > 0 && height > 0 ? { width, height } : DEFAULT_RATIO;
}
