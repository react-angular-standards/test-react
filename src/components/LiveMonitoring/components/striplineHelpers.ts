// --- Utilities ---
export const fmt = (d: Date | null | undefined): string => {
  if (!d) return "--";
  return d.toISOString().substring(11, 23); // HH:mm:ss.SSS
};

export const fmtDiff = (
  d1: Date | null | undefined,
  d2: Date | null | undefined,
): string => {
  if (!d1 || !d2) return "--";
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const s = Math.floor(diffMs / 1000);
  const ms = diffMs % 1000;
  return `${s}.${ms.toString().padStart(3, "0")}s`;
};

export const fmtNum = (n: number | null | undefined): string => {
  if (n == null) return "--";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
};

export const findClosestValue = (
  dataPoints: { x: number | Date; y: number }[],
  ts: Date,
): number | null => {
  if (!dataPoints || dataPoints.length === 0) return null;
  const targetTime = ts.getTime();

  let closest = dataPoints[0];
  let minDiff = Math.abs(
    (closest.x instanceof Date ? closest.x.getTime() : closest.x) - targetTime,
  );

  for (let i = 1; i < dataPoints.length; i++) {
    const pt = dataPoints[i];
    const ptTime = pt.x instanceof Date ? pt.x.getTime() : pt.x;
    const diff = Math.abs(ptTime - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pt;
    }
  }
  return closest.y;
};

