/**
 * Feiertage Rheinland-Pfalz — zur Laufzeit von feiertage-api.de (keine fest eingebetteten Listen).
 * Bei Netzwerkfehler: leeres Set (nur Sa/So-Verschiebung greift dann).
 */

const API = (year: number) =>
  `https://feiertage-api.de/api/?jahr=${encodeURIComponent(String(year))}&nur_land=RP`;

export async function fetchRpHolidays(years: number[]): Promise<Set<string>> {
  const uniq = Array.from(new Set(years.filter((y) => Number.isFinite(y)))).sort((a, b) => a - b);
  const out = new Set<string>();
  await Promise.all(
    uniq.map(async (year) => {
      try {
        const res = await fetch(API(year), { method: 'GET' });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, { datum?: string }>;
        for (const v of Object.values(data)) {
          const d = v?.datum;
          if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.add(d);
        }
      } catch {
        /* ignore */
      }
    })
  );
  return out;
}
