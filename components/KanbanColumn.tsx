import React, { useState, useRef, useEffect } from 'react';
import { Ticket, Status, User } from '../types';
import TicketCard from './TicketCard';

interface KanbanColumnProps {
  title: string;
  status: Status;
  tickets: Ticket[];
  technicians?: User[];
  onUpdateTicket: (ticket: Ticket) => void;
  onDropTicket: (ticketId: string, newStatus: Status, insertBeforeTicketId: string | null) => void;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicket: Ticket | null;
  panelEmbed?: boolean;
  badgeNumbers?: Record<string, number>;
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
  badgeNumbers,
}) => {
  const technicians = techniciansProp ?? [];
  const [dragOverSlot, setDragOverSlot] = useState<{ ticketId: string; position: 'before' | 'after' } | null>(null);
  const [isDragOverColumn, setIsDragOverColumn] = useState(false);
  const [scrollThumb, setScrollThumb] = useState<{ visible: boolean; top: number }>({ visible: false, top: 0 });

  const columnBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = columnBodyRef.current;
    if (!el) return;
    const THUMB_H = 88;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      const ratio = scrollTop / maxScroll;
      const top = Math.max(0, Math.min(clientHeight - THUMB_H, ratio * (clientHeight - THUMB_H)));
      setScrollThumb({ visible: true, top });
      clearTimeout(timer);
      timer = setTimeout(() => setScrollThumb(s => ({ ...s, visible: false })), 900);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, []);

  const statusKey =
      status === Status.Offen ? 'offen' : status === Status.InArbeit ? 'inarbeit' : status === Status.Ueberfaellig ? 'ueberfaellig' : 'other';

  const handleColumnDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverColumn(false);
      setDragOverSlot(null);
      const ticketId = e.dataTransfer.getData('ticketId');
      if (ticketId) {
          onDropTicket(ticketId, status, null);
      }
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverColumn(true);
  };

  const handleColumnDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOverColumn(false);
          setDragOverSlot(null);
      }
  };

  const handleCardSlotDragOver = (e: React.DragEvent<HTMLDivElement>, ticket: Ticket) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverColumn(false);
      const rect = e.currentTarget.getBoundingClientRect();
      const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDragOverSlot({ ticketId: ticket.id, position });
  };

  const handleCardSlotDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOverSlot(null);
      }
  };

  const handleCardSlotDrop = (e: React.DragEvent<HTMLDivElement>, ticket: Ticket, idx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData('ticketId');
      const slot = dragOverSlot;
      setDragOverSlot(null);
      setIsDragOverColumn(false);
      if (!draggedId || !slot || slot.ticketId !== ticket.id) return;

      let insertBeforeTicketId: string | null;
      if (slot.position === 'before') {
          insertBeforeTicketId = ticket.id;
      } else {
          insertBeforeTicketId = idx < tickets.length - 1 ? tickets[idx + 1].id : null;
      }

      onDropTicket(draggedId, status, insertBeforeTicketId);
  };

  const showDropLine = (ticketId: string, position: 'before' | 'after') =>
      dragOverSlot?.ticketId === ticketId && dragOverSlot.position === position;

  return (
      <div
          className={`board-column ${panelEmbed ? 'board-column--in-panel' : ''} ${isDragOverColumn && tickets.length === 0 ? 'drag-over' : ''}`}
          onDragOver={handleColumnDragOver}
          onDragLeave={handleColumnDragLeave}
          onDrop={handleColumnDrop}
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
              .column-body-wrap {
                  position: relative;
                  height: calc(100vh - 250px);
              }
              .column-body {
                  padding-top: 1rem;
                  height: 100%;
                  overflow-y: auto;
                  scrollbar-width: none;
              }
              .column-body::-webkit-scrollbar { display: none; }
              .scroll-thumb {
                  position: absolute;
                  right: -7px;
                  top: 0;
                  width: 4px;
                  height: 88px;
                  border-radius: 6px;
                  background: rgba(0,0,0,0.22);
                  pointer-events: none;
                  transition: opacity 1s ease;
              }
              [data-theme="dark"] .scroll-thumb {
                  background: rgba(255,255,255,0.25);
              }
              @media (max-width: 768px) {
                  .column-body-wrap { height: auto; overflow: visible; }
                  .column-body { height: auto; overflow-y: visible; }
                  .scroll-thumb { display: none; }
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
              .card-drop-slot {
                  position: relative;
              }
              .drop-line {
                  height: 3px;
                  background: var(--accent-primary, #e30613);
                  border-radius: 2px;
                  margin: 0 4px;
                  pointer-events: none;
              }
          `}</style>
          <div className="column-header">
              <h2 className="column-title">{title}</h2>
              <span className={`column-count count-${statusKey}`}>{tickets.length}</span>
          </div>
          <div className="column-body-wrap">
              <div className="column-body" ref={columnBodyRef}>
                  {tickets.length === 0 ? (
                      <div className="empty-state">
                          <div className="empty-icon">
                              <EmptyStateIcon kind={emptyCopyForStatus(status).kind} />
                          </div>
                          <div className="empty-text">{emptyCopyForStatus(status).text}</div>
                      </div>
                  ) : (
                      tickets.map((ticket, idx) => (
                          <div
                              key={ticket.id}
                              className="card-drop-slot"
                              onDragOver={(e) => handleCardSlotDragOver(e, ticket)}
                              onDragLeave={handleCardSlotDragLeave}
                              onDrop={(e) => handleCardSlotDrop(e, ticket, idx)}
                          >
                              {showDropLine(ticket.id, 'before') && <div className="drop-line" />}
                              <TicketCard
                                  ticket={ticket}
                                  technicians={technicians}
                                  onUpdateTicket={onUpdateTicket}
                                  onSelectTicket={onSelectTicket}
                                  selectedTicket={selectedTicket}
                                  badgeNumber={badgeNumbers?.[ticket.id]}
                              />
                              {showDropLine(ticket.id, 'after') && <div className="drop-line" />}
                          </div>
                      ))
                  )}
              </div>
              <div
                  className="scroll-thumb"
                  style={{
                      opacity: scrollThumb.visible ? 1 : 0,
                      top: scrollThumb.top,
                  }}
              />
          </div>
      </div>
  );
};

export default KanbanColumn;
