import React from 'react';
import { Ticket, Status } from '../types';
import { XIcon } from './icons/XIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';

interface BulkActionBarProps {
  selectedCount: number;
  technicians: string[];
  statuses: (Status | 'N/A')[];
  onBulkUpdate: (property: keyof Ticket, value: any) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({ 
    selectedCount, 
    technicians, 
    statuses, 
    onBulkUpdate, 
    onBulkDelete, 
    onClearSelection 
}) => {

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) {
            onBulkUpdate('status', value as Status);
        }
    };
    
    const handleTechnicianChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) {
            onBulkUpdate('technician', value);
        }
    };

    const ActionSelect: React.FC<{
        icon: React.ReactNode;
        label: string;
        defaultValue: string;
        options: string[];
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    }> = ({ icon, label, defaultValue, options, onChange }) => (
         <div className="action-select-wrapper">
            {icon}
            <select onChange={onChange} value="">
                <option value="" disabled>{label}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt === Status.Abgeschlossen ? 'Abschließen' : opt}</option>)}
            </select>
        </div>
    );

    return (
        <div className="bulk-action-bar">
            <style>{`
                .bulk-action-bar {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 1rem 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    transition: var(--transition-smooth);
                    margin-bottom: -1px; /* Overlap the top border of the table */
                    animation: slideInDown 0.3s ease-out;
                }
                @keyframes slideInDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .selection-info {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                 .selection-count {
                    background: var(--accent-primary);
                    color: white;
                    border-radius: 6px;
                    padding: 0.25rem 0.75rem;
                }
                .clear-selection-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-muted);
                    padding: 0.25rem;
                }
                .clear-selection-btn:hover {
                    color: var(--text-primary);
                }
                .clear-selection-btn svg { width: 20px; height: 20px; }
                
                .actions-group {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-left: 1.5rem;
                    border-left: 1px solid var(--border);
                    padding-left: 1.5rem;
                }

                .action-select-wrapper {
                    position: relative;
                    color: var(--text-secondary);
                }
                .action-select-wrapper svg {
                    position: absolute;
                    left: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 18px;
                    height: 18px;
                    pointer-events: none;
                }
                .action-select-wrapper select {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    padding: 0.5rem 0.75rem 0.5rem 2.5rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    -webkit-appearance: none;
                    appearance: none;
                    min-width: 180px;
                }

                .delete-btn {
                    margin-left: auto;
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--accent-danger);
                    font-size: 0.9rem;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: var(--transition-smooth);
                }
                .delete-btn:hover {
                    background: rgba(220, 53, 69, 0.1);
                    border-color: var(--accent-danger);
                }
            `}</style>
            <div className="selection-info">
                <span className="selection-count">{selectedCount}</span>
                <span>Ticket{selectedCount > 1 ? 's' : ''} ausgewählt</span>
                <button title="Auswahl aufheben" className="clear-selection-btn" onClick={onClearSelection}>
                    <XIcon />
                </button>
            </div>
            <div className="actions-group">
                <ActionSelect 
                    icon={<PencilSquareIcon />}
                    label="Status ändern..."
                    defaultValue=""
                    options={statuses}
                    onChange={handleStatusChange}
                />
                 <ActionSelect 
                    icon={<UserGroupIcon />}
                    label="Techniker zuweisen..."
                    defaultValue=""
                    options={technicians}
                    onChange={handleTechnicianChange}
                />
            </div>
            <button className="delete-btn" onClick={onBulkDelete}>
                <TrashIcon />
                Löschen
            </button>
        </div>
    );
};

export default BulkActionBar;