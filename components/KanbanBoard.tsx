import React from 'react';
import { Ticket, Status, User } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tickets: Ticket[];
  technicians?: User[];
  onUpdateTicket: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  panelEmbed?: boolean;
}

const parseGermanDate = (d: string) => d.split('.').reverse().join('-'); // DD.MM.YYYY → YYYY-MM-DD
const isUnassigned = (t: Ticket) => !t.technician || t.technician === 'N/A';

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tickets,
  technicians: techniciansProp,
  onUpdateTicket,
  onSelectTicket,
  selectedTicket,
  panelEmbed = false,
}) => {
  const technicians = techniciansProp ?? [];
  const columns: { title: string; status: Status }[] = [
    { title: Status.Offen, status: Status.Offen },
    { title: Status.InArbeit, status: Status.InArbeit },
    { title: Status.Ueberfaellig, status: Status.Ueberfaellig },
  ];

  const handleDropTicket = (ticketId: string, newStatus: Status) => {
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (ticketToUpdate && ticketToUpdate.status !== newStatus) {
      onUpdateTicket({ ...ticketToUpdate, status: newStatus });
    }
  };

  const getTicketsForColumn = (status: Status) => {
    const col = tickets.filter(t => t.status === status && t.status !== Status.Abgeschlossen);
    if (status === Status.Offen) {
      return col.sort((a, b) => {
        if (a.is_emergency && !b.is_emergency) return -1;
        if (!a.is_emergency && b.is_emergency) return 1;
        const aU = isUnassigned(a), bU = isUnassigned(b);
        if (aU && !bU) return -1;
        if (!aU && bU) return 1;
        return parseGermanDate(b.entryDate).localeCompare(parseGermanDate(a.entryDate));
      });
    }
    return col.sort((a, b) => {
      if (a.is_emergency && !b.is_emergency) return -1;
      if (!a.is_emergency && b.is_emergency) return 1;
      const dateA = a.dueDate.split('.').reverse().join('-');
      const dateB = b.dueDate.split('.').reverse().join('-');
      return dateA.localeCompare(dateB);
    });
  };

  const unassignedBadgeNumbers: Record<string, number> = {};
  getTicketsForColumn(Status.Offen)
    .filter(t => isUnassigned(t) && !t.is_emergency)
    .forEach((t, i) => { unassignedBadgeNumbers[t.id] = i + 1; });

  return (
    <div className={`kanban-board-container${panelEmbed ? ' kanban-board-container--embed' : ''}`}>
        <style>{`
            .kanban-board-container {
                max-width: 1800px;
            }
            .kanban-board-container--embed {
                max-width: none;
                width: 100%;
                box-sizing: border-box;
                background: var(--bg-secondary);
                padding: 0 16px 20px;
            }
            .kanban-board {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(325px, 1fr));
                gap: 1.5rem;
                padding-top: 1.5rem;
            }
            .kanban-board-container--embed .kanban-board {
                padding-top: 1.125rem;
                gap: 1.25rem;
            }
             @media (min-width: 1200px) {
                .kanban-board {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
             @media (max-width: 768px) {
                .kanban-board {
                    display: flex;
                    flex-direction: column;
                    gap: 2.5rem;
                }
            }
      `}</style>
      <div className="kanban-board">
        {columns.map(column => (
          <KanbanColumn
            key={column.title}
            title={column.title}
            status={column.status}
            tickets={getTicketsForColumn(column.status)}
            technicians={technicians}
            onUpdateTicket={onUpdateTicket}
            onDropTicket={handleDropTicket}
            onSelectTicket={onSelectTicket}
            selectedTicket={selectedTicket}
            panelEmbed={panelEmbed}
            badgeNumbers={column.status === Status.Offen ? unassignedBadgeNumbers : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;