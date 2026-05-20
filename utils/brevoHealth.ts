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

/**
 * Prüft, ob Brevo erreichbar ist – ruft die Cloud Function auf (kein direkter
 * Browser→Brevo-Kontakt, kein API-Key im Frontend).
 */
export async function checkBrevoAccountApi(
  checkFn: (data: Record<string, never>) => Promise<{ data: { ok: boolean; status: number; message: string } }>
): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const result = await checkFn({});
    return result.data;
  } catch (e) {
    return { ok: false, status: 0, message: String(e) };
  }
}
