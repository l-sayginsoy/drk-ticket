
import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Ticket, Status, Priority, Role, GroupableKey, User, Location, AppSettings, Asset, MaintenancePlan, AvailabilityStatus, RoutingRule 
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
  | { kind: 'ticket_closed'; ticketId: string };

const drkBrevoBannerTitle = (p: DrkBrevoMailPayload) => {
  switch (p.kind) {
    case 'ticket_created':
      return 'Meldung erfasst';
    case 'staff_note':
      return 'Neuigkeit zu Ihrer Meldung';
    case 'ticket_closed':
      return 'Meldung abgeschlossen';
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

/** Brevo: dasselbe HTML wie in `public/email-vorschau.html` — direkt per REST (ohne Cloud Function). */
const sendDrkBrevoMail = (to: string, subject: string, payload: DrkBrevoMailPayload) => {
  void (async () => {
    const apiKey = (import.meta.env.VITE_BREVO_API_KEY as string | undefined)?.trim();
    if (!apiKey) {
      console.warn('VITE_BREVO_API_KEY fehlt im Build — keine E-Mails.');
      return;
    }
    const textContent = buildDrkBrevoPlainText(payload);
    const htmlContent = buildDrkBrevoHtml(payload);
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          sender: { email: 'noreply@drk-ticket.de' },
          to: [{ email: to }],
          subject,
          textContent,
          htmlContent,
        }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        console.error('Brevo:', res.status, bodyText.slice(0, 500));
      }
    } catch (err) {
      console.error('Brevo senden fehlgeschlagen:', err);
    }
  })();
};

const parseGermanDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
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
            u.role === Role.Technician && 
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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => safeJSONParse('currentUser', null));

  // --- Main Data State ---
  const [tickets, setTickets] = useState<Ticket[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_TICKETS, MOCK_TICKETS));
  const [users, setUsers] = useState<User[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_USERS, MOCK_USERS));
  const [locations, setLocations] = useState<Location[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_LOCATIONS, MOCK_LOCATIONS));
  const [assets, setAssets] = useState<Asset[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_ASSETS, MOCK_ASSETS));
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>(() => safeJSONParse(LOCAL_STORAGE_KEY_PLANS, MOCK_MAINTENANCE_PLANS));
  const [appSettings, setAppSettings] = useState<AppSettings>(() => ({ ...DEFAULT_APP_SETTINGS, ...safeJSONParse(LOCAL_STORAGE_KEY_SETTINGS, {}) }));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isRemoteUpdate = useRef(false);
  const prevUsersRef = useRef<User[]>(users);

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
              case LOCAL_STORAGE_KEY_TICKETS: setTickets(value); break;
              case LOCAL_STORAGE_KEY_USERS: setUsers(value); break;
              case LOCAL_STORAGE_KEY_LOCATIONS: setLocations(value); break;
              case LOCAL_STORAGE_KEY_ASSETS: setAssets(value); break;
              case LOCAL_STORAGE_KEY_PLANS: setMaintenancePlans(value); break;
              case LOCAL_STORAGE_KEY_SETTINGS: setAppSettings(value); break;
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
            case LOCAL_STORAGE_KEY_TICKETS: setTickets(value); break;
            case LOCAL_STORAGE_KEY_USERS: setUsers(value); break;
            case LOCAL_STORAGE_KEY_LOCATIONS: setLocations(value); break;
            case LOCAL_STORAGE_KEY_ASSETS: setAssets(value); break;
            case LOCAL_STORAGE_KEY_PLANS: setMaintenancePlans(value); break;
            case LOCAL_STORAGE_KEY_SETTINGS: setAppSettings(value); break;
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
    syncToFirebase(LOCAL_STORAGE_KEY_TICKETS, tickets);
  }, [tickets]);
  
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
    syncToFirebase(LOCAL_STORAGE_KEY_ASSETS, assets);
  }, [assets]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(maintenancePlans));
    syncToFirebase(LOCAL_STORAGE_KEY_PLANS, maintenancePlans);
  }, [maintenancePlans]);
  
  useEffect(() => { 
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(appSettings));
    syncToFirebase(LOCAL_STORAGE_KEY_SETTINGS, appSettings);
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
                  u.role === Role.Technician && 
                  u.isActive && 
                  u.availability && 
                  (u.availability.status === AvailabilityStatus.Available)
              );

              if (availableTechnicians.length === 0) {
                  console.warn("No available technicians for redistribution.");
                  alert("Warnung: Ein Techniker ist jetzt abwesend, aber es gibt keine verfügbaren Kollegen für die Umverteilung!");
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
          const isAvailable = user.role === Role.Technician && user.isActive && user.availability.status === AvailabilityStatus.Available;
          
          if (!prevUser) return isAvailable; // New available technician

          const wasAvailable = prevUser.role === Role.Technician && prevUser.isActive && prevUser.availability.status === AvailabilityStatus.Available;
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
              const activeTechs = users.filter(u => u.role === Role.Technician && u.isActive && u.availability.status === AvailabilityStatus.Available);
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
                  alert(`Willkommen zurück! ${returningTechnicians.map(u => u.name).join(', ')} ist wieder verfügbar. ${reassignedCount} offene Tickets wurden zur Lastverteilung automatisch zugewiesen.`);
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
    }
  }, [tickets]); // Reruns whenever tickets change

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    const originalTicket = tickets.find(t => t.id === updatedTicket.id);
    if (!originalTicket) return;

    const statusChanged = originalTicket.status !== updatedTicket.status;

    // --- NEW: Prevent assignment to absent technicians ---
    if (updatedTicket.technician !== 'N/A' && (updatedTicket.technician !== originalTicket.technician || originalTicket.technician === 'N/A')) {
        const techUser = users.find(u => u.name === updatedTicket.technician);
        if (techUser && techUser.availability.status === AvailabilityStatus.OnLeave) {
            
            // Attempt to find a substitute
            let newTech = assignTicket({ title: updatedTicket.title, description: updatedTicket.description }, users, tickets, appSettings.routingRules);
            
            // If standard routing returns N/A or the SAME absent person (unlikely if users list is correct), try fallback
            if (newTech === 'N/A' || newTech === techUser.name) {
                // Fallback: Find any available technician with lowest load
                const availableTechs = users.filter(u => 
                    u.role === Role.Technician && 
                    u.isActive && 
                    u.availability.status === AvailabilityStatus.Available
                );

                if (availableTechs.length > 0) {
                    const techsWithLoad = availableTechs.map(tech => ({
                        ...tech,
                        load: tickets.filter(t => t.technician === tech.name && t.status !== Status.Abgeschlossen).length
                    }));
                    techsWithLoad.sort((a, b) => a.load - b.load);
                    newTech = techsWithLoad[0].name;
                } else {
                    newTech = 'N/A';
                }
            }

            if (newTech !== 'N/A' && newTech !== techUser.name) {
                alert(`Hinweis: ${techUser.name} ist derzeit abwesend. Das Ticket wurde automatisch an ${newTech} umgeleitet.`);
                updatedTicket.technician = newTech;
                updatedTicket.notes = [
                    ...(updatedTicket.notes || []), 
                    `AUTO-KORREKTUR: Ursprünglich zugewiesen an abwesenden Techniker ${techUser.name}. Automatisch zugewiesen an ${newTech}.`
                ];
            } else {
                alert(`Warnung: ${techUser.name} ist abwesend, aber es konnte kein verfügbarer Ersatz gefunden werden.`);
                // We leave it as is, or set to N/A? User said "should not be allowed".
                // But if no one else is there, maybe N/A is better.
                updatedTicket.technician = 'N/A';
            }
        }
    }

    // If ticket is being completed, set completion date
    if (updatedTicket.status === Status.Abgeschlossen && originalTicket.status !== Status.Abgeschlossen) {
        updatedTicket.completionDate = new Date().toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Auto-update due date when moving out of 'Overdue' status
    if (originalTicket.status === Status.Ueberfaellig) {
        if (updatedTicket.status === Status.Offen) {
            updatedTicket.dueDate = getFutureDateStringForUpdate(3);
        } else if (updatedTicket.status === Status.InArbeit) {
            updatedTicket.dueDate = getFutureDateStringForUpdate(2);
        }
    }

    if (statusChanged && updatedTicket.status === Status.Abgeschlossen) {
        updatedTicket.is_reopened = false;
    }

    if (updatedTicket.reporter_email) {
      if (statusChanged && updatedTicket.status === Status.Abgeschlossen) {
        sendDrkBrevoMail(updatedTicket.reporter_email, `Ihre Meldung wurde abgeschlossen – Ticket ${updatedTicket.id}`, {
          kind: 'ticket_closed',
          ticketId: updatedTicket.id,
        });
      } else if ((updatedTicket.notes?.length || 0) > (originalTicket.notes?.length || 0)) {
        const latestNote = updatedTicket.notes![updatedTicket.notes!.length - 1];
        const isNoteFromReporter = latestNote.includes('(Melder am ') || latestNote.includes('Ticket durch Melder wiedereröffnet');
        if (!isNoteFromReporter) {
          sendDrkBrevoMail(updatedTicket.reporter_email, `Neuigkeit zu Ihrem Ticket ${updatedTicket.id}`, {
            kind: 'staff_note',
            ticketId: updatedTicket.id,
            noteText: latestNote,
          });
        }
      }
    }

    setTickets(prev => prev.map(t => (t.id === updatedTicket.id ? updatedTicket : t)));
    
    if (selectedTicket && selectedTicket.id === updatedTicket.id) {
        setSelectedTicket(updatedTicket);
    }
  };

  const handleDeleteTicket = (ticketId: string) => {
      if (window.confirm('Sind Sie sicher, dass Sie dieses Ticket endgültig löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.')) {
          setTickets(prev => prev.filter(ticket => ticket.id !== ticketId));
          if (selectedTicket && selectedTicket.id === ticketId) {
              setSelectedTicket(null);
          }
      }
  };

  const handleAddNewTicket = (newTicketData: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority }, silent = false): string => {
    // --- INTELLIGENT AUTOMATION LOGIC ---

    // 1. Smart Priority: Determine priority based on category
    const category = appSettings.ticketCategories.find(c => c.id === newTicketData.categoryId);
    const determinedPriority = newTicketData.priority || category?.default_priority || appSettings.defaultPriority;

    // 2. Load-Balancing Technician Assignment
    let assignedTechnician = newTicketData.technician || 'N/A';
    let autoCorrectionNote = '';

    // Wenn ein Techniker manuell gewählt wurde, prüfen ob er abwesend ist
    if (assignedTechnician !== 'N/A') {
        const selectedTech = users.find(u => u.name === assignedTechnician);
        if (selectedTech && selectedTech.availability.status === AvailabilityStatus.OnLeave) {
            // Wenn abwesend, automatisch neu zuweisen
            const autoTech = assignTicket({ title: newTicketData.title, description: newTicketData.description }, users, tickets, appSettings.routingRules);
            if (autoTech !== 'N/A' && autoTech !== selectedTech.name) {
                autoCorrectionNote = `HINWEIS: Gewählter Techniker ${selectedTech.name} ist abwesend. Automatisch zugewiesen an ${autoTech}.`;
                assignedTechnician = autoTech;
                alert(autoCorrectionNote);
            } else {
                assignedTechnician = 'N/A';
                alert(`Warnung: ${selectedTech.name} ist abwesend. Ticket wurde auf 'Nicht zugewiesen' gesetzt.`);
            }
        }
    } else {
        // Keine manuelle Zuweisung, nutze Auto-Routing
        assignedTechnician = assignTicket({ title: newTicketData.title, description: newTicketData.description }, users, tickets, appSettings.routingRules);
    }

    // 3. SLA-based Due Date Calculation
    const slaRule = appSettings.slaMatrix.find(r => r.categoryId === newTicketData.categoryId && r.priority === determinedPriority);
    const dueDate = new Date();
    if (slaRule) {
        dueDate.setHours(dueDate.getHours() + slaRule.responseTimeHours);
    } else {
        dueDate.setDate(dueDate.getDate() + (appSettings.dueDateRules[determinedPriority] || 7));
    }
    const formattedDueDate = dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const sanitizedTicketData = Object.fromEntries(
      Object.entries(newTicketData).filter(([_, v]) => v !== undefined)
    );

    const newTicket: Ticket = {
      ...(sanitizedTicketData as Omit<Ticket, 'id' | 'entryDate' | 'status'>),
      id: `${Math.floor(Math.random() * 10000) + 30000}`,
      entryDate: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      status: Status.Offen,
      priority: determinedPriority,
      technician: assignedTechnician,
      dueDate: formattedDueDate,
      notes: autoCorrectionNote ? [...(newTicketData.notes || []), autoCorrectionNote] : (newTicketData.notes || []),
      hasNewNoteFromReporter: false,
      is_emergency: false,
    };

    setTickets(prevTickets => [newTicket, ...prevTickets]);

    if (newTicket.reporter_email) {
      sendDrkBrevoMail(newTicket.reporter_email, `Ihre Meldung wurde erfasst – Ticket ${newTicket.id}`, {
        kind: 'ticket_created',
        ticketId: newTicket.id,
      });
    }
    
    if (!silent) setIsModalOpen(false);
    return newTicket.id;
  };
  
  // FIX: Implement bulk action handlers to replace placeholder functions and resolve prop type errors.
  const handleBulkUpdate = (property: keyof Ticket, value: any) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket => {
        if (selectedTicketIds.includes(ticket.id)) {
          const updatedTicket = { ...ticket, [property]: value };
          if (property === 'status' && value === Status.Abgeschlossen && !ticket.completionDate) {
            updatedTicket.completionDate = new Date().toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
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
  const activeTechnicians = useMemo(() => users.filter(u => u.isActive && u.role === Role.Technician), [users]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
        // Role-based pre-filtering: Technicians should only see tickets assigned to them.
        if (currentUser?.role === Role.Technician && ticket.technician !== currentUser.name) {
            return false;
        }

        const searchLower = filters.search.toLowerCase();
        if (filters.search && !ticket.title.toLowerCase().includes(searchLower) && !ticket.id.toLowerCase().includes(searchLower) && !ticket.area.toLowerCase().includes(searchLower)) return false;
        
        if (filters.area !== 'Alle' && ticket.area !== filters.area) return false;
        
        if (filters.technician !== 'Alle' && ticket.technician !== filters.technician) return false;
        
        if (filters.priority !== 'Alle' && ticket.priority !== filters.priority) return false;
        
        if (currentView === 'erledigt') {
            if (filters.status !== 'Alle' && ticket.status !== filters.status) return false;
            return ticket.status === Status.Abgeschlossen;
        }
        
        // For dashboard & tickets views, hide completed tickets.
        if (ticket.status === Status.Abgeschlossen) return false;
        
        if ((currentView === 'tickets' || currentView === 'dashboard') && filters.status !== 'Alle' && ticket.status !== filters.status) return false;
        
        return true;
    });
  }, [tickets, filters, currentView, currentUser]);

    const handleExportCSV = () => {
        if (filteredTickets.length === 0) {
            alert("Keine Tickets zum Exportieren vorhanden.");
            return;
        }
        const headers = ["ID", "Titel", "Standort", "Raum / Bereich", "Gemeldet von", "Eingang", "Fällig bis", "Status", "Techniker", "Priorität", "Abgeschlossen am"];
        const escapeCsv = (str: string | undefined) => {
            if (!str) return '""';
            const escaped = str.replace(/"/g, '""');
            return `"${escaped}"`;
        };
        const rows = filteredTickets.map(t => [
            escapeCsv(t.id), escapeCsv(t.title), escapeCsv(t.area), escapeCsv(t.location),
            escapeCsv(t.reporter), escapeCsv(t.entryDate), escapeCsv(t.dueDate),
            escapeCsv(t.status), escapeCsv(t.technician), escapeCsv(t.priority),
            escapeCsv(t.completionDate)
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
        doc.text(`Exportiert am: ${date} | Standort: ${filters.area}, Techniker: ${filters.technician}`, 14, 30);

        const head = [['ID', 'Priorität', 'Titel', 'Standort / Raum', 'Fällig', 'Techniker']];
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

  const stats = useMemo(() => ({
      open: tickets.filter(t => t.status === Status.Offen).length,
      inProgress: tickets.filter(t => t.status === Status.InArbeit).length,
      overdue: tickets.filter(t => t.status === Status.Ueberfaellig).length,
  }), [tickets]);

  const allTechnicianNames = useMemo(() => ['N/A', ...users.filter(u => u.role === Role.Technician).map(t => t.name)], [users]);
  
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
    if (['dashboard', 'reports', 'techniker', 'settings'].includes(view) && currentUser?.role !== Role.Admin) {
      alert('Keine Berechtigung, auf diese Seite zuzugreifen.');
      return;
    }
    setFilters(prev => ({ ...prev, status: 'Alle', search: '' }));
    setGroupBy('none'); setSelectedTicketIds([]); setCurrentView(view);
  };
  
  const handleUserUpdated = (user: User) => {
      console.log("handleUserUpdated called for:", user.name);
      
      const status = user.availability?.status;
      const isAbsent = status === AvailabilityStatus.OnLeave;
      
      if (isAbsent) {
          // Diagnostic collection
          const userTickets = tickets.filter(t => t.technician === user.name && t.status !== Status.Abgeschlossen);
          
          if (userTickets.length === 0) {
              alert(`Info: Techniker ${user.name} hat aktuell keine offenen Tickets. Keine Umverteilung nötig.`);
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
              alert(`Info: ${user.name} hat ${userTickets.length} offene Tickets, aber keines davon fällt in den Abwesenheitszeitraum (bis ${user.availability.leaveUntil}) oder ist kritisch.`);
              return;
          }

          // 2. Identify available technicians
          const availableTechnicians = users.filter(u => 
              u.role === Role.Technician && 
              u.isActive && 
              (u.availability.status === AvailabilityStatus.Available) &&
              u.id !== user.id
          );

          if (availableTechnicians.length === 0) {
              alert(`KRITISCH: Es wurden ${ticketsToMove.length} Tickets zur Umverteilung identifiziert, aber es gibt KEINE verfügbaren Techniker (Status 'Verfügbar').\n\nBitte setzen Sie einen anderen Techniker auf 'Verfügbar'.`);
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
              alert(`ERFOLG: ${movedCount} Tickets von ${user.name} wurden automatisch auf ${availableTechnicians.length} verfügbare Kollegen verteilt.`);
          }
      }
  };

  const handleManualRedistribution = () => {
      console.log("Manual redistribution triggered.");
      
      // 1. Identify absent users
      const absentUsers = users.filter(u => 
          u.role === Role.Technician && 
          (u.availability.status === AvailabilityStatus.OnLeave)
      );

      if (absentUsers.length === 0) {
          alert("Info: Es gibt aktuell keine abwesenden Techniker.");
          return;
      }

      let ticketsToUpdate = [...tickets];
      let movedTotal = 0;
      let logMessages: string[] = [];

      // 2. Find available technicians
      const availableTechnicians = users.filter(u => 
          u.role === Role.Technician && 
          u.isActive && 
          (u.availability.status === AvailabilityStatus.Available)
      );

      if (availableTechnicians.length === 0) {
          alert("Warnung: Es gibt abwesende Techniker, aber KEINE verfügbaren Kollegen für eine Umverteilung!");
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
    else if (user.role === Role.Technician) setCurrentView('tickets');
  };
  const handleLogout = () => { setCurrentUser(null); setCurrentView('dashboard'); };
  
  if (!currentUser) {
    return <Portal appSettings={appSettings} onLogin={handleLogin} tickets={tickets} onAddTicket={handleAddNewTicket} onUpdateTicket={handleTicketUpdate} locations={activeLocations.map(a => a.name)} users={users} dataReady={isInitialized} />;
  }
  
  const renderCurrentView = () => {
    switch (currentView) {
        case 'dashboard': return <KanbanBoard tickets={filteredTickets} onUpdateTicket={handleTicketUpdate} onSelectTicket={setSelectedTicket} selectedTicket={selectedTicket} />;
        case 'tickets': return <TicketTableView tickets={filteredTickets} onUpdateTicket={handleTicketUpdate} onSelectTicket={setSelectedTicket} selectedTicketIds={selectedTicketIds} setSelectedTicketIds={setSelectedTicketIds} selectedTicket={selectedTicket} groupBy={groupBy} />;
        case 'erledigt': return <ErledigtTableView tickets={filteredTickets} onSelectTicket={setSelectedTicket} selectedTicket={selectedTicket} onDeleteTicket={handleDeleteTicket} />;
        case 'reports': return <ReportsView tickets={tickets} users={users} />;
        case 'techniker': return <TechnicianView tickets={tickets} technicians={users.filter(u => u.role === Role.Technician)} onTechnicianSelect={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} onFilter={(f) => { setFilters(prev => ({ ...prev, ...f })); setCurrentView('tickets');}} />;
        case 'settings': return <SettingsView users={users} setUsers={setUsers} locations={locations} setLocations={setLocations} assets={assets} setAssets={setAssets} maintenancePlans={maintenancePlans} setMaintenancePlans={setMaintenancePlans} appSettings={appSettings} setAppSettings={setAppSettings} />;
        default: return <KanbanBoard tickets={filteredTickets} onUpdateTicket={handleTicketUpdate} onSelectTicket={setSelectedTicket} selectedTicket={selectedTicket} />;
    }
  }

  return (
    <div className="app-layout">
      <Sidebar appSettings={appSettings} isCollapsed={isSidebarCollapsed} setCollapsed={setSidebarCollapsed} theme={theme} setTheme={setTheme} currentView={currentView} setCurrentView={changeView} onLogout={handleLogout} userRole={currentUser.role} userName={currentUser.name} tickets={tickets} onNewTicketClick={() => setIsModalOpen(true)} onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
      <main>
        <Header stats={stats} filters={filters} setFilters={setFilters} currentView={currentView} isSyncing={isSyncing} lastSyncTime={lastSyncTime} appSettings={appSettings} />
        {selectedTicketIds.length > 0 && (currentView === 'tickets' || currentView === 'erledigt') ? (
             <BulkActionBar selectedCount={selectedTicketIds.length} technicians={allTechnicianNames} statuses={Object.values(Status)} onBulkUpdate={handleBulkUpdate} onBulkDelete={handleBulkDelete} onClearSelection={() => setSelectedTicketIds([])} />
        ) : ( (currentView === 'dashboard' || currentView === 'tickets' || currentView === 'erledigt' || currentView === 'techniker') &&
            <FilterBar filters={filters} setFilters={setFilters} locations={locationOptionsWithCounts} technicians={['Alle', ...activeTechnicians.map(t=>t.name)]} statuses={STATUSES} userRole={currentUser.role} groupBy={groupBy} setGroupBy={setGroupBy} currentView={currentView} />
        )}
        {renderCurrentView()}
      </main>
      {isModalOpen && <NewTicketModal onClose={() => setIsModalOpen(false)} onSave={handleAddNewTicket} locations={activeLocations.map(a => a.name)} technicians={activeTechnicians} appSettings={appSettings} compressImage={compressImage}/>}
      {selectedTicket && <TicketDetailSidebar ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdateTicket={handleTicketUpdate} users={users} statuses={Object.values(Status)} currentUser={currentUser} appSettings={appSettings} />}
    </div>
  );
};
export default App;
