/** The Monday (as YYYY-MM-DD, in UTC like the database) of the week a date falls in: the week of the first game of the week starts then. */
export function weekStartOf(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
