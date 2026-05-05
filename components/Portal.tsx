import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Ticket, Priority, Role, User, AppSettings, Status } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { SearchIcon } from './icons/SearchIcon';
import { UserIcon } from './icons/UserIcon';
import { CameraIcon } from './icons/CameraIcon';
import { XIcon } from './icons/XIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { KeyIcon } from './icons/KeyIcon';
import { CheckBadgeIcon } from './icons/CheckBadgeIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import ModernDashboard from './ModernDashboard';

const CalendarIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const LOCAL_STORAGE_KEY = 'facility-management-tickets';
const DRAFT_STORAGE_KEY = 'facility-management-ticket-draft';

type PortalView = 'menu' | 'erfassen' | 'pruefen' | 'status-result' | 'success' | 'techniker-login' | 'admin-login' | 'login-selection';

interface PortalProps {
  appSettings: AppSettings;
  onLogin: (user: User) => void;
  tickets: Ticket[];
  locations: string[];
  onAddTicket: (newTicket: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority }) => string;
  onUpdateTicket: (ticket: Ticket) => void;
  users: User[];
  /** true, wenn Firebase/Init abgeschlossen – für Deep-Link ?ticket= aus E-Mail */
  dataReady: boolean;
}

const formatNote = (note: string) => {
    const noteRegex = /^(.*)\s\((.*)\s(?:am\s)?(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s(\d{2}:\d{2})(?::\d{2})?\)$/;
    const match = note.match(noteRegex);
    if (match) {
        const [, mainText, user, dateStr, time] = match;
        const [day, month, year] = dateStr.split('.');
        const formattedDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
        const metaText = `(${user} ${formattedDate} ${time})`;
        return <><span className="note-main-text">{mainText}</span><span className="note-meta">{metaText}</span></>;
    }
    return <span className="note-main-text">{note}</span>;
};

const getSuggestedDueDate = (priority: Priority, rules: Record<Priority, number>): string => {
    const date = new Date();
    const daysToAdd = rules[priority] || 7; // Default to 7 days if rule not found
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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
                resolve(canvas.toDataURL('image/jpeg', 0.4));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const NewTicketForm: React.FC<{
    locations: string[];
    onAddTicket: (newTicket: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority }) => string;
    setView: (view: PortalView) => void;
    setNewlyCreatedTicketId: (id: string) => void;
    appSettings: AppSettings;
}> = ({ locations, onAddTicket, setView, setNewlyCreatedTicketId, appSettings }) => {
    const [formState, setFormState] = useState(() => {
        try {
            const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (savedDraft) {
                const draft = JSON.parse(savedDraft);
                return draft;
            }
        } catch (e) { console.error("Could not load draft", e); }
        
        return {
            reporter: '', reporter_email: '', area: '', location: '', title: '',
            description: '', wunschTermin: '',
            photos: [] as string[]
        };
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formState));
    }, [formState]);

    const photoRules = useMemo(() => {
        const recommended = ['Wäscherei', 'Küche', 'Haustechnik', 'Brandschutz', 'Sicherheit'];
        if (recommended.includes(formState.area)) return { mode: 'recommended', text: '' };
        return { mode: 'optional', text: '' };
    }, [formState.area]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formState.area) newErrors.area = 'Standort ist ein Pflichtfeld.';
        if (formState.title.length < 6) newErrors.title = 'Betreff muss mindestens 6 Zeichen lang sein.';
        if (!formState.location.trim()) newErrors.location = 'Raum / Bereich ist ein Pflichtfeld.';
        if (!formState.description.trim()) newErrors.description = 'Beschreibung ist ein Pflichtfeld.';
        if (formState.reporter.trim().length < 2) newErrors.reporter = 'Gemeldet von muss mindestens 2 Zeichen lang sein.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (formState.photos.length >= 3) {
            alert("Maximal 3 Fotos erlaubt."); return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("Datei ist zu groß."); return;
        }

        try {
            const compressedDataUrl = await compressImage(file);
            if (compressedDataUrl.length > 4 * 1024 * 1024) {
                 alert("Komprimiertes Bild ist zu groß (max 4MB)."); return;
            }
            setFormState(prev => ({ ...prev, photos: [...prev.photos, compressedDataUrl] }));
        } catch (error) {
            console.error("Fehler bei der Bildkomprimierung:", error);
            alert("Fehler bei der Bildverarbeitung.");
        }
    };
    
    const handleRemovePhoto = (index: number) => {
        setFormState(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const formattedWunschTermin = formState.wunschTermin
            ? formState.wunschTermin.split('-').reverse().join('.')
            : undefined;

        const newTicketId = onAddTicket({
            ticketType: 'reactive',
            title: formState.title, area: formState.area, location: formState.location,
            reporter: formState.reporter, reporter_email: formState.reporter_email, dueDate: '', // Will be auto-calculated
            technician: 'N/A',
            description: formState.description,
            categoryId: appSettings.ticketCategories[0]?.id || '',
            wunschTermin: formattedWunschTermin, photos: formState.photos, notes: [],
        });

        setNewlyCreatedTicketId(newTicketId);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setView('success');
    };
    
    return (
        <>
            <div className="modern-form-header">
                <button type="button" className="back-btn-white" onClick={() => setView('menu')}><ArrowLeftIcon /></button>
                <h2>Meldung<br/>erstellen</h2>
                <div className="header-spacer-small" />
            </div>
            <div className="portal-form">
                <div className="form-group">
                    <label>Standort*</label>
                    <select value={formState.area} onChange={e => setFormState(p => ({...p, area: e.target.value}))}>
                        <option value="" disabled>Bitte wählen...</option>
                        {locations.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                 <div className="form-group">
                    <label>Raum / Bereich*</label>
                    <input type="text" placeholder="z.B. Zimmer 100" value={formState.location} onChange={e => setFormState(p => ({...p, location: e.target.value}))} />
                    {errors.location && <span className="error-text">{errors.location}</span>}
                </div>
                <div className="form-group">
                    <label>Betreff*</label>
                    <input type="text" placeholder="Worum geht es?" value={formState.title} onChange={e => setFormState(p => ({...p, title: e.target.value}))} />
                    {errors.title && <span className="error-text">{errors.title}</span>}
                </div>
                <div className="form-group">
                    <label>Beschreibung*</label>
                    <textarea placeholder="Bitte so genau wie möglich beschreiben." rows={5} value={formState.description} onChange={e => setFormState(p => ({...p, description: e.target.value}))}></textarea>
                    {errors.description && <span className="error-text">{errors.description}</span>}
                </div>
                 <div className="form-group">
                    <label>Foto hinzufügen {photoRules.mode !== 'optional' && '*'}</label>
                    <div className="photo-upload-area">
                        {formState.photos.map((photo, index) => (
                            <div key={index} className="photo-preview">
                                <img src={photo} alt={`Vorschau ${index + 1}`} />
                                <button className="remove-photo-btn" onClick={() => handleRemovePhoto(index)}><XIcon /></button>
                            </div>
                        ))}
                        {formState.photos.length < 3 && (
                            <div className="photo-buttons">
                                <button className="portal-btn btn-secondary" onClick={() => cameraInputRef.current?.click()}>
                                    <CameraIcon /> Foto aufnehmen
                                </button>
                                <button className="portal-btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                    Aus Galerie wählen
                                </button>
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                            </div>
                        )}
                    </div>
                     {photoRules.text && <span className={`info-text ${photoRules.mode}`}>{photoRules.text}</span>}
                     {errors.photos && <span className="error-text">{errors.photos}</span>}
                </div>
                <div className="form-group">
                    <label>Gemeldet von*</label>
                    <input type="text" placeholder="Vor- und Nachname" value={formState.reporter} onChange={e => setFormState(p => ({...p, reporter: e.target.value}))} />
                    {errors.reporter && <span className="error-text">{errors.reporter}</span>}
                </div>
                <div className="form-group">
                    <label>E-Mail-Adresse (optional)</label>
                    <input type="email" placeholder="ihre.adresse@beispiel.de" value={formState.reporter_email || ''} onChange={e => setFormState(p => ({...p, reporter_email: e.target.value}))} />
                </div>
                 <div className="form-group">
                    <label>Wunsch-Termin (unverbindlich)</label>
                    <div onClick={() => { try { dateInputRef.current?.showPicker(); } catch (e) {} }} style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', background: '#f4f5f8', borderRadius: '12px', border: 'none', padding: '0 1.25rem', height: '52px', cursor: 'pointer' }} className="portal-date-wrapper">
                        <span style={{ color: formState.wunschTermin ? '#1f2937' : '#9ca3af', flex: 1, textAlign: 'left', pointerEvents: 'none', fontSize: '1rem' }}>
                            {formState.wunschTermin ? new Date(formState.wunschTermin).toLocaleDateString('de-DE') : 'Datum wählen...'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 11 }}>
                            {formState.wunschTermin && (
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFormState(p => ({...p, wunschTermin: ''})); }}
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--text-muted)',
                                        cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    <XIcon style={{ width: '16px', height: '16px' }} />
                                </button>
                            )}
                            <div style={{ color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                                <CalendarIcon size={20} />
                            </div>
                        </div>
                        <input 
                            ref={dateInputRef}
                            type="date" 
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                            value={formState.wunschTermin} 
                            onClick={(e) => { try { dateInputRef.current?.showPicker(); } catch (err) {} }}
                            onChange={e => setFormState(p => ({...p, wunschTermin: e.target.value}))} 
                        />
                    </div>
                </div>
                <div className="portal-actions">
                    <button className="portal-btn btn-primary" onClick={handleSubmit} style={{ whiteSpace: 'nowrap' }}>Meldung senden</button>
                </div>
            </div>
        </>
    );
};


const Portal: React.FC<PortalProps> = ({ appSettings, onLogin, tickets, locations, onAddTicket, onUpdateTicket, users, dataReady }) => {
  const [view, setView] = useState<PortalView>(() => {
    try {
      return new URLSearchParams(window.location.search).has('ticket') ? 'status-result' : 'menu';
    } catch {
      return 'menu';
    }
  });
  const [ticketIdInput, setTicketIdInput] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [newlyCreatedTicketId, setNewlyCreatedTicketId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteAdded, setNoteAdded] = useState(false);
  const [loginAttempt, setLoginAttempt] = useState({ name: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [copied, setCopied] = useState(false);
  const urlTicketFromQuery = useRef<string | null>(null);
  const urlTicketDeepLinkHandled = useRef(false);
  const isTicketDeepLink = useRef(false);

  useEffect(() => {
    if (urlTicketFromQuery.current !== null) return;
    const raw = new URLSearchParams(window.location.search).get('ticket')?.trim();
    if (!raw) return;
    isTicketDeepLink.current = true;
    let t = raw.toUpperCase();
    if (t.startsWith('M-')) t = t.substring(2);
    urlTicketFromQuery.current = t;
    // Direkt die Status-Ansicht zeigen, damit es keinen "Flash" vom Hauptmenü gibt.
    setView('status-result');
    const path = window.location.pathname || '/';
    window.history.replaceState({}, '', path);
  }, []);

  useEffect(() => {
    if (urlTicketDeepLinkHandled.current) return;
    const want = urlTicketFromQuery.current;
    if (!want || !dataReady) return;
    const hit = tickets.find((x) => x.id.toUpperCase() === want);
    setTicketIdInput(want);
    setFoundTicket(hit || null);
    setSearchError(hit ? null : `Ticket mit der ID "${want}" wurde nicht gefunden.`);
    setNoteAdded(false);
    setView('status-result');
    urlTicketDeepLinkHandled.current = true;
  }, [tickets, dataReady]);

  // Bei Deep-Link (aus E-Mail) erst rendern, wenn die Ticketdaten geladen sind.
  // So sieht der Nutzer keinen "kaputten" Zwischenzustand.
  if (isTicketDeepLink.current && !dataReady) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 18px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '4px solid rgba(0,0,0,0.15)',
              borderTopColor: 'var(--drk-red)',
              margin: '0 auto 14px',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Ticket wird geladen…</div>
          <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 14 }}>Bitte einen Moment warten.</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  const handleTicketPruefen = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setFoundTicket(null);
    setNoteAdded(false);
    
    let trimmedId = ticketIdInput.trim().toUpperCase();
    if (trimmedId.startsWith('M-')) {
        trimmedId = trimmedId.substring(2);
    }
    
    if (!trimmedId) {
        setSearchError('Bitte geben Sie eine Ticket-ID ein.');
        setView('status-result');
        return;
    }

    const ticket = tickets.find(t => t.id.toUpperCase() === trimmedId);
    
    if (ticket) {
      setFoundTicket(ticket);
    } else {
      setSearchError(`Ticket mit der ID "${trimmedId}" wurde nicht gefunden.`);
    }
    setView('status-result');
  };

  const handleTechnicianLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      const user = users.find(u => u.name.toLowerCase() === loginAttempt.name.toLowerCase() && u.password === loginAttempt.password && u.role === Role.Technician && u.isActive);
      if (user) {
          onLogin(user);
      } else {
          setLoginError('Anmeldedaten sind ungültig oder Konto inaktiv.');
      }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      const user = users.find(u => u.name.toLowerCase() === loginAttempt.name.toLowerCase() && u.password === loginAttempt.password && u.role === Role.Admin);
      if (user) {
          onLogin(user);
      } else {
          setLoginError('Anmeldedaten sind ungültig.');
      }
  };
  
  const handleAddNewNote = () => {
    if (!newNote.trim() || !foundTicket) return;

    const date = new Date();
    const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
    const noteTextWithMeta = `${newNote.trim()} (Melder am ${formattedDate}, ${formattedTime})`;

    const updatedNotes = [...(foundTicket.notes || []), noteTextWithMeta];
    const updatedTicket = { ...foundTicket, notes: updatedNotes, hasNewNoteFromReporter: true };
    
    onUpdateTicket(updatedTicket);
    setFoundTicket(updatedTicket); // Update local state to show new note immediately
    setNewNote('');
    setNoteAdded(true);
    setTimeout(() => setNoteAdded(false), 3000); // Hide message after 3 seconds
  };

  const handleReopenTicket = () => {
    if (!foundTicket) return;
    const date = new Date();
    const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
    let noteTextWithMeta = `Ticket durch Melder wiedereröffnet (am ${formattedDate}, ${formattedTime})`;
    if (newNote.trim()) {
        noteTextWithMeta = `Ticket durch Melder wiedereröffnet: "${newNote.trim()}" (am ${formattedDate}, ${formattedTime})`;
    }

    const updatedNotes = [...(foundTicket.notes || []), noteTextWithMeta];
    const updatedTicket = { ...foundTicket, status: Status.InArbeit, notes: updatedNotes, hasNewNoteFromReporter: true, is_reopened: true };

    onUpdateTicket(updatedTicket);
    setFoundTicket(updatedTicket);
    setNewNote('');
    setNoteAdded(true);
    setTimeout(() => setNoteAdded(false), 3000);
  };


  const resetAndGoToMenu = () => {
      setTicketIdInput(''); setFoundTicket(null); setSearchError(null); setNewlyCreatedTicketId(null); setView('menu');
  };

  const renderContent = () => {
    switch(view) {
      case 'erfassen':
        return (
            <NewTicketForm 
                locations={locations} 
                onAddTicket={onAddTicket} 
                setView={setView} 
                setNewlyCreatedTicketId={setNewlyCreatedTicketId}
                appSettings={appSettings}
            />
        );
      case 'pruefen':
        return (
          <form onSubmit={handleTicketPruefen}>
            <div className="portal-header condensed">
                <button type="button" className="back-btn" onClick={resetAndGoToMenu}><ArrowLeftIcon /></button>
                <h2 className="portal-subtitle">Status prüfen</h2>
                <div className="header-spacer" />
            </div>
            <div className="portal-form centered-form">
                <label>Bitte geben Sie Ihre Ticket-ID ein</label>
                <input type="text" placeholder="Beispiel: 31001" value={ticketIdInput} onChange={e => setTicketIdInput(e.target.value)} />
                 <button type="submit" className="portal-btn btn-primary">Status prüfen</button>
            </div>
          </form>
        );
       case 'techniker-login':
        return (
            <form onSubmit={handleTechnicianLogin}>
                <div className="portal-header condensed">
                    <button type="button" className="back-btn" onClick={resetAndGoToMenu}><ArrowLeftIcon /></button>
                    <h2 className="portal-subtitle">Anmeldung Haustechnik</h2>
                    <div className="header-spacer" />
                </div>
                <div className="portal-form">
                     <div className="form-group">
                        <label>Techniker</label>
                        <select value={loginAttempt.name} onChange={e => { setLoginAttempt(p => ({...p, name: e.target.value})); setLoginError(''); }}>
                            <option value="" disabled>Namen auswählen</option>
                            {users.filter(t => t.isActive && t.role === Role.Technician).map(tech => (
                                <option key={tech.id} value={tech.name}>
                                    {tech.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Passwort</label>
                        <input type="password" value={loginAttempt.password} onChange={e => { setLoginAttempt(p => ({...p, password: e.target.value})); setLoginError(''); }}/>
                    </div>
                    {loginError && <p className="error-text" style={{textAlign: 'center'}}>{loginError}</p>}
                </div>
                <div className="portal-actions">
                   <button type="submit" className="portal-btn btn-primary">Anmelden</button>
                </div>
            </form>
        );
       case 'admin-login':
        return (
            <form onSubmit={handleAdminLogin}>
                <div className="portal-header condensed">
                    <button type="button" className="back-btn" onClick={resetAndGoToMenu}><ArrowLeftIcon /></button>
                    <h2 className="portal-subtitle">Admin Anmeldung</h2>
                    <div className="header-spacer" />
                </div>
                 <div className="portal-form">
                     <div className="form-group">
                        <label>Benutzername</label>
                        <input type="text" value={loginAttempt.name} onChange={e => { setLoginAttempt(p => ({...p, name: e.target.value})); setLoginError(''); }}/>
                    </div>
                    <div className="form-group">
                        <label>Passwort</label>
                        <input type="password" value={loginAttempt.password} onChange={e => { setLoginAttempt(p => ({...p, password: e.target.value})); setLoginError(''); }}/>
                    </div>
                     {loginError && <p className="error-text" style={{textAlign: 'center'}}>{loginError}</p>}
                </div>
                <div className="portal-actions">
                    <button type="submit" className="portal-btn btn-primary">Anmelden</button>
                </div>
            </form>
        );
      case 'status-result':
        return (
            <>
                <div className="portal-header condensed">
                   <button className="back-btn" onClick={() => setView('pruefen')}><ArrowLeftIcon /></button>
                   <h2 className="portal-subtitle">Ticket-Status</h2>
                   <div className="header-spacer" />
                </div>
                <div style={{ overflowY: 'auto', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {!dataReady ? (
                        <p className="search-result-text">Lade Ticketdaten…</p>
                    ) : searchError ? (
                        <p className="search-result-text error">{searchError}</p>
                    ) : foundTicket && (
                      <>
                      <div className="status-result-box">
                        <div className="status-result-id">{foundTicket.id}</div>
                        <div className="status-details-box">
                            <div className="status-detail-item"><strong>Status:</strong> <span className="status-detail-value">{foundTicket.status}</span></div>
                            <div className="status-detail-item"><strong>Betreff:</strong> <span className="status-detail-value">{foundTicket.title}</span></div>
                            <div className="status-detail-item"><strong>Techniker:</strong> <span className="status-detail-value">{foundTicket.technician === 'N/A' ? 'Noch nicht zugewiesen' : foundTicket.technician}</span></div>
                            <div className="portal-notes-container">
                                <p className="notes-title"><strong>Letzte Notizen:</strong></p>
                                {foundTicket.notes && foundTicket.notes.length > 0 ? (
                                    [...foundTicket.notes].reverse().slice(0, 3).map((note, index) => (
                                         <div className="portal-note-item" key={index}>{formatNote(note)}</div>
                                    ))
                                ) : <span className="no-notes">Keine Notizen vorhanden.</span>}
                            </div>
                        </div>
                      </div>
                      <div className="note-add-section" style={{ paddingBottom: '1rem' }}>
                        <label>Neue Notiz hinzufügen</label>
                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Schreiben Sie hier eine Nachricht an die Haustechnik..."></textarea>
                        
                        {foundTicket.status === Status.Abgeschlossen ? (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button className="portal-btn btn-primary" onClick={handleAddNewNote} disabled={!newNote.trim()}>Nachricht senden</button>
                                <button className="portal-btn" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none' }} onClick={handleReopenTicket}>
                                    Problem besteht weiter? Ticket wieder eröffnen
                                </button>
                           </div>
                        ) : (
                           <button className="portal-btn btn-primary" onClick={handleAddNewNote} disabled={!newNote.trim()}>Nachricht senden</button>
                        )}
                        
                        {noteAdded && <p className="note-added-success">Erfolgreich hinzugefügt!</p>}
                      </div>
                      </>
                    )}
                </div>
                <div className="portal-actions">
                    <button className="portal-btn btn-secondary" onClick={resetAndGoToMenu}>Zurück zum Hauptmenü</button>
                </div>
            </>
        );
       case 'success':
        return (
            <>
                <div className="success-content">
                    <div className="success-icon-wrapper">
                        <CheckBadgeIcon />
                    </div>
                    <h2 className="portal-subtitle" style={{position: 'static', transform: 'none'}}>Meldung erfolgreich gesendet!</h2>
                    <div className="success-message">
                        <p>Vielen Dank! Ihr Ticket wurde erfolgreich erstellt. Sofern Sie eine E-Mail-Adresse angegeben haben, erhalten Sie in Kürze eine Bestätigung. Bitte bewahren Sie die folgende ID für zukünftige Anfragen auf:</p>
                        <div className="success-ticket-id-wrapper">
                            <span className="success-ticket-id">{newlyCreatedTicketId}</span>
                            <button className="copy-btn" onClick={() => handleCopy(newlyCreatedTicketId)} title={copied ? 'Kopiert!' : 'In Zwischenablage kopieren'}>
                                {copied ? <CheckIcon style={{color: 'var(--accent-success)'}} /> : <ClipboardIcon />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="portal-actions">
                    <button className="portal-btn btn-primary" onClick={resetAndGoToMenu}>Zurück zum Hauptmenü</button>
                </div>
            </>
        );
       case 'login-selection':
        return (
            <>
                <div className="portal-header-compact">
                    <button className="back-btn" onClick={() => setView('menu')}><ArrowLeftIcon /></button>
                    <h2>Anmeldung wählen</h2>
                    <div />
                </div>
                <div className="portal-menu" style={{padding: '2rem 1.5rem'}}>
                    <button className="portal-menu-btn" onClick={() => setView('techniker-login')}>
                        <div className="btn-content">
                            <div className="btn-icon"><UserIcon /></div>
                            <div className="btn-text">
                                <span className="btn-title">Anmeldung Haustechnik</span>
                                <span className="btn-description">Zugang für technisches Personal</span>
                            </div>
                        </div>
                    </button>
                    <button className="portal-menu-btn" onClick={() => setView('admin-login')}>
                        <div className="btn-content">
                            <div className="btn-icon"><KeyIcon /></div>
                            <div className="btn-text">
                                <span className="btn-title">Admin Anmeldung</span>
                                <span className="btn-description">Systemverwaltung</span>
                            </div>
                        </div>
                    </button>
                </div>
            </>
        );
      case 'menu':
      default:
        return (
          <ModernDashboard 
            onReportIssue={() => setView('erfassen')}
            onCheckStatus={() => setView('pruefen')}
            onAdminLogin={() => setView('login-selection')}
          />
        );
    }
  };
  
    return (
        <div className="portal-container">
            <style>{`
                :root { --portal-max-width: 550px; }
                .portal-container { 
                    width: 100%; 
                    min-height: 100dvh; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    background-color: var(--bg-page); 
                    font-family: 'Inter', sans-serif; 
                    color: var(--text-primary); 
                    padding: 1rem; 
                    overflow: hidden; 
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .portal-container::-webkit-scrollbar {
                    display: none;
                }
                .portal-box { 
                    width: 100%; 
                    max-width: var(--portal-max-width); 
                    max-height: calc(100dvh - 2rem);
                    background: var(--bg-secondary); 
                    border-radius: 20px; 
                    box-shadow: var(--shadow-lg); 
                    border: 1px solid var(--border); 
                    display: flex; 
                    flex-direction: column; 
                    overflow: hidden; 
                    animation: fadeIn 0.4s ease-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 900px) {
                  .portal-container { 
                      padding: 0; 
                      align-items: flex-start; 
                      background-color: var(--bg-secondary);
                      height: 100dvh;
                  }
                  .portal-box { border-radius: 0; border: none; box-shadow: none; height: 100dvh; min-height: 100dvh; max-height: 100dvh; }
                }

                .portal-box.view-pruefen { max-width: 450px; }
                .portal-box.view-pruefen form { display: flex; flex-direction: column; flex-grow: 1; }
                
                /* Sub-Header style (Red Header as suggested in draft) */
                .modern-form-header { 
                    background-color: var(--drk-red); 
                    padding: 1.5rem; 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    gap: 1rem; 
                    flex-shrink: 0;
                }
                .modern-form-header h2 { font-size: 1.5rem; line-height: 1.2; font-weight: 700; margin: 0; flex-grow: 1; text-align: center; margin-right: 32px; }
                .back-btn-white { background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 50%; transition: background 0.2s; }
                .back-btn-white:hover { background: rgba(255,255,255,0.15); }
                .header-spacer-small { width: 32px; }

                /* Generic Portal Headers */
                .portal-header.condensed { 
                    padding: 1rem 1.5rem; 
                    display: grid; 
                    grid-template-columns: 44px 1fr 44px; 
                    align-items: center; 
                    border-bottom: 1px solid var(--border);
                    flex-shrink: 0;
                }
                .portal-header-compact {
                    padding: 1rem 1.5rem;
                    display: grid;
                    grid-template-columns: 44px 1fr 44px;
                    align-items: center;
                    border-bottom: 1px solid var(--border);
                    background: var(--bg-tertiary);
                    flex-shrink: 0;
                }
                .portal-header-compact h2 { font-size: 1.1rem; font-weight: 700; text-align: center; margin: 0; }
                .portal-subtitle { font-size: 1.1rem; font-weight: 700; text-align: center; margin: 0; }
                .back-btn { background: none; border: none; color: var(--text-primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
                .back-btn:hover { background: var(--bg-tertiary); }
                .header-spacer { width: 44px; }

                /* Form Styles */
                .portal-form { 
                    padding: 1.5rem; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 1.25rem; 
                    overflow-y: auto;
                    flex: 1 1 auto;
                    min-height: 0;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .portal-form::-webkit-scrollbar {
                    display: none;
                }
                .portal-form.centered-form { text-align: center; padding: 3rem 1.5rem; }
                .portal-form.centered-form label { margin-bottom: 1rem; display: block; font-weight: 500; }
                .portal-form.centered-form input { max-width: 300px; margin: 0 auto 1.5rem; text-align: center; font-size: 1.25rem; font-weight: 700; color: var(--drk-red); }
                
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .form-group label { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin-bottom: 0.1rem; }
                .portal-form input, .portal-form select, .portal-form textarea, .note-add-section textarea {
                    padding: 0.85rem 1.25rem;
                    border-radius: 12px;
                    border: none;
                    background: #f4f5f8;
                    font-size: 1rem;
                    color: #1f2937;
                    transition: all 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                    min-height: 52px;
                    font-family: inherit;
                    -webkit-appearance: none;
                    appearance: none;
                    margin: 0;
                }
                
                .portal-form select {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 1.25rem center;
                    background-size: 1.25rem;
                    padding-right: 3rem;
                }
                .portal-form input::placeholder, .portal-form textarea::placeholder, .note-add-section textarea::placeholder {
                    color: #9ca3af;
                }
                .portal-form input:focus, .portal-form select:focus, .portal-form textarea:focus, .note-add-section textarea:focus, .portal-date-wrapper:focus-within {
                    outline: none;
                    background: #eef1f6;
                    box-shadow: inset 0 0 0 2px rgba(179, 0, 12, 0.15);
                }
                .portal-date-wrapper {
                    transition: all 0.2s;
                }

                .error-text { color: var(--accent-danger); font-size: 0.85rem; margin-top: 0.25rem; }
                .info-text { font-size: 0.85rem; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem; }
                .info-text.recommended { background: rgba(25, 135, 84, 0.1); color: var(--accent-success); }
                
                /* Action Areas */
                .portal-actions { padding: 1rem 1.5rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; flex-shrink: 0; background: var(--bg-secondary); border-top: 1px solid var(--bg-tertiary); }
                .portal-btn {
                    padding: 1rem;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    transition: all 0.2s;
                    border: none;
                    width: 100%;
                    -webkit-appearance: none;
                    appearance: none;
                    box-sizing: border-box;
                    margin: 0;
                }
                .btn-primary { background: var(--drk-red); color: white; box-shadow: 0 4px 12px rgba(179, 0, 12, 0.2); }
                .btn-primary:hover { background: var(--drk-red-light); transform: translateY(-1px); box-shadow: 0 6px 15px rgba(179, 0, 12, 0.3); }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                
                .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border); }
                .btn-secondary:hover { background: var(--border); }

                /* Photo Area */
                .photo-upload-area { display: flex; flex-wrap: wrap; gap: 0.75rem; }
                .photo-preview { position: relative; width: 80px; height: 80px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
                .photo-preview img { width: 100%; height: 100%; object-fit: cover; }
                .remove-photo-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .photo-buttons { display: flex; gap: 0.5rem; width: 100%; align-items: stretch; }
                .photo-buttons .portal-btn { 
                    flex: 1 1 0%; 
                    padding: 0.6rem 0.5rem; 
                    font-size: 0.85rem; 
                    border-radius: 8px; 
                    border: 1px solid #e5e7eb; 
                    background: #f9fafb; 
                    color: #4b5563; 
                    min-height: auto; 
                    font-weight: 500; 
                    gap: 0.4rem;
                }
                .photo-buttons .portal-btn svg { width: 16px; height: 16px; stroke-width: 2px; }
                .photo-buttons .portal-btn:hover { background: #f3f4f6; border-color: #d1d5db; }

                /* Success & Result States */
                .success-content { padding: 3rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
                .success-icon-wrapper { color: var(--accent-success); }
                .success-icon-wrapper svg { width: 64px; height: 64px; }
                .success-ticket-id-wrapper { background: var(--bg-tertiary); padding: 1rem 1.5rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; margin: 1rem 0; width: 100%; justify-content: center; border: 2px dashed var(--border); }
                .success-ticket-id { font-size: 1.75rem; font-weight: 800; color: var(--drk-red); font-family: monospace; letter-spacing: 2px; }
                .copy-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .copy-btn svg { width: 24px; height: 24px; }
                .copy-btn:hover { background: white; color: var(--drk-red); }

                /* Result Details */
                .status-result-box { padding: 1.5rem; }
                .status-result-id { font-size: 1.5rem; font-weight: 800; color: var(--drk-red); text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--bg-tertiary); }
                .search-result-text.error { text-align: center; padding: 2rem 1.5rem; color: var(--text-secondary); width: 100%; display: block; }
                .status-details-box { display: flex; flex-direction: column; gap: 1rem; }
                .status-detail-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid var(--bg-tertiary); }
                .status-detail-item strong { color: var(--text-secondary); font-size: 0.9rem; }
                .status-detail-value { font-weight: 600; }
                
                .portal-notes-container { margin-top: 1rem; }
                .notes-title { font-size: 0.9rem; margin-bottom: 0.75rem; display: block; }
                .portal-note-item { background: var(--bg-tertiary); padding: 0.75rem; border-radius: 8px; font-size: 0.9rem; margin-bottom: 0.5rem; }
                .note-meta { display: block; font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 0.25rem; font-style: italic; }
                
                .note-add-section { padding: 1.5rem; border-top: 2px solid var(--bg-tertiary); display: flex; flex-direction: column; gap: 1rem; }
                .note-add-section label { font-weight: 600; font-size: 0.9rem; }

                /* Menu & Selection */
                .portal-menu { display: flex; flex-direction: column; gap: 1rem; }
                .portal-menu-btn { 
                    background: white; 
                    border: 1px solid var(--border); 
                    border-radius: 16px; 
                    padding: 1.25rem; 
                    text-align: left; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                }
                .portal-menu-btn:hover { border-color: var(--drk-red); transform: translateY(-2px); box-shadow: var(--shadow-md); }
                .btn-content { display: flex; align-items: center; gap: 1rem; }
                .btn-icon { color: var(--drk-red); background: rgba(179, 0, 12, 0.05); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .btn-text { display: flex; flex-direction: column; }
                .btn-title { font-weight: 700; font-size: 1.05rem; }
                .btn-description { font-size: 0.85rem; color: var(--text-muted); }
            `}</style>
            {view === 'menu' ? (
                renderContent()
            ) : (
                <div className={`portal-box view-${view}`}>
                    {renderContent()}
                </div>
            )}
        </div>
    );
};

export default Portal;