import React, { useState } from 'react';
import { Ticket, Status } from '../types';
import TicketCard from './TicketCard';

interface KanbanColumnProps {
  title: string;
  status: Status;
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onDropTicket: (ticketId: string, newStatus: Status) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
}

const EmptyStateIcon: React.FC<{ kind: 'ok' | 'idle' }> = ({ kind }) => {
    if (kind === 'idle') {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M8 12h8"></path>
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M8.5 12.5l2.4 2.4L15.5 10.3"></path>
        </svg>
    );
};

const emptyCopyForStatus = (status: Status) => {
    switch (status) {
        case Status.Offen:
            return { kind: 'ok' as const, text: 'Keine offenen Tickets' };
        case Status.InArbeit:
            return { kind: 'idle' as const, text: 'Keine Tickets in Arbeit' };
        case Status.Ueberfaellig:
            return { kind: 'ok' as const, text: 'Alles im grünen Bereich' };
        default:
            return { kind: 'idle' as const, text: 'Keine Tickets' };
    }
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, status, tickets, onUpdateTicket, onDropTicket, onSelectTicket, selectedTicket }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const statusKey =
        status === Status.Offen ? 'offen' : status === Status.InArbeit ? 'inarbeit' : status === Status.Ueberfaellig ? 'ueberfaellig' : 'other';

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const ticketId = e.dataTransfer.getData("ticketId");
        if (ticketId) {
            onDropTicket(ticketId, status);
        }
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    return (
        <div 
            className={`board-column ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
             <style>{`
                .board-column {
                    background-color: transparent;
                    border-radius: 8px;
                    transition: background-color 0.2s ease-in-out;
                }
                .board-column.drag-over {
                    background-color: var(--bg-tertiary);
                }
                .column-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 0.5rem 1rem 0.5rem;
                    border-bottom: 2px solid var(--border);
                }
                .column-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .column-count {
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 600;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    transition: var(--transition-smooth);
                }
                .column-count.count-offen {
                    background: rgba(108, 117, 125, 0.14);
                    color: var(--text-muted);
                }
                .column-count.count-inarbeit {
                    background: rgba(13, 110, 253, 0.14);
                    color: var(--accent-inprogress);
                }
                .column-count.count-ueberfaellig {
                    background: rgba(220, 53, 69, 0.14);
                    color: var(--accent-danger);
                }
                .column-body {
                    padding-top: 1.5rem;
                    height: calc(100vh - 250px);
                    overflow-y: auto;
                }
                 .column-body::-webkit-scrollbar { width: 6px; }
                 .column-body::-webkit-scrollbar-track { background: transparent; }
                 .column-body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
                 [data-theme="dark"] .column-body::-webkit-scrollbar-thumb { background: #444; }

                 @media (max-width: 768px) {
                    .column-body {
                        height: auto;
                        overflow-y: visible;
                    }
                 }

                .empty-state {
                    border: 2px dashed var(--border);
                    border-radius: 14px;
                    padding: 2.25rem 1.25rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    color: var(--text-muted);
                    background: rgba(255,255,255,0.55);
                }
                [data-theme="dark"] .empty-state {
                    background: rgba(36, 37, 38, 0.35);
                }
                .empty-state .empty-icon {
                    color: rgba(0,0,0,0.25);
                }
                [data-theme="dark"] .empty-state .empty-icon {
                    color: rgba(255,255,255,0.28);
                }
                .empty-state .empty-text {
                    font-weight: 600;
                    font-size: 0.95rem;
                }
            `}</style>
            <div className="column-header">
                <h2 className="column-title">{title}</h2>
                <span className={`column-count count-${statusKey}`}>{tickets.length}</span>
            </div>
            <div className="column-body">
                {tickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <EmptyStateIcon kind={emptyCopyForStatus(status).kind} />
                        </div>
                        <div className="empty-text">{emptyCopyForStatus(status).text}</div>
                    </div>
                ) : (
                    tickets.map(ticket => (
                        <TicketCard 
                            key={ticket.id} 
                            ticket={ticket} 
                            onUpdateTicket={onUpdateTicket}
                            onSelectTicket={onSelectTicket}
                            selectedTicket={selectedTicket}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default KanbanColumn;