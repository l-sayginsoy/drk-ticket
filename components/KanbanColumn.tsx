import React, { useState } from 'react';
import { Ticket, Status, User } from '../types';
import TicketCard from './TicketCard';

interface KanbanColumnProps {
  title: string;
  status: Status;
  tickets: Ticket[];
  technicians?: User[];
  onUpdateTicket: (ticket: Ticket) => void;
  onDropTicket: (ticketId: string, newStatus: Status) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  panelEmbed?: boolean;
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

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  tickets,
  technicians: techniciansProp,
  onUpdateTicket,
  onDropTicket,
  onSelectTicket,
  selectedTicket,
  panelEmbed = false,
}) => {
  const technicians = techniciansProp ?? [];
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
            className={`board-column ${panelEmbed ? 'board-column--in-panel' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
             <style>{`
                .board-column {
                    background-color: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 12px 10px 16px;
                    box-sizing: border-box;
                    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
                    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
                }
                [data-theme="dark"] .board-column {
                    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
                }
                .board-column--in-panel {
                    background: var(--bg-primary);
                    box-shadow: none;
                }
                .board-column--in-panel .column-header {
                    border-bottom: none;
                    padding-bottom: 8px;
                }
                .board-column.drag-over {
                    background-color: var(--bg-tertiary);
                    border-color: var(--border-active);
                }
                .column-header {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-start;
                    align-items: baseline;
                    gap: 0.55rem;
                    padding: 0 6px 12px 6px;
                    border-bottom: 1px solid var(--border);
                }
                .column-title {
                    margin: 0;
                    font-size: 1.0625rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    color: var(--text-primary);
                }
                .column-count {
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    padding: 0;
                    min-width: 0;
                    border-radius: 0;
                    border: none;
                    box-shadow: none;
                    line-height: 1.2;
                    transition: var(--transition-smooth);
                }
                .column-count.count-offen {
                    background: transparent;
                    color: var(--text-muted);
                }
                .column-count.count-inarbeit {
                    background: transparent;
                    color: var(--accent-inprogress);
                }
                .column-count.count-ueberfaellig {
                    background: transparent;
                    color: var(--accent-danger);
                }
                .column-body {
                    padding-top: 1rem;
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
                            technicians={technicians}
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