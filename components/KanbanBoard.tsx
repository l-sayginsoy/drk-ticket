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
  currentUser?: User | null;
}

const parseGermanDate = (d: string) => d.split('.').reverse().join('-'); // DD.MM.YYYY → YYYY-MM-DD for string compare
const isUnassigned = (t: Ticket) => !t.technician || t.technician === 'N/A';

const parseDateObj = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
};
const formatDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}.${m}.${date.getFullYear()}`;
};
const addDays = (date: Date, days: number): Date => {
    const r = new Date(date); r.setDate(r.getDate() + days); return r;
};
const computeInsertionDueDate = (otherTickets: Ticket[], insertBeforeId: string | null, fallback: string): string => {
    if (otherTickets.length === 0) return fallback;
    if (insertBeforeId === null) return formatDate(addDays(parseDateObj(otherTickets[otherTickets.length - 1].dueDate), 1));
    const idx = otherTickets.findIndex(t => t.id === insertBeforeId);
    if (idx === -1) return fallback;
    if (idx === 0) return formatDate(addDays(parseDateObj(otherTickets[0].dueDate), -1));
    const prev = parseDateObj(otherTickets[idx - 1].dueDate);
    const next = parseDateObj(otherTickets[idx].dueDate);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86400000);
    return diff <= 1 ? otherTickets[idx].dueDate : formatDate(addDays(prev, 1));
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tickets,
  technicians: techniciansProp,
  onUpdateTicket,
  onSelectTicket,
  selectedTicket,
  panelEmbed = false,
  currentUser,
}) => {
  const technicians = techniciansProp ?? [];
  const columns: { title: string; status: Status }[] = [
    { title: Status.Offen, status: Status.Offen },
    { title: Status.InArbeit, status: Status.InArbeit },
    { title: Status.Ueberfaellig, status: Status.Ueberfaellig },
  ];

  const getTicketsForColumn = (status: Status) => {
    const col = tickets.filter(t => t.status === status && t.status !== Status.Abgeschlossen);
    return col.sort((a, b) => {
      if (a.is_emergency && !b.is_emergency) return -1;
      if (!a.is_emergency && b.is_emergency) return 1;
      // Neue Tickets (isNew) immer oben
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      const dateA = a.dueDate.split('.').reverse().join('-');
      const dateB = b.dueDate.split('.').reverse().join('-');
      return dateA.localeCompare(dateB);
    });
  };

  const handleDropTicket = (ticketId: string, newStatus: Status, insertBeforeTicketId: string | null) => {
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (!ticketToUpdate) return;

    if (ticketToUpdate.status !== newStatus) {
      onUpdateTicket({ ...ticketToUpdate, status: newStatus });
      return;
    }

    const columnTickets = getTicketsForColumn(newStatus);
    const currentIdx = columnTickets.findIndex(t => t.id === ticketId);
    const nextTicket = currentIdx < columnTickets.length - 1 ? columnTickets[currentIdx + 1] : null;
    if (insertBeforeTicketId === ticketId) return;
    if (insertBeforeTicketId === nextTicket?.id) return;
    if (insertBeforeTicketId === null && currentIdx === columnTickets.length - 1) return;

    const otherTickets = columnTickets.filter(t => t.id !== ticketId);
    const newDueDate = computeInsertionDueDate(otherTickets, insertBeforeTicketId, ticketToUpdate.dueDate);
    if (newDueDate !== ticketToUpdate.dueDate) {
      onUpdateTicket({ ...ticketToUpdate, dueDate: newDueDate });
    }
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
                background: transparent;
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
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;