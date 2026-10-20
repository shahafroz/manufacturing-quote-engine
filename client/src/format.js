export const mm = (v, d = 1) => `${v.toFixed(d)} mm`;
export const cm3 = (mm3) => `${(mm3 / 1000).toFixed(2)} cm³`;
export const money = (v) => `$${v.toFixed(2)}`;
export function duration(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
