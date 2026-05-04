/** Fallback, wenn kein VITE_BREVO_API_KEY beim Build gesetzt war: Schlüssel in Einstellungen speichern (nur dieser Browser). */
const LS_KEY = 'drk_facility_brevo_api_key';

export function getBrevoApiKeyForClient(): string {
  const fromEnv = (import.meta.env.VITE_BREVO_API_KEY as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  try {
    return (localStorage.getItem(LS_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setBrevoApiKeyInBrowser(key: string): void {
  try {
    const t = key.trim();
    if (!t) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, t);
  } catch {
    /* ignore */
  }
}

export function clearBrevoApiKeyFromBrowser(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasBrevoKeyInBrowserStorage(): boolean {
  try {
    return !!(localStorage.getItem(LS_KEY) || '').trim();
  } catch {
    return false;
  }
}
