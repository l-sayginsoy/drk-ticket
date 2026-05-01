import React, { useState, useEffect } from 'react';
// FIX: Import 'Location' to resolve module export error, as AppArea is not a defined type.
import { Location } from '../types';

interface AreaModalProps {
  area: Partial<Location> | null;
  onClose: () => void;
  onSave: (area: Location) => void;
}

const AreaModal: React.FC<AreaModalProps> = ({ area, onClose, onSave }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(area?.name || '');
  }, [area]);

  const isNewArea = !area?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Name ist ein Pflichtfeld.");
      return;
    }
    onSave({ ...(area || {}), name: name.trim() } as Location);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <style>{`
        /* Re-using styles from UserModal for consistency */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6); display: flex; align-items: center;
            justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-content {
            background: var(--bg-secondary); padding: 2rem; border-radius: 12px;
            box-shadow: var(--shadow-lg); width: 90%; max-width: 500px;
            z-index: 1001;
        }
        .modal-content h2 {
            margin-bottom: 1.5rem; font-size: 1.5rem; color: var(--text-primary);
        }
        .modal-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-group { display: flex; flex-direction: column; }
        .form-group label {
            margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 500;
            color: var(--text-secondary);
        }
        .form-group input {
            width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border);
            background: var(--bg-primary); font-size: 0.95rem; color: var(--text-primary);
            transition: var(--transition-smooth);
        }
        .form-group input:focus {
            outline: none; border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        .form-actions {
            display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
        }
        .btn {
            padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 500; font-size: 0.9rem;
            cursor: pointer; transition: var(--transition-smooth); display: flex;
            align-items: center; gap: 0.5rem; border: 1px solid transparent;
        }
        .btn-secondary {
            background-color: var(--bg-tertiary); border-color: var(--border);
            color: var(--text-secondary);
        }
        .btn-secondary:hover { background-color: var(--border); color: var(--text-primary); }
        .btn-primary {
            background-color: var(--accent-primary); border-color: var(--accent-primary);
            color: white;
        }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{isNewArea ? 'Neuen Standort erstellen' : 'Standort bearbeiten'}</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name des Standorts</label>
            <input id="name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" className="btn btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AreaModal;