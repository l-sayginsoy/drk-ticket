import React from 'react';
import { Ticket, Status } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
}

const getTicketSortPriority = (ticket: Ticket): number => {
    if (ticket.is_emergency) return 0; // Highest priority
    if (ticket.status === Status.Ueberfaellig) return 1; // Second highest
    return 2; // Normal
};


const KanbanBoard: React.FC<KanbanBoardProps> = ({ tickets, onUpdateTicket, onSelectTicket, selectedTicket }) => {
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
    return tickets
      .filter(ticket => ticket.status === status && ticket.status !== Status.Abgeschlossen)
      .sort((a, b) => {
          const priorityA = getTicketSortPriority(a);
          const priorityB = getTicketSortPriority(b);
          if (priorityA !== priorityB) {
              return priorityA - priorityB;
          }
          // Optional: secondary sort by due date
          const dateA = a.dueDate.split('.').reverse().join('-');
          const dateB = b.dueDate.split('.').reverse().join('-');
          return dateA.localeCompare(dateB);
      });
  };

  return (
    <div className="kanban-board-container">
        <style>{`
            .kanban-board-container {
                max-width: 1800px;
            }
            .kanban-board {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(325px, 1fr));
                gap: 1.5rem;
                padding-top: 1.5rem;
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
            onUpdateTicket={onUpdateTicket}
            onDropTicket={handleDropTicket}
            onSelectTicket={onSelectTicket}
            selectedTicket={selectedTicket}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;