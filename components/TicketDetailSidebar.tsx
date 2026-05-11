import React, { useState, useEffect } from 'react';
// FIX: Import User type to align with App state
import { Ticket, Status, Priority, Role, User, AppSettings, AvailabilityStatus } from '../types';
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

const TicketDetailSidebar: React.FC<TicketDetailSidebarProps> = ({ ticket, onClose, onUpdateTicket, users, statuses, currentUser, appSettings }) => {
    const [viewingImageSrc, setViewingImageSrc] = useState<string | null>(null);
    const [newNote, setNewNote] = useState('');

    // Filter service-team users from users (alphabetisch nach gespeichertem Namen)
    const technicians = users
      .filter(u => u.role === Role.Technician || u.role === Role.Housekeeping)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    useEffect(() => {
        // Mark note as read when opening details
        if (ticket.hasNewNoteFromReporter) {
            const timer = setTimeout(() => {
                onUpdateTicket({ ...ticket, hasNewNoteFromReporter: false });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [ticket, onUpdateTicket]);

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
    
    const handleToggleEmergency = () => {
        const isCurrentlyEmergency = !!ticket.is_emergency;
        let updatedTicket: Ticket = { ...ticket, is_emergency: !isCurrentlyEmergency };

        // If marking as emergency AND status is not final/overdue, set to Overdue
        if (!isCurrentlyEmergency && (ticket.status === Status.Offen || ticket.status === Status.InArbeit)) {
            updatedTicket.status = Status.Ueberfaellig;
        }

        onUpdateTicket(updatedTicket);
    };

    const priorityClasses = {
        [Priority.Hoch]: 'priority-high',
        [Priority.Mittel]: 'priority-medium',
        [Priority.Niedrig]: 'priority-low',
    };
    
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
                padding: 1rem 1.5rem; flex-shrink: 0;
            }
            .sidebar-title-compact {
                font-size: 1.1rem; font-weight: 600; color: var(--text-primary);
                display: flex; align-items: center; gap: 0.75rem;
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
            .close-btn svg { width: 24px; height: 24px; }
            
            .sidebar-body-compact {
                flex-grow: 1; overflow-y: auto; padding: 0.5rem 1.5rem 1.5rem;
            }
            .sidebar-body-compact::-webkit-scrollbar { width: 6px; }
            .sidebar-body-compact::-webkit-scrollbar-track { background: transparent; }
            .sidebar-body-compact::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            [data-theme="dark"] .sidebar-body-compact::-webkit-scrollbar-thumb { background: #555; }
            
            .detail-group { margin-bottom: 1rem; }
            
            .detail-label-compact {
                font-size: 0.75rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.25rem;
            }
            .detail-subject-text {
                font-size: 1rem; color: var(--text-primary); line-height: 1.4;
            }

            .auftrag-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem;
            }
            .grid-item-span-2 { grid-column: span 2; }
            
            .detail-value-compact, .editable-field-compact {
                font-size: 0.85rem; font-weight: 500; border-radius: var(--radius-md);
                height: 32px; display: flex; align-items: center; justify-content: flex-start;
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
            .notes-title-compact {
                font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;
            }
            .notes-list-compact { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
            .note-item-compact {
                background: var(--bg-tertiary); padding: 0.6rem 0.8rem; border-radius: var(--radius-md);
                font-size: 0.85rem; color: var(--text-primary); line-height: 1.5;
            }
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
                background-color: var(--accent-danger);
                color: white;
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
        `}</style>
        <div className="sidebar-header-compact">
            <h2 className="sidebar-title-compact">
                {ticket.is_emergency && <ExclamationTriangleIcon className="urgent-sidebar-icon" width={20} height={20} />}
                Ticket {ticket.id}
            </h2>
            <button className="close-btn" onClick={onClose}><XIcon /></button>
        </div>
        <div className="sidebar-body-compact">
            
            <div className="detail-group">
                <p className="detail-label-compact">Betreff</p>
                <p className="detail-subject-text">{ticket.title}</p>
            </div>

            {currentUser?.role === Role.Admin && (
              <div className="detail-group">
                {ticket.is_emergency ? (
                    <button
                        className="admin-action-btn is-emergency"
                        onClick={handleToggleEmergency}
                    >
                        Notfall-Markierung aufheben
                    </button>
                ) : (
                    <button
                        className="admin-action-btn not-emergency"
                        onClick={handleToggleEmergency}
                    >
                        Als Notfall markieren
                    </button>
                )}
              </div>
            )}

            <div className="auftrag-grid">
                <div className="grid-item">
                    <p className="detail-label-compact">Gemeldet von</p>
                    <p className="detail-value-compact">{ticket.reporter}</p>
                </div>
                <div className="grid-item">
                    <p className="detail-label-compact">Standort</p>
                    <p className="detail-value-compact">{ticket.area}</p>
                </div>
                <div className="grid-item grid-item-span-2">
                    <p className="detail-label-compact">Raum / Bereich</p>
                    <p className="detail-value-compact">{ticket.location}</p>
                </div>
                 <div className="grid-item">
                    <p className="detail-label-compact">Kategorie</p>
                     <div className="editable-field-compact">
                        <span>{categoryName}</span><ChevronDownIcon />
                        <select value={ticket.categoryId} onChange={(e) => handleFieldChange('categoryId', e.target.value)}>
                            {appSettings.ticketCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid-item">
                    <p className="detail-label-compact">Priorität</p>
                    <div className={`editable-field-compact ${priorityClasses[ticket.priority]}`}>
                        <span>{ticket.priority}</span><ChevronDownIcon />
                        <select value={ticket.priority} onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}>
                            {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="grid-item grid-item-span-2">
                    <p className="detail-label-compact">Status</p>
                    <div className="editable-field-compact" style={{ backgroundColor: statusBgColorMap[ticket.status], borderColor: `var(${statusColorMap[ticket.status]})`, color: `var(${statusColorMap[ticket.status]})` }}>
                        <span>{ticket.status}</span><ChevronDownIcon />
                        <select value={ticket.status} onChange={(e) => handleFieldChange('status', e.target.value as Status)}>
                            {statuses.map(s => <option key={s} value={s}>{s === Status.Abgeschlossen ? 'Abschließen' : s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid-item grid-item-span-2">
                    <p className="detail-label-compact">Bearbeiter</p>
                    <div className={`editable-field-compact`}>
                        <span>
                            {ticket.technician === 'N/A' ? 'Zuweisen' : displayNameShort(ticket.technician)}
                        </span>
                        <ChevronDownIcon />
                        <select value={ticket.technician} onChange={(e) => handleFieldChange('technician', e.target.value)}>
                            <option value="N/A">Zuweisen</option>
                            {technicians.map(t => (
                                <option key={t.id} value={t.name} disabled={t.availability.status === AvailabilityStatus.OnLeave}>
                                    {displayNameShort(t.name)}{' '}
                                    {t.availability.status === AvailabilityStatus.OnLeave ? '(Abwesend)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid-item">
                    <p className="detail-label-compact">Eingang</p>
                    <p className="detail-value-compact">{ticket.entryDate}</p>
                </div>
                <div className="grid-item">
                    <p className="detail-label-compact">Fällig bis</p>
                    <div className="editable-field-compact" style={ticket.status === Status.Ueberfaellig ? { borderColor: `var(${statusColorMap[Status.Ueberfaellig]})`, backgroundColor: statusBgColorMap[Status.Ueberfaellig] } : {}}>
                        <span>{ticket.dueDate}</span>
                        <input type="date" value={toInputDate(ticket.dueDate)} onChange={(e) => handleFieldChange('dueDate', fromInputDate(e.target.value))} />
                    </div>
                </div>
                {ticket.wunschTermin && <div className="grid-item"><p className="detail-label-compact">Wunsch-Termin</p><p className="detail-value-compact">{ticket.wunschTermin}</p></div>}
                {ticket.completionDate && (
                  <div className="grid-item">
                    <p className="detail-label-compact">Abgeschlossen am</p>
                    <p className="detail-value-compact">
                      {ticket.completionDate}
                      {ticket.completionTime ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.72rem',
                            fontWeight: 400,
                            color: 'var(--text-muted)',
                            marginTop: '0.2rem',
                            textAlign: 'left',
                          }}
                        >
                          {ticket.completionTime}
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}
            </div>

            {ticket.description && ticket.description.trim() && (
                <div className="description-box-compact">{ticket.description}</div>
            )}
             {ticket.photos && ticket.photos.length > 0 && (
                <div className="detail-group" style={{marginTop: '1rem'}}>
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
            
            <div className="notes-section">
                <h3 className="notes-title-compact">Notizen</h3>
                {ticket.notes && ticket.notes.length > 0 && (
                     <div className="notes-list-compact">
                        {[...ticket.notes].reverse().map((note, index) => (<div className="note-item-compact" key={index}>{formatNote(note)}</div>))}
                     </div>
                )}
                 <div className="new-note-form">
                    <textarea className="note-textarea-compact" rows={2} placeholder="Neue Notiz eingeben..." value={newNote} onChange={(e) => setNewNote(e.target.value)}></textarea>
                    <button className="add-note-btn-compact" onClick={handleAddNote} disabled={!newNote.trim()}>Notiz speichern</button>
                </div>
            </div>
        </div>
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