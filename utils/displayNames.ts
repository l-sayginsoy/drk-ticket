/**
 * Kurze UI-Anzeige für Personen: ein Token (z. B. Rolle/Label „Haustechniker“, „Hauswirtschaft“)
 * bleibt unverändert — so wie in den Stammdaten angelegt. Bei Vor- und Nachnamen nur der Vorname
 * (erstes Wort).
 *
 * Für E-Mails und gespeicherte Texte immer den vollen gespeicherten Namen (`User.name`) verwenden.
 */
export function displayNameShort(name: string | null | undefined): string {
  if (name == null) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return parts[0];
}

/** Vergleich von Stammdaten-Namen mit Ticketfeldern (Unicode, Mehrfach-Leerzeichen). */
export function normalizePersonName(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}
