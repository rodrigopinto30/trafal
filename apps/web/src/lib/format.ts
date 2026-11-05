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
