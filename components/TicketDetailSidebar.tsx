import React, { useState, useEffect, useRef } from 'react';
// FIX: Import User type to align with App state
import { Ticket, Status, Priority, Role, User, AppSettings, AvailabilityStatus, StaffMessage } from '../types';
import { markStaffMessagesRead, markReporterNoteRead } from '../utils/staffChat';
import { XIcon } from './icons/XIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { statusColorMap, statusBgColorMap } from '../constants';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { displayNameShort } from '../utils/displayNames';


const ExclamationTriangleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

// Helper function to format the note text and style its metadata (can be shared)
const formatNote = (note: string) => {
    const noteRegex = /^(.*)\s\((.*)\s(?:am\s)?(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s(\d{2}:\d{2})(?::\d{2})?\)$/;
    const match = note.match(noteRegex);
    if (match) {
        const [, mainText, user, dateStr, time] = match;
        const [day, month, year] = dateStr.split('.');
        const formattedDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
        const userShort = displayNameShort(user);
        const metaText = `(${userShort} ${formattedDate} ${time})`;
        return (
            <>
                <span className="note-main-text">{mainText}</span>
                <span className="note-meta-reformatted">{metaText}</span>
            </>
        );
    }
    return <span className="note-main-text">{note}</span>;
};

interface TicketDetailSidebarProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdateTicket: (ticket: Ticket) => void;
  users: User[]; // Changed from technicians: string[]
  statuses: Status[];
  currentUser: User | null;
  appSettings: AppSettings;
}

const PencilIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
);

const TicketDetailSidebar: React.FC<TicketDetailSidebarProps> = ({ ticket, onClose, onUpdateTicket, users, statuses, currentUser, appSettings }) => {
    const dueDateInputRef = useRef<HTMLInputElement>(null);
    const [viewingImageSrc, setViewingImageSrc] = useState<string | null>(null);
    const [newNote, setNewNote] = useState('');
    const [newStaffMsg, setNewStaffMsg] = useState('');
    const [chatOpen, setChatOpen] = useState(true);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const notesScrollRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState({ title: '', area: '', location: '', description: '', reporter: '' });
    const [showParkModal, setShowParkModal] = useState(false);

    const canEdit = ticket.origin === 'manual' &&
        (currentUser?.role === Role.Admin || currentUser?.role === Role.Technician);

    const startEdit = () => {
        setEditDraft({
            title: ticket.title,
            area: ticket.area,
            location: ticket.location,
            description: ticket.description || '',
            reporter: ticket.reporter,
        });
        setIsEditing(true);
    };
    const saveEdit = () => {
        onUpdateTicket({ ...ticket, ...editDraft });
        setIsEditing(false);
    };
    const cancelEdit = () => setIsEditing(false);

    // Filter service-team users from users (alphabetisch nach gespeichertem Namen)
    const technicians = users
      .filter(u => u.role === Role.Technician || u.role === Role.Housekeeping)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    // Avatar-Farbe & Initialen für Chat-Absender (gleiche Farbe wie im Kanban)
    const userColorFor = (name: string) => users.find(u => u.name === name)?.color;
    const initialsOf = (name: string) => {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };
    // Helle Absenderfarbe → dunkle Schrift auf dem Avatar (Kontrast)
    const isLightHex = (hex?: string) => {
        if (!hex || hex.length < 7) return false;
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
    };

    const isNewClearedRef = useRef(false);
    useEffect(() => {
        // Clear isNew flag when ticket is first opened (only once per mount)
        if (ticket.isNew === true && !isNewClearedRef.current) {
            isNewClearedRef.current = true;
            const timer = setTimeout(() => {
                onUpdateTicket({ ...ticket, isNew: false });
            }, 300);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Beim Öffnen für MICH (pro Person) als gelesen markieren: interne Chat-
        // Nachrichten (readBy) UND die Melder-Nachricht (reporterNoteReadBy).
        // Wichtig: KEIN globales hasNewNoteFromReporter=false mehr – sonst würde
        // das Orange auch bei allen anderen verschwinden, die das Ticket nie
        // geöffnet haben (z. B. nur weil jemand zum Chatten reinschaut).
        if (!currentUser) return;
        const me = currentUser.name;
        let next = ticket;
        const chatRead = markStaffMessagesRead(next, me);
        if (chatRead) next = chatRead;
        const noteRead = markReporterNoteRead(next, me);
        if (noteRead) next = noteRead;
        if (next === ticket) return;
        const timer = setTimeout(() => onUpdateTicket(next), 500);
        return () => clearTimeout(timer);
    }, [ticket, onUpdateTicket, currentUser]);

    // Chat & Melder-Verlauf immer ans Ende scrollen (neueste Nachricht unten sichtbar, wie WhatsApp)
    useEffect(() => {
        const el = chatScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [ticket.staffMessages?.length, chatOpen]);
    useEffect(() => {
        const el = notesScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [ticket.notes?.length]);

    const toInputDate = (dateStr: string | undefined) => {
        if (!dateStr || dateStr === 'N/A') return '';
        const parts = dateStr.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return '';
    };
    const fromInputDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return '';
    };

    const handleFieldChange = (field: keyof Ticket, value: any) => {
        onUpdateTicket({ ...ticket, [field]: value });
    };

     const handleAddNote = () => {
        if (!newNote.trim() || !currentUser) return;

        const date = new Date();
        const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
        const formattedTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        // FIX: Use currentUser.name instead of non-existent currentUser.displayName
        const noteTextWithMeta = `${newNote.trim()} (${currentUser.name} am ${formattedDate}, ${formattedTime})`;

        const updatedNotes = [...(ticket.notes || []), noteTextWithMeta];
        const updatedTicket = { ...ticket, notes: updatedNotes };
        onUpdateTicket(updatedTicket);
        setNewNote('');
    };
    
    const handleSendStaffMessage = () => {
        if (!newStaffMsg.trim() || !currentUser) return;
        const msg: StaffMessage = {
            text: newStaffMsg.trim(),
            author: currentUser.name,
            timestamp: new Date().toISOString(),
            readBy: [currentUser.name],
        };
        const updated: Ticket = {
            ...ticket,
            staffMessages: [...(ticket.staffMessages || []), msg],
        };
        onUpdateTicket(updated);
        setNewStaffMsg('');
    };

    // Nur Admin darf Nachrichten löschen.
    const isAdmin = currentUser?.role === Role.Admin;
    const handleDeleteStaffMessage = (index: number) => {
        if (!isAdmin) return;
        if (!window.confirm('Diese Team-Chat-Nachricht wirklich löschen?')) return;
        onUpdateTicket({ ...ticket, staffMessages: (ticket.staffMessages || []).filter((_, i) => i !== index) });
    };
    const handleDeleteNote = (index: number) => {
        if (!isAdmin) return;
        if (!window.confirm('Diese Melder-Nachricht wirklich löschen?')) return;
        onUpdateTicket({ ...ticket, notes: (ticket.notes || []).filter((_, i) => i !== index) });
    };

    const handleToggleEmergency = () => {
        const isCurrentlyEmergency = !!ticket.is_emergency;
        let updatedTicket: Ticket = { ...ticket, is_emergency: !isCurrentlyEmergency };

        // If marking as emergency AND status is not final/overdue, set to Overdue
        if (!isCurrentlyEmergency && (ticket.status === Status.Offen || ticket.status === Status.InArbeit)) {
            updatedTicket.status = Status.Ueberfaellig;
        }

        onUpdateTicket(updatedTicket);
    };

    const handleParkConfirm = (weeks: 1 | 2 | 3 | 4 | null) => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        let nextDateStr: string | undefined;
        if (weeks) {
            const nextDate = new Date(today);
            nextDate.setDate(nextDate.getDate() + weeks * 7);
            nextDateStr = nextDate.toISOString().split('T')[0];
        }
        onUpdateTicket({
            ...ticket,
            status: Status.Zurueckgestellt,
            parkReminderInterval: weeks ?? undefined,
            parkReminderNextDate: nextDateStr,
            parkedAt: todayStr,
        });
        setShowParkModal(false);
    };

    const handleUnpark = () => {
        onUpdateTicket({
            ...ticket,
            status: Status.InArbeit,
            parkReminderInterval: undefined,
            parkReminderNextDate: undefined,
            parkedAt: undefined,
            parkedForReturnOf: undefined,
        });
    };

    const priorityClasses = {
        [Priority.Hoch]: 'priority-high',
        [Priority.Mittel]: 'priority-medium',
        [Priority.Niedrig]: 'priority-low',
    };

    const dueDateUrgency: 'normal' | 'soon' | 'today' | 'overdue' = (() => {
        if (ticket.status === Status.Ueberfaellig) return 'overdue';
        const p = ticket.dueDate?.split('.');
        if (!p || p.length !== 3) return 'normal';
        const due = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
        const today = new Date(); today.setHours(0,0,0,0); due.setHours(0,0,0,0);
        const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
        if (diff < 0) return 'overdue';
        if (diff === 0) return 'today';
        if (diff <= 3) return 'soon';
        return 'normal';
    })();

    const priorityPillClass = ticket.priority === Priority.Hoch ? 'ds-pill-p-hoch'
        : ticket.priority === Priority.Mittel ? 'ds-pill-p-mittel' : 'ds-pill-p-niedrig';

    const statusPillClass = ticket.status === Status.InArbeit ? 'ds-pill-s-inarbeit'
        : ticket.status === Status.Ueberfaellig ? 'ds-pill-s-ueberfaellig'
        : ticket.status === Status.Abgeschlossen ? 'ds-pill-s-done'
        : ticket.status === Status.Zurueckgestellt ? 'ds-pill-s-zurueckgestellt'
        : 'ds-pill-s-offen';

    const categoryName = appSettings.ticketCategories.find(c => c.id === ticket.categoryId)?.name || 'N/A';

  return (
    <>
      <div className="detail-sidebar-overlay" onClick={onClose}></div>
      <div className={`detail-sidebar ${ticket.is_emergency ? 'urgent-alert-sidebar' : ''}`}>
        <style>{`
            .detail-sidebar-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5); z-index: 100; animation: fadeIn 0.3s ease;
            }
            .detail-sidebar {
                position: fixed; top: 0; right: 0; width: 500px; height: 100%;
                background: var(--bg-secondary); box-shadow: -5px 0 15px rgba(0,0,0,0.1);
                z-index: 101; display: flex; flex-direction: column; animation: slideInRight 0.3s ease;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
            
            /* --- New Compact Layout --- */
            .sidebar-header-compact {
                display: flex; justify-content: space-between; align-items: center;
                padding: 1.6rem 1.5rem 0.5rem; flex-shrink: 0;
            }
            .sidebar-ticket-id {
                font-size: 0.78rem; font-weight: 600; color: var(--text-muted);
                background: var(--bg-tertiary); border: 1px solid var(--border);
                border-radius: 999px; padding: 0.15rem 0.6rem;
                display: flex; align-items: center; gap: 0.4rem; letter-spacing: 0.01em;
            }
            .urgent-sidebar-icon {
                color: var(--accent-danger);
            }

            @keyframes pulse-border-sidebar {
                0% { border-left-color: var(--accent-danger); }
                50% { border-left-color: transparent; }
                100% { border-left-color: var(--accent-danger); }
            }
            .detail-sidebar.urgent-alert-sidebar {
                border-left: 3px solid var(--accent-danger);
                animation: slideInRight 0.3s ease, pulse-border-sidebar 1.5s infinite;
            }

            .close-btn {
                background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.5rem; margin: -0.5rem;
            }
            .close-btn:hover { color: var(--text-primary); }
            .close-btn svg { width: 18px; height: 18px; }
            
            .sidebar-body-compact {
                flex-grow: 1; overflow-y: auto; padding: 0.25rem 1.5rem 1.5rem;
            }
            .sidebar-body-compact::-webkit-scrollbar { width: 6px; }
            .sidebar-body-compact::-webkit-scrollbar-track { background: transparent; }
            .sidebar-body-compact::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            [data-theme="dark"] .sidebar-body-compact::-webkit-scrollbar-thumb { background: #555; }
            
            .detail-group { margin-bottom: 1rem; }
            
            .detail-label-compact {
                font-size: 0.8rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.25rem;
            }
            .detail-subject-text {
                font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1.4;
            }

            .auftrag-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem;
            }
            .grid-item-span-2 { grid-column: span 2; }

            .detail-value-compact, .editable-field-compact {
                font-size: 0.9rem; font-weight: 500; border-radius: var(--radius-md);
                height: 34px; display: flex; align-items: center; justify-content: flex-start;
                padding: 0 0.75rem;
            }
            .detail-value-compact {
                background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--bg-tertiary);
            }
            
            .editable-field-compact {
                position: relative; background: var(--bg-secondary); border: 1px solid var(--border);
                color: var(--text-primary); justify-content: space-between;
                transition: border-color 0.2s ease, background-color 0.2s ease;
            }
            .editable-field-compact:hover { border-color: var(--border-active); background-color: var(--bg-tertiary); }
            .editable-field-compact select, .editable-field-compact input {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;
            }
            .editable-field-compact.priority-high { background-color: rgba(220, 53, 69, 0.1); color: #c82333; border-color: rgba(220, 53, 69, 0.2); }
            .editable-field-compact.priority-medium { background-color: rgba(255, 193, 7, 0.1); color: #d97706; border-color: rgba(255, 193, 7, 0.2); }
            .editable-field-compact.priority-low { background-color: rgba(25, 135, 84, 0.1); color: var(--accent-success); border-color: rgba(25, 135, 84, 0.2); }

            .description-box-compact {
                margin-top: 1rem; background: var(--bg-tertiary); padding: 0.75rem;
                border-radius: var(--radius-md); font-size: 0.9rem; color: var(--text-primary);
                line-height: 1.6;
            }
            .section-separator {
                border: 0; height: 1px; background-color: var(--border); margin: 1.5rem 0;
            }
            /* ── Zwei getrennte Kanäle: interner Chat (lila) & Melder-Verlauf (bernstein) ── */
            .channel-card {
                border: 1px solid var(--border); border-radius: 12px;
                overflow: hidden; margin-bottom: 1.25rem;
            }
            .channel-head {
                display: flex; align-items: center; gap: 7px; width: 100%;
                border: none; text-align: left; font-family: inherit; cursor: default;
                padding: 9px 13px; font-size: 0.82rem; font-weight: 600;
            }
            .channel-head--chat { background: rgba(99,102,241,0.10); color: #4f46e5; cursor: pointer; }
            .channel-head--chat:hover { background: rgba(99,102,241,0.16); }
            .channel-head--melder { background: rgba(217,119,6,0.12); color: #b45309; }
            [data-theme="dark"] .channel-head--chat { background: rgba(99,102,241,0.24); color: #c7d2fe; }
            [data-theme="dark"] .channel-head--melder { background: rgba(217,119,6,0.22); color: #fbbf24; }
            .channel-pill {
                margin-left: auto; font-size: 0.68rem; font-weight: 600;
                padding: 2px 9px; border-radius: 999px; white-space: nowrap;
            }
            .channel-pill--chat { background: rgba(99,102,241,0.18); color: #4338ca; }
            [data-theme="dark"] .channel-pill--chat { background: rgba(99,102,241,0.32); color: #c7d2fe; }
            .channel-count {
                font-size: 0.68rem; font-weight: 700; padding: 1px 7px; border-radius: 999px;
                background: rgba(99,102,241,0.18); color: #4338ca;
            }
            [data-theme="dark"] .channel-count { background: rgba(99,102,241,0.32); color: #c7d2fe; }
            .channel-chevron { font-size: 14px; opacity: 0.65; }
            .channel-body { padding: 12px 13px; }

            /* Chat-Blasen im WhatsApp-Stil */
            .chat-messages { display: flex; flex-direction: column; gap: 11px; margin-bottom: 12px; max-height: 300px; overflow-y: auto; padding-right: 4px; }
            .chat-row { display: flex; gap: 7px; }
            .chat-row--mine { justify-content: flex-end; }
            .chat-row--other { justify-content: flex-start; align-items: flex-end; }
            .chat-av {
                width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.64rem; font-weight: 700; color: rgba(255,255,255,0.95);
                background: var(--text-muted);
            }
            .chat-col { display: flex; flex-direction: column; max-width: 82%; }
            .chat-author { font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); margin: 0 0 2px 3px; }
            .chat-bubble { padding: 8px 12px; font-size: 0.86rem; line-height: 1.45; word-break: break-word; }
            .chat-bubble--mine { background: #6366F1; color: #fff; border-radius: 14px 14px 4px 14px; }
            .chat-bubble--other { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 14px 14px 14px 4px; }
            .chat-meta { display: flex; align-items: center; gap: 6px; font-size: 0.68rem; color: var(--text-muted); margin-top: 3px; }
            .chat-meta--mine { justify-content: flex-end; margin-right: 3px; }
            .chat-meta--other { margin-left: 3px; }
            .msg-del-btn { background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); opacity: 0.55; display: inline-flex; align-items: center; font-size: 12.5px; line-height: 1; transition: color 0.12s, opacity 0.12s; }
            .msg-del-btn:hover { color: var(--accent-danger, #dc3545); opacity: 1; }
            .note-del-btn { position: absolute; top: 6px; right: 6px; }
            .chat-empty { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px; padding: 2px; }

            /* gemeinsame Eingabezeile (Chat + Melder) */
            .channel-input-row { display: flex; gap: 6px; align-items: flex-end; }
            .channel-input {
                flex: 1; resize: none; border: 1px solid var(--border); border-radius: 8px;
                background: var(--bg-secondary); color: var(--text-primary);
                padding: 7px 10px; font-size: 0.85rem; font-family: inherit; transition: border-color 0.2s;
            }
            .channel-input:focus { outline: none; border-color: #6366F1; }
            .channel-melder-input:focus { border-color: #D97706; }
            .channel-send {
                flex-shrink: 0; padding: 8px 14px; border-radius: 8px; border: none; color: #fff;
                font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: opacity 0.15s;
                display: flex; align-items: center; gap: 5px; white-space: nowrap;
            }
            .channel-send:hover { opacity: 0.88; }
            .channel-send:disabled { opacity: 0.4; cursor: default; }
            .channel-send--chat { background: #6366F1; }
            .channel-send--melder { background: #D97706; }

            .notes-list-compact { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; max-height: 260px; overflow-y: auto; padding-right: 4px; }
            .note-item-compact {
                position: relative;
                background: var(--bg-tertiary); padding: 0.6rem 0.8rem; border-radius: var(--radius-md);
                font-size: 0.85rem; color: var(--text-primary); line-height: 1.5;
            }
            .note-item-compact:has(.note-del-btn) { padding-right: 1.9rem; }
            .note-meta-reformatted {
                display: block; text-align: right; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;
            }
            .note-textarea-compact {
                width: 100%; background: var(--bg-tertiary); border: 1px solid var(--border);
                border-radius: var(--radius-md); padding: 0.6rem 0.8rem; font-size: 0.9rem;
                color: var(--text-primary); line-height: 1.5; margin-bottom: 0.5rem;
                resize: vertical; font-family: inherit;
            }
            .note-textarea-compact:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }
            
            .add-note-btn-compact, .admin-action-btn {
                width: 100%; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-weight: 500;
                font-size: 0.85rem; cursor: pointer;
                border: 1px solid transparent; /* Prevent layout shift */
                transition: var(--transition-smooth);
            }
            .add-note-btn-compact:disabled {
                background-color: var(--bg-tertiary);
                border-color: var(--border);
                color: var(--text-secondary);
                opacity: 0.6;
                cursor: not-allowed;
            }
            .add-note-btn-compact:not(:disabled) {
                background-color: var(--accent-primary);
                border-color: var(--accent-primary);
                color: #fff;
            }
            .add-note-btn-compact:hover:not(:disabled) {
                opacity: 0.9;
            }
            .admin-action-btn.is-emergency {
                background-color: var(--bg-tertiary);
                color: var(--text-secondary);
                border-color: var(--border);
            }
            .admin-action-btn.not-emergency {
                background-color: transparent;
                color: var(--accent-danger);
                border-color: var(--accent-danger);
            }
            .admin-action-btn.not-emergency:hover {
                background-color: rgba(220, 53, 69, 0.08);
            }
            
            .photo-gallery { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
            .photo-thumbnail { 
                width: 60px; height: 60px; 
                border-radius: var(--radius-md); 
                overflow: hidden; 
                border: 1px solid var(--border); 
                cursor: pointer;
                padding: 0;
                background: none;
            }
            .photo-thumbnail img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease; }
            .photo-thumbnail:hover img { transform: scale(1.1); }
            
            .lightbox-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex; align-items: center; justify-content: center;
                z-index: 102;
                animation: fadeIn 0.3s ease;
            }
            .lightbox-content-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }
            .lightbox-image {
                max-width: 90vw; max-height: 85vh;
                object-fit: contain;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                border-radius: var(--radius-md);
            }
            .lightbox-close-btn {
                position: absolute; top: 2rem; right: 2rem;
                background: none; border: none; cursor: pointer;
                color: rgba(255,255,255,0.7);
                transition: color 0.2s ease;
            }
            .lightbox-close-btn:hover {
                color: white;
            }
            .lightbox-close-btn svg {
                width: 32px; height: 32px;
            }
            .lightbox-download-btn {
                background-color: rgba(40, 40, 40, 0.8);
                color: #e4e6eb;
                padding: 0.6rem 1.2rem;
                border-radius: var(--radius-md);
                text-decoration: none;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 0.75rem;
                transition: background-color 0.2s ease;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .lightbox-download-btn:hover {
                background-color: rgba(58, 59, 60, 0.9);
            }
            .lightbox-download-btn svg {
                width: 20px;
                height: 20px;
            }

            .edit-btn {
                background: none; border: none; cursor: pointer; color: var(--text-muted);
                padding: 0.5rem; margin: -0.5rem; border-radius: var(--radius-sm);
                transition: color 0.2s ease, background-color 0.2s ease;
            }
            .edit-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
            .edit-btn svg { width: 20px; height: 20px; }
            .header-actions { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }

            /* Notfall: fast unsichtbar, nur als Geisterschaltfläche */
            .notfall-ghost-btn {
                background: none; border: none; cursor: pointer; padding: 0.4rem;
                border-radius: var(--radius-sm); color: var(--border);
                transition: color 0.2s ease, background-color 0.2s ease;
                display: flex; align-items: center; justify-content: center;
            }
            .notfall-ghost-btn:hover { color: var(--text-muted); background: var(--bg-tertiary); }
            .notfall-ghost-btn.is-active { color: var(--accent-danger); }
            .notfall-ghost-btn.is-active:hover { color: var(--accent-danger); background: rgba(220,53,69,0.08); }
            .edit-save-btn, .edit-cancel-btn {
                padding: 0.3rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.82rem;
                font-weight: 600; cursor: pointer; border: 1px solid transparent;
                transition: opacity 0.2s ease;
            }
            .edit-save-btn {
                background: var(--accent-primary); color: #fff; border-color: var(--accent-primary);
            }
            .edit-save-btn:hover { opacity: 0.88; }
            .edit-cancel-btn {
                background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border);
            }
            .edit-cancel-btn:hover { border-color: var(--border-active); }

            .edit-input-compact {
                width: 100%; font-size: 0.9rem; font-weight: 500; color: var(--text-primary);
                background: var(--bg-secondary); border: 1px solid var(--border-active);
                border-radius: var(--radius-md); padding: 0 0.75rem; height: 34px;
                font-family: inherit; outline: none;
                transition: border-color 0.2s ease;
            }
            .edit-input-compact:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(179,0,12,0.1); }
            .edit-title-input {
                width: 100%; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);
                background: var(--bg-secondary); border: 1px solid var(--border-active);
                border-radius: var(--radius-md); padding: 0.4rem 0.75rem;
                font-family: inherit; outline: none; resize: vertical; line-height: 1.4;
                transition: border-color 0.2s ease;
            }
            .edit-title-input:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(179,0,12,0.1); }
            .edit-reporter-input {
                font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);
                background: var(--bg-secondary); border: 1px solid var(--border-active);
                border-radius: var(--radius-sm); padding: 0.2rem 0.5rem; height: 28px;
                font-family: inherit; outline: none; width: 100%; margin-top: 0.25rem;
                transition: border-color 0.2s ease;
            }
            .edit-reporter-input:focus { border-color: var(--accent-primary); }
            .edit-description-textarea {
                width: 100%; font-size: 0.9rem; color: var(--text-primary);
                background: var(--bg-secondary); border: 1px solid var(--border-active);
                border-radius: var(--radius-md); padding: 0.6rem 0.75rem;
                font-family: inherit; outline: none; resize: vertical; line-height: 1.6;
                transition: border-color 0.2s ease; min-height: 80px;
            }
            .edit-description-textarea:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(179,0,12,0.1); }

            /* ── Melder row ── */
            .ds-melder-row {
                display: flex; align-items: center; gap: 5px;
                font-size: 13px; color: var(--text-secondary); font-weight: 500;
                margin: 0.3rem 0 0.15rem;
            }
            .ds-melder-row i { color: var(--text-muted); font-size: 13px; flex-shrink: 0; }

            /* ── Pill row (3-col, wie Karten) ── */
            .ds-pill-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 0.6rem; }
            .ds-pill-cell { display: flex; flex-direction: column; }
            .ds-pill-lbl { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; margin-bottom: 3px; text-align: center; letter-spacing: 0.01em; }
            .ds-pill {
                display: flex; align-items: center; justify-content: center; gap: 3px;
                padding: 5px 6px; border-radius: 20px; font-size: 11px; font-weight: 600;
                border: 0.5px solid; position: relative; cursor: pointer; white-space: nowrap;
                width: 100%; box-sizing: border-box;
            }
            .ds-pill select, .ds-pill input[type="date"] {
                position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;
            }
            .ds-pill-p-hoch     { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
            .ds-pill-p-mittel   { background: #FAEEDA; color: #854F0B; border-color: #FAC775; }
            .ds-pill-p-niedrig  { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
            .ds-pill-s-inarbeit     { background: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
            .ds-pill-s-offen        { background: #F1F0EC; color: #5F5E5A; border-color: #D3D1C7; }
            .ds-pill-s-ueberfaellig { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
            .ds-pill-s-done         { background: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
            .ds-pill-due            { background: #F1F0EC; color: #5F5E5A; border-color: #D3D1C7; }
            .ds-pill-due.soon       { background: #FFFBEB; color: #92400E; border-color: #FDE68A; }
            .ds-pill-due.today      { background: #FEF2F2; color: #B91C1C; border-color: #FECACA; }
            .ds-pill-due.overdue    { background: #FCEBEB; color: #A32D2D; border-color: #F7C1C1; }
            [data-theme="dark"] .ds-pill-p-hoch     { background: rgba(163,45,45,0.18); color: #f87171; border-color: rgba(163,45,45,0.35); }
            [data-theme="dark"] .ds-pill-p-mittel   { background: rgba(133,79,11,0.18); color: #fbbf24; border-color: rgba(133,79,11,0.35); }
            [data-theme="dark"] .ds-pill-p-niedrig  { background: rgba(59,109,17,0.18); color: #86efac; border-color: rgba(59,109,17,0.35); }
            [data-theme="dark"] .ds-pill-s-inarbeit { background: rgba(24,95,165,0.18); color: #93c5fd; border-color: rgba(24,95,165,0.35); }
            [data-theme="dark"] .ds-pill-s-offen    { background: rgba(95,94,90,0.18); color: #b0b3b8; border-color: rgba(95,94,90,0.35); }
            [data-theme="dark"] .ds-pill-s-ueberfaellig { background: rgba(163,45,45,0.18); color: #f87171; border-color: rgba(163,45,45,0.35); }
            [data-theme="dark"] .ds-pill-s-done     { background: rgba(59,109,17,0.18); color: #86efac; border-color: rgba(59,109,17,0.35); }
            [data-theme="dark"] .ds-pill-due        { background: rgba(95,94,90,0.18); color: #b0b3b8; border-color: rgba(95,94,90,0.35); }

            /* ── 2-col fields ── */
            .ds-fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 0.6rem; }

            /* ── Meta info row (Eingang) ── */
            .ds-meta-row {
                font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center;
                gap: 5px; margin-bottom: 0.75rem; flex-wrap: wrap;
            }
            .ds-meta-row i { font-size: 12px; }

            /* ── Assignee chip (wie Karte) ── */
            .ds-assignee-field {
                position: relative; display: flex; align-items: center; gap: 7px;
                background: var(--bg-secondary); border: 1px solid var(--border);
                border-radius: var(--radius-md); height: 34px; padding: 0 0.75rem;
                cursor: pointer; transition: border-color 0.2s ease, background-color 0.2s ease;
            }
            .ds-assignee-field:hover { border-color: var(--border-active); background: var(--bg-tertiary); }
            .ds-assignee-field--unassigned {
                border-color: rgba(255,140,0,0.6) !important;
                background: rgba(255,140,0,0.07) !important;
            }
            .ds-assignee-field--unassigned .ds-assignee-name {
                color: #B45309 !important; font-weight: 600 !important;
            }
            [data-theme="dark"] .ds-assignee-field--unassigned .ds-assignee-name { color: #FBBF24 !important; }
            .ds-assignee-field select {
                position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;
            }
            .ds-av {
                width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 8px; font-weight: 700;
            }
            .ds-av-un { background: transparent; border: 1.5px dashed #E24B4A; color: #E24B4A; }
            .ds-av-un i { font-size: 9px; }
            .ds-assignee-name { font-size: 0.9rem; font-weight: 500; color: var(--text-primary); flex: 1; }

            .ds-pill-s-zurueckgestellt { background: #FFF3E0; color: #E65100; border-color: #FFCC80; }
            [data-theme="dark"] .ds-pill-s-zurueckgestellt { background: rgba(230,81,0,0.18); color: #FFB74D; border-color: rgba(230,81,0,0.35); }

            /* ── Park / Unpark buttons ── */
            .park-footer { padding: 0.75rem 1.5rem; border-top: 1px solid var(--border); background: var(--bg-secondary); flex-shrink: 0; }
            .park-section { }
            .park-btn {
                width: 100%; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-weight: 500;
                font-size: 0.85rem; cursor: pointer; border: 1px solid rgba(255, 140, 0, 0.5);
                background: transparent; color: rgba(230, 81, 0, 0.9);
                display: flex; align-items: center; justify-content: center; gap: 0.4rem;
                transition: var(--transition-smooth);
            }
            .park-btn:hover { background: rgba(255, 140, 0, 0.08); }
            .unpark-btn {
                width: 100%; padding: 0.6rem 1rem; border-radius: var(--radius-md); font-weight: 600;
                font-size: 0.9rem; cursor: pointer; border: 1px solid var(--accent-primary);
                background: var(--accent-primary); color: #fff;
                display: flex; align-items: center; justify-content: center; gap: 0.4rem;
                transition: var(--transition-smooth);
            }
            .unpark-btn:hover { opacity: 0.88; }
            .park-modal {
                margin-top: 0.75rem; background: var(--bg-tertiary); border: 1px solid rgba(255, 140, 0, 0.3);
                border-radius: var(--radius-md); padding: 0.9rem 1rem;
            }
            .park-modal-title {
                font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.6rem;
            }
            .park-interval-options {
                display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;
            }
            .park-interval-btn {
                flex: 1; min-width: 50px; padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);
                font-size: 0.82rem; font-weight: 600; cursor: pointer;
                border: 1.5px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary);
                transition: var(--transition-smooth); text-align: center;
            }
            .park-interval-btn.selected {
                border-color: rgba(255, 140, 0, 0.8); background: rgba(255, 140, 0, 0.12); color: #E65100;
            }
            .park-confirm-btn {
                width: 100%; padding: 0.5rem; border-radius: var(--radius-md); font-weight: 600;
                font-size: 0.85rem; cursor: pointer; border: none;
                background: rgba(255, 140, 0, 0.9); color: #fff;
                transition: var(--transition-smooth);
            }
            .park-confirm-btn:hover { opacity: 0.88; }
            .park-info-row {
                font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;
                display: flex; align-items: center; gap: 0.35rem;
            }

            /* ── Bearbeiter-Zeile (wie Melder-Zeile, aber klickbar) ── */
            .ds-bearbeiter-wrap {
                display: flex; justify-content: center; margin-top: 8px;
            }
            .ds-bearbeiter-row {
                position: relative; display: inline-flex; align-items: center; gap: 8px;
                padding: 6px 14px 6px 6px;
                border-radius: 999px; border: 1px solid var(--border);
                background: var(--bg-tertiary);
                cursor: pointer; max-width: 100%;
                transition: border-color 0.15s ease, background 0.15s ease;
            }
            .ds-bearbeiter-row:hover { border-color: var(--border-active); background: var(--bg-secondary); }
            .ds-bearbeiter-row svg { width: 14px; height: 14px; color: var(--text-muted); flex-shrink: 0; }
            .ds-bearbeiter-name {
                font-size: 0.88rem; font-weight: 600; color: var(--text-primary);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
        `}</style>
        <div className="sidebar-header-compact">
            {/* Titel im Header, gleiche Höhe wie X */}
            <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                {isEditing ? (
                    <textarea className="edit-title-input" value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} rows={1} style={{ fontSize: '1rem' }} />
                ) : (
                    <p className="detail-subject-text" style={{ margin: 0, fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.title}</p>
                )}
            </div>
            <div className="header-actions" style={{ flexShrink: 0 }}>
                {canEdit && !isEditing && (
                    <button className="edit-btn" onClick={startEdit} title="Ticket bearbeiten">
                        <PencilIcon />
                    </button>
                )}
                {isEditing && (
                    <>
                        <button className="edit-cancel-btn" onClick={cancelEdit}>Abbrechen</button>
                        <button className="edit-save-btn" onClick={saveEdit}>Speichern</button>
                    </>
                )}
                {currentUser?.role === Role.Admin && (
                    <button
                        onClick={handleToggleEmergency}
                        className={`notfall-ghost-btn${ticket.is_emergency ? ' is-active' : ''}`}
                        title={ticket.is_emergency ? 'Notfall aufheben' : 'Als Notfall markieren'}
                    >
                        <ExclamationTriangleIcon width={16} height={16} />
                    </button>
                )}
                <button className="close-btn" onClick={onClose}><XIcon /></button>
            </div>
        </div>
        <div className="sidebar-body-compact">

            {/* ── 2. MELDER + TICKET-ID rechts (gleiche Texthöhe) ── */}
            {isEditing ? (
                <input className="edit-reporter-input" value={editDraft.reporter} onChange={e => setEditDraft(d => ({ ...d, reporter: e.target.value }))} placeholder="Name des Melders..." style={{ marginBottom: '0.6rem' }} />
            ) : (
                <div style={{ marginBottom: '0.6rem' }}>
                    <div className="ds-melder-row" style={{ justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="ti ti-user" aria-hidden="true" />
                            <span>{ticket.reporter}{ticket.entryDate ? ` · ${ticket.entryDate.slice(0,5)}.` : ''}{ticket.entryTime ? ` · ${ticket.entryTime}` : ''}</span>
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {ticket.is_emergency && <ExclamationTriangleIcon className="urgent-sidebar-icon" width={11} height={11} />}
                            #{ticket.id}
                        </span>
                    </div>
                    {ticket.reporter_email ? (
                        <a href={`mailto:${ticket.reporter_email}`} style={{ fontSize: '0.82rem', color: 'var(--accent-inprogress)', marginTop: '0.1rem', display: 'inline-block', textDecoration: 'none', fontWeight: 500 }} title="E-Mail schreiben">
                            <i className="ti ti-mail" style={{ fontSize: '11px', marginRight: 4 }} aria-hidden="true" />{ticket.reporter_email}
                        </a>
                    ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'inline-block', fontStyle: 'italic' }}>Keine E-Mail angegeben</span>
                    )}
                </div>
            )}

            {/* ── 3. STANDORT | BEREICH ── */}
            <div className="ds-fields-grid">
                <div>
                    <p className="detail-label-compact">Standort</p>
                    {isEditing
                        ? <input className="edit-input-compact" value={editDraft.area} onChange={e => setEditDraft(d => ({ ...d, area: e.target.value }))} />
                        : <p className="detail-value-compact">{ticket.area}</p>
                    }
                </div>
                <div>
                    <p className="detail-label-compact">Bereich</p>
                    {isEditing
                        ? <input className="edit-input-compact" value={editDraft.location} onChange={e => setEditDraft(d => ({ ...d, location: e.target.value }))} />
                        : <p className="detail-value-compact" title={ticket.location} style={{ overflow: 'hidden' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.location}</span></p>
                    }
                </div>
            </div>

            {/* ── 3. BESCHREIBUNG ── */}
            <div style={{ marginTop: '0.5rem' }}>
                <p className="detail-label-compact">Beschreibung</p>
                {isEditing ? (
                    <textarea className="edit-description-textarea" value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} placeholder="Beschreibung..." rows={4} />
                ) : (
                    <p className="detail-value-compact" style={{ height: 'auto', minHeight: '34px', whiteSpace: 'pre-wrap', alignItems: 'flex-start', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        {ticket.description && ticket.description.trim()
                            ? ticket.description
                            : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Keine Beschreibung</span>
                        }
                    </p>
                )}
            </div>

            <hr className="section-separator" style={{ margin: '0.75rem 0' }} />

            {/* ── 5. PILLS: Priorität | Fällig bis | Status ── */}
            <div className="ds-pill-row">
                <div className="ds-pill-cell">
                    <div className="ds-pill-lbl">Priorität</div>
                    {ticket.is_emergency ? (
                        <div className="ds-pill ds-pill-p-hoch">Notfall</div>
                    ) : (
                        <div className={`ds-pill ${priorityPillClass}`}>
                            <span>{ticket.priority}</span>
                            <select value={ticket.priority} onChange={e => handleFieldChange('priority', e.target.value as Priority)}>
                                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="ds-pill-cell">
                    <div className="ds-pill-lbl">Fällig bis</div>
                    <div
                        className={`ds-pill ds-pill-due${dueDateUrgency !== 'normal' ? ` ${dueDateUrgency}` : ''}`}
                    >
                        <i className="ti ti-calendar-due" aria-hidden="true" style={{ pointerEvents: 'none', fontSize: 11 }} />
                        <span style={{ pointerEvents: 'none' }}>{ticket.dueDate.slice(0,5)}.</span>
                        <input
                            ref={dueDateInputRef}
                            type="date"
                            value={toInputDate(ticket.dueDate)}
                            onChange={e => handleFieldChange('dueDate', fromInputDate(e.target.value))}
                            onClick={e => { try { (e.currentTarget as HTMLInputElement).showPicker(); } catch {} }}
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', pointerEvents: 'auto' }}
                        />
                    </div>
                </div>
                <div className="ds-pill-cell">
                    <div className="ds-pill-lbl">Status</div>
                    <div className={`ds-pill ${statusPillClass}`}>
                        <span>{ticket.status}</span>
                        <select value={ticket.status} onChange={e => handleFieldChange('status', e.target.value as Status)}>
                            {statuses.map(s => <option key={s} value={s}>{s === Status.Abgeschlossen ? 'Abschließen' : s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── 6. BEARBEITER | KATEGORIE ── */}
            <div className="ds-fields-grid" style={{ marginTop: '6px' }}>
                <div>
                    <p className="detail-label-compact">Bearbeiter</p>
                    {(() => {
                        const isAssigned = ticket.technician && ticket.technician !== 'N/A';
                        const initials = isAssigned ? (() => {
                            const p = ticket.technician.trim().split(' ');
                            return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : ticket.technician.slice(0,2).toUpperCase();
                        })() : '';
                        const isAuto = ticket.autoAssigned === true && ticket.status === Status.Offen;
                        const techUser = isAssigned ? technicians.find(u => u.name === ticket.technician) : null;
                        const userHexColor = techUser?.color ?? null;
                        const avBg = isAssigned && userHexColor
                            ? userHexColor
                            : isAssigned ? '#C8C8C8' : 'transparent';
                        const avColor = isAssigned && userHexColor
                            ? 'rgba(255,255,255,0.95)'
                            : isAssigned ? '#444' : '#E24B4A';
                        return (
                            <div className={`ds-assignee-field${!isAssigned ? ' ds-assignee-field--unassigned' : ''}`}>
                                {isAssigned
                                    ? <span className="ds-av" style={{ background: avBg, color: avColor }}>{initials}</span>
                                    : <span className="ds-av ds-av-un" style={{ background: '#FF8C00', color: '#fff', border: 'none' }}><i className="ti ti-alert-triangle" aria-hidden="true" /></span>
                                }
                                <span className="ds-assignee-name">{isAssigned ? displayNameShort(ticket.technician) : '⚠ Bitte wählen'}</span>
                                {isAuto && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 14, height: 14, borderRadius: 4,
                                        background: '#6366F1', color: '#fff',
                                        fontSize: 8, fontWeight: 800,
                                        flexShrink: 0,
                                    }} title="Automatisch zugewiesen">A</span>
                                )}
                                <ChevronDownIcon />
                                <select style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} value={ticket.technician} onChange={e => handleFieldChange('technician', e.target.value)}>
                                    <option value="N/A">Nicht zugewiesen</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.name}>
                                            {displayNameShort(t.name)}{t.availability.status === AvailabilityStatus.OnLeave ? ' (Abwesend)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })()}
                </div>
                <div>
                    <p className="detail-label-compact">Kategorie</p>
                    <div className={`editable-field-compact${!ticket.categoryId ? ' ds-assignee-field--unassigned' : ''}`} style={!ticket.categoryId ? { borderColor: 'rgba(255,140,0,0.6)', background: 'rgba(255,140,0,0.07)' } : {}}>
                        <span style={!ticket.categoryId ? { color: '#B45309', fontWeight: 600 } : {}}>{ticket.categoryId ? categoryName : '⚠ Bitte wählen'}</span><ChevronDownIcon />
                        <select value={ticket.categoryId ?? ''} onChange={e => handleFieldChange('categoryId', e.target.value || undefined)}>
                            <option value="" hidden>Bitte wählen</option>
                            {appSettings.ticketCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── 8. META: nur optionale Felder (Wunschtermin, Abgeschlossen) ── */}
            {(ticket.wunschTermin || ticket.completionDate) && (
                <div className="ds-meta-row">
                    {ticket.wunschTermin && <><i className="ti ti-calendar-event" aria-hidden="true" /><span>Wunsch {ticket.wunschTermin}</span></>}
                    {ticket.completionDate && <><i className="ti ti-circle-check" aria-hidden="true" style={{ color: '#3B6D11' }} /><span style={{ color: '#3B6D11' }}>Erledigt {ticket.completionDate}{ticket.completionTime ? ` ${ticket.completionTime}` : ''}</span></>}
                </div>
            )}

            {/* ── 9. FOTOS ── */}
            {ticket.photos && ticket.photos.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                    <p className="detail-label-compact">Fotos</p>
                    <div className="photo-gallery">
                        {ticket.photos.map((photo, index) => (
                            <button key={index} onClick={() => setViewingImageSrc(photo)} className="photo-thumbnail">
                                <img src={photo} alt={`Foto ${index + 1}`} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <hr className="section-separator" />

            {/* ── 10. INTERNER STAFF-CHAT ── */}
            {currentUser && (currentUser.role === Role.Admin || currentUser.role === Role.Technician || currentUser.role === Role.Housekeeping) && (
              <div className="channel-card">
                <button type="button" className="channel-head channel-head--chat" onClick={() => setChatOpen(o => !o)}>
                  <i className="ti ti-lock" style={{ fontSize: 15 }} aria-hidden="true" />
                  <span>Interner Chat</span>
                  <span className="channel-pill channel-pill--chat">nur das Team</span>
                  {(ticket.staffMessages?.length ?? 0) > 0 && (
                    <span className="channel-count">{ticket.staffMessages!.length}</span>
                  )}
                  <i className={`ti ti-chevron-${chatOpen ? 'up' : 'down'} channel-chevron`} aria-hidden="true" />
                </button>
                {chatOpen && (
                  <div className="channel-body">
                    {(ticket.staffMessages || []).length > 0 ? (
                      <div className="chat-messages" ref={chatScrollRef}>
                        {ticket.staffMessages!.map((msg, i) => {
                          const isMe = msg.author === currentUser.name;
                          const d = new Date(msg.timestamp);
                          const formatted = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          if (isMe) {
                            return (
                              <div key={i} className="chat-row chat-row--mine">
                                <div className="chat-col">
                                  <div className="chat-bubble chat-bubble--mine">{msg.text}</div>
                                  <div className="chat-meta chat-meta--mine">
                                    {formatted}
                                    {isAdmin && <button type="button" className="msg-del-btn" title="Nachricht löschen" onClick={() => handleDeleteStaffMessage(i)}><i className="ti ti-trash" aria-hidden="true" /></button>}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const color = userColorFor(msg.author);
                          return (
                            <div key={i} className="chat-row chat-row--other">
                              <span className="chat-av" style={color ? { background: color, color: isLightHex(color) ? '#1a1a1a' : 'rgba(255,255,255,0.95)' } : undefined}>{initialsOf(msg.author)}</span>
                              <div className="chat-col">
                                <div className="chat-author" style={color ? { color } : undefined}>{displayNameShort(msg.author)}</div>
                                <div className="chat-bubble chat-bubble--other" style={color ? { background: `${color}1A`, borderColor: `${color}66` } : undefined}>{msg.text}</div>
                                <div className="chat-meta chat-meta--other">
                                  {formatted}
                                  {isAdmin && <button type="button" className="msg-del-btn" title="Nachricht löschen" onClick={() => handleDeleteStaffMessage(i)}><i className="ti ti-trash" aria-hidden="true" /></button>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="chat-empty">Noch keine Nachrichten – nur für das Team sichtbar.</div>
                    )}
                    <div className="channel-input-row">
                      <textarea
                        className="channel-input"
                        rows={2}
                        placeholder="Nachricht an das Team…"
                        value={newStaffMsg}
                        onChange={e => setNewStaffMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendStaffMessage(); } }}
                      />
                      <button className="channel-send channel-send--chat" onClick={handleSendStaffMessage} disabled={!newStaffMsg.trim()}>
                        <i className="ti ti-send" aria-hidden="true" />
                        Senden
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 11. MELDER-KONVERSATION (Verlauf, an den Melder) ── */}
            <div className="channel-card">
                <div className="channel-head channel-head--melder">
                    <i className="ti ti-mail" style={{ fontSize: 15 }} aria-hidden="true" />
                    <span>Konversation mit dem Melder</span>
                </div>
                <div className="channel-body">
                    {ticket.notes && ticket.notes.length > 0 && (
                        <div className="notes-list-compact" ref={notesScrollRef}>
                            {ticket.notes.map((note, index) => (
                                <div className="note-item-compact" key={index}>
                                    {formatNote(note)}
                                    {isAdmin && <button type="button" className="msg-del-btn note-del-btn" title="Nachricht löschen" onClick={() => handleDeleteNote(index)}><i className="ti ti-trash" aria-hidden="true" /></button>}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="channel-input-row">
                        <textarea className="channel-input channel-melder-input" rows={2} placeholder="Antwort an den Melder…" value={newNote} onChange={e => setNewNote(e.target.value)} />
                        <button className="channel-send channel-send--melder" onClick={handleAddNote} disabled={!newNote.trim()}>
                            <i className="ti ti-mail" aria-hidden="true" />
                            An Melder
                        </button>
                    </div>
                </div>
            </div>

        </div>

      {/* ── PARK / UNPARK FOOTER (immer sichtbar, nicht scrollbar) ── */}
      {ticket.status !== Status.Abgeschlossen && (
        <div className="park-footer">
          {ticket.status === Status.Zurueckgestellt ? (
            <div className="park-section">
                {ticket.parkedAt && (
                    <div className="park-info-row">
                        <i className="ti ti-parking" aria-hidden="true" />
                        <span>Zurückgestellt seit {fromInputDate(ticket.parkedAt)}</span>
                        {ticket.parkReminderNextDate && (
                            <span> · Erinnerung: {fromInputDate(ticket.parkReminderNextDate)}</span>
                        )}
                        {ticket.parkReminderInterval && (
                            <span> (alle {ticket.parkReminderInterval} Wo.)</span>
                        )}
                    </div>
                )}
                <button className="unpark-btn" onClick={handleUnpark}>
                    <i className="ti ti-player-play" aria-hidden="true" />
                    Wieder in Arbeit
                </button>
            </div>
          ) : (
            <div className="park-section">
                {!showParkModal ? (
                    <button className="park-btn" onClick={() => setShowParkModal(true)}>
                        <i className="ti ti-parking" aria-hidden="true" />
                        Zurückstellen
                    </button>
                ) : (
                    <div className="park-modal">
                        <div className="park-modal-title">Zurückstellen – wann erinnern?</div>
                        <div className="park-interval-options">
                            {([1, 2, 3, 4] as const).map(w => (
                                <button
                                    key={w}
                                    className="park-interval-btn"
                                    onClick={() => handleParkConfirm(w)}
                                >
                                    {w} {w === 1 ? 'Woche' : 'Wochen'}
                                </button>
                            ))}
                        </div>
                        <button className="park-confirm-btn" onClick={() => handleParkConfirm(null)}>
                            <i className="ti ti-parking" aria-hidden="true" style={{ marginRight: 4 }} />
                            Ohne Erinnerung zurückstellen
                        </button>
                    </div>
                )}
            </div>
          )}
        </div>
      )}
      </div>
      {viewingImageSrc && (
          <div className="lightbox-overlay" onClick={() => setViewingImageSrc(null)}>
              <button className="lightbox-close-btn" onClick={() => setViewingImageSrc(null)}><XIcon /></button>
              <div className="lightbox-content-wrapper" onClick={e => e.stopPropagation()}>
                <img src={viewingImageSrc} alt="Vergrößerte Ansicht" className="lightbox-image" />
                 <a
                    href={viewingImageSrc}
                    download={`ticket-${ticket.id}-photo.jpeg`}
                    className="lightbox-download-btn"
                  >
                    <DocumentArrowDownIcon />
                    Herunterladen
                  </a>
              </div>
          </div>
      )}
    </>
  );
};

export default TicketDetailSidebar;