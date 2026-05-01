import React, { useState, useEffect } from 'react';
import { User, Role, AvailabilityStatus } from '../types';

interface UserModalProps {
  user: Partial<User> | null;
  allSkills: string[];
  onClose: () => void;
  onSave: (user: User) => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, allSkills, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [skills, setSkills] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({ ...user, password: '' });
      setSkills(user.skills?.join(', ') || '');
    } else {
      setFormData({
        name: '',
        role: Role.Technician,
        password: '',
        isActive: true,
        availability: { status: AvailabilityStatus.Available, leaveUntil: null }
      });
      setSkills('');
    }
  }, [user]);

  const isNewUser = !user?.id;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAvailabilityChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({
          ...prev,
          availability: { ...(prev.availability || {}), [name]: value } as User['availability']
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert("Name ist ein Pflichtfeld.");
      return;
    }
    
    // Ensure availability is set
    const finalAvailability = formData.availability || { status: AvailabilityStatus.Available, leaveUntil: null };
    
    const finalSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
    const userToSave = { ...formData, skills: finalSkills, availability: finalAvailability } as User;
    
    console.log("UserModal saving:", userToSave);
    onSave(userToSave);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <style>{`
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
        .modal-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .form-group { display: flex; flex-direction: column; }
        .full-width { grid-column: 1 / -1; }
        .form-group label {
            margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 500;
            color: var(--text-secondary);
        }
        .form-group input, .form-group select {
            width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border);
            background: var(--bg-primary); font-size: 0.95rem; color: var(--text-primary);
            transition: var(--transition-smooth);
        }
        .form-group input:focus, .form-group select:focus {
            outline: none; border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        .form-actions {
            grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
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
        <h2>{isNewUser ? 'Neuen Benutzer erstellen' : 'Benutzer bearbeiten'}</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group full-width">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="role">Rolle</label>
            <select id="role" name="role" value={formData.role} onChange={handleChange}>
              <option value={Role.Technician}>Techniker</option>
              <option value={Role.Admin}>Admin</option>
            </select>
          </div>
           <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input id="password" name="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder={isNewUser ? '' : 'Leer lassen, um nicht zu ändern'} />
          </div>
          <div className="form-group full-width">
            <label htmlFor="skills">Skills (Komma-getrennt)</label>
            <input id="skills" name="skills" type="text" value={skills} onChange={e => setSkills(e.target.value)} list="skills-datalist" placeholder="z.B. Elektrik, Sanitär, HLK" />
            <datalist id="skills-datalist">
                {allSkills.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label htmlFor="availability-status">Verfügbarkeit</label>
            <select id="availability-status" name="status" value={formData.availability?.status || ''} onChange={handleAvailabilityChange}>
              {Object.values(AvailabilityStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="availability-leaveUntil">Abwesend bis</label>
            <input id="availability-leaveUntil" name="leaveUntil" type="date" value={formData.availability?.leaveUntil || ''} onChange={handleAvailabilityChange} disabled={formData.availability?.status !== AvailabilityStatus.OnLeave} />
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

export default UserModal;
