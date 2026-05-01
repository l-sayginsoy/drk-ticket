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

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, status, tickets, onUpdateTicket, onDropTicket, onSelectTicket, selectedTicket }) => {
    const [isDragOver, setIsDragOver] = useState(false);

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
            `}</style>
            <div className="column-header">
                <h2 className="column-title">{title}</h2>
                <span className="column-count">{tickets.length}</span>
            </div>
            <div className="column-body">
                {tickets.map(ticket => (
                    <TicketCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        onUpdateTicket={onUpdateTicket}
                        onSelectTicket={onSelectTicket}
                        selectedTicket={selectedTicket}
                    />
                ))}
            </div>
        </div>
    );
};

export default KanbanColumn;