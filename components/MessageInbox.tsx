import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, Status } from '../types';

/** Ein Ticket mit neuer Aktivität für die angemeldete Person. */
export interface MessageActivityItem {
  ticket: Ticket;
  /** neue (ungelesene) Melder-Nachricht */
  reporter: boolean;
  /** neuer (ungelesener) interner Team-Chat */
  chat: boolean;
}

interface MessageInboxProps {
  items: MessageActivityItem[];
  /** Öffnet das Ticket in der Detailansicht. */
  onOpenTicket?: (ticket: Ticket) => void;
}

const CHAT_BLUE = '#6366f1';      // Team-Chat – durchgängig blau
const MELDER_ORANGE = '#F97316';  // Melder-Nachricht – orange

/**
 * Glocke mit aufklappbarer Liste aller Tickets mit neuen Nachrichten (Chat und/oder
 * Melder). Jede Zeile öffnet das Ticket direkt – egal ob auf dem Board oder
 * zurückgestellt (dann mit „zurückgestellt"-Etikett). Ersetzt die früheren zwei
 * „X neu"-Pillen und das Chat-Signal am Sidebar-Menüpunkt „Zurückgestellt".
 *
 * Das Dropdown wird als Portal am <body> gerendert, damit es nicht von Containern
 * mit overflow:hidden (Kanban-Panel) abgeschnitten wird.
 */
const MessageInbox: React.FC<MessageInboxProps> = ({ items, onOpenTicket }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollResize = () => reposition();
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
    };
  }, [open, reposition]);

  if (items.length === 0) return null;

  const handleRow = (t: Ticket) => {
    setOpen(false);
    onOpenTicket?.(t);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`${items.length} Ticket${items.length > 1 ? 's' : ''} mit neuen Nachrichten`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 14px', boxSizing: 'border-box',
          fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
          borderRadius: 20, background: CHAT_BLUE, color: '#fff',
          whiteSpace: 'nowrap', userSelect: 'none', flexShrink: 0,
        }}
      >
        <i className="ti ti-bell" style={{ fontSize: 16 }} aria-hidden="true" />
        {items.length} neu
        <i
          className="ti ti-chevron-down"
          style={{ fontSize: 14, opacity: 0.85, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden="true"
        />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed', top: coords.top, right: coords.right,
            width: 360, maxWidth: 'calc(100vw - 16px)', maxHeight: '70vh', overflowY: 'auto',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.18))',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            Neue Nachrichten
          </div>
          {items.map(({ ticket, reporter, chat }) => {
            const parked = ticket.status === Status.Zurueckgestellt;
            const isChat = chat;
            const desc = chat && reporter
              ? 'Neuer Chat · neue Melder-Nachricht'
              : chat ? 'Neuer Team-Chat' : 'Neue Melder-Nachricht';
            return (
              <button
                key={ticket.id}
                type="button"
                role="menuitem"
                onClick={() => handleRow(ticket)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
                    background: isChat ? 'rgba(99,102,241,0.16)' : 'rgba(249,115,22,0.16)',
                    color: isChat ? CHAT_BLUE : MELDER_ORANGE,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <i className={`ti ${isChat ? 'ti-message-circle' : 'ti-mail'}`} style={{ fontSize: 16 }} aria-hidden="true" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{ticket.id} · {ticket.title}
                    </span>
                    {parked && (
                      <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, background: 'rgba(255,140,0,0.18)', color: MELDER_ORANGE, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        zurückgestellt
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{desc}</span>
                </span>
                <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
};

export default MessageInbox;
