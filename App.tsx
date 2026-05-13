
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Ticket, Status, Priority, Role, GroupableKey, User, Location, AppSettings, Asset, MaintenancePlan, AvailabilityStatus, RoutingRule, RoutineSchedule, SLARule
} from './types';
import { MOCK_TICKETS, MOCK_USERS, MOCK_LOCATIONS, STATUSES, DEFAULT_APP_SETTINGS, MOCK_ASSETS, MOCK_MAINTENANCE_PLANS } from './constants';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import KanbanBoard from './components/KanbanBoard';
import NewTicketModal from './components/NewTicketModal';
import Portal from './components/Portal';
import TicketTableView from './components/TicketTableView';
import TicketDetailSidebar from './components/TicketDetailSidebar';
import BulkActionBar from './components/BulkActionBar';
import ErledigtTableView from './components/ErledigtTableView';
import ReportsView from './components/ReportsView';
import TechnicianView from './components/TechnicianView';
import SettingsView from './components/SettingsView';
import RoutineSchedulesView from './components/RoutineSchedulesView';
import RoutineNachweisView from './components/RoutineNachweisView';
import CompleteOrderDialog from './components/CompleteOrderDialog';
import DashboardRoutineLinkBar from './components/DashboardRoutineLinkBar';
import { localISODate, isRoutineDueOnCalendarDay } from './utils/routineHelpers';
import { fetchRpHolidays } from './utils/rpHolidays';
import {
  BREVO_MAIL_STATUS_EVENT,
  checkBrevoAccountApi,
  emitBrevoMailStatus,
  readStoredBrevoMailError,
  type BrevoMailStatusDetail,
} from './utils/brevoHealth';
import { displayNameShort, normalizePersonName } from './utils/displayNames';
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const LOCAL_STORAGE_KEY_TICKETS = 'facility-management-tickets';
const LOCAL_STORAGE_KEY_USERS = 'facility-management-users';
const LOCAL_STORAGE_KEY_LOCATIONS = 'facility-management-locations';
const LOCAL_STORAGE_KEY_ASSETS = 'facility-management-assets';
const LOCAL_STORAGE_KEY_PLANS = 'facility-management-plans';
const LOCAL_STORAGE_KEY_SETTINGS = 'facility-management-settings';

const DRK_TICKET_PORTAL_URL = 'https://www.drk-ticket.de';
/** An Portal-Farben angelehnt (Haustechnik Service) */
const DRK_RED = '#9d0a0e';
/** Außenbereich der E-Mail: neutral hell (kein Braunton) */
const DRK_PAGE_BG = '#ffffff';
const DRK_LOGO_EMAIL_SRC = `${DRK_TICKET_PORTAL_URL}/drk-logo-wide.png`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type DrkBrevoMailPayload =
  | { kind: 'ticket_created'; ticketId: string }
  | { kind: 'staff_note'; ticketId: string; noteText: string }
  | { kind: 'ticket_closed'; ticketId: string }
  | {
      kind: 'ticket_update';
      ticketId: string;
      status: string;
      dueDate: string;
      technician: string;
      priority: string;
      title: string;
    };

const drkBrevoBannerTitle = (p: DrkBrevoMailPayload) => {
  switch (p.kind) {
    case 'ticket_created':
      return 'Meldung erfasst';
    case 'staff_note':
      return 'Neuigkeit zu Ihrer Meldung';
    case 'ticket_closed':
      return 'Meldung abgeschlossen';
    case 'ticket_update':
      return 'Stand Ihrer Meldung';
  }
};

const buildDrkBrevoPlainText = (p: DrkBrevoMailPayload) => {
  const line = '────────────────────────────';
  if (p.kind === 'ticket_created') {
    return [
      'Haustechnik Service · DRK Ticket',
      '',
      `Ticketnummer: ${p.ticketId}`,
      '',
      'Ihre Meldung ist bei uns eingegangen und befindet sich nun in der Bearbeitung.',
      '',
      line,
      '  TICKETNUMMER',
      line,
      `  ${p.ticketId}`,
      '',
      'Direktlink (Ticket ist in der Adresse bereits enthalten):',
      `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
      '',
      'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
    ].join('\n');
  }
  if (p.kind === 'staff_note') {
    return [
      'Haustechnik Service · DRK Ticket',
      '',
      `Ticketnummer: ${p.ticketId}`,
      '',
      'Es gibt eine Neuigkeit zu Ihrer Meldung.',
      '',
      line,
      '  NEUE NOTIZ',
      line,
      `  ${p.noteText}`,
      '',
      'Direktlink zu Ihrem Ticket:',
      `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
      '',
      'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
    ].join('\n');
  }
  if (p.kind === 'ticket_update') {
    return [
      'Haustechnik Service · DRK Ticket',
      '',
      `Ticketnummer: ${p.ticketId}`,
      '',
      'Es gibt eine Aktualisierung zu Ihrer Meldung (aktueller Stand):',
      '',
      `  Status:     ${p.status}`,
      `  Fälligkeit: ${p.dueDate}`,
      `  Bearbeiter: ${p.technician}`,
      `  Priorität:  ${p.priority}`,
      `  Betreff:    ${p.title}`,
      '',
      'Direktlink zu Ihrem Ticket:',
      `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
      '',
      'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
    ].join('\n');
  }
  return [
    'Haustechnik Service · DRK Ticket',
    '',
    `Ihre Meldung mit der Ticketnummer: ${p.ticketId} wurde erfolgreich abgeschlossen.`,
    '',
    'Direktlink zu Ihrem Ticket:',
    `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
    '',
    'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
  ].join('\n');
};

const portalDeepLink = (ticketId: string) =>
  `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(ticketId)}`;

/** Eine Tabellenzeile: CTA-Button (für Zusammensetzen mit äußerem margin). */
const portalOpenButtonRowHtml = (ticketId: string) => {
  const href = portalDeepLink(ticketId);
  return `<tr><td align="left" style="padding:0;">
<table role="presentation" cellspacing="0" cellpadding="0" align="left" style="border-collapse:separate;">
<tr><td style="border-radius:10px;background:${DRK_RED};">
<a href="${href}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#fff!important;text-decoration:none;">Ticket im Portal öffnen</a>
</td></tr></table>
</td></tr>`;
};

const portalOpenButtonWrappedHtml = (ticketId: string, tableMargin: string) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:${tableMargin};">
${portalOpenButtonRowHtml(ticketId)}
</table>`;

const portalCtaHtml = (ticketId: string) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
${portalOpenButtonRowHtml(ticketId)}
</table>`;

const drkEmailShellHtml = (
  bannerTitle: string,
  innerBodyHtml: string,
  ticketId: string,
  footerCtaHtml?: string,
) => `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(bannerTitle)}</title></head>
<!-- drk-facility-dashboard-mail:v3 (Banner 1:1 wie public/email-vorschau.html) -->
<body style="margin:0;padding:0;background:${DRK_PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${DRK_PAGE_BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
<tr><td style="background:${DRK_RED};padding:0;height:20px;line-height:20px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:18px 20px;background:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="vertical-align:middle;text-align:left;padding:0;">
<img src="${DRK_LOGO_EMAIL_SRC}" alt="DRK Logo" style="display:block;margin:0;max-height:72px;max-width:360px;width:auto;height:auto;border:0;">
</td>
</tr></table>
</td></tr>
<tr><td style="background-color:#9d0a0e;background-image:linear-gradient(to top right,#9d0a0e 0%,#9d0a0e 26%,rgba(157,10,14,0.35) 44%,rgba(157,10,14,0) 62%),radial-gradient(circle,rgba(255,255,255,.14) 1px,transparent 1.6px);background-size:100% 100%,14px 14px;padding:22px 22px 26px;min-height:92px;">
<p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${escapeHtml(bannerTitle)}</p>
</td></tr>
<tr><td style="padding:24px 22px 22px;">${innerBodyHtml}</td></tr>
${
  footerCtaHtml === ''
    ? ''
    : `<tr><td style="padding:18px 22px 40px;background:#fafafa;border-top:1px solid #eee;">${footerCtaHtml ?? portalCtaHtml(ticketId)}</td></tr>`
}
</table>
<p style="max-width:580px;margin:14px auto 0;font-size:12px;color:#888;text-align:center;line-height:1.45;">Automatische Nachricht · bitte nicht auf diese E-Mail antworten</p>
<p style="max-width:580px;margin:10px auto 0;font-size:13px;font-weight:600;color:#666;text-align:center;line-height:1.3;">DRK Haustechnik Service</p>
</td></tr></table>
</body></html>`;

const buildDrkBrevoHtml = (p: DrkBrevoMailPayload) => {
  const title = drkBrevoBannerTitle(p);
  if (p.kind === 'ticket_created') {
    const inner = `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;"><strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong></p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#333;">Ihre Meldung ist bei uns eingegangen und befindet sich nun in der Bearbeitung.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '0 0 18px')}
<p style="margin:0;font-size:14px;line-height:1.55;color:#444;">Mit diesem Button öffnen Sie das Meldeportal. Ihre Ticketnummer ist im Link bereits enthalten – Sie müssen sie <strong>nicht erneut eingeben</strong>.</p>`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'ticket_update') {
    const inner = `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;"><strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong></p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#333;">Ihre Meldung wurde bearbeitet. <strong>Aktueller Stand:</strong></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:collapse;">
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;">Status</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;font-weight:600;">${escapeHtml(p.status)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;">Fälligkeit</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">${escapeHtml(p.dueDate)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;">Bearbeiter</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">${escapeHtml(p.technician)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;">Priorität</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">${escapeHtml(p.priority)}</td></tr>
<tr><td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top;">Betreff</td><td style="padding:8px 0;font-size:14px;color:#222;">${escapeHtml(p.title)}</td></tr>
</table>
<p style="margin:0;font-size:14px;line-height:1.55;color:#444;">Details im Portal – Ihre Ticketnummer ist im Link bereits hinterlegt.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '18px 0 0')}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'staff_note') {
    const inner = `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;"><strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong></p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;">Es gibt eine <strong>Neuigkeit</strong> zu Ihrer Meldung:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;"><tr><td style="background:#faf7f2;border-left:4px solid ${DRK_RED};border-radius:0 10px 10px 0;padding:16px 18px;">
<p style="margin:0;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap;">${escapeHtml(p.noteText)}</p>
</td></tr></table>
<p style="margin:0;font-size:14px;line-height:1.55;color:#444;">Details und Rückmeldung erreichen Sie über den Button – Ihre Ticketnummer ist im Link bereits hinterlegt.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '18px 0 0')}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  const inner = `
<p style="margin:0;font-size:15px;line-height:1.55;color:#333;">Ihre Meldung mit der <strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong> wurde erfolgreich abgeschlossen.</p>
<p style="margin:14px 0 0;font-size:14px;line-height:1.55;color:#444;">Zum Nachlesen oder bei Rückfragen nutzen Sie den Button – Ihr Ticket wird im Portal direkt geöffnet.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '18px 0 0')}`;
  return drkEmailShellHtml(title, inner, p.ticketId, '');
};

type SendDrkBrevoMailOpts = { silent?: boolean };

/** Brevo: dasselbe HTML wie in `public/email-vorschau.html` — direkt per REST (ohne Cloud Function). */
const sendDrkBrevoMailAsync = async (
  to: string,
  subject: string,
  payload: DrkBrevoMailPayload,
  opts?: SendDrkBrevoMailOpts
): Promise<boolean> => {
  const silent = !!opts?.silent;
  const recipient = String(to || '').trim();
  if (!recipient) {
    console.warn('Brevo: kein Empfänger (leere E-Mail-Adresse).');
    return false;
  }
  const apiKey = (import.meta.env.VITE_BREVO_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    const msg = 'E-Mail konnte nicht gesendet werden: VITE_BREVO_API_KEY fehlt im Build.';
    console.warn(msg);
    emitBrevoMailStatus({ ok: false, status: 0, message: msg });
    if (!silent) window.alert(msg);
    return false;
  }
  const senderEmail =
    (import.meta.env.VITE_BREVO_SENDER_EMAIL as string | undefined)?.trim() || 'noreply@drk-ticket.de';
  const senderName =
    (import.meta.env.VITE_BREVO_SENDER_NAME as string | undefined)?.trim() || 'DRK Haustechnik Service';
  const textContent = buildDrkBrevoPlainText(payload);
  const htmlContent = buildDrkBrevoHtml(payload);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: recipient }],
        subject,
        textContent,
        htmlContent,
      }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      let detail = bodyText.slice(0, 1200);
      try {
        const j = JSON.parse(bodyText) as { message?: string; code?: string };
        if (j?.message) detail = `${j.message}${j.code ? ` (${j.code})` : ''}`;
      } catch {
        /* Roh-Text behalten */
      }
      console.error('Brevo Fehler:', res.status, detail);
      emitBrevoMailStatus({ ok: false, status: res.status, message: detail });
      if (!silent) {
        window.alert(
          `E-Mail konnte nicht gesendet werden (Brevo HTTP ${res.status}).\n\n` +
            `Absender muss in Brevo unter „Senders & IPs“ verifiziert sein (aktuell: ${senderEmail}).\n\n` +
            detail
        );
      }
      return false;
    }
    try {
      const parsed = bodyText ? JSON.parse(bodyText) : null;
      const messageId = parsed?.messageId ? String(parsed.messageId) : '';
      console.info('Brevo OK', { status: res.status, messageId });
    } catch {
      console.info('Brevo OK', { status: res.status });
    }
    emitBrevoMailStatus({ ok: true });
    return true;
  } catch (err) {
    console.error('Brevo senden fehlgeschlagen:', err);
    const m = String(err);
    emitBrevoMailStatus({ ok: false, status: 0, message: m });
    if (!silent) window.alert(`E-Mail konnte nicht gesendet werden (Netzwerk/Browser-Block).\n\n${m}`);
    return false;
  }
};

const sendDrkBrevoMail = (to: string, subject: string, payload: DrkBrevoMailPayload, opts?: SendDrkBrevoMailOpts) => {
  void sendDrkBrevoMailAsync(to, subject, payload, opts);
};

const parseGermanDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
};

/** Reaktiv ohne Wunschtermin: Kalender-Fälligkeit = Eingangstag (TT.MM.JJJJ) + n Kalendertage (Mittag als Anker). */
const reactiveDueDateAfterCalendarDaysFromEntry = (entryDateDE: string, calendarDays: number): Date => {
    const parsed = parseGermanDate(entryDateDE);
    const base = parsed ?? new Date();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
    d.setDate(d.getDate() + calendarDays);
    return d;
};

// ADD THIS HELPER for Safari compatibility
const parseISODate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        // new Date(year, monthIndex, day)
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return null;
}

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // DRK HACK: Drastische Reduzierung der Bildgröße, um das 1MB Firebase-Limit pro Dokument nicht zu sprengen
                const MAX_LONG_EDGE = 600;
                let { width, height } = img;
                if (width > height) {
                    if (width > MAX_LONG_EDGE) {
                        height *= MAX_LONG_EDGE / width;
                        width = MAX_LONG_EDGE;
                    }
                } else {
                    if (height > MAX_LONG_EDGE) {
                        width *= MAX_LONG_EDGE / height;
                        height = MAX_LONG_EDGE;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context not available'));
                ctx.drawImage(img, 0, 0, width, height);
                // Komprimierung hochdrehen (0.4)
                resolve(canvas.toDataURL('image/jpeg', 0.4));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};


const getFutureDateInGermanFormat = (days: number): string => {
    const today = new Date(2026, 1, 7); // February is month 1. Changed for Safari.
    today.setDate(today.getDate() + days);
    return today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getFutureDateStringForUpdate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getFormattedDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // FIX: Corrected padStart call which was missing arguments. It now ensures the day string is padded to 2 digits with a leading zero.
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// FIX: Made title optional in ticketData to fix type error and handled potential undefined value.
const assignTicket = (
    ticketData: { title?: string; description?: string; },
    users: User[],
    tickets: Ticket[],
    routingRules: RoutingRule[]
): string => {
    let assignedTechnician = 'N/A';
    const fullText = `${ticketData.title || ''} ${ticketData.description || ''}`.toLowerCase();
    
    // Find a rule that matches keywords in the ticket's title or description
    const matchedRule = routingRules.find(rule => 
        rule.keyword.toLowerCase().split(',').some(kw => fullText.includes(kw.trim()))
    );

    if (matchedRule) {
        // Find all active and available technicians with the required skill
        const skilledTechnicians = users.filter(u => 
            (u.role === Role.Technician || u.role === Role.Housekeeping) && 
            u.isActive && 
            u.availability.status === AvailabilityStatus.Available && 
            u.skills.includes(matchedRule.skill)
        );
        
        if (skilledTechnicians.length > 0) {
            // Calculate current load for each skilled technician
            const techniciansWithLoad = skilledTechnicians.map(tech => ({
                ...tech,
                load: tickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length
            }));
            
            // Sort by load, ascending, to find the least busy one
            techniciansWithLoad.sort((a, b) => a.load - b.load);
            assignedTechnician = techniciansWithLoad[0].name;
        }
    }
    return assignedTechnician;
};

const safeJSONParse = <T,>(key: string, fallback: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`Error parsing ${key} from localStorage:`, error);
        return fallback;
    }
};

/** Firestore liefert manchmal kein Array — verhindert .map/.filter-Crashes in der UI */
const asUserArray = (value: unknown): User[] => (Array.isArray(value) ? (value as User[]) : MOCK_USERS);
const completionStampNow = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return {
    completionDate: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    completionTime: `${hh}:${mm}`,
  };
};

/** Reaktive Meldungen ohne Wunschtermin: Vorlauf in Kalendertagen nach Eingang. */
const REACTIVE_DEFAULT_LEAD_DAYS = 5;
reactiveDueDateAfterCalendarDaysFromEntry(
  entryDateDE,
  REACTIVE_DEFAULT_LEAD_DAYS
)

/** Strengste SLA-Regel pro Kategorie (kürzeste Antwortzeit) → deren Priorität; sonst null. */
const inferStrictestSlaPriorityForCategory = (
  categoryId: string | undefined,
  slaMatrix: SLARule[]
): Priority | null => {
  if (!categoryId || !Array.isArray(slaMatrix) || slaMatrix.length === 0) return null;

  const rules = slaMatrix.filter((r) =>
    r.categoryId === categoryId &&
    r.priority &&
    r.responseTimeHours > 0
  );

  if (rules.length === 0) return null;

  return rules.sort((a, b) => a.responseTimeHours - b.responseTimeHours).shift()?.priority ?? null;
};

/** Reaktiv ohne Wunschtermin: Eingang (Kalender) + 5 Tage vs. kürzeste SLA-Frist — gleiche Logik wie bei Neuanlage. */
const computeReactiveDueDateWithoutWunsch = (
  entryDateDE: string,
  categoryId: string | undefined,
  slaMatrix: SLARule[]
): string => {
  const deadlineCal = reactiveDueDateAfterCalendarDaysFromEntry(entryDateDE, REACTIVE_DEFAULT_LEAD_DAYS);
  const rulesForCat = slaMatrix.filter((r) => r.categoryId === categoryId);
  let deadlineSla: Date | null = null;
  if (rulesForCat.length > 0) {
    const minHours = Math.min(...rulesForCat.map((r) => r.responseTimeHours));
    const d = new Date();
    d.setHours(d.getHours() + minHours);
    deadlineSla = d;
  }
  const chosen =
    deadlineSla !== null && deadlineSla.getTime() < deadlineCal.getTime() ? deadlineSla : deadlineCal;
  return chosen.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const normalizeTicket = (t: Ticket): Ticket => {
  const techRaw = typeof t.technician === 'string' ? t.technician : 'N/A';
  const technician = techRaw.trim() || 'N/A';
  const completionTimeRaw = t.completionTime;
  const completionTimeNorm =
    typeof completionTimeRaw === 'string' && completionTimeRaw.trim() ? completionTimeRaw.trim() : undefined;
  const reporterEmailRaw = typeof t.reporter_email === 'string' ? t.reporter_email.trim() : '';
  const base: Ticket = {
    ...t,
    technician,
    area: typeof t.area === 'string' ? t.area.trim() : t.area,
    location: typeof t.location === 'string' ? t.location.trim() : t.location,
    reporter: typeof t.reporter === 'string' ? t.reporter.trim() : t.reporter,
  };
  if (reporterEmailRaw) {
    base.reporter_email = reporterEmailRaw;
  } else {
    delete (base as Partial<Ticket>).reporter_email;
  }
  if (completionTimeNorm !== undefined) {
    base.completionTime = completionTimeNorm;
  } else {
    delete (base as Partial<Ticket>).completionTime;
  }
  return base;
};
const asTicketArray = (value: unknown): Ticket[] =>
  Array.isArray(value) ? (value as Ticket[]).map(normalizeTicket) : MOCK_TICKETS.map(normalizeTicket);
const asLocationArray = (value: unknown): Location[] =>
  Array.isArray(value) ? (value as Location[]) : MOCK_LOCATIONS;
const asAssetArray = (value: unknown): Asset[] => (Array.isArray(value) ? (value as Asset[]) : MOCK_ASSETS);
const asPlanArray = (value: unknown): MaintenancePlan[] =>
  Array.isArray(value) ? (value as MaintenancePlan[]) : MOCK_MAINTENANCE_PLANS;

const mergeAppSettingsRemote = (value: unknown, prev: AppSettings): AppSettings => {
  if (!value || typeof value !== 'object') return prev;
  const v = value as Partial<AppSettings>;
  return {
    ...DEFAULT_APP_SETTINGS,
    ...prev,
    ...v,
    ticketCategories: Array.isArray(v.ticketCategories) ? v.ticketCategories : prev.ticketCategories,
    slaMatrix: Array.isArray(v.slaMatrix) ? v.slaMatrix : prev.slaMatrix,
    routingRules: Array.isArray(v.routingRules) ? v.routingRules : prev.routingRules,
    routineSchedules: Array.isArray(v.routineSchedules) ? v.routineSchedules : prev.routineSchedules ?? [],
    routineDayCompletions: Array.isArray(v.routineDayCompletions)
      ? v.routineDayCompletions
      : prev.routineDayCompletions ?? [],
    portalMaintenance: v.portalMaintenance ?? prev.portalMaintenance,
    portalConfig: { ...DEFAULT_APP_SETTINGS.portalConfig, ...prev.portalConfig, ...v.portalConfig },
    dueDateRules: v.dueDateRules ?? prev.dueDateRules,
  };
};

const App: React.FC = () => {
  const isServiceTeamRole = (role: Role) => role === Role.Technician || role === Role.Housekeeping;
  const [currentUser, setCurrentUser] = useState<User | null>(() => safeJSONParse('currentUser', null));
  const [showPortalOverlay, setShowPortalOverlay] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).has('ticket');
    } catch {
      return false;
    }
  });

  // --- Main Data State ---
  const [tickets, setTickets] = useState<Ticket[]>(() =>
    safeJSONParse<Ticket[]>(LOCAL_STORAGE_KEY_TICKETS, MOCK_TICKETS).map(normalizeTicket)
  );
  const [users, setUsers] = useState<User[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_USERS, MOCK_USERS));
  const [locations, setLocations] = useState<Location[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_LOCATIONS, MOCK_LOCATIONS));
  const [assets, setAssets] = useState<Asset[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_ASSETS, MOCK_ASSETS));
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_PLANS, MOCK_MAINTENANCE_PLANS));
  const [appSettings, setAppSettings] = useState<AppSettings>(() => ({ ...DEFAULT_APP_SETTINGS, ...safeJSONParse(LOCAL_STORAGE_KEY_SETTINGS, {}) }));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [rpHolidayYmdList, setRpHolidayYmdList] = useState<string[]>([]);
  /** Admin: sichtbarer Hinweis wenn Brevo (Transaktions-Mail) nicht funktioniert */
  const [brevoAdminAlert, setBrevoAdminAlert] = useState<{ message: string; status: number } | null>(null);
  const [brevoAlertSuppressed, setBrevoAlertSuppressed] = useState(false);
  /** Sidebar-Status wie „Synchronisiert“ */
  const [brevoMailOk, setBrevoMailOk] = useState<boolean | null>(null);
  const [brevoMailLastChecked, setBrevoMailLastChecked] = useState<Date | null>(null);
  const isRemoteUpdate = useRef(false);
  const prevUsersRef = useRef<User[]>(users);

  useEffect(() => {
    const load = () => {
      const y = new Date().getFullYear();
      fetchRpHolidays([y - 1, y, y + 1])
        .then((s) => setRpHolidayYmdList(Array.from(s)))
        .catch(() => setRpHolidayYmdList([]));
    };
    load();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const onStatus = (ev: Event) => {
      const e = ev as CustomEvent<BrevoMailStatusDetail>;
      const d = e.detail;
      if (!d) return;
      setBrevoMailLastChecked(new Date());
      if (d.ok) {
        setBrevoAdminAlert(null);
        setBrevoAlertSuppressed(false);
        setBrevoMailOk(true);
      } else {
        setBrevoAlertSuppressed(false);
        setBrevoAdminAlert({ message: d.message || 'Fehler', status: d.status ?? 0 });
        setBrevoMailOk(false);
      }
    };
    window.addEventListener(BREVO_MAIL_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(BREVO_MAIL_STATUS_EVENT, onStatus);
  }, []);

  /** Admin: gespeicherten letzten Fehler anzeigen (z. B. nach Reload) */
  useEffect(() => {
    if (currentUser?.role !== Role.Admin) {
      setBrevoAdminAlert(null);
      return;
    }
    const stored = readStoredBrevoMailError();
    if (stored) setBrevoAdminAlert(stored);
  }, [currentUser?.role]);

  /** Admin: Brevo-API regelmäßig prüfen (ohne Mail), damit deaktivierte Keys sofort auffallen */
  useEffect(() => {
    if (!isInitialized || currentUser?.role !== Role.Admin) return;
    const apiKey = (import.meta.env.VITE_BREVO_API_KEY as string | undefined)?.trim();
    let cancelled = false;
    const run = async () => {
      const r = await checkBrevoAccountApi(apiKey || '');
      if (cancelled) return;
      setBrevoMailLastChecked(new Date());
      if (!r.ok) {
        emitBrevoMailStatus({ ok: false, status: r.status, message: r.message });
      } else {
        emitBrevoMailStatus({ ok: true });
      }
    };
    void run();
    const id = window.setInterval(run, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isInitialized, currentUser?.role]);

  // --- Firebase Sync Logic ---
  useEffect(() => {
    const fetchData = async () => {
      setIsSyncing(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'app_data'));
        if (!querySnapshot.empty) {
          isRemoteUpdate.current = true;
          querySnapshot.forEach((doc) => {
            const key = doc.id;
            const value = doc.data().value;
            switch (key) {
              case LOCAL_STORAGE_KEY_TICKETS:
                setTickets(asTicketArray(value));
                break;
              case LOCAL_STORAGE_KEY_USERS:
                setUsers(asUserArray(value));
                break;
              case LOCAL_STORAGE_KEY_LOCATIONS:
                setLocations(asLocationArray(value));
                break;
              case LOCAL_STORAGE_KEY_ASSETS:
                setAssets(asAssetArray(value));
                break;
              case LOCAL_STORAGE_KEY_PLANS:
                setMaintenancePlans(asPlanArray(value));
                break;
              case LOCAL_STORAGE_KEY_SETTINGS:
                setAppSettings((prev) => mergeAppSettingsRemote(value, prev));
                break;
            }
          });
          setLastSyncTime(new Date());
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
        }
        setIsInitialized(true);
      } catch (err) {
        console.error('Error fetching from Firebase:', err);
        // Even if it fails, we mark as initialized to allow local changes to sync
        setIsInitialized(true);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchData();

    // Subscribe to realtime changes
    const unsubscribe = onSnapshot(collection(db, 'app_data'), (snapshot) => {
      isRemoteUpdate.current = true;
      let hasChanges = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          hasChanges = true;
          const key = change.doc.id;
          const value = change.doc.data().value;
          switch (key) {
            case LOCAL_STORAGE_KEY_TICKETS:
              setTickets(asTicketArray(value));
              break;
            case LOCAL_STORAGE_KEY_USERS:
              setUsers(asUserArray(value));
              break;
            case LOCAL_STORAGE_KEY_LOCATIONS:
              setLocations(asLocationArray(value));
              break;
            case LOCAL_STORAGE_KEY_ASSETS:
              setAssets(asAssetArray(value));
              break;
            case LOCAL_STORAGE_KEY_PLANS:
              setMaintenancePlans(asPlanArray(value));
              break;
            case LOCAL_STORAGE_KEY_SETTINGS:
              setAppSettings((prev) => mergeAppSettingsRemote(value, prev));
              break;
          }
        }
      });
      if (hasChanges) {
        setLastSyncTime(new Date());
        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      } else {
        isRemoteUpdate.current = false;
      }
    }, (error) => {
      console.error('Firebase onSnapshot error:', error);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const syncToFirebase = async (key: string, value: any) => {
    if (isRemoteUpdate.current || !isInitialized) return;
    try {
      const sanitizedValue = JSON.parse(JSON.stringify(value));
      await setDoc(doc(db, 'app_data', key), { value: sanitizedValue, updated_at: new Date().toISOString() });
      setLastSyncTime(new Date());
    } catch (err) {
      console.error(`Error syncing ${key} to Firebase:`, err);
    }
  };

  // --- UI State ---
  const [filters, setFilters] = useState({ area: 'Alle', technician: 'Alle', priority: 'Alle', status: 'Alle', search: '' });
  const [groupBy, setGroupBy] = useState<GroupableKey | 'none'>('none');
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  /** Offener Bestätigungsdialog vor Abschluss (Entwurf mit Status „Abgeschlossen“). */
  const [completeOrderDialog, setCompleteOrderDialog] = useState<{ draft: Ticket } | null>(null);

  // Bearbeiter sollen nach Refresh nicht im Admin-Dashboard landen.
  useEffect(() => {
    if (!currentUser) return;
    if (!isServiceTeamRole(currentUser.role)) return;
    if (
      currentView === 'dashboard' ||
      currentView === 'reports' ||
      currentView === 'techniker' ||
      currentView === 'settings' ||
      currentView === 'erledigt'
    ) {
      setCurrentView('tech-dashboard');
    }
  }, [currentUser, currentView]);

  // --- Effects to persist state ---
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Migration for old data
  useEffect(() => {
    if (isInitialized) {
      const officialName = 'DRK Haustechnik Service';
      
      // Update if appName is missing or still set to the old name
      if (!appSettings.appName || appSettings.appName === 'DRK Facility Dashboard') {
        setAppSettings(prev => ({
          ...prev,
          appName: officialName
        }));
      }
    }
  }, [isInitialized, appSettings.appName]);

  useEffect(() => {
    if (isInitialized) {
      setUsers(prev => {
          let changed = false;
          const updated = prev.filter(u => u.id !== 'user-5').map(u => {
            if (u.id === 'user-2' && (u.name !== 'Heiko Saupert' || u.password !== 'Heiko1')) { changed = true; return { ...u, name: 'Heiko Saupert', password: 'Heiko1' }; }
            if (u.id === 'user-3' && (u.name !== 'Ali Najafi' || u.password !== 'Ali1')) { changed = true; return { ...u, name: 'Ali Najafi', password: 'Ali1' }; }
            if (u.id === 'user-4' && (u.name !== 'Torsten Isselhard' || u.password !== 'Torsten1')) { changed = true; return { ...u, name: 'Torsten Isselhard', password: 'Torsten1' }; }
            if (u.id === 'user-1' && (u.name !== 'admin' || u.password !== 'admin')) { changed = true; return { ...u, name: 'admin', password: 'admin' }; }
            return u;
          });
          return (changed || updated.length !== prev.length) ? updated : prev;
        });

        setTickets(prev => {
          let changed = false;
          const updated = prev.map(t => {
            let newTech = t.technician;
            if (newTech === 'Heiko') newTech = 'Heiko Saupert';
            if (newTech === 'Torsten') newTech = 'Torsten Isselhard';
            if (newTech === 'Ali') newTech = 'Ali Najafi';
            
            let newId = t.id;
            if (newId.startsWith('M-')) {
               newId = newId.substring(2);
            }

            if (newTech !== t.technician || newId !== t.id) {
              changed = true;
              return { ...t, technician: newTech, id: newId };
            }
            return t;
          });
          return changed ? updated : prev;
        });
      }
    }, [isInitialized]);

  useEffect(() => { localStorage.setItem('currentUser', JSON.stringify(currentUser)); }, [currentUser]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_TICKETS, JSON.stringify(tickets));
    // syncToFirebase(LOCAL_STORAGE_KEY_TICKETS, tickets);
  }, [tickets]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(users));
    // syncToFirebase(LOCAL_STORAGE_KEY_USERS, users);
  }, [users]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_LOCATIONS, JSON.stringify(locations));
    // syncToFirebase(LOCAL_STORAGE_KEY_LOCATIONS, locations);
  }, [locations]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_ASSETS, JSON.stringify(assets));
    // syncToFirebase(LOCAL_STORAGE_KEY_ASSETS, assets);
  }, [assets]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(maintenancePlans));
    // syncToFirebase(LOCAL_STORAGE_KEY_PLANS, maintenancePlans);
  }, [maintenancePlans]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(appSettings));
   // syncToFirebase(LOCAL_STORAGE_KEY_SETTINGS, appSettings);
  }, [appSettings]);

  // --- Core App Logic Effects ---
  // Automatic Ticket Re-assignment on Technician Leave OR Return
  useEffect(() => {
      const prevUsers = prevUsersRef.current;
      if (!prevUsers || prevUsers.length === 0) {
          prevUsersRef.current = users;
          return;
      }

      // 1. Handle Absence
      const newlyAbsentUsers = users.filter(user => {
          const prevUser = prevUsers.find(p => p.id === user.id);
          return prevUser && 
              prevUser.availability && 
              user.availability &&
              prevUser.availability.status !== AvailabilityStatus.OnLeave &&
              user.availability.status === AvailabilityStatus.OnLeave;
      });

      if (newlyAbsentUsers.length > 0) {
          console.log("Redistribution triggered for:", newlyAbsentUsers.map(u => u.name));
          
          setTickets(currentTickets => {
              let ticketsToUpdate = [...currentTickets];
              let updated = false;
              let movedTotal = 0;

              const availableTechnicians = users.filter(u => 
                  (u.role === Role.Technician || u.role === Role.Housekeeping) && 
                  u.isActive && 
                  u.availability && 
                  (u.availability.status === AvailabilityStatus.Available)
              );

              if (availableTechnicians.length === 0) {
                  console.warn("No available technicians for redistribution.");
                  alert("Warnung: Ein Bearbeiter ist jetzt abwesend, aber es gibt keine verfügbaren Kollegen für die Umverteilung!");
                  return currentTickets; 
              }

              const techLoadMap = new Map<string, number>();
              availableTechnicians.forEach(tech => {
                  const currentLoad = currentTickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length;
                  techLoadMap.set(tech.name, currentLoad);
              });

              newlyAbsentUsers.forEach(absentUser => {
                  const leaveUntilDate = parseISODate(absentUser.availability.leaveUntil);
                  if (leaveUntilDate) leaveUntilDate.setHours(23, 59, 59, 999);

                  const criticalTickets = currentTickets.filter(t => {
                      if (t.technician !== absentUser.name || t.status === Status.Abgeschlossen) return false;
                      if (!leaveUntilDate) return true;
                      if (t.priority === Priority.Hoch) return true;
                      if (t.status === Status.Ueberfaellig) return true;
                      if (t.dueDate) {
                          const dueDate = parseGermanDate(t.dueDate);
                          if (dueDate && dueDate.getTime() <= leaveUntilDate.getTime()) return true;
                      }
                      return false;
                  });

                  if (criticalTickets.length > 0) {
                      criticalTickets.forEach(ticket => {
                          availableTechnicians.sort((a, b) => (techLoadMap.get(a.name) || 0) - (techLoadMap.get(b.name) || 0));
                          const targetTech = availableTechnicians[0];
                          if (targetTech) {
                              const ticketIndex = ticketsToUpdate.findIndex(t => t.id === ticket.id);
                              if (ticketIndex !== -1) {
                                  const date = new Date();
                                  const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
                                  const formattedTime = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                  const note = `AUTO-UMVERTEILUNG: Von ${absentUser.name} an ${targetTech.name}. Grund: Abwesend bis ${absentUser.availability.leaveUntil || 'unbekannt'}. (${formattedDate}, ${formattedTime})`;
                                  ticketsToUpdate[ticketIndex] = { ...ticketsToUpdate[ticketIndex], technician: targetTech.name, notes: [...(ticketsToUpdate[ticketIndex].notes || []), note] };
                                  updated = true;
                                  movedTotal++;
                                  techLoadMap.set(targetTech.name, (techLoadMap.get(targetTech.name) || 0) + 1);
                              }
                          }
                      });
                  }
              });

              if (updated) {
                  alert(`Erfolg: ${movedTotal} Tickets wurden automatisch umverteilt.`);
                  return ticketsToUpdate;
              }
              return currentTickets;
          });
      }

      // 2. Handle Return (Availability OR Activation OR New User)
      const returningTechnicians = users.filter(user => {
          const prevUser = prevUsers.find(u => u.id === user.id);
          const isAvailable =
            (user.role === Role.Technician || user.role === Role.Housekeeping) &&
            user.isActive &&
            user.availability.status === AvailabilityStatus.Available;
          
          if (!prevUser) return isAvailable; // New available technician

          const wasAvailable =
            (prevUser.role === Role.Technician || prevUser.role === Role.Housekeeping) &&
            prevUser.isActive &&
            prevUser.availability.status === AvailabilityStatus.Available;
          return !wasAvailable && isAvailable;
      });

      if (returningTechnicians.length > 0) {
          console.log("RÜCKKEHR LOGIK: Gefundene Rückkehrer:", returningTechnicians.map(u => u.name));
          setTickets(currentTickets => {
              const openTickets = currentTickets.filter(t => t.status === Status.Offen);
              let ticketsUpdated = false;
              let updatedTickets = [...currentTickets];
              let reassignedCount = 0;

              // Helfer zur Lastberechnung
              const getLoad = (techName: string, ticketList: Ticket[]) => 
                  ticketList.filter(t => t.technician === techName && t.status !== Status.Abgeschlossen).length;

              // Durchschnittliche Last berechnen
              const activeTechs = users.filter(
                u =>
                  (u.role === Role.Technician || u.role === Role.Housekeeping) &&
                  u.isActive &&
                  u.availability.status === AvailabilityStatus.Available
              );
              const totalActiveTickets = updatedTickets.filter(t => t.status !== Status.Abgeschlossen && t.technician !== 'N/A').length;
              const avgLoad = activeTechs.length > 0 ? totalActiveTickets / activeTechs.length : 0;

              openTickets.forEach(ticket => {
                  // 1. Versuche Standard-Routing-Regeln (Stärken)
                  let bestTech = assignTicket(
                      { title: ticket.title, description: ticket.description },
                      users,
                      updatedTickets, 
                      appSettings.routingRules
                  );

                  // 2. Wenn keine Regel passt ODER der Rückkehrer unter der Durchschnittslast liegt, 
                  // forcieren wir die Zuweisung an den Rückkehrer um das Team zu entlasten.
                  if (!returningTechnicians.some(rt => rt.name === bestTech)) {
                      const eligibleReturnees = [...returningTechnicians].sort((a, b) => getLoad(a.name, updatedTickets) - getLoad(b.name, updatedTickets));
                      if (eligibleReturnees.length > 0) {
                          const candidate = eligibleReturnees[0];
                          const candidateLoad = getLoad(candidate.name, updatedTickets);
                          
                          // Wenn der Rückkehrer noch Kapazität unter dem Durchschnitt hat, bekommt er das Ticket
                          if (candidateLoad < avgLoad || ticket.technician === 'N/A') {
                              bestTech = candidate.name;
                          }
                      }
                  }

                  // 3. Zuweisung anwenden
                  if (bestTech !== 'N/A' && returningTechnicians.some(rt => rt.name === bestTech) && ticket.technician !== bestTech) {
                      const ticketIndex = updatedTickets.findIndex(t => t.id === ticket.id);
                      if (ticketIndex !== -1) {
                          updatedTickets[ticketIndex] = { 
                              ...updatedTickets[ticketIndex], 
                              technician: bestTech,
                              notes: [...(updatedTickets[ticketIndex].notes || []), `AUTO-ZUWIESUNG: An Rückkehrer ${bestTech} zur Lastverteilung zugewiesen.`]
                          };
                          ticketsUpdated = true;
                          reassignedCount++;
                      }
                  }
              });

              if (ticketsUpdated) {
                  console.log(`RÜCKKEHR LOGIK: ${reassignedCount} Tickets neu zugewiesen.`);
                  alert(`Willkommen zurück! ${returningTechnicians.map((u) => displayNameShort(u.name)).join(', ')} ist wieder verfügbar. ${reassignedCount} offene Tickets wurden zur Lastverteilung automatisch zugewiesen.`);
                  return updatedTickets;
              }
              return currentTickets;
          });
      }

      prevUsersRef.current = users;
  }, [users, appSettings.routingRules]);

  // Maintenance Scheduler Simulation
  useEffect(() => {
    const today = new Date(2026, 1, 7); // Changed for Safari
    today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];
    
    const duePlans = maintenancePlans.filter(plan => {
        const lastGenerated = parseISODate(plan.lastGenerated); // Changed for Safari
        if (!lastGenerated) return false;
        const nextDueDate = new Date(lastGenerated);
        nextDueDate.setDate(nextDueDate.getDate() + plan.intervalDays);
// FIX: Use .getTime() for robust date comparison to resolve arithmetic operation error.
        return nextDueDate.getTime() <= today.getTime();
    });

    if (duePlans.length > 0) {
        const updatedPlans = [...maintenancePlans];

        duePlans.forEach(plan => {
            const asset = assets.find(a => a.id === plan.assetId);
            if(!asset) return;
            
            const location = locations.find(l => l.id === asset.locationId);

// FIX: Changed type annotation of newTicket to match function parameter and added missing categoryId.
            const newTicket: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority } = {
                ticketType: 'preventive',
                origin: 'maintenance',
                title: `Wartung: ${asset.name}`,
                area: location?.name || 'Unbekannt',
                location: asset.details.type,
                reporter: 'System',
                dueDate: '', // Will be set by SLA logic
                technician: 'N/A', // Will be set by routing logic
                priority: plan.ticketPriority,
                description: plan.taskDescription,
                categoryId: 'cat-gebaeudetechnik',
            };
            
            const ticketId = handleAddNewTicket(newTicket, true); // Add ticket without opening modal
            const planIndex = updatedPlans.findIndex(p => p.id === plan.id);
            if (planIndex !== -1) {
                updatedPlans[planIndex] = { ...updatedPlans[planIndex], lastGenerated: todayStr };
            }
        });
        setMaintenancePlans(updatedPlans);
    }
  }, []); // Runs once on app load

  // Routine Schedules (Serientermine): Fälligkeit inkl. Startdatum, monatlich/jährlich, RP-Feiertags-Verschiebung
  useEffect(() => {
    if (!isInitialized) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = localISODate(today);

    const schedules = (appSettings.routineSchedules || []) as Array<RoutineSchedule & { recurrence?: any }>;
    if (schedules.length === 0) return;

    const rpSet = new Set(rpHolidayYmdList);

    const updatedSchedules = [...schedules];
    let changed = false;

    schedules.forEach((schedule, idx) => {
      if (schedule.lastGenerated === todayStr) return;
      if (!isRoutineDueOnCalendarDay(schedule, today, rpSet)) return;

      const eligibleUsers = users
        .filter(u => u.isActive && u.role === schedule.targetRole)
        .map(u => u.name)
        .sort((a, b) => a.localeCompare(b, 'de'));

      const pool =
        Array.isArray((schedule as any).assignees) && (schedule as any).assignees.length > 0
          ? eligibleUsers.filter(n => (schedule as any).assignees.includes(n))
          : eligibleUsers;

      let assigned = 'N/A';
      if (schedule.assignment?.type === 'fixed') {
        const name = schedule.assignment.userName;
        assigned = pool.includes(name) ? name : 'N/A';
      } else {
        // rotate
        if (pool.length > 0) {
          const cursor = Math.max(0, Number(schedule.rotationCursor || 0));
          assigned = pool[cursor % pool.length];
          updatedSchedules[idx] = {
            ...updatedSchedules[idx],
            rotationCursor: (cursor + 1) % pool.length,
          } as any;
          changed = true;
        }
      }

      const newTicket: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority } = {
        ticketType: 'preventive',
        origin: 'routine',
        routineScheduleId: schedule.id,
        title: schedule.title || 'Serientermin',
        area: schedule.area || 'Alle',
        location: schedule.location || '',
        reporter: 'System',
        dueDate: '',
        technician: assigned,
        priority: Priority.Mittel,
        description: schedule.description,
        categoryId: 'cat-gebaeudetechnik',
      };

      handleAddNewTicket(newTicket, true);
      updatedSchedules[idx] = { ...updatedSchedules[idx], lastGenerated: todayStr } as any;
      changed = true;
    });

    if (changed) {
      setAppSettings(prev => ({ ...prev, routineSchedules: updatedSchedules as any }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Serienlogik bewusst bei Schedule-/Feiertags-Änderung; Tickets über setTickets
  }, [isInitialized, appSettings.routineSchedules, users, rpHolidayYmdList]);

  // Automatically set tickets to overdue and back
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let wasChanged = false;
    const updatedTickets = tickets.map(ticket => {
        if (ticket.status === Status.Abgeschlossen) {
            return ticket;
        }

        const dueDate = parseGermanDate(ticket.dueDate);
        if (!dueDate) return ticket;

// FIX: Use .getTime() for robust date comparison to resolve arithmetic operation error.
        const isPastDue = dueDate.getTime() < today.getTime();

        if (isPastDue && ticket.status !== Status.Ueberfaellig) {
            wasChanged = true;
            return { ...ticket, status: Status.Ueberfaellig };
        } else if (!isPastDue && ticket.status === Status.Ueberfaellig) {
            wasChanged = true;
            return { ...ticket, status: Status.InArbeit };
        }
        
        return ticket;
    });

    if (wasChanged) {
  setTickets(updatedTickets);
  saveTicketsSafely(updatedTickets);
}
  }, [tickets]); // Reruns whenever tickets change
const handleAppSettingsChange = (updater: React.SetStateAction<AppSettings>) => {
  setAppSettings((prev) => {
    const next =
      typeof updater === 'function'
        ? (updater as (prevState: AppSettings) => AppSettings)(prev)
        : updater;

    localStorage.setItem(
      LOCAL_STORAGE_KEY_SETTINGS,
      JSON.stringify(next)
    );

    void setDoc(
      doc(db, 'app_data', LOCAL_STORAGE_KEY_SETTINGS),
      {
        value: JSON.parse(JSON.stringify(next)),
        updated_at: new Date().toISOString(),
      }
    )
      .then(() => {
        setLastSyncTime(new Date());
        console.log('Einstellungen gespeichert');
      })
      .catch((err) => {
        console.error('Fehler beim Speichern der Einstellungen:', err);
      });

    return next;
  });
};
  const handleRoutineDayComplete = (scheduleId: string) => {
    if (!currentUser) return;
    const ymd = localISODate(new Date());
    setAppSettings((prev) => {
      const rest = (prev.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd));
      return {
        ...prev,
        routineDayCompletions: [
          ...rest,
          {
            scheduleId,
            date: ymd,
            completedBy: currentUser.name,
            completedAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const handleRoutineDayUncomplete = (scheduleId: string) => {
    const ymd = localISODate(new Date());
    setAppSettings((prev) => ({
      ...prev,
      routineDayCompletions: (prev.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd)),
    }));
  };
const saveTicketsSafely = (nextTickets: Ticket[]) => {
  localStorage.setItem(
    LOCAL_STORAGE_KEY_TICKETS,
    JSON.stringify(nextTickets)
  );

  void setDoc(
    doc(db, 'app_data', LOCAL_STORAGE_KEY_TICKETS),
    {
      value: JSON.parse(JSON.stringify(nextTickets)),
      updated_at: new Date().toISOString(),
    }
  )
    .then(() => {
      setLastSyncTime(new Date());
      console.log('Tickets gespeichert');
    })
    .catch((err) => {
      console.error('Fehler beim Speichern der Tickets:', err);
    });
};
  const commitTicketUpdate = (updatedTicket: Ticket, originalTicket: Ticket) => {
    const ut: Ticket = { ...updatedTicket };
    const statusChanged = originalTicket.status !== ut.status;

    // --- Prevent assignment to absent technicians ---
    if (ut.technician !== 'N/A' && (ut.technician !== originalTicket.technician || originalTicket.technician === 'N/A')) {
      const techUser = users.find((u) => u.name === ut.technician);
      if (techUser && techUser.availability.status === AvailabilityStatus.OnLeave) {
        let newTech = assignTicket(
          { title: ut.title, description: ut.description },
          users,
          tickets,
          appSettings.routingRules
        );

        if (newTech === 'N/A' || newTech === techUser.name) {
          const availableTechs = users.filter(
            (u) =>
              (u.role === Role.Technician || u.role === Role.Housekeeping) &&
              u.isActive &&
              u.availability.status === AvailabilityStatus.Available
          );

          if (availableTechs.length > 0) {
            const techsWithLoad = availableTechs.map((tech) => ({
              ...tech,
              load: tickets.filter((t) => t.technician === tech.name && t.status !== Status.Abgeschlossen).length,
            }));
            techsWithLoad.sort((a, b) => a.load - b.load);
            newTech = techsWithLoad[0].name;
          } else {
            newTech = 'N/A';
          }
        }

        if (newTech !== 'N/A' && newTech !== techUser.name) {
          alert(
            `Hinweis: ${displayNameShort(techUser.name)} ist derzeit abwesend. Das Ticket wurde automatisch an ${displayNameShort(newTech)} umgeleitet.`
          );
          ut.technician = newTech;
          ut.notes = [
            ...(ut.notes || []),
            `AUTO-KORREKTUR: Ursprünglich zugewiesen an abwesenden Bearbeiter ${techUser.name}. Automatisch zugewiesen an ${newTech}.`,
          ];
        } else {
          alert(`Warnung: ${displayNameShort(techUser.name)} ist abwesend, aber es konnte kein verfügbarer Ersatz gefunden werden.`);
          ut.technician = 'N/A';
        }
      }
    }

    if (ut.status === Status.Abgeschlossen && originalTicket.status !== Status.Abgeschlossen) {
      const stamp = completionStampNow();
      ut.completionDate = stamp.completionDate;
      ut.completionTime = stamp.completionTime;
    }

    let skipReactiveAutoDue = false;
    if (originalTicket.status === Status.Ueberfaellig) {
      if (ut.status === Status.Offen) {
        ut.dueDate = getFutureDateStringForUpdate(3);
        skipReactiveAutoDue = true;
      } else if (ut.status === Status.InArbeit) {
        ut.dueDate = getFutureDateStringForUpdate(2);
        skipReactiveAutoDue = true;
      }
    }

    if (ut.ticketType === 'reactive' && !skipReactiveAutoDue) {
      const w = ut.wunschTermin?.trim();
      const w0 = originalTicket.wunschTermin?.trim();
      if (w) {
        ut.dueDate = w;
      } else {
        const wunschCleared = !!w0 && !w;
        const catChanged = ut.categoryId !== originalTicket.categoryId;
        if (wunschCleared || catChanged) {
          ut.dueDate = computeReactiveDueDateWithoutWunsch(ut.entryDate, ut.categoryId, appSettings.slaMatrix);
        }
        if (catChanged) {
          const slaP = inferStrictestSlaPriorityForCategory(ut.categoryId, appSettings.slaMatrix);
          ut.priority = slaP ?? Priority.Niedrig;
        }
      }
    }

    if (statusChanged && ut.status === Status.Abgeschlossen) {
      ut.is_reopened = false;
    }

    const reporterMailTo = ut.reporter_email?.trim();
    let reporterMailSent = false;
    if (reporterMailTo) {
      if (statusChanged && ut.status === Status.Abgeschlossen) {
        sendDrkBrevoMail(reporterMailTo, `Ihre Meldung wurde abgeschlossen – Ticket ${ut.id}`, {
          kind: 'ticket_closed',
          ticketId: ut.id,
        });
        reporterMailSent = true;
      } else if ((ut.notes?.length || 0) > (originalTicket.notes?.length || 0)) {
        const latestNote = ut.notes![ut.notes!.length - 1];
        const isNoteFromReporter =
          latestNote.includes('(Melder am ') || latestNote.includes('Ticket durch Melder wiedereröffnet');
        if (!isNoteFromReporter) {
          sendDrkBrevoMail(reporterMailTo, `Neuigkeit zu Ihrem Ticket ${ut.id}`, {
            kind: 'staff_note',
            ticketId: ut.id,
            noteText: latestNote,
          });
          reporterMailSent = true;
        }
      }
    }
    if (reporterMailTo && !reporterMailSent) {
      const statusDiff = ut.status !== originalTicket.status;
      const dueDiff = ut.dueDate !== originalTicket.dueDate;
      const techDiff = ut.technician !== originalTicket.technician;
      const prioDiff = ut.priority !== originalTicket.priority;
      const titleDiff = ut.title !== originalTicket.title;
      const descDiff = (ut.description || '') !== (originalTicket.description || '');
      const wunschDiff = (ut.wunschTermin || '') !== (originalTicket.wunschTermin || '');
      if (statusDiff || dueDiff || techDiff || prioDiff || titleDiff || descDiff || wunschDiff) {
        sendDrkBrevoMail(reporterMailTo, `Aktualisierung zu Ihrem Ticket ${ut.id}`, {
          kind: 'ticket_update',
          ticketId: ut.id,
          status: String(ut.status),
          dueDate: ut.dueDate || '—',
          technician: ut.technician || 'N/A',
          priority: String(ut.priority),
          title: ut.title || '—',
        });
      }
    }

    const nextTickets = tickets.map((t) =>
  t.id === ut.id ? ut : t
);

setTickets(nextTickets);
saveTicketsSafely(nextTickets);

    if (selectedTicket && selectedTicket.id === ut.id) {
      setSelectedTicket(ut);
    }
  };

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    const originalTicket = tickets.find((t) => t.id === updatedTicket.id);
    if (!originalTicket) return;

    const statusChanged = originalTicket.status !== updatedTicket.status;
    if (
      statusChanged &&
      updatedTicket.status === Status.Abgeschlossen &&
      originalTicket.status !== Status.Abgeschlossen
    ) {
      setCompleteOrderDialog({ draft: { ...updatedTicket } });
      return;
    }

    commitTicketUpdate(updatedTicket, originalTicket);
  };

  const handleCompleteOrderConfirm = () => {
    if (!completeOrderDialog) return;
    const draft = completeOrderDialog.draft;
    setCompleteOrderDialog(null);
    const originalTicket = tickets.find((t) => t.id === draft.id);
    if (!originalTicket) return;
    commitTicketUpdate(draft, originalTicket);
  };

  const handleCompleteOrderCancel = () => {
    setCompleteOrderDialog(null);
  };

  const handleDeleteTicket = (ticketId: string) => {
  const nextTickets = tickets.filter(
    (ticket) => ticket.id !== ticketId
  );

  setTickets(nextTickets);
  saveTicketsSafely(nextTickets);

  if (selectedTicket && selectedTicket.id === ticketId) {
    setSelectedTicket(null);
  }
};

  /** Nachhol-Bestätigungen (z. B. nach Brevo-Ausfall): gleiche Vorlage wie bei Meldung erfassen. */
  const handleResendConfirmationMailsForEntryDate = useCallback(async (entryDateDE: string) => {
    const d = entryDateDE.trim();
    if (!d) {
      window.alert('Bitte ein Eingangsdatum im Format TT.MM.JJJJ angeben.');
      return { ok: 0, fail: 0 };
    }
    const list = tickets.filter((t) => t.entryDate === d && t.reporter_email?.trim());
    if (list.length === 0) {
      window.alert(`Keine Tickets mit Melder-E-Mail für das Eingangsdatum ${d}.`);
      return { ok: 0, fail: 0 };
    }
    if (
      !window.confirm(
        `${list.length} Bestätigungsmail(s) an Melder senden (Eingang ${d})?\n\n` +
          'Es wird dieselbe Vorlage wie bei „Meldung erfasst“ verwendet. Zwischen den Mails liegt eine kurze Pause (Brevo).'
      )
    ) {
      return { ok: 0, fail: 0 };
    }
    let ok = 0;
    let fail = 0;
    for (const t of list) {
      const to = t.reporter_email!.trim();
      const success = await sendDrkBrevoMailAsync(
        to,
        `Ihre Meldung wurde erfasst – Ticket ${t.id}`,
        { kind: 'ticket_created', ticketId: t.id },
        { silent: true }
      );
      if (success) ok += 1;
      else fail += 1;
      await new Promise((r) => setTimeout(r, 500));
    }
    window.alert(`Versand beendet: ${ok} erfolgreich, ${fail} fehlgeschlagen (von ${list.length}).`);
    return { ok, fail };
  }, [tickets]);

  const handleAddNewTicket = (newTicketData: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority }, silent = false): string => {
    // --- INTELLIGENT AUTOMATION LOGIC ---
    const reporterEmail =
      typeof newTicketData.reporter_email === 'string' ? newTicketData.reporter_email.trim() : '';
    /** Eingang = Kalendertag der Erfassung (gleiches Datum wie Fälligkeits-Basis ohne Wunschtermin). */
    const entryDateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const category = appSettings.ticketCategories.find(c => c.id === newTicketData.categoryId);
    const isReactive = newTicketData.ticketType === 'reactive';
    const slaStrictPriority = newTicketData.dueDate
  ? inferStrictestSlaPriorityForCategory(newTicketData.categoryId, appSettings.slaMatrix)
  : null;

    // Reaktiv: immer Priorität „Niedrig“, außer die SLA-Matrix (kürzeste Frist je Kategorie) legt eine andere Prio fest.
    // Keine Kategorie-Defaults, keine mitgeschickte priority aus Formularen.
    const determinedPriority = isReactive
  ? (slaStrictPriority ?? Priority.Niedrig)
  : (newTicketData.priority || category?.default_priority || appSettings.defaultPriority);

    // 2. Load-Balancing Technician Assignment
    let assignedTechnician = newTicketData.technician || 'N/A';

if (newTicketData.ticketType === 'reactive') {
  assignedTechnician = newTicketData.technician || 'N/A';
} else if (assignedTechnician === 'N/A') {
  assignedTechnician = assignTicket(
    { title: newTicketData.title, description: newTicketData.description },
    users,
    tickets,
    appSettings.routingRules
  );
}
    let autoCorrectionNote = '';

    // Wenn ein Bearbeiter manuell gewählt wurde, prüfen ob er abwesend ist
    if (assignedTechnician !== 'N/A') {
        const selectedTech = users.find(u => u.name === assignedTechnician);
        if (selectedTech && selectedTech.availability.status === AvailabilityStatus.OnLeave) {
            // Wenn abwesend, automatisch neu zuweisen
            const autoTech = assignTicket({ title: newTicketData.title, description: newTicketData.description }, users, tickets, appSettings.routingRules);
            if (autoTech !== 'N/A' && autoTech !== selectedTech.name) {
                autoCorrectionNote = `HINWEIS: Gewählter Bearbeiter ${selectedTech.name} ist abwesend. Automatisch zugewiesen an ${autoTech}.`;
                assignedTechnician = autoTech;
                alert(autoCorrectionNote);
            } else {
                assignedTechnician = 'N/A';
                alert(`Warnung: ${displayNameShort(selectedTech.name)} ist abwesend. Ticket wurde auf 'Nicht zugewiesen' gesetzt.`);
            }
        }
    } else {
        // Reaktive Meldungen (Portal + „Neues Ticket“): ohne explizite Wahl immer „Nicht zugewiesen“ — kein Keyword-Routing.
        // Präventiv (Wartung/Serientermin): weiter automatisch zuweisen, wenn möglich.
        if (newTicketData.ticketType === 'reactive') {
            assignedTechnician = 'N/A';
        } else {
            assignedTechnician = assignTicket(
                { title: newTicketData.title, description: newTicketData.description },
                users,
                tickets,
                appSettings.routingRules
            );
        }
    }

    // 3. Fälligkeit: reaktiv — mit Wunschtermin = Wunschdatum; sonst Kalender „Eingang + 5 Tage“ (z. B. 11.05. → 16.05.)
    //    oder falls die SLA-Matrix für die Kategorie eine frühere Frist liefert: das frühere Datum.
    let formattedDueDate: string;
    if (isReactive) {
      const wunsch = newTicketData.dueDate?.trim();
      if (wunsch) {
        formattedDueDate = wunsch;
      } else {
        formattedDueDate = reactiveDueDateAfterCalendarDaysFromEntry(
  entryDateStr,
  REACTIVE_DEFAULT_LEAD_DAYS
).toLocaleDateString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
      }
    } else {
      const slaRule = appSettings.slaMatrix.find(
        (r) => r.categoryId === newTicketData.categoryId && r.priority === determinedPriority
      );
      const dueDate = new Date();
      if (slaRule) {
        dueDate.setHours(dueDate.getHours() + slaRule.responseTimeHours);
      } else {
        dueDate.setDate(dueDate.getDate() + (appSettings.dueDateRules[determinedPriority] || 7));
      }
      formattedDueDate = dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const sanitizedTicketData = Object.fromEntries(
      Object.entries(newTicketData).filter(([key, v]) => {
        if (v === undefined) return false;
        if (isReactive && key === 'priority') return false;
        return true;
      })
    );

    const newTicket: Ticket = {
      ...(sanitizedTicketData as Omit<Ticket, 'id' | 'entryDate' | 'status'>),
      id: `${Math.floor(Math.random() * 10000) + 30000}`,
      entryDate: entryDateStr,
      status: Status.Offen,
      priority: determinedPriority,
      technician: assignedTechnician,
      dueDate: formattedDueDate,
      notes: autoCorrectionNote ? [...(newTicketData.notes || []), autoCorrectionNote] : (newTicketData.notes || []),
      hasNewNoteFromReporter: false,
      is_emergency: false,
    };
    if (reporterEmail) {
      newTicket.reporter_email = reporterEmail;
    } else {
      delete (newTicket as Partial<Ticket>).reporter_email;
    }

    setTickets(prevTickets => {
  const updatedTickets = [newTicket, ...prevTickets];
  saveTicketsSafely(updatedTickets);
  return updatedTickets;
});

    if (reporterEmail) {
      sendDrkBrevoMail(reporterEmail, `Ihre Meldung wurde erfasst – Ticket ${newTicket.id}`, {
        kind: 'ticket_created',
        ticketId: newTicket.id,
      });
    }
    
    if (!silent) setIsModalOpen(false);
    return newTicket.id;
  };
  
  // FIX: Implement bulk action handlers to replace placeholder functions and resolve prop type errors.
  const handleBulkUpdate = (property: keyof Ticket, value: any) => {
    if (property === 'status' && value === Status.Abgeschlossen) {
      const n = selectedTicketIds.length;
      if (n === 0) return;
      if (!window.confirm(`Alle ${n} ausgewählten Aufträge wirklich abschließen?`)) {
        return;
      }
    }

    setTickets((prevTickets) =>
      prevTickets.map((ticket) => {
        if (selectedTicketIds.includes(ticket.id)) {
          const updatedTicket = { ...ticket, [property]: value };
          if (property === 'status' && value === Status.Abgeschlossen && !ticket.completionDate) {
            const stamp = completionStampNow();
            updatedTicket.completionDate = stamp.completionDate;
            updatedTicket.completionTime = stamp.completionTime;
          }
          return updatedTicket;
        }
        return ticket;
      })
    );
    setSelectedTicketIds([]);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Sind Sie sicher, dass Sie ${selectedTicketIds.length} Tickets endgültig löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) {
      setTickets(prev => prev.filter(ticket => !selectedTicketIds.includes(ticket.id)));
      setSelectedTicketIds([]);
    }
  };

  const activeLocations = useMemo(() => locations.filter(a => a.isActive), [locations]);
  const activeTechnicians = useMemo(() => {
    const list = Array.isArray(users) ? users : MOCK_USERS;
    return list
      .filter(
        (u) => u.isActive && (u.role === Role.Technician || u.role === Role.Housekeeping)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [users]);

  /** Gleiche Grundmenge wie die Haupttabelle der Listenansicht: keine Serienaufträge (origin routine). */
  const listenBenchTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (currentUser?.role && isServiceTeamRole(currentUser.role) && ticket.technician !== currentUser.name) {
        return false;
      }
      if (ticket.origin === 'routine') return false;
      return true;
    });
  }, [tickets, currentUser]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
        // Role-based pre-filtering: Service-Team should only see tickets assigned to them.
        if (currentUser?.role && isServiceTeamRole(currentUser.role) && ticket.technician !== currentUser.name) {
            return false;
        }

        const searchLower = filters.search.toLowerCase();
        if (filters.search && !ticket.title.toLowerCase().includes(searchLower) && !ticket.id.toLowerCase().includes(searchLower) && !ticket.area.toLowerCase().includes(searchLower)) return false;
        
        if (filters.area !== 'Alle' && ticket.area !== filters.area) return false;
        
        if (
          filters.technician !== 'Alle' &&
          normalizePersonName(ticket.technician) !== normalizePersonName(filters.technician)
        ) {
          return false;
        }
        
        if (filters.priority !== 'Alle' && ticket.priority !== filters.priority) return false;
        
        if (currentView === 'erledigt') {
            if (filters.status !== 'Alle' && ticket.status !== filters.status) return false;
            return ticket.status === Status.Abgeschlossen;
        }
        
        // For dashboard & tickets views, hide completed tickets.
        if (ticket.status === Status.Abgeschlossen) return false;

        // Serienaufträge nicht im Kanban (nur in Listenansicht anzeigen)
        if ((currentView === 'dashboard' || currentView === 'tech-dashboard') && ticket.origin === 'routine') {
            return false;
        }
        
        if ((currentView === 'tickets' || currentView === 'dashboard' || currentView === 'tech-dashboard') && filters.status !== 'Alle' && ticket.status !== filters.status) return false;
        
        return true;
    });
  }, [tickets, filters, currentView, currentUser]);

    const handleExportCSV = () => {
        if (filteredTickets.length === 0) {
            alert("Keine Tickets zum Exportieren vorhanden.");
            return;
        }
        const headers = ["ID", "Titel", "Standort", "Raum / Bereich", "Gemeldet von", "Eingang", "Fällig bis", "Status", "Bearbeiter", "Priorität", "Abgeschlossen am", "Abgeschlossen (Uhrzeit)"];
        const escapeCsv = (str: string | undefined) => {
            if (!str) return '""';
            const escaped = str.replace(/"/g, '""');
            return `"${escaped}"`;
        };
        const rows = filteredTickets.map(t => [
            escapeCsv(t.id), escapeCsv(t.title), escapeCsv(t.area), escapeCsv(t.location),
            escapeCsv(t.reporter), escapeCsv(t.entryDate), escapeCsv(t.dueDate),
            escapeCsv(t.status), escapeCsv(t.technician), escapeCsv(t.priority),
            escapeCsv(t.completionDate), escapeCsv(t.completionTime)
        ].join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `tickets_${currentView}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportPDF = () => {
        if (filteredTickets.length === 0) {
            alert("Keine Tickets zum Exportieren vorhanden.");
            return;
        }
        const doc = new jsPDF();
        const title = currentView === 'erledigt' ? 'Abgeschlossene Tickets' : 'Aktuelle Ticketliste';
        const date = new Date().toLocaleDateString('de-DE');

        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Exportiert am: ${date} | Standort: ${filters.area}, Bearbeiter: ${filters.technician}`, 14, 30);

        const head = [['ID', 'Priorität', 'Titel', 'Standort / Raum', 'Fällig', 'Bearbeiter']];
        const body = filteredTickets.map(t => [
            t.id,
            t.priority,
            t.title,
            `${t.area} (${t.location})`,
            t.dueDate,
            t.technician
        ]);

        autoTable(doc, {
            startY: 35,
            head: head,
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [33, 37, 41], textColor: 255, fontStyle: 'bold' },
            willDrawCell: (data) => {
                const ticket = filteredTickets[data.row.index];
                if (ticket && (ticket.priority === Priority.Hoch || ticket.status === Status.Ueberfaellig || ticket.is_emergency)) {
                    doc.setFillColor(255, 235, 238); // light red for high priority rows
                }
            },
        });

        const fileName = `tickets_${currentView}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    };

  const ticketsForUser = useMemo(() => {
    if (!currentUser) return tickets;
    if (isServiceTeamRole(currentUser.role)) {
      return tickets.filter((t) => t.technician === currentUser.name);
    }
    return tickets;
  }, [tickets, currentUser]);

  const allTechnicianNames = useMemo(
    () => [
      'N/A',
      ...users
        .filter(u => u.role === Role.Technician || u.role === Role.Housekeeping)
        .map(t => t.name)
        .sort((a, b) => a.localeCompare(b, 'de')),
    ],
    [users]
  );
  
  const locationOptionsWithCounts = useMemo(() => {
    const ticketsForCounts = tickets.filter(t => currentView === 'erledigt' ? t.status === Status.Abgeschlossen : t.status !== Status.Abgeschlossen);
    const counts = ticketsForCounts.reduce((acc, ticket) => {
        acc[ticket.area] = (acc[ticket.area] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const result = activeLocations.map(loc => ({ name: loc.name, count: counts[loc.name] || 0 }));
    return [{ name: 'Alle', count: ticketsForCounts.length }, ...result];
  }, [tickets, activeLocations, currentView]);

  const changeView = (view: string) => {
    if (['dashboard', 'reports', 'techniker', 'settings', 'erledigt'].includes(view) && currentUser?.role !== Role.Admin) {
      alert('Keine Berechtigung, auf diese Seite zuzugreifen.');
      return;
    }
    setFilters(prev => ({ ...prev, status: 'Alle', search: '' }));
    setGroupBy('none');
    setSelectedTicketIds([]);
    setCurrentView(view);
  };
  
  const handleUserUpdated = (user: User) => {
      console.log("handleUserUpdated called for:", user.name);
      
      const status = user.availability?.status;
      const isAbsent = status === AvailabilityStatus.OnLeave;
      
      if (isAbsent) {
          // Diagnostic collection
          const userTickets = tickets.filter(t => t.technician === user.name && t.status !== Status.Abgeschlossen);
          
          if (userTickets.length === 0) {
              alert(`Info: Bearbeiter ${displayNameShort(user.name)} hat aktuell keine offenen Tickets. Keine Umverteilung nötig.`);
              return;
          }

          const leaveUntilDate = parseISODate(user.availability.leaveUntil);
          if (leaveUntilDate) leaveUntilDate.setHours(23, 59, 59, 999);

          // 1. Identify tickets to move
          const ticketsToMove = userTickets.filter(t => {
              // If indefinite absence (no date), move ALL open tickets
              if (!leaveUntilDate) return true;
              
              // Otherwise, check specific criteria for dated absence
              if (t.priority === Priority.Hoch) return true;
              if (t.status === Status.Ueberfaellig) return true;
              
              // Check due date
              if (t.dueDate) {
                  const dueDate = parseGermanDate(t.dueDate);
                  if (dueDate && dueDate.getTime() <= leaveUntilDate.getTime()) {
                      return true;
                  }
              }
              return false;
          });

          if (ticketsToMove.length === 0) {
              alert(`Info: ${displayNameShort(user.name)} hat ${userTickets.length} offene Tickets, aber keines davon fällt in den Abwesenheitszeitraum (bis ${user.availability.leaveUntil}) oder ist kritisch.`);
              return;
          }

          // 2. Identify available technicians
          const availableTechnicians = users.filter(u => 
              (u.role === Role.Technician || u.role === Role.Housekeeping) && 
              u.isActive && 
              (u.availability.status === AvailabilityStatus.Available) &&
              u.id !== user.id
          );

          if (availableTechnicians.length === 0) {
              alert(`KRITISCH: Es wurden ${ticketsToMove.length} Tickets zur Umverteilung identifiziert, aber es gibt KEINE verfügbaren Bearbeiter (Status 'Verfügbar').\n\nBitte setzen Sie einen anderen Bearbeiter auf 'Verfügbar'.`);
              return;
          }

          // 3. Initialize Load Map
          const techLoadMap = new Map<string, number>();
          availableTechnicians.forEach(tech => {
              const currentLoad = tickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length;
              techLoadMap.set(tech.name, currentLoad);
          });

          let ticketsToUpdate = [...tickets];
          let movedCount = 0;

          // 4. Process each ticket
          ticketsToMove.forEach(ticket => {
              // A. Determine Required Skill
              let requiredSkill: string | null = null;
              for (const rule of appSettings.routingRules) {
                  const keywords = rule.keyword.split(',').map(k => k.trim().toLowerCase());
                  const textToSearch = `${ticket.title} ${ticket.description || ''}`.toLowerCase();
                  if (keywords.some(k => k && textToSearch.includes(k))) {
                      requiredSkill = rule.skill;
                      break;
                  }
              }

              // B. Filter Candidates based on Skill
              let candidates = availableTechnicians;
              if (requiredSkill) {
                  const skilledCandidates = availableTechnicians.filter(u => u.skills.includes(requiredSkill!));
                  if (skilledCandidates.length > 0) {
                      candidates = skilledCandidates;
                  }
              }

              // C. Find Candidate with Lowest Load
              candidates.sort((a, b) => {
                  const loadA = techLoadMap.get(a.name) || 0;
                  const loadB = techLoadMap.get(b.name) || 0;
                  return loadA - loadB;
              });

              const bestCandidate = candidates[0];

              if (bestCandidate) {
                  // D. Assign Ticket
                  const ticketIndex = ticketsToUpdate.findIndex(t => t.id === ticket.id);
                  if (ticketIndex !== -1) {
                      const date = new Date();
                      const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
                      const formattedTime = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      
                      const reason = leaveUntilDate ? `Abwesend bis ${user.availability.leaveUntil}` : 'Unbefristet abwesend';
                      const skillNote = requiredSkill ? ` (Skill-Match: ${requiredSkill})` : '';
                      const note = `AUTO-UMVERTEILUNG: Von ${user.name} zu ${bestCandidate.name}. Grund: ${reason}.${skillNote} (${formattedDate}, ${formattedTime})`;

                      const originalTicket = ticketsToUpdate[ticketIndex];
                      ticketsToUpdate[ticketIndex] = {
                          ...originalTicket,
                          technician: bestCandidate.name,
                          notes: [...(originalTicket.notes || []), note]
                      };
                      
                      // E. Update Load Immediately
                      const currentLoad = techLoadMap.get(bestCandidate.name) || 0;
                      techLoadMap.set(bestCandidate.name, currentLoad + 1);
                      
                      movedCount++;
                  }
              }
          });

          if (movedCount > 0) {
              setTickets(ticketsToUpdate);
              alert(`ERFOLG: ${movedCount} Tickets von ${displayNameShort(user.name)} wurden automatisch auf ${availableTechnicians.length} verfügbare Kollegen verteilt.`);
          }
      }
  };

  const handleManualRedistribution = () => {
      console.log("Manual redistribution triggered.");
      
      // 1. Identify absent users
      const absentUsers = users.filter(u => 
          (u.role === Role.Technician || u.role === Role.Housekeeping) && 
          (u.availability.status === AvailabilityStatus.OnLeave)
      );

      if (absentUsers.length === 0) {
          alert("Info: Es gibt aktuell keine abwesenden Bearbeiter.");
          return;
      }

      let ticketsToUpdate = [...tickets];
      let movedTotal = 0;
      let logMessages: string[] = [];

      // 2. Find available technicians
      const availableTechnicians = users.filter(u => 
          (u.role === Role.Technician || u.role === Role.Housekeeping) && 
          u.isActive && 
          (u.availability.status === AvailabilityStatus.Available)
      );

      if (availableTechnicians.length === 0) {
          alert("Warnung: Es gibt abwesende Bearbeiter, aber KEINE verfügbaren Kollegen für eine Umverteilung!");
          return;
      }

      // 3. Initialize Load Map
      const techLoadMap = new Map<string, number>();
      availableTechnicians.forEach(tech => {
          const currentLoad = tickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length;
          techLoadMap.set(tech.name, currentLoad);
      });

      // 4. Process each absent user
      absentUsers.forEach(absentUser => {
          const leaveUntilDate = parseISODate(absentUser.availability.leaveUntil);
          if (leaveUntilDate) leaveUntilDate.setHours(23, 59, 59, 999);

          // Find tickets to move
          const ticketsToMove = tickets.filter(t => {
              if (t.technician !== absentUser.name || t.status === Status.Abgeschlossen) return false;
              
              // If indefinite absence, move all
              if (!leaveUntilDate) return true;
              
              // Move high priority
              if (t.priority === Priority.Hoch) return true;
              
              // Move overdue
              if (t.status === Status.Ueberfaellig) return true;
              
              // Move if due date is within absence
              if (t.dueDate) {
                  const dueDate = parseGermanDate(t.dueDate);
                  if (dueDate && dueDate.getTime() <= leaveUntilDate.getTime()) {
                      return true;
                  }
              }
              return false;
          });

          if (ticketsToMove.length === 0) {
              logMessages.push(`- ${absentUser.name}: Keine kritischen Tickets gefunden.`);
              return;
          }

          ticketsToMove.forEach(ticket => {
              // Sort candidates by current load
              availableTechnicians.sort((a, b) => {
                  const loadA = techLoadMap.get(a.name) || 0;
                  const loadB = techLoadMap.get(b.name) || 0;
                  return loadA - loadB;
              });

              const targetTech = availableTechnicians[0];

              if (targetTech) {
                  const ticketIndex = ticketsToUpdate.findIndex(t => t.id === ticket.id);
                  if (ticketIndex !== -1) {
                      const date = new Date();
                      const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
                      const formattedTime = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      const note = `MANUELLE UMVERTEILUNG: Von ${absentUser.name} an ${targetTech.name}. Grund: Abwesend bis ${absentUser.availability.leaveUntil || 'unbekannt'}. (${formattedDate}, ${formattedTime})`;

                      const originalTicket = ticketsToUpdate[ticketIndex];
                      ticketsToUpdate[ticketIndex] = {
                          ...originalTicket,
                          technician: targetTech.name,
                          notes: [...(originalTicket.notes || []), note]
                      };
                      
                      movedTotal++;
                      const currentLoad = techLoadMap.get(targetTech.name) || 0;
                      techLoadMap.set(targetTech.name, currentLoad + 1);
                  }
              }
          });
          logMessages.push(`- ${absentUser.name}: ${ticketsToMove.length} Tickets umverteilt.`);
      });

      if (movedTotal > 0) {
          setTickets(ticketsToUpdate);
          alert(`Erfolg: ${movedTotal} Tickets wurden umverteilt.\n\nDetails:\n${logMessages.join('\n')}`);
      } else {
          alert(`Prüfung abgeschlossen. Keine Tickets mussten umverteilt werden.\n\nDetails:\n${logMessages.join('\n')}`);
      }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === Role.Admin) setCurrentView('dashboard');
    else if (isServiceTeamRole(user.role)) setCurrentView('tech-dashboard');
  };
  const handleLogout = () => { setCurrentUser(null); setCurrentView('dashboard'); };

  const portalElement = (
    <Portal
      appSettings={appSettings}
      onLogin={handleLogin}
      tickets={tickets}
      onAddTicket={handleAddNewTicket}
      onUpdateTicket={handleTicketUpdate}
      locations={activeLocations.map((a) => a.name)}
      users={users}
      dataReady={isInitialized}
    />
  );
  
  if (!currentUser) {
    return portalElement;
  }
  
  const renderCurrentView = () => {
    switch (currentView) {
        case 'dashboard':
        case 'tech-dashboard':
          return (
            <KanbanBoard
              panelEmbed
              tickets={filteredTickets}
              technicians={activeTechnicians}
              onUpdateTicket={handleTicketUpdate}
              onSelectTicket={setSelectedTicket}
              selectedTicket={selectedTicket}
            />
          );
        case 'tickets': return <TicketTableView tickets={filteredTickets} onUpdateTicket={handleTicketUpdate} onSelectTicket={setSelectedTicket} selectedTicketIds={selectedTicketIds} setSelectedTicketIds={setSelectedTicketIds} selectedTicket={selectedTicket} groupBy={groupBy} showRoutineSection={false} />;
        case 'routines': return (
          <RoutineSchedulesView
            userRole={currentUser.role}
            userName={currentUser.name}
            schedules={appSettings.routineSchedules as any}
            users={users}
            rpHolidayYmdList={rpHolidayYmdList}
            completions={appSettings.routineDayCompletions || []}
            onComplete={handleRoutineDayComplete}
            onUncomplete={handleRoutineDayUncomplete}
            onReorder={(fromId, toId) => {
              setAppSettings(prev => {
                const list = [...(prev.routineSchedules || [])] as any[];
                const fromIdx = list.findIndex(x => x.id === fromId);
                const toIdx = list.findIndex(x => x.id === toId);
                if (fromIdx === -1 || toIdx === -1) return prev;
                const [moved] = list.splice(fromIdx, 1);
                list.splice(toIdx, 0, moved);
                return { ...prev, routineSchedules: list as any };
              });
            }}
          />
        );
        case 'routine-nachweis':
          return (
            <RoutineNachweisView
              schedules={appSettings.routineSchedules as any}
              completions={appSettings.routineDayCompletions || []}
              users={users}
              userRole={currentUser.role}
              userName={currentUser.name}
              rpHolidayYmdList={rpHolidayYmdList}
            />
          );
        case 'erledigt': return <ErledigtTableView tickets={filteredTickets} onSelectTicket={setSelectedTicket} selectedTicket={selectedTicket} onDeleteTicket={handleDeleteTicket} />;
        case 'reports': {
          const activeTickets = listenBenchTickets.filter((t) => t.status !== Status.Abgeschlossen);
          const completedTickets = listenBenchTickets.filter((t) => t.status === Status.Abgeschlossen);
          return <ReportsView activeTickets={activeTickets} completedTickets={completedTickets} users={users} />;
        }
        case 'techniker': return <TechnicianView tickets={listenBenchTickets} technicians={users.filter(u => (u.role === Role.Technician || u.role === Role.Housekeeping) && u.isActive)} onTechnicianSelect={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} onFilter={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} />;
        case 'settings': return <SettingsView users={users} setUsers={setUsers} locations={locations} setLocations={setLocations} assets={assets} setAssets={setAssets} maintenancePlans={maintenancePlans} setMaintenancePlans={setMaintenancePlans} appSettings={appSettings} setAppSettings={handleAppSettingsChange} onResendConfirmationMailsForEntryDate={handleResendConfirmationMailsForEntryDate} />;
        default: return (
          <KanbanBoard
            tickets={filteredTickets}
            technicians={activeTechnicians}
            onUpdateTicket={handleTicketUpdate}
            onSelectTicket={setSelectedTicket}
            selectedTicket={selectedTicket}
          />
        );
    }
  }

  const isKanbanWorkbench = currentView === 'dashboard' || currentView === 'tech-dashboard';

  return (
    <div className="app-layout">
      <Sidebar
        appSettings={appSettings}
        isCollapsed={isSidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        theme={theme}
        setTheme={setTheme}
        currentView={currentView}
        setCurrentView={changeView}
        onLogout={handleLogout}
        userRole={currentUser.role}
        userName={displayNameShort(currentUser.name)}
        userNameFull={currentUser.name}
        tickets={ticketsForUser}
        onNewTicketClick={() => setIsModalOpen(true)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        brevoMailOk={currentUser.role === Role.Admin ? brevoMailOk : null}
        brevoMailLastChecked={currentUser.role === Role.Admin ? brevoMailLastChecked : null}
      />
      <main>
        <Header filters={filters} setFilters={setFilters} currentView={currentView} />
        {currentUser?.role === Role.Admin && brevoAdminAlert && !brevoAlertSuppressed && (
          <div
            role="alert"
            style={{
              margin: '0 0 12px',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(180, 35, 24, 0.45)',
              background: 'rgba(220, 53, 69, 0.12)',
              color: 'var(--text-primary)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 14px',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <strong>E-Mail-Versand (Brevo):</strong> funktioniert gerade nicht
              {brevoAdminAlert.status ? ` (HTTP ${brevoAdminAlert.status})` : ''}. Meldungen mit E-Mail können keine
              Bestätigung verschicken. Bitte API-Key in Brevo prüfen und GitHub-Secret{' '}
              <code style={{ fontSize: '0.9em' }}>VITE_BREVO_API_KEY</code> aktualisieren, dann neu deployen.
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.92, wordBreak: 'break-word' }}>
                {brevoAdminAlert.message}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flexShrink: 0 }}
              onClick={() => setBrevoAlertSuppressed(true)}
            >
              Ausblenden
            </button>
          </div>
        )}
        {(currentView === 'dashboard' || currentView === 'tech-dashboard') && (
          <DashboardRoutineLinkBar
            schedules={appSettings.routineSchedules as any}
            users={users}
            userRole={currentUser.role}
            userName={currentUser.name}
            completions={appSettings.routineDayCompletions || []}
            rpHolidayYmdList={rpHolidayYmdList}
            onOpenRoutines={() => changeView('routines')}
          />
        )}
        {isKanbanWorkbench ? (
          <div className="kanban-workbench">
            <style>{`
              .kanban-workbench {
                max-width: 1800px;
                width: 100%;
                margin-top: 1.25rem;
                box-sizing: border-box;
                border: 1px solid var(--border);
                border-radius: 12px;
                overflow: hidden;
                background: var(--bg-secondary);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
              }
              [data-theme="dark"] .kanban-workbench {
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
              }
            `}</style>
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              locations={locationOptionsWithCounts}
              technicians={['Alle', ...activeTechnicians.map((t) => t.name)]}
              statuses={STATUSES}
              userRole={currentUser.role}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              currentView={currentView}
              panelEmbed
            />
            {renderCurrentView()}
          </div>
        ) : (
          <>
            {selectedTicketIds.length > 0 && (currentView === 'tickets' || currentView === 'erledigt') ? (
              <BulkActionBar selectedCount={selectedTicketIds.length} technicians={allTechnicianNames} statuses={Object.values(Status)} onBulkUpdate={handleBulkUpdate} onBulkDelete={handleBulkDelete} onClearSelection={() => setSelectedTicketIds([])} />
            ) : (
              (currentView === 'tickets' || currentView === 'erledigt' || currentView === 'techniker') && (
                <FilterBar filters={filters} setFilters={setFilters} locations={locationOptionsWithCounts} technicians={['Alle', ...activeTechnicians.map((t) => t.name)]} statuses={STATUSES} userRole={currentUser.role} groupBy={groupBy} setGroupBy={setGroupBy} currentView={currentView} />
              )
            )}
            {renderCurrentView()}
          </>
        )}
      </main>
      {isModalOpen && <NewTicketModal onClose={() => setIsModalOpen(false)} onSave={handleAddNewTicket} locations={activeLocations.map(a => a.name)} technicians={activeTechnicians} appSettings={appSettings} compressImage={compressImage}/>}
      <CompleteOrderDialog
        open={!!completeOrderDialog}
        ticketId={completeOrderDialog?.draft.id ?? ''}
        ticketTitle={completeOrderDialog?.draft.title ?? ''}
        onConfirm={handleCompleteOrderConfirm}
        onCancel={handleCompleteOrderCancel}
      />
      {selectedTicket && <TicketDetailSidebar ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdateTicket={handleTicketUpdate} users={users} statuses={Object.values(Status)} currentUser={currentUser} appSettings={appSettings} />}
      {showPortalOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 9999,
            overflow: 'auto',
            padding: '24px 12px',
          }}
        >
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => setShowPortalOverlay(false)}
                style={{
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Zurück zum Dashboard
              </button>
            </div>
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.18)' }}>
              {portalElement}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
