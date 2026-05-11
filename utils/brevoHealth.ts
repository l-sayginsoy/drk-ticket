/** Browser-Event + localStorage: App zeigt Admin-Banner bei Brevo-Problemen. */
export const BREVO_MAIL_STATUS_EVENT = 'drk-brevo-mail-status';

const LS_ERROR = 'drk_brevo_mail_error';

export type BrevoMailStatusDetail = { ok: boolean; status?: number; message?: string };

export function emitBrevoMailStatus(detail: BrevoMailStatusDetail): void {
  try {
    window.dispatchEvent(new CustomEvent(BREVO_MAIL_STATUS_EVENT, { detail }));
  } catch {
    /* ignore */
  }
  try {
    if (detail.ok) {
      localStorage.removeItem(LS_ERROR);
    } else {
      localStorage.setItem(
        LS_ERROR,
        JSON.stringify({
          at: Date.now(),
          status: detail.status ?? 0,
          message: detail.message || 'Unbekannter Fehler',
        })
      );
    }
  } catch {
    /* ignore */
  }
}

export function readStoredBrevoMailError(): { status: number; message: string } | null {
  try {
    const raw = localStorage.getItem(LS_ERROR);
    if (!raw) return null;
    const j = JSON.parse(raw) as { status?: number; message?: string };
    if (!j?.message) return null;
    return { status: Number(j.status) || 0, message: String(j.message) };
  } catch {
    return null;
  }
}

/** Prüft, ob der API-Key bei Brevo gültig ist (ohne Mail zu versenden). */
export async function checkBrevoAccountApi(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, status: 0, message: 'VITE_BREVO_API_KEY fehlt im Build.' };
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: { 'api-key': key, Accept: 'application/json' },
    });
    const text = await res.text();
    if (res.ok) return { ok: true, status: res.status, message: '' };
    let msg = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j?.message) msg = String(j.message);
    } catch {
      /* keep raw slice */
    }
    return { ok: false, status: res.status, message: msg || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, message: String(e) };
  }
}
