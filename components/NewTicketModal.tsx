import React, { useState, useRef, useMemo } from 'react';
import { Ticket, Priority, User, AppSettings, AvailabilityStatus } from '../types';
import { CameraIcon } from './icons/CameraIcon';
import { displayNameShort } from '../utils/displayNames';
import { XIcon } from './icons/XIcon';

interface NewTicketModalProps {
  onClose: () => void;
  onSave: (newTicket: Omit<Ticket, 'id' | 'entryDate' | 'status' | 'priority'> & { priority?: Priority }) => void;
  locations: string[];
  technicians: User[];
  appSettings: AppSettings;
  compressImage: (file: File) => Promise<string>;
}

const NewTicketModal: React.FC<NewTicketModalProps> = ({ onClose, onSave, locations, technicians, appSettings, compressImage }) => {
  const techniciansSorted = useMemo(
    () => [...technicians].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [technicians]
  );

  const [title, setTitle] = useState('');
  const [area, setArea] = useState(locations[0] || '');
  const [location, setLocation] = useState('');
  const [reporter, setReporter] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [technician, setTechnician] = useState('N/A');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (photos.length >= 3) {
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
            setPhotos(prev => [...prev, compressedDataUrl]);
        } catch (error) {
            console.error("Fehler bei der Bildkomprimierung:", error);
            alert("Fehler bei der Bildverarbeitung.");
        }
    };
    
    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
        alert('Bitte einen Titel angeben.');
        return;
    }

    const emailTrim = reporterEmail.trim();
    onSave({
      ticketType: 'reactive',
      title,
      area,
      location,
      reporter,
      ...(emailTrim ? { reporter_email: emailTrim } : {}),
      technician,
      categoryId: appSettings.ticketCategories[0]?.id || '',
      description,
      photos,
      notes: [],
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
        <style>{`
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                overflow: hidden;
            }
            .modal-content {
                background: var(--bg-secondary);
                padding: 1.5rem;
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                width: 90%;
                max-width: 600px;
                z-index: 1001;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .modal-content h2 {
                margin-top: 0;
                margin-bottom: 1.5rem;
                font-size: 1.5rem;
                color: var(--text-primary);
                flex-shrink: 0;
            }
            .modal-form {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.25rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                margin-right: -0.5rem;
                flex: 1 1 auto;
                min-height: 0;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            .modal-form::-webkit-scrollbar {
                display: none;
            }
            .form-group {
                display: flex;
                flex-direction: column;
            }
            .form-group.full-width {
                grid-column: 1 / -1;
            }
            .form-group label {
                margin-bottom: 0.35rem;
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-secondary);
                min-height: 1.5rem;
                display: flex;
                align-items: flex-start;
            }
            /* Eine Zeile: „Gemeldet von“ + „E-Mail“ in derselben Grid-Zeile, Inputs bündig */
            .form-group.form-group--pair label {
                white-space: nowrap;
                min-height: 1.35rem;
                align-items: center;
            }
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 0.5rem 0.75rem;
                height: 38px;
                border-radius: 8px;
                border: 1px solid var(--border);
                background: var(--bg-primary);
                font-size: 0.9rem;
                color: var(--text-primary);
                font-family: 'Geist', sans-serif;
                transition: var(--transition-smooth);
            }
            .form-group textarea {
                height: auto;
                min-height: 90px;
            }
            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
                outline: none;
                border-color: var(--accent-primary);
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
            }
            .form-actions {
                grid-column: 1 / -1;
                display: flex;
                justify-content: flex-end;
                gap: 1rem;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border);
                flex-shrink: 0;
            }
            .btn {
                padding: 0.6rem 1.25rem;
                border-radius: 8px;
                font-weight: 500;
                font-size: 0.9rem;
                cursor: pointer;
                transition: var(--transition-smooth);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                border: 1px solid transparent;
                -webkit-appearance: none;
                appearance: none;
            }
            .btn-secondary {
                background-color: var(--bg-tertiary);
                border-color: var(--border);
                color: var(--text-secondary);
            }
            .btn-secondary:hover {
                background-color: var(--border);
                color: var(--text-primary);
            }
            .btn-primary {
                background-color: var(--accent-primary);
                border-color: var(--accent-primary);
                color: white;
            }
            .btn-primary:hover { opacity: 0.9; }

            .photo-upload-area { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
            .photo-preview { position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
            .photo-preview img { width: 100%; height: 100%; object-fit: cover; }
            .remove-photo-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
            .remove-photo-btn svg { width: 14px; height: 14px; }
            .photo-buttons { display: flex; gap: 0.5rem; width: 100%; align-items: stretch; }
            .photo-buttons .btn { flex: 1 1 0%; font-size: 0.82rem; padding: 0.5rem 0.25rem; min-width: 0; white-space: normal; line-height: 1.2; text-align: center; }
            .photo-buttons svg { width: 16px; height: 16px; flex-shrink: 0; }

            @media (max-width: 600px) {
                .modal-content {
                    width: 100vw;
                    height: 100%;
                    max-height: 100%;
                    border-radius: 0;
                    padding: 1.5rem 1.25rem;
                }
                .modal-form {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                .form-actions {
                    flex-direction: column;
                }
                .form-actions .btn {
                    width: 100%;
                }
                .form-group label {
                    min-height: auto;
                    margin-bottom: 0.2rem;
                }
            }
        `}</style>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Neues Ticket</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="area">Standort</label>
                <select id="area" value={area} onChange={e => setArea(e.target.value)}>
                    {locations.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
             <div className="form-group">
                <label htmlFor="location">Raum / Bereich</label>
                <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="form-group full-width">
                <label htmlFor="title">Betreff</label>
                <input id="title" type="text" placeholder="Worum geht es?" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
             <div className="form-group full-width">
                <label htmlFor="description">Beschreibung</label>
                <textarea id="description" rows={3} placeholder="Bitte so genau wie möglich beschreiben." value={description} onChange={e => setDescription(e.target.value)}></textarea>
            </div>
            <div className="form-group full-width">
                <label>Foto hinzufügen</label>
                <div className="photo-upload-area">
                    {photos.map((photo, index) => (
                        <div key={index} className="photo-preview">
                            <img src={photo} alt={`Vorschau ${index + 1}`} />
                            <button type="button" className="remove-photo-btn" onClick={() => handleRemovePhoto(index)}><XIcon /></button>
                        </div>
                    ))}
                    {photos.length < 3 && (
                        <div className="photo-buttons">
                            <button type="button" className="btn btn-secondary" onClick={() => cameraInputRef.current?.click()}>
                                <CameraIcon /> Foto aufnehmen
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                Aus Galerie wählen
                            </button>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                        </div>
                    )}
                </div>
            </div>
            <div className="form-group form-group--pair">
                <label htmlFor="reporter">Gemeldet von</label>
                <input id="reporter" type="text" placeholder="Vor- und Nachname" value={reporter} onChange={e => setReporter(e.target.value)} />
            </div>
            <div className="form-group form-group--pair">
                <label htmlFor="reporter-email" title="Optional, für Benachrichtigungen">
                  E-Mail
                </label>
                <input
                  id="reporter-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  title="Optional, für Benachrichtigungen"
                />
            </div>
            <div className="form-group">
                <p
                    style={{
                        margin: 0,
                        fontSize: '0.88rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.45,
                        padding: '0.65rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                    }}
                >
                    <strong>Fälligkeit</strong> wird automatisch gesetzt: ohne Wunschtermin{' '}
                    <strong>5 Kalendertage nach Eingang</strong>, sofern für die Kategorie keine kürzere Frist aus der{' '}
                    <strong>SLA-Matrix</strong> gilt.
                </p>
            </div>
            <div className="form-group">
                <label htmlFor="technician">Zugewiesen (Standard: nicht zugewiesen; optional einen Bearbeiter wählen)</label>
                <select id="technician" value={technician} onChange={e => setTechnician(e.target.value)}>
                    <option value="N/A">Nicht zugewiesen</option>
                    {techniciansSorted.map(t => (
                        <option
                            key={t.name}
                            value={t.name}
                            title={t.name}
                            disabled={t.availability.status === AvailabilityStatus.OnLeave}
                        >
                            {displayNameShort(t.name)}{' '}
                            {t.availability.status === AvailabilityStatus.OnLeave ? '(Abwesend)' : ''}
                        </option>
                    ))}
                </select>
            </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" className="btn btn-primary">Ticket speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTicketModal;