export type DeviceClass = "desktop" | "mobile" | "tablet";

type DeviceInput = { innerWidth: number; coarsePointer: boolean };

/** Rough device class for play statistics. Only this class is stored: never an IP address or a user agent. */
export function classifyDevice({ innerWidth, coarsePointer }: DeviceInput): DeviceClass {
  if (!coarsePointer) return "desktop";
  return innerWidth < 768 ? "mobile" : "tablet";
}
