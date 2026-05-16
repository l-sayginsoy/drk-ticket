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

const getTicketSortPriority = (ticket: Ticket): number => {
    if (ticket.is_emergency) return 0;
    if (ticket.status === Status.Ueberfaellig) return 1;
    return 2;
};

const parseGermanDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
};

const formatGermanDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const computeInsertionDueDate = (
    otherTickets: Ticket[],
    insertBeforeTicketId: string | null,
    fallback: string
): string => {
    if (otherTickets.length === 0) return fallback;

    if (insertBeforeTicketId === null) {
        const last = otherTickets[otherTickets.length - 1];
        return formatGermanDate(addDays(parseGermanDate(last.dueDate), 1));
    }

    const insertIdx = otherTickets.findIndex(t => t.id === insertBeforeTicketId);
    if (insertIdx === -1) return fallback;

    if (insertIdx === 0) {
        return formatGermanDate(addDays(parseGermanDate(otherTickets[0].dueDate), -1));
    }

    const prev = otherTickets[insertIdx - 1];
    const next = otherTickets[insertIdx];
    const prevDate = parseGermanDate(prev.dueDate);
    const nextDate = parseGermanDate(next.dueDate);
    const diffDays = Math.round((nextDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays <= 1) {
        return next.dueDate;
    }

    return formatGermanDate(addDays(prevDate, 1));
};

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

  const getTicketsForColumn = (status: Status) => {
    return tickets
      .filter(ticket => ticket.status === status && ticket.status !== Status.Abgeschlossen)
      .sort((a, b) => {
          const priorityA = getTicketSortPriority(a);
          const priorityB = getTicketSortPriority(b);
          if (priorityA !== priorityB) {
              return priorityA - priorityB;
          }
          const dateA = a.dueDate.split('.').reverse().join('-');
          const dateB = b.dueDate.split('.').reverse().join('-');
          return dateA.localeCompare(dateB);
      });
  };

  const handleDropTicket = (ticketId: string, newStatus: Status, insertBeforeTicketId: string | null) => {
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (!ticketToUpdate) return;

    const isSameColumn = ticketToUpdate.status === newStatus;

    if (!isSameColumn) {
      onUpdateTicket({ ...ticketToUpdate, status: newStatus });
      return;
    }

    const columnTickets = getTicketsForColumn(newStatus);
    const currentIdx = columnTickets.findIndex(t => t.id === ticketId);
    const nextTicket = currentIdx < columnTickets.length - 1 ? columnTickets[currentIdx + 1] : null;

    // Dropping on itself or same position — no-op
    if (insertBeforeTicketId === ticketId) return;
    if (insertBeforeTicketId === nextTicket?.id) return;
    if (insertBeforeTicketId === null && currentIdx === columnTickets.length - 1) return;

    const otherTickets = columnTickets.filter(t => t.id !== ticketId);
    const newDueDate = computeInsertionDueDate(otherTickets, insertBeforeTicketId, ticketToUpdate.dueDate);

    if (newDueDate !== ticketToUpdate.dueDate) {
      onUpdateTicket({ ...ticketToUpdate, dueDate: newDueDate });
    }
  };

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
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
