
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Ticket, Status, Priority, Role, GroupableKey, User, Location, AppSettings, Asset, MaintenancePlan, AvailabilityStatus, RoutingRule, RoutineSchedule, RoutineDayCompletion, SLARule
} from './types';
import { MOCK_TICKETS, MOCK_USERS, MOCK_LOCATIONS, STATUSES, DEFAULT_APP_SETTINGS, MOCK_ASSETS, MOCK_MAINTENANCE_PLANS } from './constants';
import { db, functions } from './firebase';
import { collection, doc, setDoc, onSnapshot, getDocs, deleteDoc, arrayUnion, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

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
import ToastContainer, { type Toast } from './components/ToastContainer';
import DashboardRoutineLinkBar from './components/DashboardRoutineLinkBar';
import ZurückgestelltView from './components/ZurückgestelltView';
import { localISODate, isRoutineDueOnCalendarDay, routineDayStatus } from './utils/routineHelpers';
import { getStaffChatState, hasUnreadReporterNote } from './utils/staffChat';
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
const LOCAL_STORAGE_KEY_DELETED_IDS = 'facility-management-deleted-ticket-ids';
const LOCAL_STORAGE_KEY_COMPLETED_TICKETS = 'facility-management-completed-tickets';
const LOCAL_STORAGE_KEY_ROUTINE_TICKETS = 'facility-management-routine-tickets';
// Einmal-Schalter für die einmaligen Daten-Migrationen (Alt-Format → Sammlungen,
// completed/routine aus tickets/ verschieben, closedAt-Backfill, Ghost-Cleanup).
// Liegt als app_data-Dokument vor. Solange NICHT gesetzt, laufen die Migrationen beim
// Laden – inkl. teurer Voll-Scans der completed_tickets-Sammlung. Sobald gesetzt, werden
// diese Voll-Scans bei jedem Laden ÜBERSPRUNGEN (Firestore-Lesekosten sparen).
// Recovery: dieses app_data-Dokument in Firestore löschen → Migrationen laufen einmalig erneut.
const APP_DATA_KEY_MIGRATIONS_DONE = 'data-migrations-v1';

const DRK_TICKET_PORTAL_URL = 'https://drk-facility-dashboard.web.app';
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
      kind: 'ticket_in_progress';
      ticketId: string;
      title: string;
      area: string;
      location: string;
      priority: string;
      technician: string;
      dueDate: string;
      description: string;
    }
  | {
      kind: 'admin_new_ticket';
      ticketId: string;
      title: string;
      area: string;
      location: string;
      categoryName: string;
      priority: string;
      reporter: string;
      description: string;
      entryDate: string;
      entryTime?: string;
    }
  | {
      kind: 'due_date_changed';
      ticketId: string;
      title: string;
      newDueDate: string;
    }
  | {
      kind: 'custom';
      subject: string;
      bodyHtml: string;
      bodyText: string;
    };

const drkBrevoBannerTitle = (p: DrkBrevoMailPayload) => {
  switch (p.kind) {
    case 'ticket_created':
      return 'Meldung erfasst';
    case 'staff_note':
      return 'Neuigkeit zu Ihrer Meldung';
    case 'ticket_closed':
      return 'Meldung abgeschlossen';
    case 'ticket_in_progress':
      return 'Ihre Meldung wird bearbeitet';
    case 'admin_new_ticket':
      return 'Neue Meldung eingegangen';
    case 'due_date_changed':
      return 'Fälligkeitstermin geändert';
    case 'custom':
      return p.subject;
  }
};

const buildDrkBrevoPlainText = (p: DrkBrevoMailPayload) => {
  const line = '────────────────────────────';
  if (p.kind === 'ticket_created') {
    return [
      'DRK Serviceportal',
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
      'DRK Serviceportal',
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
  if (p.kind === 'ticket_in_progress') {
    return [
      'DRK Serviceportal',
      '',
      `Ticketnummer: ${p.ticketId}`,
      '',
      'Ihre Meldung wird jetzt bearbeitet. Hier alle Informationen auf einen Blick:',
      '',
      `  Ticket-Nr.:  ${p.ticketId}`,
      `  Betreff:     ${p.title}`,
      `  Standort:    ${p.area}${p.location ? ` › ${p.location}` : ''}`,
      `  Priorität:   ${p.priority}`,
      `  Bearbeiter:  ${p.technician}`,
      `  Fälligkeit:  ${p.dueDate}`,
      ...(p.description ? ['', `  Beschreibung: ${p.description}`] : []),
      '',
      'Direktlink zu Ihrem Ticket:',
      `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
      '',
      'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
    ].join('\n');
  }
  if (p.kind === 'admin_new_ticket') {
    return [
      'DRK Serviceportal · Neue Meldung',
      '',
      `Ticket-Nr.: ${p.ticketId}`,
      `Betreff:    ${p.title}`,
      `Gemeldet:   ${p.reporter}`,
      `Standort:   ${p.area}`,
      `Raum:       ${p.location}`,
      `Priorität:  ${p.priority}`,
      `Eingang:    ${p.entryDate}${p.entryTime ? ` | ${p.entryTime} Uhr` : ''}`,
      '',
      p.description ? `Beschreibung:\n${p.description}` : '',
      '',
      'Diese E-Mail wurde automatisch erzeugt.',
    ].filter(l => l !== '').join('\n');
  }
  if (p.kind === 'due_date_changed') {
    return [
      'DRK Serviceportal',
      '',
      `Ticketnummer: ${p.ticketId}`,
      '',
      `Der Fälligkeitstermin Ihrer Meldung „${p.title}" wurde geändert.`,
      '',
      `Neuer Termin: ${p.newDueDate}`,
      '',
      'Direktlink zu Ihrem Ticket:',
      `${DRK_TICKET_PORTAL_URL}/?ticket=${encodeURIComponent(p.ticketId)}`,
      '',
      'Diese E-Mail wurde automatisch erzeugt. Bitte nicht antworten.',
    ].join('\n');
  }
  if (p.kind === 'custom') {
    return p.bodyText;
  }
  return [
    'DRK Serviceportal',
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

/**
 * CTA-Button: bgcolor für Outlook, background+border-radius für moderne Clients.
 * padding nur auf <td> (kein mso-padding-alt).
 */
const portalOpenButtonRowHtml = (ticketId: string) => {
  const href = portalDeepLink(ticketId);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td bgcolor="${DRK_RED}" style="background:${DRK_RED};border-radius:6px;padding:14px 32px;">
<a href="${href}" style="display:block;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;mso-line-height-rule:exactly;line-height:1.2;">Ticket im Portal &#246;ffnen</a>
</td></tr></table>`;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const portalOpenButtonWrappedHtml = (ticketId: string, _margin: string) => portalOpenButtonRowHtml(ticketId);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const portalCtaHtml = (ticketId: string) => portalOpenButtonRowHtml(ticketId);

/**
 * Duales E-Mail-Layout:
 *  <!--[if mso]>        → Outlook Windows: Tabellen-Fallback (600px fix, kein Shadow/Radius)
 *  <!--[if !mso]><!-->  → Moderne Clients: CSS-Design (Shadow, Radius, schönes Layout)
 */
const drkEmailShellHtml = (
  bannerTitle: string,
  innerBodyHtml: string,
  _ticketId: string,
  _footerCtaHtml?: string,
) => `<!DOCTYPE html>
<html lang="de" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(bannerTitle)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:${DRK_PAGE_BG};">

<!--[if mso]>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${DRK_PAGE_BG}">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;border-collapse:collapse;">
<tr><td bgcolor="${DRK_RED}" height="6" style="background:${DRK_RED};height:6px;line-height:6px;font-size:1px;mso-line-height-rule:exactly;">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:16px 22px;">
<img src="${DRK_LOGO_EMAIL_SRC}" alt="DRK Logo" width="240" style="display:block;border:0;width:240px;">
</td></tr>
<tr><td bgcolor="${DRK_RED}" style="background:${DRK_RED};padding:20px 22px 24px;">
<p style="margin:0;font-size:24px;font-weight:bold;color:#ffffff;line-height:1.3;font-family:Arial,Helvetica,sans-serif;mso-line-height-rule:exactly;">${escapeHtml(bannerTitle)}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:24px 22px;font-family:Arial,Helvetica,sans-serif;">
${innerBodyHtml}
</td></tr>
<tr><td bgcolor="#f5f5f5" style="background:#f5f5f5;padding:16px 22px;border-top:1px solid #e0e0e0;">
<p style="margin:0;font-size:12px;color:#888888;text-align:center;font-family:Arial,Helvetica,sans-serif;">Automatische Nachricht &middot; bitte nicht auf diese E-Mail antworten</p>
<p style="margin:8px 0 0;font-size:13px;font-weight:bold;color:#666666;text-align:center;font-family:Arial,Helvetica,sans-serif;">DRK Serviceportal</p>
</td></tr>
</table>
</td></tr></table>
<![endif]-->

<!--[if !mso]><!--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${DRK_PAGE_BG}" style="background:${DRK_PAGE_BG};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
  <tr><td bgcolor="${DRK_RED}" style="background:${DRK_RED};padding:0;height:6px;line-height:6px;font-size:1px;">&nbsp;</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:18px 22px;">
    <img src="${DRK_LOGO_EMAIL_SRC}" alt="DRK Logo" width="300" style="display:block;width:300px;max-width:100%;height:auto;border:0;">
  </td></tr>
  <tr><td bgcolor="${DRK_RED}" style="background:${DRK_RED};padding:22px 22px 26px;">
    <p style="margin:0;font-size:24px;font-weight:bold;color:#ffffff;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(bannerTitle)}</p>
  </td></tr>
  <tr><td style="padding:24px 22px 22px;font-family:Arial,Helvetica,sans-serif;">${innerBodyHtml}</td></tr>
</table>
<p style="margin:14px auto 0;font-size:12px;color:#888888;text-align:center;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">Automatische Nachricht &middot; bitte nicht auf diese E-Mail antworten</p>
<p style="margin:8px auto 0;font-size:13px;font-weight:bold;color:#666666;text-align:center;line-height:1.3;font-family:Arial,Helvetica,sans-serif;">DRK Serviceportal</p>
</td></tr></table>
<!--<![endif]-->

</body></html>`;

const buildDrkBrevoHtml = (p: DrkBrevoMailPayload) => {
  const title = drkBrevoBannerTitle(p);
  if (p.kind === 'ticket_created') {
    const inner = `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;"><strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong></p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#333;">Ihre Meldung ist bei uns eingegangen und befindet sich nun in der Bearbeitung.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '0 0 4px')}
<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#444;font-family:Arial,Helvetica,sans-serif;">Mit diesem Button öffnen Sie das Meldeportal. Ihre Ticketnummer ist im Link bereits enthalten – Sie müssen sie <strong>nicht erneut eingeben</strong>.</p>`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'ticket_in_progress') {
    const rows = [
      ['Ticket-Nr.', p.ticketId],
      ['Betreff', p.title],
      ['Standort', p.location ? `${p.area} › ${p.location}` : p.area],
      ['Priorität', p.priority],
      ['Bearbeiter', p.technician],
      ['Fälligkeit', p.dueDate],
    ].map(([label, value]) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;white-space:nowrap;padding-right:16px;">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;font-weight:600;">${escapeHtml(value)}</td></tr>`
    ).join('');
    const descHtml = p.description
      ? `<p style="margin:18px 0 6px;font-size:14px;color:#555;font-weight:600;">Beschreibung</p><p style="margin:0;font-size:14px;line-height:1.6;color:#333;white-space:pre-wrap;">${escapeHtml(p.description)}</p>`
      : '';
    const inner = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#333;">Ihre Meldung wird jetzt bearbeitet. Hier alle Informationen auf einen Blick:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:4px;">${rows}</table>
${descHtml}
${portalOpenButtonWrappedHtml(p.ticketId, '18px 0 0')}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'staff_note') {
    const inner = `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;font-family:Arial,Helvetica,sans-serif;"><strong>Ticketnummer: ${escapeHtml(p.ticketId)}</strong></p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#333;font-family:Arial,Helvetica,sans-serif;">Es gibt eine <strong>Neuigkeit</strong> zu Ihrer Meldung:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
<tr><td bgcolor="#faf7f2" style="background:#faf7f2;border-left:4px solid ${DRK_RED};padding:16px 18px;">
<p style="margin:0;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(p.noteText)}</p>
</td></tr></table>
<p style="margin:20px 0 28px;font-size:14px;line-height:1.55;color:#444;font-family:Arial,Helvetica,sans-serif;">Details und R&#252;ckmeldung erreichen Sie &#252;ber den Button &#8211; Ihre Ticketnummer ist im Link bereits hinterlegt.</p>
${portalOpenButtonWrappedHtml(p.ticketId, '0')}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'admin_new_ticket') {
    const rows = [
      ['Ticket-Nr.', p.ticketId],
      ['Betreff', p.title],
      ['Gemeldet von', p.reporter],
      ['Standort', p.area],
      ['Raum / Bereich', p.location],
      ['Priorität', p.priority],
      ['Eingang', p.entryTime ? `${p.entryDate} | ${p.entryTime} Uhr` : p.entryDate],
    ].map(([label, value]) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;white-space:nowrap;padding-right:16px;">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;font-weight:600;">${escapeHtml(value)}</td></tr>`
    ).join('');
    const descHtml = p.description
      ? `<p style="margin:18px 0 6px;font-size:14px;color:#555;font-weight:600;">Beschreibung</p><p style="margin:0;font-size:14px;line-height:1.6;color:#333;white-space:pre-wrap;">${escapeHtml(p.description)}</p>`
      : '';
    const inner = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:4px;">${rows}</table>
${descHtml}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'due_date_changed') {
    const inner = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#333;">Der Fälligkeitstermin Ihrer Meldung hat sich geändert:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:20px;">
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;white-space:nowrap;padding-right:16px;">Ticket-Nr.</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;font-weight:600;">${escapeHtml(p.ticketId)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;white-space:nowrap;padding-right:16px;">Betreff</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;font-weight:600;">${escapeHtml(p.title)}</td></tr>
<tr><td style="padding:8px 0;font-size:14px;color:#555;white-space:nowrap;padding-right:16px;">Neuer Termin</td><td style="padding:8px 0;font-size:15px;color:#222;font-weight:700;">${escapeHtml(p.newDueDate)}</td></tr>
</table>
${portalOpenButtonWrappedHtml(p.ticketId, '0')}`;
    return drkEmailShellHtml(title, inner, p.ticketId, '');
  }
  if (p.kind === 'custom') {
    return drkEmailShellHtml(title, p.bodyHtml, '', '');
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
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  if (!recipient || !isValidEmail) {
    console.warn('Brevo: ungültige oder leere E-Mail-Adresse:', recipient);
    return false;
  }
  const textContent = buildDrkBrevoPlainText(payload);
  const htmlContent = buildDrkBrevoHtml(payload);
  try {
    const sendFn = httpsCallable<
      { to: string; subject: string; htmlContent: string; textContent: string },
      { ok: boolean; messageId?: string }
    >(functions, 'sendBrevoMail');
    const result = await sendFn({ to: recipient, subject, htmlContent, textContent });
    if (!result.data.ok) {
      const detail = 'Unbekannter Fehler';
      emitBrevoMailStatus({ ok: false, status: 0, message: detail });
      if (!silent) window.alert(`E-Mail konnte nicht gesendet werden.\n\n${detail}`);
      return false;
    }
    console.info('Brevo OK', { messageId: result.data.messageId });
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
/** Feiertage Rheinland-Pfalz für ein gegebenes Jahr (algorithmisch berechnet). */
const getRlpHolidays = (year: number): Set<string> => {
  // Ostersonntag nach Gauss/Meeus
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const addDaysToDate = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const holidays = new Set<string>();
  // Feste Feiertage
  [[1,1],[5,1],[10,3],[11,1],[12,25],[12,26]].forEach(([m,d]) => holidays.add(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`));
  // Rheinland-Pfalz: bewegliche Feiertage
  [-2, 1, 39, 49, 50, 60].forEach(offset => holidays.add(fmt(addDaysToDate(easter, offset))));
  // Fronleichnam (+60), Allerheiligen (1.11) bereits enthalten
  return holidays;
};

/** Gibt das Datum zurück, das n Werktage (Mo-Fr, keine Feiertage RLP) nach base liegt. */
const addWorkdays = (base: Date, workdays: number): Date => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  let added = 0;
  const holidays = getRlpHolidays(d.getFullYear());
  while (added < workdays) {
    d.setDate(d.getDate() + 1);
    // Jahreswechsel: Feiertage neu laden
    const hols = getRlpHolidays(d.getFullYear());
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (d.getDay() !== 0 && d.getDay() !== 6 && !hols.has(iso)) added++;
  }
  return d;
};

const reactiveDueDateAfterCalendarDaysFromEntry = (entryDateDE: string, _calendarDays: number): Date => {
    const parsed = parseGermanDate(entryDateDE);
    const base = parsed ?? new Date();
    return addWorkdays(base, REACTIVE_DEFAULT_LEAD_DAYS);
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

// ────────────────────────────────────────────────────────────────────────────
// HARTE SICHERHEITS-REGEL für automatische Umverteilung (Abwesenheit/Rückkehr).
// NUR diese drei Status dürfen jemals automatisch einem anderen Bearbeiter
// zugewiesen werden. Abgeschlossen & Zurückgestellt werden NIEMALS automatisch
// angefasst – die wurden bewusst manuell verteilt bzw. abgeschlossen und bleiben
// exakt so, bis ein Mensch sie wieder aufmacht (oder der Melder sie aufschließt).
// Diese Funktion ist die EINZIGE Stelle, an der diese Regel definiert wird –
// alle Umverteilungs-Wege müssen sie benutzen.
const REDISTRIBUTABLE_STATUSES: Status[] = [Status.Offen, Status.InArbeit, Status.Ueberfaellig];
const canRedistribute = (ticket: { status: Status }): boolean =>
    REDISTRIBUTABLE_STATUSES.includes(ticket.status);

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
/** Prüft ob ein Keyword als ganzes Wort im Text vorkommt (nicht als Teilstring). */
const keywordMatchesText = (keyword: string, text: string): boolean => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return false;
    // Exakter Wortgrenzen-Vergleich: Keyword muss von Wortgrenzen umgeben sein
    try {
        return new RegExp(`(?<![a-zäöüß])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zäöüß])`, 'i').test(text);
    } catch {
        return text.includes(kw);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// SELBST-LERNENDES ROUTING
// Aus jeder MANUELLEN Zuweisung lernt das System „Schlagwort → Person".
// Schwelle „Mittel": ab LEARN_THRESHOLD gleichen Zuweisungen für ein Schlagwort
// wird ein neues Ticket mit diesem Schlagwort automatisch zugewiesen – sonst
// bleibt es unzugewiesen ('N/A') und wartet auf eine manuelle Zuweisung.
// Manuell angelegte Routing-Regeln haben IMMER Vorrang (siehe assignTicket).
const LEARN_THRESHOLD = 2;

type LearnedRouting = { [keyword: string]: { [technicianName: string]: number } };

const LEARN_STOPWORDS = new Set<string>([
  'der','die','das','und','oder','ist','war','sind','ein','eine','einen','einem','einer','eines',
  'den','dem','des','für','von','vor','nach','bei','mit','aus','auf','zur','zum','beim','sowie',
  'nicht','kein','keine','mehr','sehr','auch','schon','aber','wie','was','wer','wann','warum',
  'dass','weil','wenn','dann','muss','soll','kann','wegen','etwas','hier','dort','sich','man',
  'wir','ich','sie','ihr','uns','euch','ihre','ihren','seine','sein','dieser','diese','dieses',
  'alle','alles','durch','über','unter','ohne','gegen','bzw','usw','etc','bitte','noch','wird',
  'werden','wurde','haben','sowie','bzw',
]);

/** Bedeutungstragende Wörter aus Betreff + Beschreibung (klein, ohne Füllwörter, ohne sehr kurze). */
const extractKeywords = (text: string): string[] => {
  const out = new Set<string>();
  for (const tok of (text || '').toLowerCase().split(/[^a-zäöüß]+/)) {
    const w = tok.trim();
    if (w.length < 4) continue;
    if (LEARN_STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return [...out];
};

/** Wählt aus dem Gelernten einen Bearbeiter – NUR wenn ein Schlagwort die Schwelle erreicht
 *  UND der Gewinner gerade verfügbar ist. Sonst 'N/A' (warten auf manuelle Zuweisung). */
const learnedRoutingPick = (
  fullText: string,
  learned: LearnedRouting | undefined,
  users: User[],
  tickets: Ticket[],
): string => {
  if (!learned) return 'N/A';
  const keywords = extractKeywords(fullText);
  if (keywords.length === 0) return 'N/A';

  const availableNames = new Set(
    users
      .filter(u =>
        (u.role === Role.Technician || u.role === Role.Housekeeping) &&
        u.isActive &&
        u.availability.status === AvailabilityStatus.Available)
      .map(u => u.name)
  );

  // Jedes Schlagwort, dessen Top-Person die Schwelle erreicht UND verfügbar ist, stimmt mit seiner Anzahl.
  const votes = new Map<string, number>();
  for (const kw of keywords) {
    const entry = learned[kw];
    if (!entry) continue;
    let topName = '';
    let topCount = 0;
    for (const [name, count] of Object.entries(entry)) {
      if (count > topCount) { topCount = count; topName = name; }
    }
    if (topName && topCount >= LEARN_THRESHOLD && availableNames.has(topName)) {
      votes.set(topName, (votes.get(topName) || 0) + topCount);
    }
  }
  if (votes.size === 0) return 'N/A';

  // Gewinner = meiste Stimmen; bei Gleichstand der mit geringster aktueller Last.
  let winner = '';
  let bestScore = -1;
  for (const [name, score] of votes.entries()) {
    if (score > bestScore) {
      bestScore = score;
      winner = name;
    } else if (score === bestScore && winner) {
      const loadWinner = tickets.filter(t => t.technician === winner && t.status !== Status.Abgeschlossen).length;
      const loadName = tickets.filter(t => t.technician === name && t.status !== Status.Abgeschlossen).length;
      if (loadName < loadWinner) winner = name;
    }
  }
  return winner || 'N/A';
};

const assignTicket = (
    ticketData: { title?: string; description?: string; },
    users: User[],
    tickets: Ticket[],
    routingRules: RoutingRule[],
    learnedRouting?: LearnedRouting
): string => {
    const fullText = `${ticketData.title || ''} ${ticketData.description || ''}`.toLowerCase();

    // Nur Regeln mit mindestens einem echten Keyword-Match
    const matchedRule = routingRules.find(rule =>
        rule.keyword.split(',').some(kw => keywordMatchesText(kw, fullText))
    );

    // Manuell angelegte Regeln haben Vorrang. Keine Regel getroffen →
    // Gelerntes konsultieren (füllt nur die Lücken). Kein sicheres Lernen → 'N/A' (warten).
    if (!matchedRule) return learnedRoutingPick(fullText, learnedRouting, users, tickets);

    const availableUsers = users.filter(u =>
        (u.role === Role.Technician || u.role === Role.Housekeeping) &&
        u.isActive &&
        u.availability.status === AvailabilityStatus.Available
    );

    // Kandidaten: nur die in der Regel konfigurierten Assignees
    // Wenn die Regel keine Assignees hat → nicht zuweisen
    const pool = (matchedRule.assignees && matchedRule.assignees.length > 0)
        ? availableUsers.filter(u => matchedRule.assignees!.includes(u.name))
        : [];

    if (pool.length === 0) return 'N/A';

    // Den mit der geringsten aktuellen Last zuweisen
    const withLoad = pool.map(tech => ({
        ...tech,
        load: tickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length
    }));
    withLoad.sort((a, b) => a.load - b.load);
    return withLoad[0].name;
};

/** Erkennt die Kategorie automatisch aus Betreff + Beschreibung anhand der Routing-Regeln. */
const inferCategoryFromText = (
  text: string,
  routingRules: RoutingRule[],
  fallbackCategoryId: string
): string => {
  const lower = text.toLowerCase();
  const matched = routingRules.find(r =>
    r.categoryId && r.keyword.split(',').some(kw => kw.trim() && lower.includes(kw.trim().toLowerCase()))
  );
  return matched?.categoryId || fallbackCategoryId;
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
const REACTIVE_DEFAULT_LEAD_DAYS = 2;

/** Strengste SLA-Regel pro Kategorie (kürzeste Antwortzeit) → deren Priorität; sonst null. */
const inferStrictestSlaPriorityForCategory = (categoryId: string | undefined, slaMatrix: SLARule[]): Priority | null => {
  if (!categoryId || !Array.isArray(slaMatrix) || slaMatrix.length === 0) return null;
  const rules = slaMatrix.filter((r) => r.categoryId === categoryId);
  if (rules.length === 0) return null;
  return [...rules].sort((a, b) => a.responseTimeHours - b.responseTimeHours)[0].priority;
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
  Array.isArray(value) ? (value as Ticket[]).map(normalizeTicket) : [];
const asLocationArray = (value: unknown): Location[] =>
  Array.isArray(value) ? (value as Location[]) : [];
const asAssetArray = (value: unknown): Asset[] => (Array.isArray(value) ? (value as Asset[]) : []);
const asPlanArray = (value: unknown): MaintenancePlan[] =>
  Array.isArray(value) ? (value as MaintenancePlan[]) : [];

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
    learnedRouting: (v.learnedRouting && typeof v.learnedRouting === 'object') ? v.learnedRouting : prev.learnedRouting,
    routineSchedules: Array.isArray(v.routineSchedules)
      ? v.routineSchedules.map((remoteS: RoutineSchedule) => {
          const localS = prev.routineSchedules?.find(s => s.id === remoteS.id);
          // Keep the more recent lastGenerated so a just-generated ticket isn't overwritten by stale remote data
          if (localS && (localS.lastGenerated ?? '') > (remoteS.lastGenerated ?? '')) {
            return { ...remoteS, lastGenerated: localS.lastGenerated, rotationCursor: localS.rotationCursor };
          }
          return remoteS;
        })
      : prev.routineSchedules ?? [],
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
    safeJSONParse<Ticket[]>(LOCAL_STORAGE_KEY_TICKETS, []).map(normalizeTicket)
  );
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [routineTickets, setRoutineTickets] = useState<Ticket[]>(() =>
    safeJSONParse<Ticket[]>(LOCAL_STORAGE_KEY_ROUTINE_TICKETS, []).map(normalizeTicket)
  );
  const [users, setUsers] = useState<User[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_USERS, []));
  const [locations, setLocations] = useState<Location[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_LOCATIONS, []));
  const [assets, setAssets] = useState<Asset[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_ASSETS, []));
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_PLANS, []));
  const [appSettings, setAppSettings] = useState<AppSettings>(() => ({ ...DEFAULT_APP_SETTINGS, ...safeJSONParse(LOCAL_STORAGE_KEY_SETTINGS, {}) }));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [rpHolidayYmdList, setRpHolidayYmdList] = useState<string[]>([]);
  /** Admin: sichtbarer Hinweis wenn Brevo (Transaktions-Mail) nicht funktioniert */
  const [brevoAdminAlert, setBrevoAdminAlert] = useState<{ message: string; status: number } | null>(null);
  const [brevoAlertSuppressed, setBrevoAlertSuppressed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  const addToast = (toast: Omit<Toast, 'id'>) => setToasts(prev => [...prev, { ...toast, id: `${Date.now()}-${Math.random()}` }]);
  /** Sidebar-Status wie „Synchronisiert“ */
  const [brevoMailOk, setBrevoMailOk] = useState<boolean | null>(null);
  const [brevoMailLastChecked, setBrevoMailLastChecked] = useState<Date | null>(null);
  const isRemoteUpdate = useRef(false);
  const appDataReadyRef = useRef(false);
  // true, sobald die einmaligen Daten-Migrationen erledigt sind (aus app_data gelesen oder
  // gerade abgeschlossen). Steuert das Überspringen der teuren completed_tickets-Voll-Scans.
  const migrationsDoneRef = useRef(false);
  const ticketsSnapshotReadyRef = useRef(false);
  const completedSnapshotReadyRef = useRef(false);
  const routineSnapshotReadyRef = useRef(false);
  const deletedTicketIdsRef = useRef<Set<string>>(
    new Set<string>(safeJSONParse<string[]>(LOCAL_STORAGE_KEY_DELETED_IDS, []))
  );
  const prevUsersRef = useRef<User[]>(users);

  const _today = new Date();
  const [completedMonth, setCompletedMonth] = useState<number>(_today.getMonth() + 1); // 1–12
  const [completedYear, setCompletedYear] = useState<number>(_today.getFullYear());
  const [isLoadingCompleted, setIsLoadingCompleted] = useState<boolean>(false);

  // Hilfsfunktion: DD.MM.YYYY → YYYY-MM-DD (für closedAt-Migration)
  const germanDateToIso = (d: string | undefined): string | null => {
    if (!d || d === 'N/A') return null;
    const p = d.split('.');
    if (p.length !== 3) return null;
    const year = p[2].length === 2 ? `20${p[2]}` : p[2];
    return `${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  };

  const loadCompletedTicketsForMonth = useCallback(async (month: number, year: number) => {
    setIsLoadingCompleted(true);
    try {
      // Schritt 1: Einmaliger closedAt-Backfill für Alt-Tickets.
      // ACHTUNG Firestore-Lesekosten: dieser Voll-Scan der GESAMTEN completed_tickets-Sammlung
      // lief früher bei JEDEM Monatswechsel + jedem Laden. Da neu abgeschlossene Tickets ihr
      // closedAt beim Schließen setzen (commitTicketUpdate), ist der Backfill reine Alt-Daten-
      // Migration und nur nötig, solange der Einmal-Schalter (migrationsDoneRef) nicht gesetzt ist.
      if (!migrationsDoneRef.current) {
        const allSnap = await getDocs(collection(db, 'completed_tickets'));
        const toMigrate = allSnap.docs.filter(d => {
          const data = d.data() as Ticket;
          return !data.closedAt && (data.completionDate || data.entryDate);
        });
        if (toMigrate.length > 0) {
          await Promise.all(toMigrate.map(d => {
            const data = d.data() as Ticket;
            const iso = germanDateToIso(data.completionDate) ?? germanDateToIso(data.entryDate);
            if (!iso) return Promise.resolve();
            return setDoc(doc(db, 'completed_tickets', d.id), { ...data, closedAt: iso });
          }));
        }
      }

      // Schritt 2: Monatsabfrage per closedAt
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      const q = query(
        collection(db, 'completed_tickets'),
        where('closedAt', '>=', start),
        where('closedAt', '<', end)
      );
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs
        .filter(d => !deletedTicketIdsRef.current.has(d.id))
        .map(d => normalizeTicket(d.data() as Ticket));
      setCompletedTickets(loaded);
    } catch (e) {
      console.error('loadCompletedTicketsForMonth error:', e);
      setCompletedTickets([]);
    } finally {
      setIsLoadingCompleted(false);
    }
  }, []);

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

  // Push-Benachrichtigungen anfordern (einmalig beim Login als Admin)
  useEffect(() => {
    if (currentUser?.role !== Role.Admin) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser?.role]);

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
        // Push-Benachrichtigung senden
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification('DRK Serviceportal – E-Mail inaktiv', {
            body: 'Der E-Mail-Versand über Brevo ist ausgefallen. Bitte in Brevo prüfen und reaktivieren.',
            icon: '/icon-192.png',
            tag: 'brevo-down',
          });
          n.onclick = () => {
            window.open('https://app.brevo.com', '_blank');
            n.close();
          };
        }
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
    const healthFn = httpsCallable<Record<string, never>, { ok: boolean; status: number; message: string }>(
      functions, 'checkBrevoHealth'
    );
    let cancelled = false;
    const run = async () => {
      const r = await checkBrevoAccountApi(healthFn);
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

  // --- Stale-Ticket-Erinnerungen (Admin, einmal beim Start) ---
  useEffect(() => {
    if (!isInitialized || currentUser?.role !== Role.Admin || tickets.length === 0) return;

    const STALE_DAYS = 5; // Tage ohne Aktivität
    const REMINDER_COOLDOWN_DAYS = 3; // nicht öfter als alle 3 Tage erinnern
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Letzte Aktivität aus Notizen ermitteln
    const getLastActivity = (t: Ticket): Date => {
      if (t.notes && t.notes.length > 0) {
        // Notiz-Format: "Text (Person am DD.MM.YYYY, HH:MM)" oder "Text (Person DD.MM.YYYY, HH:MM)"
        const lastNote = t.notes[t.notes.length - 1];
        const dateMatch = lastNote.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (dateMatch) {
          const [, d, m, y] = dateMatch;
          const year = y.length === 2 ? 2000 + Number(y) : Number(y);
          const parsed = new Date(year, Number(m) - 1, Number(d));
          if (!isNaN(parsed.getTime())) return parsed;
        }
      }
      // Fallback: Erstelldatum
      if (t.entryDate) {
        const p = t.entryDate.split('.');
        if (p.length === 3) {
          const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
          if (!isNaN(d.getTime())) return d;
        }
      }
      return new Date(0);
    };

    const diffDays = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);

    // Stale Tickets filtern
    const stale = tickets.filter(t => {
      if (t.status === Status.Abgeschlossen || t.status === Status.Zurueckgestellt) return false;
      if (!t.technician || t.technician === 'N/A') return false;
      const lastActivity = getLastActivity(t);
      const daysSinceActivity = diffDays(lastActivity, today);
      if (daysSinceActivity < STALE_DAYS) return false;
      // Cooldown: nicht erneut senden wenn schon kürzlich erinnert
      if (t.reminderSentAt) {
        const lastReminder = new Date(t.reminderSentAt);
        if (diffDays(lastReminder, today) < REMINDER_COOLDOWN_DAYS) return false;
      }
      return true;
    });

    if (stale.length === 0) return;

    // Gruppiert nach Techniker → eine E-Mail pro Person
    const byTechnician = new Map<string, Ticket[]>();
    stale.forEach(t => {
      if (!byTechnician.has(t.technician)) byTechnician.set(t.technician, []);
      byTechnician.get(t.technician)!.push(t);
    });

    byTechnician.forEach(async (techTickets, techName) => {
      // E-Mail-Adresse des Technikers
      const techUser = users.find(u => u.name === techName);
      const email = techUser?.email;
      if (!email) return; // Kein Email → überspringen

      const ticketLines = techTickets.map(t => {
        const lastAct = getLastActivity(t);
        const days = diffDays(lastAct, today);
        return `• Ticket #${t.id} – ${t.title} (${t.area}, ${t.priority}, seit ${days} Tagen ohne Aktivität)`;
      }).join('\n');

      const subject = `Erinnerung: ${techTickets.length} Ticket${techTickets.length > 1 ? 's' : ''} warten auf Bearbeitung`;
      const textContent = [
        `Hallo ${techName},`,
        '',
        `folgende Tickets haben seit ${STALE_DAYS}+ Tagen keine Aktivität:`,
        '',
        ticketLines,
        '',
        'Bitte diese Tickets zeitnah bearbeiten oder den Status aktualisieren.',
        '',
        'DRK Serviceportal',
      ].join('\n');

      const bodyHtml = `
        <p>Hallo <strong>${techName}</strong>,</p>
        <p>folgende Tickets haben seit mindestens <strong>${STALE_DAYS} Tagen</strong> keine Aktivität und warten auf Bearbeitung:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="background:#f5f5f5;"><th style="text-align:left;padding:6px 8px;border:1px solid #ddd;">Ticket</th><th style="text-align:left;padding:6px 8px;border:1px solid #ddd;">Betreff</th><th style="padding:6px 8px;border:1px solid #ddd;">Standort</th><th style="padding:6px 8px;border:1px solid #ddd;">Priorität</th><th style="padding:6px 8px;border:1px solid #ddd;">Inaktiv seit</th></tr>
          ${techTickets.map(t => {
            const days = diffDays(getLastActivity(t), today);
            return `<tr><td style="padding:6px 8px;border:1px solid #ddd;">#${t.id}</td><td style="padding:6px 8px;border:1px solid #ddd;">${t.title}</td><td style="padding:6px 8px;border:1px solid #ddd;">${t.area}</td><td style="padding:6px 8px;border:1px solid #ddd;">${t.priority}</td><td style="padding:6px 8px;border:1px solid #ddd;">${days} Tage</td></tr>`;
          }).join('')}
        </table>
        <p style="margin-top:16px;">Bitte diese Tickets zeitnah bearbeiten oder den Status aktualisieren.</p>
      `;
      // Unterstützt mehrere kommagetrennte Adressen (z.B. "ali@x.de, torsten@x.de")
      const emailAddresses = email.split(',').map(e => e.trim()).filter(Boolean);
      const results = await Promise.all(
        emailAddresses.map(addr => sendDrkBrevoMailAsync(addr, subject, {
          kind: 'custom',
          subject,
          bodyHtml,
          bodyText: textContent,
        }, { silent: true }))
      );
      const ok = results.some(r => r);

      if (ok) {
        // reminderSentAt auf allen erinnerten Tickets setzen
        techTickets.forEach(t => {
          saveTicketToFirebase({ ...t, reminderSentAt: todayStr });
        });
      }
    });
  // Nur beim ersten Laden (isInitialized wechselt von false→true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  // --- Firebase Sync Logic ---
  useEffect(() => {
    const tryMarkInitialized = () => {
      if (appDataReadyRef.current && ticketsSnapshotReadyRef.current && completedSnapshotReadyRef.current && routineSnapshotReadyRef.current) {
        setIsInitialized(true);
      }
    };

    const fetchData = async () => {
      setIsSyncing(true);
      try {
        // Load non-ticket app data
        const querySnapshot = await getDocs(collection(db, 'app_data'));
        // Einmal-Schalter prüfen: sind die teuren Daten-Migrationen bereits erledigt?
        // (Flag liegt selbst im app_data-Snapshot — kein zusätzlicher Lesezugriff nötig.)
        const migFlagDoc = querySnapshot.docs.find((d) => d.id === APP_DATA_KEY_MIGRATIONS_DONE);
        migrationsDoneRef.current = migFlagDoc?.data()?.value?.done === true;
        if (!querySnapshot.empty) {
          isRemoteUpdate.current = true;
          querySnapshot.forEach((d) => {
            const key = d.id;
            const value = d.data().value;
            switch (key) {
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
              case 'deleted-ticket-ids':
                (Array.isArray(value) ? value as string[] : []).forEach((id: string) => deletedTicketIdsRef.current.add(id));
                persistDeletedIds();
                break;
            }
          });
          setLastSyncTime(new Date());
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);

          // Race-condition safety: onSnapshot for tickets/routine_tickets may have already fired
          // before fetchData() finished loading the deleted-ticket-ids blocklist from Firestore.
          // Re-filter both collections now that deletedTicketIdsRef is fully populated.
          if (deletedTicketIdsRef.current.size > 0) {
            setTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
            setRoutineTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
            setCompletedTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
          }
        }

        // Einmalige Daten-Migrationen — NUR ausführen, solange der Einmal-Schalter nicht gesetzt ist.
        // Diese lasen früher bei JEDEM Laden die kompletten Sammlungen tickets/completed_tickets/
        // routine_tickets ein (Hauptquelle der hohen Firestore-Lesekosten, da completed_tickets
        // unbegrenzt wächst). Nach einmaligem Lauf wird der Schalter in app_data gesetzt und der
        // gesamte Block bei künftigen Ladevorgängen übersprungen.
        if (!migrationsDoneRef.current) {
          // Load current state of all ticket collections
          const [ticketsCollSnap, completedCollSnap, routineCollSnap] = await Promise.all([
            getDocs(collection(db, 'tickets')),
            getDocs(collection(db, 'completed_tickets')),
            getDocs(collection(db, 'routine_tickets')),
          ]);

          // Migration from old app_data array format:
          // Write any ticket from the old doc that doesn't yet exist in either collection
          const oldDoc = querySnapshot.docs.find((d) => d.id === LOCAL_STORAGE_KEY_TICKETS);
          if (oldDoc) {
            const oldTickets = asTicketArray(oldDoc.data().value);
            const existingIds = new Set([
              ...ticketsCollSnap.docs.map((d) => d.id),
              ...completedCollSnap.docs.map((d) => d.id),
              ...routineCollSnap.docs.map((d) => d.id),
            ]);
            const missing = oldTickets.filter(
              (t) => !existingIds.has(t.id) && !deletedTicketIdsRef.current.has(t.id)
            );
            if (missing.length > 0) {
              console.log(`Migrating ${missing.length} missing tickets from old format…`);
              await Promise.all(
                missing.map((t) => {
                  let target: string;
                  if (t.status === Status.Abgeschlossen) {
                    target = 'completed_tickets';
                  } else if (t.origin === 'routine') {
                    target = 'routine_tickets';
                  } else {
                    target = 'tickets';
                  }
                  return setDoc(doc(db, target, t.id), JSON.parse(JSON.stringify(t)));
                })
              );
            }
          }

          // Migration: move any completed tickets still in tickets/ to completed_tickets/
          const toMigrate = ticketsCollSnap.docs.filter((d) => {
            const t = d.data() as Ticket;
            return t.status === Status.Abgeschlossen && !deletedTicketIdsRef.current.has(d.id);
          });
          if (toMigrate.length > 0) {
            console.log(`Moving ${toMigrate.length} completed tickets to completed_tickets/…`);
            await Promise.all(
              toMigrate.map(async (d) => {
                await setDoc(doc(db, 'completed_tickets', d.id), d.data());
                await deleteDoc(doc(db, 'tickets', d.id));
              })
            );
          }

          // Migration: move any routine tickets still in tickets/ to routine_tickets/
          const routineToMigrate = ticketsCollSnap.docs.filter((d) => {
            const t = d.data() as Ticket;
            return t.origin === 'routine' && t.status !== Status.Abgeschlossen && !deletedTicketIdsRef.current.has(d.id);
          });
          if (routineToMigrate.length > 0) {
            console.log(`Moving ${routineToMigrate.length} routine tickets to routine_tickets/…`);
            await Promise.all(
              routineToMigrate.map(async (d) => {
                await setDoc(doc(db, 'routine_tickets', d.id), d.data());
                await deleteDoc(doc(db, 'tickets', d.id));
              })
            );
          }

          // Migration: move any routine tickets still in completed_tickets/ to routine_tickets/ ...
          // Actually completed routine tickets stay in completed_tickets/ per spec — no migration needed here.

          // Cleanup: remove any documents that are in the deleted-ticket-ids blocklist but still
          // physically exist in Firestore (e.g. previous delete failed due to network issues).
          if (deletedTicketIdsRef.current.size > 0) {
            const allCollSnaps: Array<{ snap: typeof ticketsCollSnap; coll: string }> = [
              { snap: ticketsCollSnap, coll: 'tickets' },
              { snap: completedCollSnap, coll: 'completed_tickets' },
              { snap: routineCollSnap, coll: 'routine_tickets' },
            ];
            for (const { snap, coll } of allCollSnaps) {
              const ghostDocs = snap.docs.filter((d) => deletedTicketIdsRef.current.has(d.id));
              if (ghostDocs.length > 0) {
                console.log(`Cleaning up ${ghostDocs.length} ghost document(s) from ${coll}/…`);
                await Promise.all(
                  ghostDocs.map((d) => deleteDoc(doc(db, coll, d.id)).catch(() => {}))
                );
              }
            }
          }

          // Migrationen erfolgreich durchgelaufen → Einmal-Schalter in app_data setzen, damit die
          // teuren Voll-Scans bei künftigen Ladevorgängen komplett entfallen. Bei einem Fehler oben
          // greift der catch-Zweig und der Schalter bleibt ungesetzt → nächster Start versucht es erneut.
          await setDoc(doc(db, 'app_data', APP_DATA_KEY_MIGRATIONS_DONE), {
            value: { done: true },
            updated_at: new Date().toISOString(),
          });
          migrationsDoneRef.current = true;
        }

        appDataReadyRef.current = true;
        tryMarkInitialized();
      } catch (err) {
        console.error('Error fetching from Firebase:', err);
        appDataReadyRef.current = true;
        tryMarkInitialized();
      } finally {
        setIsSyncing(false);
        // Aktuellen Monat der abgeschlossenen Tickets laden — bewusst HIER (nach dem Migrations-/
        // Einmal-Schalter-Check), damit der einmalige closedAt-Backfill-Voll-Scan in
        // loadCompletedTicketsForMonth nicht bei jedem Laden erneut anläuft. migrationsDoneRef
        // ist an dieser Stelle bereits aus app_data gesetzt (bzw. die Migration ist durchgelaufen).
        const now = new Date();
        void loadCompletedTicketsForMonth(now.getMonth() + 1, now.getFullYear());
      }
    };

    fetchData();

    // Real-time listener for non-ticket app data
    const unsubscribeAppData = onSnapshot(collection(db, 'app_data'), (snapshot) => {
      isRemoteUpdate.current = true;
      let hasChanges = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const key = change.doc.id;
          const value = change.doc.data().value;
          switch (key) {
            case LOCAL_STORAGE_KEY_USERS:
              hasChanges = true;
              setUsers(asUserArray(value));
              break;
            case LOCAL_STORAGE_KEY_LOCATIONS:
              hasChanges = true;
              setLocations(asLocationArray(value));
              break;
            case LOCAL_STORAGE_KEY_ASSETS:
              hasChanges = true;
              setAssets(asAssetArray(value));
              break;
            case LOCAL_STORAGE_KEY_PLANS:
              hasChanges = true;
              setMaintenancePlans(asPlanArray(value));
              break;
            case LOCAL_STORAGE_KEY_SETTINGS:
              hasChanges = true;
              setAppSettings((prev) => mergeAppSettingsRemote(value, prev));
              break;
            case 'deleted-ticket-ids':
              hasChanges = true;
              (Array.isArray(value) ? value as string[] : []).forEach((id: string) => deletedTicketIdsRef.current.add(id));
              persistDeletedIds();
              setTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
              setCompletedTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
              setRoutineTickets((prev) => prev.filter((t) => !deletedTicketIdsRef.current.has(t.id)));
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
      console.error('Firebase app_data onSnapshot error:', error);
    });

    // Real-time listener for individual ticket documents
    const unsubscribeTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      isRemoteUpdate.current = true;
      const changes = snapshot.docChanges();

      if (!ticketsSnapshotReadyRef.current) {
        // Initial snapshot: replace state with all tickets, filtered by deletion blocklist
        const allTickets = snapshot.docs
          .filter((d) => !deletedTicketIdsRef.current.has(d.id))
          .map((d) => normalizeTicket(d.data() as Ticket));
        setTickets(allTickets);
        ticketsSnapshotReadyRef.current = true;
        tryMarkInitialized();
      } else if (changes.length > 0) {
        setTickets((prev) => {
          let next = [...prev];
          changes.forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              if (deletedTicketIdsRef.current.has(change.doc.id)) return; // permanently deleted
              const ticket = normalizeTicket(change.doc.data() as Ticket);
              const idx = next.findIndex((t) => t.id === ticket.id);
              if (idx >= 0) next[idx] = ticket;
              else next = [ticket, ...next];
            } else if (change.type === 'removed') {
              next = next.filter((t) => t.id !== change.doc.id);
            }
          });
          return next;
        });
        setLastSyncTime(new Date());
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
    }, (error) => {
      console.error('Firebase tickets onSnapshot error:', error);
      if (!ticketsSnapshotReadyRef.current) {
        ticketsSnapshotReadyRef.current = true;
        tryMarkInitialized();
      }
    });

    // Abgeschlossene Tickets werden nicht live geladen – nur monatsweise per loadCompletedTicketsForMonth
    completedSnapshotReadyRef.current = true;
    tryMarkInitialized();
    const unsubscribeCompleted = () => {}; // Kein aktiver Listener

    const unsubscribeRoutine = onSnapshot(collection(db, 'routine_tickets'), (snapshot) => {
      isRemoteUpdate.current = true;
      const changes = snapshot.docChanges();

      if (!routineSnapshotReadyRef.current) {
        const allRoutine = snapshot.docs
          .filter((d) => !deletedTicketIdsRef.current.has(d.id))
          .map((d) => normalizeTicket(d.data() as Ticket));
        setRoutineTickets(allRoutine);
        routineSnapshotReadyRef.current = true;
        tryMarkInitialized();
      } else if (changes.length > 0) {
        setRoutineTickets((prev) => {
          let next = [...prev];
          changes.forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              if (deletedTicketIdsRef.current.has(change.doc.id)) return;
              const ticket = normalizeTicket(change.doc.data() as Ticket);
              const idx = next.findIndex((t) => t.id === ticket.id);
              if (idx >= 0) next[idx] = ticket;
              else next = [ticket, ...next];
            } else if (change.type === 'removed') {
              next = next.filter((t) => t.id !== change.doc.id);
            }
          });
          return next;
        });
        setLastSyncTime(new Date());
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
    }, (error) => {
      console.error('Firebase routine_tickets onSnapshot error:', error);
      if (!routineSnapshotReadyRef.current) {
        routineSnapshotReadyRef.current = true;
        tryMarkInitialized();
      }
    });

    // (Der initiale Monats-Load der abgeschlossenen Tickets passiert jetzt am Ende von
    // fetchData — siehe finally-Block oben — damit der Einmal-Schalter vorher feststeht.)

    return () => {
      unsubscribeAppData();
      unsubscribeTickets();
      unsubscribeCompleted();
      unsubscribeRoutine();
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
  const [filters, setFilters] = useState({ area: 'Alle', technician: 'Alle', priority: 'Alle', status: 'Alle', reporter: 'Alle', search: '' });
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
      currentView === 'settings'
    ) {
      setCurrentView('tech-dashboard');
    }
    // zurueckgestellt is allowed for all roles — no redirect
  }, [currentUser, currentView]);

  // Beim Wechsel zur Erledigt-Ansicht den gewählten Monat neu laden
  useEffect(() => {
    if (currentView === 'erledigt') {
      void loadCompletedTicketsForMonth(completedMonth, completedYear);
    }
  }, [currentView]);

  // --- Effects to persist state ---
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Migration for old data
  useEffect(() => {
    if (!isInitialized) return;

    setAppSettings(prev => {
      let changed = false;
      const next = { ...prev };

      // appName
      if (!next.appName || next.appName === 'DRK Facility Dashboard') {
        next.appName = 'DRK Serviceportal';
        changed = true;
      }

      // Category name migrations
      const catRenames: Record<string, string> = {
        'Sicherheit': 'Sicherheit / Brandschutz',
        'IT-Infrastruktur': 'IT / EDV',
        'Komfort': 'Hauswirtschaft',
        'Gebäudetechnik': 'Haustechnik',
      };
      const newCats = (next.ticketCategories || []).map(c => {
        if (catRenames[c.name]) { changed = true; return { ...c, name: catRenames[c.name] }; }
        return c;
      });
      // Add missing categories
      const missingCats = [
        { id: 'cat-garten', name: 'Garten / Außen', default_priority: Priority.Niedrig },
        { id: 'cat-sonstiges', name: 'Sonstiges', default_priority: Priority.Niedrig },
      ].filter(nc => !newCats.some(c => c.id === nc.id));
      if (missingCats.length > 0) changed = true;
      next.ticketCategories = [...newCats, ...missingCats];

      return changed ? next : prev;
    });
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      setUsers(prev => {
          let changed = false;
          // Fest angelegte Konten konsistent halten: Name normalisieren (Tickets referenzieren ihn),
          // Passwort aber NUR setzen, wenn keines vorhanden ist – selbst vergebene Passwörter bleiben erhalten.
          const fixUser = (u: User, wantName: string, defaultPw: string, nameAliases?: string[]): User => {
            const fix: Partial<User> = {};
            const okNames = nameAliases || [wantName];
            if (!okNames.includes(u.name)) fix.name = wantName;
            if (!u.password) fix.password = defaultPw;
            if (Object.keys(fix).length > 0) { changed = true; return { ...u, ...fix }; }
            return u;
          };
          const updated = prev.filter(u => u.id !== 'user-5').map(u => {
            if (u.id === 'user-2') return fixUser(u, 'Heiko Saupert', 'Heiko1');
            if (u.id === 'user-3') return fixUser(u, 'Ali Najafi', 'Ali1');
            if (u.id === 'user-4') return fixUser(u, 'Torsten Isselhard', 'Torsten1');
            if (u.id === 'user-1') return fixUser(u, 'admin', 'admin', ['admin', 'Admin']);
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

  // completedTickets werden nicht mehr im localStorage gecacht (monatsweise Ladung per getDocs)

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ROUTINE_TICKETS, JSON.stringify(routineTickets));
  }, [routineTickets]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(users));
    syncToFirebase(LOCAL_STORAGE_KEY_USERS, users);
  }, [users]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_LOCATIONS, JSON.stringify(locations));
    syncToFirebase(LOCAL_STORAGE_KEY_LOCATIONS, locations);
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
                      // Zentrale Regel: NIE Abgeschlossen/Zurückgestellt automatisch umverteilen
                      if (t.technician !== absentUser.name || !canRedistribute(t)) return false;
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
                  ticketsToUpdate.forEach((t, i) => { if (t !== currentTickets[i]) saveTicketToFirebase(t); });
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
              // Rückkehr-Logik zieht bewusst NUR offene Tickets (Teilmenge der erlaubten Status).
              // canRedistribute zusätzlich als harte Absicherung gegen Abgeschlossen/Zurückgestellt.
              const openTickets = currentTickets.filter(t => t.status === Status.Offen && canRedistribute(t));
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
                  // Unzugewiesene Tickets werden NIE automatisch vergeben — nur manuelle Zuweisung erlaubt.
                  if (!ticket.technician || ticket.technician === 'N/A') return;

                  // Nur Tickets eines abwesenden Technikers können an den Rückkehrer übergehen.
                  const isAssignedToAbsentee = !returningTechnicians.some(rt => rt.name === ticket.technician) &&
                      users.find(u => u.name === ticket.technician)?.availability?.status !== AvailabilityStatus.Available;
                  if (!isAssignedToAbsentee) return;

                  // Rückkehrer mit geringster Last als Ziel wählen, aber nur wenn er unter dem Durchschnitt liegt.
                  const eligibleReturnees = [...returningTechnicians].sort((a, b) => getLoad(a.name, updatedTickets) - getLoad(b.name, updatedTickets));
                  if (eligibleReturnees.length === 0) return;
                  const candidate = eligibleReturnees[0];
                  if (getLoad(candidate.name, updatedTickets) >= avgLoad) return;

                  const ticketIndex = updatedTickets.findIndex(t => t.id === ticket.id);
                  if (ticketIndex !== -1) {
                      updatedTickets[ticketIndex] = {
                          ...updatedTickets[ticketIndex],
                          technician: candidate.name,
                          notes: [...(updatedTickets[ticketIndex].notes || []), `AUTO-UMVERTEILUNG: Von ${ticket.technician} an ${candidate.name} (Rückkehr-Lastverteilung).`]
                      };
                      ticketsUpdated = true;
                      reassignedCount++;
                  }
              });

              if (ticketsUpdated) {
                  console.log(`RÜCKKEHR LOGIK: ${reassignedCount} Tickets neu zugewiesen.`);
                  alert(`Willkommen zurück! ${returningTechnicians.map((u) => displayNameShort(u.name)).join(', ')} ist wieder verfügbar. ${reassignedCount} offene Tickets wurden zur Lastverteilung automatisch zugewiesen.`);
                  updatedTickets.forEach((t, i) => { if (t !== currentTickets[i]) saveTicketToFirebase(t); });
                  return updatedTickets;
              }
              return currentTickets;
          });
      }

      prevUsersRef.current = users;
  }, [users, appSettings.routingRules]);

  // Auto-Rückkehr: Tickets, die an einen Abwesenden zugewiesen (geparkt) wurden, kommen automatisch
  // wieder als „Offen" zurück, sobald diese Person wieder VERFÜGBAR ist. State-basiert (nicht an ein
  // Übergangs-Event gebunden) → robust auch nach Reload. Fasst NUR Tickets mit parkedForReturnOf an,
  // niemals manuell zurückgestellte.
  useEffect(() => {
      const availableNames = new Set(
          users
              .filter(u => (u.role === Role.Technician || u.role === Role.Housekeeping) && u.isActive && u.availability?.status === AvailabilityStatus.Available)
              .map(u => u.name)
      );
      const toRestore = tickets.filter(t =>
          t.parkedForReturnOf && t.status === Status.Zurueckgestellt && availableNames.has(t.parkedForReturnOf)
      );
      if (toRestore.length === 0) return;

      const d = new Date();
      const stamp = `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      setTickets(prev => {
          let changed = false;
          const next = prev.map(t => {
              if (t.parkedForReturnOf && t.status === Status.Zurueckgestellt && availableNames.has(t.parkedForReturnOf)) {
                  changed = true;
                  return {
                      ...t,
                      status: Status.Offen,
                      parkedForReturnOf: undefined,
                      parkedAt: undefined,
                      notes: [...(t.notes || []), `RÜCKKEHR: ${t.parkedForReturnOf} ist zurück – Aufgabe wieder offen (${stamp}).`],
                  };
              }
              return t;
          });
          if (!changed) return prev;
          next.forEach((t, i) => { if (t !== prev[i]) saveTicketToFirebase(t); });
          return next;
      });
  }, [tickets, users]);

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
      // Safety: skip if a ticket for this schedule was already created today
      // Use todayStr (ISO YYYY-MM-DD) to compare against entryDate stored as DD.MM.YYYY
      const [y, m, d] = todayStr.split('-');
      const todayDE = `${d}.${m}.${y}`;
      const alreadyCreatedToday = routineTickets.some(
        t => t.routineScheduleId === schedule.id && t.entryDate === todayDE
      );
      if (alreadyCreatedToday) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tickets intentionally accessed via closure; adding to deps would re-run on every ticket save
  }, [isInitialized, appSettings.routineSchedules, users, rpHolidayYmdList]);

  // Automatically set tickets to overdue and back
  useEffect(() => {
    if (!isInitialized) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let wasChanged = false;
    const updatedTickets = tickets.map(ticket => {
        if (ticket.status === Status.Abgeschlossen || ticket.status === Status.Zurueckgestellt) {
            return ticket;
        }

        const dueDate = parseGermanDate(ticket.dueDate);
        if (!dueDate) return ticket;

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
      updatedTickets.forEach((t, i) => { if (t !== tickets[i]) saveTicketToFirebase(t); });
    }
  }, [tickets, isInitialized]);

  // Automatically set routine tickets to overdue and back
  useEffect(() => {
    if (!isInitialized) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let wasChanged = false;
    const updatedRoutineTickets = routineTickets.map(ticket => {
        if (ticket.status === Status.Abgeschlossen || ticket.status === Status.Zurueckgestellt) {
            return ticket;
        }

        const dueDate = parseGermanDate(ticket.dueDate);
        if (!dueDate) return ticket;

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
      setRoutineTickets(updatedRoutineTickets);
      updatedRoutineTickets.forEach((t, i) => { if (t !== routineTickets[i]) saveTicketToFirebase(t); });
    }
  }, [routineTickets, isInitialized]);

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

  // Serienauftrag anlegen/bearbeiten bzw. löschen – direkt aus der Serienaufträge-Ansicht.
  const handleSaveRoutineSchedule = (sched: RoutineSchedule) => {
    handleAppSettingsChange((prev) => {
      const list = [...(((prev.routineSchedules as any[]) || []))];
      const idx = list.findIndex((x) => x.id === sched.id);
      if (idx >= 0) list[idx] = sched; else list.push(sched);
      return { ...prev, routineSchedules: list as any };
    });
  };
  const handleDeleteRoutineSchedule = (id: string) => {
    handleAppSettingsChange((prev) => ({
      ...prev,
      routineSchedules: (((prev.routineSchedules as any[]) || []).filter((x) => x.id !== id)) as any,
    }));
  };
  const persistRoutineSettings = (next: AppSettings) => {
    setAppSettings(next);
    void setDoc(doc(db, 'app_data', LOCAL_STORAGE_KEY_SETTINGS), { value: JSON.parse(JSON.stringify(next)), updated_at: new Date().toISOString() });
  };

  /**
   * Info-Mail bei Serienauftrag-Erledigung. Schickt – falls eine `notifyEmail` hinterlegt ist – eine
   * stille Mail, sobald der Auftrag für den Tag VOLLSTÄNDIG abgehakt ist (bei Unter-Aufgaben: alle).
   * Dedupe über `routineNotifySent` (Key `scheduleId|ymd`). Gibt die ggf. erweiterte Liste zurück
   * (oder null = nichts zu tun), damit der Aufrufer sie in DENSELBEN Firestore-Write mitpersistiert.
   * WICHTIG: außerhalb von setAppSettings-Updatern aufrufen (sonst doppelter Mailversand im StrictMode).
   */
  const ROUTINE_NOTIFY_MAX = 800;
  const maybeBuildRoutineDoneNotify = (
    base: AppSettings,
    scheduleId: string,
    ymd: string,
    completions: RoutineDayCompletion[],
    completedBy: string,
  ): string[] | null => {
    const schedule = (base.routineSchedules || []).find((s) => s.id === scheduleId);
    const emails = (schedule?.notifyEmail || '').trim();
    if (!schedule || !emails) return null;
    if (!routineDayStatus(schedule, ymd, completions).complete) return null;
    const key = `${scheduleId}|${ymd}`;
    const sent = base.routineNotifySent || [];
    if (sent.includes(key)) return null;
    const dateDE = ymd.split('-').reverse().join('.');
    const whereLine = [schedule.area, schedule.location].filter(Boolean).join(' · ');
    const subject = `Serienauftrag erledigt: ${schedule.title}`;
    const bodyText =
      `Der Serienauftrag „${schedule.title}" wurde am ${dateDE} vollständig erledigt.\n` +
      (whereLine ? `Bereich: ${whereLine}\n` : '') +
      `Erledigt von: ${completedBy}`;
    const bodyHtml =
      `<p style="margin:0;font-size:15px;line-height:1.55;color:#333;">Der Serienauftrag <strong>${escapeHtml(schedule.title)}</strong> wurde am <strong>${escapeHtml(dateDE)}</strong> vollständig erledigt.</p>` +
      (whereLine ? `<p style="margin:12px 0 0;font-size:14px;color:#444;">Bereich: ${escapeHtml(whereLine)}</p>` : '') +
      `<p style="margin:10px 0 0;font-size:14px;color:#444;">Erledigt von: ${escapeHtml(completedBy)}</p>`;
    emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .forEach((addr) => void sendDrkBrevoMailAsync(addr, subject, { kind: 'custom', subject, bodyHtml, bodyText }, { silent: true }));
    return [...sent, key].slice(-ROUTINE_NOTIFY_MAX);
  };

  /** Entfernt den Dedupe-Marker, damit eine erneute Erledigung am selben Tag wieder benachrichtigt. */
  const clearRoutineNotifyMarker = (base: AppSettings, scheduleId: string, ymd: string): string[] | undefined => {
    const sent = base.routineNotifySent;
    if (!sent || !sent.length) return sent;
    const key = `${scheduleId}|${ymd}`;
    return sent.includes(key) ? sent.filter((k) => k !== key) : sent;
  };

  const handleRoutineDayComplete = (scheduleId: string) => {
    if (!currentUser) return;
    const ymd = localISODate(new Date());
    const rest = (appSettings.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd));
    const completions: RoutineDayCompletion[] = [
      ...rest,
      { scheduleId, date: ymd, completedBy: currentUser.name, completedAt: new Date().toISOString() },
    ];
    const notifySent = maybeBuildRoutineDoneNotify(appSettings, scheduleId, ymd, completions, currentUser.name);
    persistRoutineSettings({
      ...appSettings,
      routineDayCompletions: completions,
      ...(notifySent ? { routineNotifySent: notifySent } : {}),
    });
  };

  const handleRoutineDayUncomplete = (scheduleId: string) => {
    const ymd = localISODate(new Date());
    persistRoutineSettings({
      ...appSettings,
      routineDayCompletions: (appSettings.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd)),
      routineNotifySent: clearRoutineNotifyMarker(appSettings, scheduleId, ymd),
    });
  };

  /** Setzt/entfernt eine Erledigung für einen BELIEBIGEN Tag (Nachtragen/Korrigieren im Serien-Nachweis). */
  const handleSetRoutineCompletion = (scheduleId: string, ymd: string, completedBy: string | null) => {
    setAppSettings(prev => {
      const rest = (prev.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd));
      const next: AppSettings = completedBy
        ? { ...prev, routineDayCompletions: [...rest, { scheduleId, date: ymd, completedBy, completedAt: new Date().toISOString() }] }
        : { ...prev, routineDayCompletions: rest };
      void setDoc(doc(db, 'app_data', LOCAL_STORAGE_KEY_SETTINGS), { value: JSON.parse(JSON.stringify(next)), updated_at: new Date().toISOString() });
      return next;
    });
  };

  /** Hakt eine EINZELNE Unter-Aufgabe für einen Tag ab bzw. wieder zurück (completedBy=null → entfernen). */
  const handleToggleRoutineSubtask = (scheduleId: string, ymd: string, subtaskId: string, completedBy: string | null) => {
    const rest = (appSettings.routineDayCompletions || []).filter((c) => !(c.scheduleId === scheduleId && c.date === ymd && c.subtaskId === subtaskId));
    if (completedBy) {
      const completions: RoutineDayCompletion[] = [...rest, { scheduleId, date: ymd, subtaskId, completedBy, completedAt: new Date().toISOString() }];
      // Info-Mail erst, wenn mit dieser letzten Unter-Aufgabe ALLE erledigt sind.
      const notifySent = maybeBuildRoutineDoneNotify(appSettings, scheduleId, ymd, completions, completedBy);
      persistRoutineSettings({
        ...appSettings,
        routineDayCompletions: completions,
        ...(notifySent ? { routineNotifySent: notifySent } : {}),
      });
    } else {
      persistRoutineSettings({
        ...appSettings,
        routineDayCompletions: rest,
        routineNotifySent: clearRoutineNotifyMarker(appSettings, scheduleId, ymd),
      });
    }
  };
const persistDeletedIds = () => {
  localStorage.setItem(
    LOCAL_STORAGE_KEY_DELETED_IDS,
    JSON.stringify(Array.from(deletedTicketIdsRef.current))
  );
};

const saveTicketToFirebase = (ticket: Ticket) => {
  const coll = ticket.origin === 'routine' ? 'routine_tickets' : 'tickets';
  void setDoc(doc(db, coll, ticket.id), JSON.parse(JSON.stringify(ticket)))
    .then(() => setLastSyncTime(new Date()))
    .catch((err) => console.error('Fehler beim Speichern des Tickets:', err));
};

const saveCompletedTicketToFirebase = (ticket: Ticket) => {
  void setDoc(doc(db, 'completed_tickets', ticket.id), JSON.parse(JSON.stringify(ticket)))
    .then(() => setLastSyncTime(new Date()))
    .catch((err) => console.error('Fehler beim Speichern:', err));
};

const deleteFromActiveFirebase = (ticketId: string) => {
  void deleteDoc(doc(db, 'tickets', ticketId))
    .then(() => setLastSyncTime(new Date()))
    .catch(() => {});
  void deleteDoc(doc(db, 'routine_tickets', ticketId))
    .catch(() => {});
};

const deleteFromCompletedFirebase = (ticketId: string) => {
  void deleteDoc(doc(db, 'completed_tickets', ticketId))
    .catch((err) => console.error('Fehler beim Löschen (abgeschlossen):', err));
};

const deleteTicketFromFirebase = (ticketId: string) => {
  // Layer 1: localStorage — immediate, works offline, persists across restarts
  deletedTicketIdsRef.current.add(ticketId);
  persistDeletedIds();
  // Layer 2: Firestore blocklist — cross-device sync
  void setDoc(doc(db, 'app_data', 'deleted-ticket-ids'), { value: arrayUnion(ticketId) }, { merge: true });
  // Layer 3: delete from all collections (ticket could be in any)
  void deleteDoc(doc(db, 'tickets', ticketId))
    .then(() => setLastSyncTime(new Date()))
    .catch((err) => console.error('Fehler beim Löschen des Tickets:', err));
  void deleteDoc(doc(db, 'completed_tickets', ticketId))
    .catch(() => {}); // silently ignore if not there
  void deleteDoc(doc(db, 'routine_tickets', ticketId))
    .catch(() => {}); // silently ignore if not there
};
  /** Lernt aus einer MANUELLEN Zuweisung: Schlagwörter des Tickets → gewählte Person (+1). */
  const learnFromAssignment = (ticket: Ticket, technicianName: string) => {
    const keywords = extractKeywords(`${ticket.title} ${ticket.description || ''}`);
    if (keywords.length === 0) return;
    setAppSettings(prev => {
      const learned: LearnedRouting = { ...(prev.learnedRouting || {}) };
      keywords.forEach(kw => {
        const entry = { ...(learned[kw] || {}) };
        entry[technicianName] = (entry[technicianName] || 0) + 1;
        learned[kw] = entry;
      });
      const next: AppSettings = { ...prev, learnedRouting: learned };
      void setDoc(doc(db, 'app_data', LOCAL_STORAGE_KEY_SETTINGS), { value: JSON.parse(JSON.stringify(next)), updated_at: new Date().toISOString() });
      return next;
    });
  };

  const commitTicketUpdate = (updatedTicket: Ticket, originalTicket: Ticket) => {
    const ut: Ticket = { ...updatedTicket };
    const statusChanged = originalTicket.status !== ut.status;
    const originalDueDate = originalTicket.dueDate; // Sicherung: wird am Ende geprüft

    // Manuelle Technikerzuweisung löscht Auto-Flag
    if (ut.technician !== originalTicket.technician) {
      ut.autoAssigned = false;
      // SELBST-LERNEN: echte manuelle Zuweisung an eine Person (nicht 'N/A') → Schlagwörter merken
      if (ut.technician && ut.technician !== 'N/A') {
        learnFromAssignment(ut, ut.technician);
      }
    }

    // --- Zuweisung an einen ABWESENDEN → Aufgabe parken („wartet auf Rückkehr") ---
    // Wird eine Aufgabe einem abwesenden Bearbeiter zugewiesen, fliegt sie in „Zurückgestellt"
    // mit Marker parkedForReturnOf. Bei dessen Rückkehr holt der Wächter sie automatisch zurück.
    // Gegenstück: wird ein bereits geparktes Ticket an eine andere/verfügbare Person umgewiesen,
    // wird es reaktiviert (Marker weg, wieder Offen).
    if (ut.technician !== 'N/A' && ut.technician !== originalTicket.technician) {
      const techUser = users.find((u) => u.name === ut.technician);
      const d = new Date();
      const stamp = `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      if (techUser && techUser.availability.status === AvailabilityStatus.OnLeave) {
        ut.status = Status.Zurueckgestellt;
        ut.parkedForReturnOf = techUser.name;
        ut.parkedAt = d.toISOString().slice(0, 10);
        ut.notes = [
          ...(ut.notes || []),
          `GEPARKT: an abwesenden ${techUser.name} zugewiesen – wartet auf Rückkehr (${stamp}).`,
        ];
      } else if (ut.parkedForReturnOf && ut.parkedForReturnOf !== ut.technician) {
        ut.parkedForReturnOf = undefined;
        ut.parkedAt = undefined;
        if (ut.status === Status.Zurueckgestellt) ut.status = Status.Offen;
        ut.notes = [...(ut.notes || []), `REAKTIVIERT: an ${ut.technician} umgewiesen (${stamp}).`];
      }
    }

    if (ut.status === Status.Abgeschlossen && originalTicket.status !== Status.Abgeschlossen) {
      const stamp = completionStampNow();
      ut.completionDate = stamp.completionDate;
      ut.completionTime = stamp.completionTime;
    }

    // Beim Zurückstellen (z. B. direkt über das Status-Dropdown der Karte) ein
    // „Zurückgestellt seit"-Datum setzen, falls der Erinnerungs-Dialog nicht genutzt wurde.
    if (ut.status === Status.Zurueckgestellt && originalTicket.status !== Status.Zurueckgestellt && !ut.parkedAt) {
      ut.parkedAt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
      const w  = ut.wunschTermin?.trim() || '';
      const w0 = originalTicket.wunschTermin?.trim() || '';
      const wunschChanged = w !== w0;
      const catChanged    = ut.categoryId !== originalTicket.categoryId;

      // dueDate NUR anpassen wenn Wunschtermin oder Kategorie sich geändert hat
      if (wunschChanged) {
        ut.dueDate = w
          ? w  // neuer Wunschtermin gesetzt
          : computeReactiveDueDateWithoutWunsch(ut.entryDate, ut.categoryId, appSettings.slaMatrix); // Wunschtermin gelöscht
      } else if (catChanged) {
        ut.dueDate = computeReactiveDueDateWithoutWunsch(ut.entryDate, ut.categoryId, appSettings.slaMatrix);
      }
      // Prio-, Status-, Techniker-Änderungen o.ä. → dueDate bleibt unberührt

      if (catChanged) {
        const slaP = inferStrictestSlaPriorityForCategory(ut.categoryId, appSettings.slaMatrix);
        ut.priority = slaP ?? Priority.Niedrig;
      }
    }

    if (statusChanged && ut.status === Status.Abgeschlossen) {
      ut.is_reopened = false;
    }

    // E-Mails an den Melder bewusst MINIMAL halten – KEIN Versand beim Umverteilen, Statuswechsel
    // (z. B. „In Arbeit") oder Terminänderungen, sonst fluten wir. Nur noch zwei Anlässe hier:
    //  • Ticket abgeschlossen → Abschluss-Info
    //  • Mitarbeiter schreibt eine Notiz an den Melder → genau diese Nachricht
    // (Die Eingangsbestätigung läuft separat bei der Ticket-Erstellung; der interne Chat
    //  verschickt bewusst NIE eine Mail.)
    const reporterMailTo = ut.reporter_email?.trim();
    if (reporterMailTo) {
      if (statusChanged && ut.status === Status.Abgeschlossen) {
        sendDrkBrevoMail(reporterMailTo, `Ihre Meldung wurde abgeschlossen – Ticket ${ut.id}`, {
          kind: 'ticket_closed',
          ticketId: ut.id,
        });
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
        }
      }
    }

    // Interner Chat verschickt bewusst KEINE E-Mails — der Hinweis auf eine neue
    // Nachricht erscheint nur in der App (Chat-Symbol/Badge auf der Karte) und
    // verschwindet automatisch über readBy, sobald die Person das Ticket öffnet.

    // Absoluter Sicherheitsanker: dueDate darf sich NUR ändern wenn der User
    // es selbst geändert hat, oder wunschTermin/Kategorie/Überfällig-Status sich änderte.
    const dueDateManuallyChanged = updatedTicket.dueDate !== originalTicket.dueDate;
    const dueDateRelevantChange =
      dueDateManuallyChanged ||
      (ut.wunschTermin?.trim() || '') !== (originalTicket.wunschTermin?.trim() || '') ||
      ut.categoryId !== originalTicket.categoryId ||
      (originalTicket.status === Status.Ueberfaellig && statusChanged);
    if (!dueDateRelevantChange) {
      ut.dueDate = originalDueDate;
    }

    const wasCompleted = originalTicket.status === Status.Abgeschlossen;
    const isNowCompleted = ut.status === Status.Abgeschlossen;

    if (!wasCompleted && isNowCompleted) {
      // Active → Completed
      if (!ut.closedAt) {
        ut.closedAt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      }
      if (ut.origin === 'routine') {
        setRoutineTickets((prev) => prev.filter((t) => t.id !== ut.id));
      } else {
        setTickets((prev) => prev.filter((t) => t.id !== ut.id));
      }
      setCompletedTickets((prev) => [ut, ...prev]);
      saveCompletedTicketToFirebase(ut);
      deleteFromActiveFirebase(ut.id);
    } else if (wasCompleted && !isNowCompleted) {
      // Reopened: Completed → Active
      setCompletedTickets((prev) => prev.filter((t) => t.id !== ut.id));
      if (ut.origin === 'routine') {
        setRoutineTickets((prev) => [ut, ...prev]);
      } else {
        setTickets((prev) => [ut, ...prev]);
      }
      saveTicketToFirebase(ut);
      deleteFromCompletedFirebase(ut.id);
    } else if (wasCompleted) {
      // Update within completed
      setCompletedTickets((prev) => prev.map((t) => t.id === ut.id ? ut : t));
      saveCompletedTicketToFirebase(ut);
    } else {
      // Update within active
      if (ut.origin === 'routine') {
        setRoutineTickets((prev) => prev.map((t) => t.id === ut.id ? ut : t));
      } else {
        setTickets((prev) => prev.map((t) => t.id === ut.id ? ut : t));
      }
      saveTicketToFirebase(ut);
    }

    if (selectedTicket && selectedTicket.id === ut.id) {
      setSelectedTicket(ut);
    }
  };

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    const originalTicket = tickets.find((t) => t.id === updatedTicket.id)
      ?? routineTickets.find((t) => t.id === updatedTicket.id)
      ?? completedTickets.find((t) => t.id === updatedTicket.id);
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
    const originalTicket = tickets.find((t) => t.id === draft.id)
      ?? routineTickets.find((t) => t.id === draft.id)
      ?? completedTickets.find((t) => t.id === draft.id);
    if (!originalTicket) return;
    commitTicketUpdate(draft, originalTicket);
  };

  const handleCompleteOrderCancel = () => {
    setCompleteOrderDialog(null);
  };

  const handleDeleteTicket = (ticketId: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setRoutineTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setCompletedTickets((prev) => prev.filter((t) => t.id !== ticketId));
    deleteTicketFromFirebase(ticketId);
    if (selectedTicket && selectedTicket.id === ticketId) setSelectedTicket(null);
  };

  /** Nachhol-Bestätigungen (z. B. nach Brevo-Ausfall): gleiche Vorlage wie bei Meldung erfassen. */
  const handleSendTestEmail = useCallback(async (to: string): Promise<boolean> => {
    return sendDrkBrevoMailAsync(
      to,
      '✅ DRK Serviceportal – Test-E-Mail',
      {
        kind: 'custom',
        subject: '✅ DRK Serviceportal – Test-E-Mail',
        bodyHtml: `<p>Diese Test-E-Mail wurde erfolgreich über das DRK Serviceportal versendet.</p>
<p style="color:#666;font-size:0.9em;">Absender: ticket@kv-vorderpfalz.drk.de<br>Zeitpunkt: ${new Date().toLocaleString('de-DE')}</p>`,
        bodyText: `Diese Test-E-Mail wurde erfolgreich über das DRK Serviceportal versendet.\n\nZeitpunkt: ${new Date().toLocaleString('de-DE')}`,
      },
      { silent: true }
    );
  }, []);

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
    const entryTimeStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const isReactive = newTicketData.ticketType === 'reactive';

    // Kategorie automatisch aus Stichwörtern erkennen wenn keine angegeben
    const resolvedCategoryId = newTicketData.categoryId
      ? newTicketData.categoryId
      : inferCategoryFromText(
          `${newTicketData.title || ''} ${newTicketData.description || ''}`,
          appSettings.routingRules,
          '' // kein Fallback auf erste Kategorie — lieber keine Kategorie als falsche Prio
        );

    const category = appSettings.ticketCategories.find(c => c.id === resolvedCategoryId);

    // Priorität: Routing-Regel hat Vorrang, dann Kategorie-Default, dann App-Default
    const fullText = `${newTicketData.title || ''} ${newTicketData.description || ''}`.toLowerCase();
    const matchedRoutingRule = appSettings.routingRules.find(r =>
      r.keyword.split(',').some(kw => kw.trim() && fullText.includes(kw.trim().toLowerCase()))
    );
    const routingPriority = matchedRoutingRule?.priority || null;

    const determinedPriority = isReactive
      ? (routingPriority || category?.default_priority || Priority.Niedrig)
      : (newTicketData.priority || category?.default_priority || appSettings.defaultPriority);

    // 2. Load-Balancing Technician Assignment
    let assignedTechnician = newTicketData.technician || 'N/A';
    let wasAutoAssigned = false;

    // Alle Ticket-Typen (reactive, preventive, routine) nutzen Routing-Regeln wenn kein Techniker vorgegeben
    if (assignedTechnician === 'N/A') {
      assignedTechnician = assignTicket(
        { title: newTicketData.title, description: newTicketData.description },
        users,
        tickets,
        appSettings.routingRules,
        appSettings.learnedRouting
      );
      if (assignedTechnician !== 'N/A') wasAutoAssigned = true;
    }
    let autoCorrectionNote = '';
    let parkForReturnOf: string | undefined;

    // Wenn ein Bearbeiter manuell gewählt wurde: Zuweisung an einen Abwesenden ist erlaubt –
    // die Aufgabe wird dann direkt geparkt („wartet auf Rückkehr") statt offen liegen zu bleiben.
    if (assignedTechnician !== 'N/A') {
        const selectedTech = users.find(u => u.name === assignedTechnician);
        if (selectedTech && selectedTech.availability.status === AvailabilityStatus.OnLeave) {
            parkForReturnOf = selectedTech.name;
            autoCorrectionNote = `GEPARKT: an abwesenden ${selectedTech.name} zugewiesen – wartet auf Rückkehr.`;
        }
    } else {
        // Reaktiv + präventiv: Keyword-Routing für automatische Zuweisung nutzen.
        assignedTechnician = assignTicket(
            { title: newTicketData.title, description: newTicketData.description },
            users,
            tickets,
            appSettings.routingRules,
            appSettings.learnedRouting
        );
        if (assignedTechnician !== 'N/A') wasAutoAssigned = true;
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
      entryTime: entryTimeStr,
      status: parkForReturnOf ? Status.Zurueckgestellt : Status.Offen,
      priority: determinedPriority,
      technician: assignedTechnician,
      categoryId: resolvedCategoryId,
      dueDate: formattedDueDate,
      notes: autoCorrectionNote ? [...(newTicketData.notes || []), autoCorrectionNote] : (newTicketData.notes || []),
      hasNewNoteFromReporter: false,
      is_emergency: false,
      autoAssigned: wasAutoAssigned,
      isNew: true,
      ...(parkForReturnOf ? { parkedForReturnOf: parkForReturnOf, parkedAt: new Date().toISOString().slice(0, 10) } : {}),
    };
    if (reporterEmail) {
      newTicket.reporter_email = reporterEmail;
    } else {
      delete (newTicket as Partial<Ticket>).reporter_email;
    }

    if (newTicket.origin === 'routine') {
      setRoutineTickets((prevRoutine) => [newTicket, ...prevRoutine]);
    } else {
      setTickets((prevTickets) => [newTicket, ...prevTickets]);
    }
    saveTicketToFirebase(newTicket);

    if (reporterEmail) {
      sendDrkBrevoMail(reporterEmail, `Ihre Meldung wurde erfasst – Ticket ${newTicket.id}`, {
        kind: 'ticket_created',
        ticketId: newTicket.id,
      });
    }

    const adminEmail = appSettings.adminNotificationEmail?.trim();
    if (adminEmail) {
      const categoryName = appSettings.ticketCategories.find(c => c.id === newTicket.categoryId)?.name || 'N/A';
      sendDrkBrevoMail(
        adminEmail,
        `Neue Meldung – Ticket ${newTicket.id}: ${newTicket.title}`,
        {
          kind: 'admin_new_ticket',
          ticketId: newTicket.id,
          title: newTicket.title,
          area: newTicket.area,
          location: newTicket.location,
          categoryName,
          priority: String(newTicket.priority),
          reporter: newTicket.reporter,
          description: newTicket.description || '',
          entryDate: newTicket.entryDate,
          entryTime: newTicket.entryTime,
        },
        { silent: true }
      );
    }

    if (!silent) setIsModalOpen(false);

    // Hinweis wenn kein Bearbeiter automatisch zugewiesen werden konnte
    if (!silent && newTicket.technician === 'N/A') {
      addToast({
        type: 'new-ticket',
        title: '⚠ Kein Bearbeiter gefunden',
        message: `Ticket ${newTicket.id}: „${newTicket.title}" – bitte Bearbeiter manuell zuweisen`,
      });
    }

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

    const toComplete: Ticket[] = [];
    const toUpdate: Ticket[] = [];
    const toUpdateRoutine: Ticket[] = [];
    setTickets((prevTickets) =>
      prevTickets.filter((ticket) => {
        if (!selectedTicketIds.includes(ticket.id)) return true;
        const updatedTicket = { ...ticket, [property]: value } as Ticket;
        if (property === 'status' && value === Status.Abgeschlossen) {
          if (!ticket.completionDate) {
            const stamp = completionStampNow();
            updatedTicket.completionDate = stamp.completionDate;
            updatedTicket.completionTime = stamp.completionTime;
          }
          updatedTicket.is_reopened = false;
          toComplete.push(updatedTicket);
          return false; // remove from active
        }
        toUpdate.push(updatedTicket);
        return true; // keep in active (updated below)
      }).map(ticket => {
        const updated = toUpdate.find(t => t.id === ticket.id);
        return updated ?? ticket;
      })
    );
    setRoutineTickets((prevRoutine) =>
      prevRoutine.filter((ticket) => {
        if (!selectedTicketIds.includes(ticket.id)) return true;
        const updatedTicket = { ...ticket, [property]: value } as Ticket;
        if (property === 'status' && value === Status.Abgeschlossen) {
          if (!ticket.completionDate) {
            const stamp = completionStampNow();
            updatedTicket.completionDate = stamp.completionDate;
            updatedTicket.completionTime = stamp.completionTime;
          }
          updatedTicket.is_reopened = false;
          toComplete.push(updatedTicket);
          return false; // remove from routine active
        }
        toUpdateRoutine.push(updatedTicket);
        return true; // keep in routine (updated below)
      }).map(ticket => {
        const updated = toUpdateRoutine.find(t => t.id === ticket.id);
        return updated ?? ticket;
      })
    );
    if (toComplete.length > 0) {
      setCompletedTickets((prev) => [...toComplete, ...prev]);
      toComplete.forEach(t => { saveCompletedTicketToFirebase(t); deleteFromActiveFirebase(t.id); });
    }
    toUpdate.forEach(t => saveTicketToFirebase(t));
    toUpdateRoutine.forEach(t => saveTicketToFirebase(t));
    setSelectedTicketIds([]);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Sind Sie sicher, dass Sie ${selectedTicketIds.length} Tickets endgültig löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) {
      selectedTicketIds.forEach((id) => deleteTicketFromFirebase(id));
      setTickets((prev) => prev.filter((t) => !selectedTicketIds.includes(t.id)));
      setRoutineTickets((prev) => prev.filter((t) => !selectedTicketIds.includes(t.id)));
      setCompletedTickets((prev) => prev.filter((t) => !selectedTicketIds.includes(t.id)));
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
    return [...tickets, ...routineTickets, ...completedTickets].filter((ticket) => {
      if (currentUser?.role && isServiceTeamRole(currentUser.role) && ticket.technician !== currentUser.name) {
        return false;
      }
      if (ticket.origin === 'routine') return false;
      return true;
    });
  }, [tickets, routineTickets, completedTickets, currentUser]);

  /** Zurückgestellte Tickets mit fälliger Erinnerung (parkReminderNextDate <= heute) */
  const dueParkedTickets = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return [...tickets, ...routineTickets].filter(
      t => t.status === Status.Zurueckgestellt && t.parkReminderNextDate && t.parkReminderNextDate <= todayStr
    );
  }, [tickets, routineTickets]);

  // Banner für vergessene Serienaufträge — nur ab Montag 16.06.2026
  const ROUTINE_WARN_START = '2026-06-16';
  const missedRoutinesSinceStart = useMemo(() => {
    const completions = appSettings.routineDayCompletions || [];
    return routineTickets.filter(t => {
      if (t.status !== Status.Ueberfaellig) return false;
      if (!t.dueDate) return false;
      const parts = t.dueDate.split('.');
      if (parts.length !== 3) return false;
      const iso = `${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      if (iso < ROUTINE_WARN_START) return false;
      // Im Serienaufträge-Board abgehakt? Dann NICHT „vergessen". Der Haken im Board
      // schreibt einen routineDayCompletion-Eintrag (App.tsx ~Z.2082), ändert aber den
      // Ticket-Status nicht. Hier den abgehakten Auftrag aus dem Warnblock ausblenden:
      // ein Erledigt-Eintrag für denselben Zeitplan am Fälligkeitstag (oder später,
      // = verspätet abgehakt) zählt als erledigt.
      if (t.routineScheduleId && completions.some(
        c => c.scheduleId === t.routineScheduleId && c.date >= iso
      )) return false;
      return true;
    });
  }, [routineTickets, appSettings.routineDayCompletions]);

  const filteredTickets = useMemo(() => {
    const source = currentView === 'erledigt' ? completedTickets : [...tickets, ...routineTickets];
    return source.filter(ticket => {
        // Role-based pre-filtering: Service-Team should only see tickets assigned to them.
        if (currentUser?.role && isServiceTeamRole(currentUser.role) && ticket.technician !== currentUser.name) {
            return false;
        }

        const searchLower = filters.search.toLowerCase();
        if (filters.search && !ticket.title.toLowerCase().includes(searchLower) && !ticket.id.toLowerCase().includes(searchLower) && !ticket.area.toLowerCase().includes(searchLower) && !ticket.reporter.toLowerCase().includes(searchLower)) return false;

        if (filters.area !== 'Alle' && ticket.area !== filters.area) return false;

        if (
          filters.technician !== 'Alle' &&
          normalizePersonName(ticket.technician) !== normalizePersonName(filters.technician)
        ) {
          return false;
        }

        if (filters.priority !== 'Alle' && ticket.priority !== filters.priority) return false;
        if (filters.reporter && filters.reporter !== 'Alle' && ticket.reporter !== filters.reporter) return false;

        if (currentView === 'erledigt') {
          if (filters.status !== 'Alle' && ticket.status !== filters.status) return false;
        }

        if (currentView !== 'erledigt') {
          // Serienaufträge nicht im Kanban (nur in Listenansicht anzeigen)
          if ((currentView === 'dashboard' || currentView === 'tech-dashboard') && ticket.origin === 'routine') {
              return false;
          }

          // Zurückgestellte Tickets nicht in regulären Ansichten anzeigen
          if (currentView !== 'zurueckgestellt' && ticket.status === Status.Zurueckgestellt) return false;

          if ((currentView === 'tickets' || currentView === 'dashboard' || currentView === 'tech-dashboard') && filters.status !== 'Alle' && ticket.status !== filters.status) return false;
        }

        return true;
    });
  }, [tickets, routineTickets, completedTickets, filters, currentView, currentUser]);

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
    const allActive = [...tickets, ...routineTickets];
    if (!currentUser) return allActive;
    if (isServiceTeamRole(currentUser.role)) {
      return allActive.filter((t) => t.technician === currentUser.name);
    }
    return allActive;
  }, [tickets, routineTickets, currentUser]);

  const newMeldungenCount = useMemo(() => {
    return tickets.filter(t =>
      (t.status === Status.Offen && (t.technician === 'N/A' || !t.technician)) || t.is_reopened
    ).length;
  }, [tickets]);

  // Speist die Benachrichtigungs-Glocke (MessageInbox): Tickets mit neuer Melder-Nachricht bzw.
  // neuem internen Chat (ungelesen für die angemeldete Person). Admin sieht ALLE aktiven Tickets;
  // Techniker/Hauswirtschaft sehen NUR ihre eigenen (an sie zugewiesenen) Tickets.
  const messageActivityTickets = useMemo(() => {
    const me = currentUser?.name ?? null;
    const isAdmin = currentUser?.role === Role.Admin;
    const active = [...tickets, ...routineTickets].filter(t =>
      t.status !== Status.Abgeschlossen && t.origin !== 'routine' &&
      (isAdmin || t.technician === me)
    );
    const map = new Map<string, { ticket: Ticket; reporter: boolean; chat: boolean }>();
    active.forEach(t => {
      const reporter = hasUnreadReporterNote(t, currentUser?.name ?? null);
      const chat = getStaffChatState(t, currentUser?.name ?? null) === 'unread';
      if (reporter || chat) map.set(t.id, { ticket: t, reporter, chat });
    });
    return Array.from(map.values());
  }, [tickets, routineTickets, currentUser]);
  // messageActivityTickets speist die Benachrichtigungs-Glocke (MessageInbox) oben in der
  // Filterleiste: eine anklickbare Liste aller Tickets mit neuer Aktivität (Chat/Melder),
  // inkl. zurückgestellter (mit „zurückgestellt"-Etikett). Klick öffnet das Ticket direkt.
  // Das frühere Chat-Signal am Sidebar-Menüpunkt „Zurückgestellt" entfällt damit bewusst –
  // der Menüpunkt zeigt nur noch die reine Anzahl zurückgestellter Tickets.

  const techOffeneCount = useMemo(() => {
    if (!currentUser || !isServiceTeamRole(currentUser.role)) return 0;
    return ticketsForUser.filter(t => t.status === Status.Offen && t.origin !== 'routine').length;
  }, [ticketsForUser, currentUser]);

  // Suche in abgeschlossenen Tickets (Hinweis-Banner)
  const completedSearchCount = useMemo(() => {
    if (!filters.search || currentView === 'erledigt') return 0;
    const s = filters.search.toLowerCase();
    return completedTickets.filter(t =>
      t.title?.toLowerCase().includes(s) ||
      t.id?.toLowerCase().includes(s) ||
      t.reporter?.toLowerCase().includes(s) ||
      t.area?.toLowerCase().includes(s)
    ).length;
  }, [filters.search, completedTickets, currentView]);

  const listStatusCounts = useMemo(() => {
    const main = filteredTickets.filter(t => t.origin !== 'routine');
    return {
      offen: main.filter(t => t.status === Status.Offen).length,
      inArbeit: main.filter(t => t.status === Status.InArbeit).length,
      ueberfaellig: main.filter(t => t.status === Status.Ueberfaellig).length,
    };
  }, [filteredTickets]);

  useEffect(() => {
    document.title = newMeldungenCount > 0
      ? `(${newMeldungenCount})`
      : 'DRK Serviceportal';
  }, [newMeldungenCount]);

  // Browser-Benachrichtigungs-Berechtigung beim Login anfordern
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [currentUser?.id]);

  // In-App-Toasts + Browser-Benachrichtigungen: neue Tickets (Admin) + neue Zuweisung (Techniker)
  const prevTicketsRef = useRef<Ticket[] | null>(null);
  useEffect(() => {
    if (!currentUser) { prevTicketsRef.current = null; return; }
    if (prevTicketsRef.current === null) { prevTicketsRef.current = tickets; return; }
    const prev = prevTicketsRef.current;
    prevTicketsRef.current = tickets;
    const prevIds = new Set(prev.map(t => t.id));
    if (currentUser.role === Role.Admin) {
      tickets
        .filter(t => !prevIds.has(t.id) && t.status !== Status.Abgeschlossen)
        .forEach(t => {
          const assignee = t.technician && t.technician !== 'N/A' ? ` · Zugewiesen: ${displayNameShort(t.technician)}` : ' · Noch nicht zugewiesen';
          const msg = `${t.id}: ${t.title} · ${t.area}${assignee}`;
          addToast({ type: 'new-ticket', title: '🔔 Neue Meldung eingegangen', message: msg });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Neue Meldung', { body: msg, icon: '/favicon.ico' });
          }
        });
    }
    if (isServiceTeamRole(currentUser.role)) {
      tickets.forEach(t => {
        const p = prev.find(x => x.id === t.id);
        if (p && p.technician !== currentUser.name && t.technician === currentUser.name) {
          addToast({ type: 'assigned', title: 'Ticket zugewiesen', message: `Ticket ${t.id}: ${t.title}` });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Ticket zugewiesen', { body: `Ticket ${t.id}: ${t.title}`, icon: '/favicon.ico' });
          }
        }
      });
    }
    // Neue interne Staff-Nachricht erkennen
    const allActive = [...tickets, ...routineTickets];
    const allPrev = prev;
    allActive.forEach(t => {
      const p = allPrev.find(x => x.id === t.id);
      if (!p) return;
      const prevCount = (p.staffMessages || []).length;
      const newCount = (t.staffMessages || []).length;
      if (newCount <= prevCount) return;
      const lastMsg = t.staffMessages![newCount - 1];
      if (lastMsg.author === currentUser.name) return; // eigene Nachricht
      const msg = `Ticket ${t.id}: ${t.title} – von ${displayNameShort(lastMsg.author)}`;
      addToast({ type: 'assigned', title: '💬 Neue interne Nachricht', message: msg });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('💬 Neue interne Nachricht', { body: msg, icon: '/favicon.ico' });
      }
    });
  }, [tickets, routineTickets, currentUser]);

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
  
  const reporterOptions = useMemo(() => {
    const all = [...tickets, ...routineTickets, ...completedTickets];
    const names = Array.from(new Set(all.map(t => t.reporter).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
    return ['Alle', ...names];
  }, [tickets, routineTickets, completedTickets]);

  const locationOptionsWithCounts = useMemo(() => {
    const ticketsForCounts = currentView === 'erledigt' ? completedTickets : [...tickets, ...routineTickets];
    const counts = ticketsForCounts.reduce((acc, ticket) => {
        acc[ticket.area] = (acc[ticket.area] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const result = activeLocations.map(loc => ({ name: loc.name, count: counts[loc.name] || 0 }));
    return [{ name: 'Alle', count: ticketsForCounts.length }, ...result];
  }, [tickets, routineTickets, completedTickets, activeLocations, currentView]);

  const changeView = (view: string) => {
    if (['dashboard', 'reports', 'techniker', 'settings'].includes(view) && currentUser?.role !== Role.Admin) {
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
          // Zentrale Regel: NIE Abgeschlossen/Zurückgestellt automatisch umverteilen
          const userTickets = tickets.filter(t => t.technician === user.name && canRedistribute(t));
          
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
              const originalTickets = tickets;
              setTickets(ticketsToUpdate);
              ticketsToUpdate.forEach((t, i) => { if (t !== originalTickets[i]) saveTicketToFirebase(t); });
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

      const originalTickets = [...tickets];
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
              // Zentrale Regel: NIE Abgeschlossen/Zurückgestellt automatisch umverteilen
              if (t.technician !== absentUser.name || !canRedistribute(t)) return false;
              
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
          ticketsToUpdate.forEach((t, i) => { if (t !== originalTickets[i]) saveTicketToFirebase(t); });
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

  // Dezenter Auto-Hide-Scrollbalken im Hauptbereich: `is-scrolling` nur während
  // des Scrollens setzen, ~0,9 s danach wieder entfernen (CSS faded den Thumb).
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    let hideTimer: number | undefined;
    const onScroll = () => {
      main.classList.add('is-scrolling');
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => main.classList.remove('is-scrolling'), 900);
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      main.removeEventListener('scroll', onScroll);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [currentUser, currentView]);

  const portalElement = (
    <Portal
      appSettings={appSettings}
      onLogin={handleLogin}
      tickets={[...tickets, ...routineTickets, ...completedTickets]}
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
              currentUser={currentUser}
            />
          );
        case 'tickets': return <TicketTableView tickets={filteredTickets} onUpdateTicket={handleTicketUpdate} onSelectTicket={setSelectedTicket} selectedTicketIds={selectedTicketIds} setSelectedTicketIds={setSelectedTicketIds} selectedTicket={selectedTicket} groupBy={groupBy} showRoutineSection={false} currentUser={currentUser} />;
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
            onSaveSchedule={handleSaveRoutineSchedule}
            onDeleteSchedule={handleDeleteRoutineSchedule}
            onToggleSubtask={handleToggleRoutineSubtask}
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
              missedSinceYmd={ROUTINE_WARN_START}
              onSetCompletion={handleSetRoutineCompletion}
              onToggleSubtask={handleToggleRoutineSubtask}
            />
          );
        case 'erledigt': return <ErledigtTableView
          tickets={filteredTickets}
          onSelectTicket={setSelectedTicket}
          selectedTicket={selectedTicket}
          onDeleteTicket={handleDeleteTicket}
          userRole={currentUser?.role}
          selectedMonth={completedMonth}
          selectedYear={completedYear}
          onMonthChange={setCompletedMonth}
          onYearChange={setCompletedYear}
          onReload={loadCompletedTicketsForMonth}
          isLoading={isLoadingCompleted}
        />;
        case 'reports': {
          return <ReportsView activeTickets={tickets} completedTickets={completedTickets} completedMonth={completedMonth} completedYear={completedYear} onLoadMonth={(m, y) => { setCompletedMonth(m); setCompletedYear(y); void loadCompletedTicketsForMonth(m, y); }} users={users} appSettings={appSettings} />;
        }
        case 'techniker': return <TechnicianView tickets={listenBenchTickets} technicians={users.filter(u => (u.role === Role.Technician || u.role === Role.Housekeeping) && u.isActive)} onTechnicianSelect={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} onFilter={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} />;
        case 'settings': return <SettingsView users={users} setUsers={setUsers} locations={locations} setLocations={setLocations} assets={assets} setAssets={setAssets} maintenancePlans={maintenancePlans} setMaintenancePlans={setMaintenancePlans} appSettings={appSettings} setAppSettings={handleAppSettingsChange} onResendConfirmationMailsForEntryDate={handleResendConfirmationMailsForEntryDate} onSendTestEmail={handleSendTestEmail} />;
        case 'zurueckgestellt': return (
          <ZurückgestelltView
            tickets={[...tickets, ...routineTickets]}
            onUpdateTicket={handleTicketUpdate}
            onSelectTicket={setSelectedTicket}
            selectedTicket={selectedTicket}
            userRole={currentUser.role}
            currentUserName={currentUser.name}
          />
        );
        default: return (
          <KanbanBoard
            tickets={filteredTickets}
            technicians={activeTechnicians}
            onUpdateTicket={handleTicketUpdate}
            onSelectTicket={setSelectedTicket}
            selectedTicket={selectedTicket}
            currentUser={currentUser}
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
        userColor={currentUser.color ?? null}
        tickets={ticketsForUser}
        onNewTicketClick={() => setIsModalOpen(true)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        brevoMailOk={currentUser.role === Role.Admin ? brevoMailOk : null}
        brevoMailLastChecked={currentUser.role === Role.Admin ? brevoMailLastChecked : null}
        missedRoutinesCount={missedRoutinesSinceStart.length}
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
              Bestätigung verschicken. Bitte API-Key in Brevo prüfen und{' '}
              <code style={{ fontSize: '0.9em' }}>functions/.env → BREVO_API_KEY</code> aktualisieren, dann neu deployen.
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
        {/* Zurückgestellt Reminder Banner */}
        {dueParkedTickets.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              marginBottom: 4,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255, 140, 0, 0.35)',
              background: 'rgba(255, 140, 0, 0.1)',
              color: '#854F0B',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
            onClick={() => {
              // Update nextReminderDate for all due parked tickets
              const todayStr = new Date().toISOString().split('T')[0];
              dueParkedTickets.forEach(t => {
                if (!t.parkReminderInterval) return;
                const next = new Date();
                next.setDate(next.getDate() + t.parkReminderInterval * 7);
                const nextStr = next.toISOString().split('T')[0];
                if (nextStr !== todayStr) {
                  saveTicketToFirebase({ ...t, parkReminderNextDate: nextStr });
                }
              });
              changeView('zurueckgestellt');
            }}
          >
            <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,140,0,0.9)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-parking" style={{ fontSize: 18 }} aria-hidden="true" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {dueParkedTickets.length === 1
                ? '1 zurückgestellter Auftrag wartet auf Überprüfung'
                : `${dueParkedTickets.length} zurückgestellte Aufträge warten auf Überprüfung`}
            </span>
            <span style={{ flexShrink: 0, opacity: 0.8 }}>
              <i className="ti ti-chevron-right" style={{ fontSize: 20 }} aria-hidden="true" />
            </span>
          </div>
        )}
        {/* Nachrichten-Badge: wird in der FilterBar rechts angezeigt (messageActivityCount-Prop) */}
        {/* Vergessene Serienaufträge – prominenter Warnblock (bleibt stehen bis erledigt) */}
        {missedRoutinesSinceStart.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              marginBottom: 8,
              maxWidth: 2400,
              width: '100%',
              marginLeft: 'auto',
              marginRight: 'auto',
              boxSizing: 'border-box',
              borderRadius: 12,
              border: '1.5px solid rgba(220, 38, 38, 0.45)',
              background: 'rgba(220, 38, 38, 0.06)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(220,38,38,0.10)',
            }}
          >
            <style>{`
              .missed-routine-row { transition: background 0.12s ease; }
              .missed-routine-row:hover { background: rgba(220,38,38,0.09); }
            `}</style>
            {/* Kopfzeile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(220,38,38,0.10)', borderBottom: '1px solid rgba(220,38,38,0.18)' }}>
              <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 9, background: 'rgba(220,38,38,0.95)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 21 }} aria-hidden="true" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#9B1C1C', letterSpacing: '0.01em' }}>
                  {missedRoutinesSinceStart.length === 1
                    ? '1 Serienauftrag wurde vergessen'
                    : `${missedRoutinesSinceStart.length} Serienaufträge wurden vergessen`}
                </div>
                <div style={{ fontWeight: 500, fontSize: 12.5, color: '#7A2020' }}>
                  Nicht rechtzeitig erledigt – bitte nachholen oder prüfen.
                </div>
              </div>
              <button
                type="button"
                onClick={() => changeView('routines')}
                style={{ flexShrink: 0, background: 'rgba(220,38,38,0.95)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 13px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Alle ansehen <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
            {/* Liste der vergessenen Aufträge */}
            <div>
              {missedRoutinesSinceStart.slice(0, 6).map((t, i) => (
                <div
                  key={t.id}
                  className="missed-routine-row"
                  onClick={() => setSelectedTicket(t)}
                  title="Öffnen"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderTop: i === 0 ? 'none' : '1px solid rgba(220,38,38,0.10)' }}
                >
                  <i className="ti ti-repeat" style={{ fontSize: 16, color: '#B91C1C', flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                    {t.title}
                  </span>
                  {t.area ? <span style={{ fontSize: 12.5, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{t.area}</span> : null}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    <i className="ti ti-calendar" style={{ fontSize: 14 }} aria-hidden="true" />
                    fällig war {t.dueDate}
                  </span>
                  {t.technician && t.technician !== 'N/A' ? (
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>· {displayNameShort(t.technician)}</span>
                  ) : null}
                  <i className="ti ti-chevron-right" style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
                </div>
              ))}
              {missedRoutinesSinceStart.length > 6 && (
                <div
                  className="missed-routine-row"
                  onClick={() => changeView('routines')}
                  style={{ padding: '10px 16px', borderTop: '1px solid rgba(220,38,38,0.10)', fontSize: 13, fontWeight: 700, color: '#9B1C1C', cursor: 'pointer' }}
                >
                  und {missedRoutinesSinceStart.length - 6} weitere … alle ansehen
                </div>
              )}
            </div>
          </div>
        )}
        {(currentView === 'dashboard' || currentView === 'tech-dashboard') && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, marginBottom: 12, maxWidth: 2400, width: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box' }}>
            {/* Linke Alert-Karte */}
            {currentView === 'dashboard' && newMeldungenCount > 0 && (
              <div
                role="alert"
                style={{
                  flex: '1 1 0%',
                  minWidth: 0,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(220, 53, 69, 0.35)',
                  background: 'rgba(220, 53, 69, 0.08)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: 'var(--accent-danger)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-alert-circle" style={{ fontSize: 20 }} />
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  {newMeldungenCount === 1
                    ? '1 neue Meldung wartet auf Bearbeiter-Zuweisung'
                    : `${newMeldungenCount} neue Meldungen warten auf Bearbeiter-Zuweisung`}
                </span>
                <span style={{ flexShrink: 0, opacity: 0.85 }}>
                  <i className="ti ti-chevron-right" style={{ fontSize: 22 }} />
                </span>
              </div>
            )}
            {currentView === 'tech-dashboard' && techOffeneCount > 0 && (
              <div
                role="alert"
                style={{
                  flex: '1 1 0%',
                  minWidth: 0,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(234, 179, 8, 0.5)',
                  background: 'rgba(234, 179, 8, 0.1)',
                  color: '#854F0B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: '#d97706', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-alert-circle" style={{ fontSize: 20 }} />
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  {techOffeneCount === 1
                    ? 'Dir wurde 1 Ticket zugewiesen — bitte auf „In Arbeit" setzen'
                    : `Dir wurden ${techOffeneCount} Tickets zugewiesen — bitte auf „In Arbeit" setzen`}
                </span>
                <span style={{ flexShrink: 0, opacity: 0.85 }}>
                  <i className="ti ti-chevron-right" style={{ fontSize: 22 }} />
                </span>
              </div>
            )}
            {/* Rechte Karte: Serientermine */}
            <DashboardRoutineLinkBar
              schedules={appSettings.routineSchedules as any}
              users={users}
              userRole={currentUser.role}
              userName={currentUser.name}
              completions={appSettings.routineDayCompletions || []}
              rpHolidayYmdList={rpHolidayYmdList}
              onOpenRoutines={() => changeView('routines')}
              inline
            />
          </div>
        )}
        {isKanbanWorkbench ? (
          <div className="kanban-workbench">
            <style>{`
              .kanban-workbench {
                max-width: 2400px;
                width: 100%;
                margin: 1.25rem auto 0;
                box-sizing: border-box;
                background: transparent;
              }
            `}</style>
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              locations={locationOptionsWithCounts}
              technicians={['Alle', ...activeTechnicians.map((t) => t.name)]}
              statuses={STATUSES}
              reporters={reporterOptions}
              userRole={currentUser.role}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              currentView={currentView}
              statusCounts={listStatusCounts}
              messageActivity={messageActivityTickets} onOpenTicket={setSelectedTicket}
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
                <>
                  <FilterBar filters={filters} setFilters={setFilters} locations={locationOptionsWithCounts} technicians={['Alle', ...activeTechnicians.map((t) => t.name)]} statuses={STATUSES} reporters={reporterOptions} userRole={currentUser.role} groupBy={groupBy} setGroupBy={setGroupBy} currentView={currentView} statusCounts={listStatusCounts} messageActivity={messageActivityTickets} onOpenTicket={setSelectedTicket} />
                  {completedSearchCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: '#e6f1fb', border: '1px solid #b5d4f4', borderRadius: 8, fontSize: '0.875rem', color: '#185fa5' }}>
                      <i className="ti ti-search" />
                      <span><strong>{completedSearchCount}</strong> abgeschlossene Ticket{completedSearchCount !== 1 ? 's' : ''} gefunden</span>
                      <button
                        onClick={() => setCurrentView('erledigt')}
                        style={{ marginLeft: 'auto', background: '#185fa5', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        In Abgeschlossen anzeigen →
                      </button>
                    </div>
                  )}
                </>
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
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
export default App;
