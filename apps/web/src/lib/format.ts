const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const RELATIVE_UNITS: readonly { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "month", seconds: 30 * DAY },
  { unit: "week", seconds: 7 * DAY },
  { unit: "day", seconds: DAY },
  { unit: "hour", seconds: HOUR },
  { unit: "minute", seconds: MINUTE },
];

export function formatCompactNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatRelativeTime(locale: string, date: Date | string, now: Date): string {
  const elapsedSeconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const match = RELATIVE_UNITS.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds);
  if (!match) return formatter.format(0, "second");
  return formatter.format(Math.round(elapsedSeconds / match.seconds), match.unit);
}

/** Human-readable file size with binary units (1 MB = 1024 × 1024 bytes), e.g. «200 MB» or «1,5 MB». */
export function formatBytes(locale: string, bytes: number): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 || Number.isInteger(value) ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)} ${units[unit]}`;
}
