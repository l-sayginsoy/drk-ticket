import React from 'react';

export interface DeleteTicketDialogProps {
  open: boolean;
  ticketId: string;
  ticketTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bestätigung vor endgültigem Löschen eines abgeschlossenen Auftrags (Ja / Nein). */
const DeleteTicketDialog: React.FC<DeleteTicketDialogProps> = ({
  open,
  ticketId,
  ticketTitle,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="dtd-root" role="presentation">
      <div className="dtd-backdrop" onClick={onCancel} aria-hidden />
      <div className="dtd-panel" role="dialog" aria-modal="true" aria-labelledby="dtd-heading">
        <h2 id="dtd-heading" className="dtd-heading">
          Auftrag löschen?
        </h2>
        <p className="dtd-lead">Dieser Eintrag wird unwiderruflich gelöscht. Fortfahren?</p>
        <p className="dtd-meta">
          <strong>Ticket {ticketId}</strong>
        </p>
        <p className="dtd-title">{ticketTitle}</p>
        <div className="dtd-actions">
          <button type="button" className="dtd-btn dtd-btn-secondary" onClick={onCancel}>
            Nein
          </button>
          <button type="button" className="dtd-btn dtd-btn-danger" onClick={onConfirm}>
            Ja, endgültig löschen
          </button>
        </div>
      </div>
      <style>{`
        .dtd-root {
          position: fixed;
          inset: 0;
          z-index: 10050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .dtd-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
        }
        .dtd-panel {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem 1.5rem 1.25rem;
          box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.18));
        }
        .dtd-heading {
          margin: 0 0 0.5rem;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .dtd-lead {
          margin: 0 0 0.75rem;
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .dtd-meta {
          margin: 0 0 0.25rem;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .dtd-title {
          margin: 0 0 1.25rem;
          font-size: 0.88rem;
          color: var(--text-muted);
          line-height: 1.4;
          word-break: break-word;
        }
        .dtd-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .dtd-btn {
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .dtd-btn-secondary {
          background: var(--bg-tertiary);
          border-color: var(--border);
          color: var(--text-primary);
        }
        .dtd-btn-secondary:hover {
          background: var(--border);
        }
        .dtd-btn-danger {
          background: #c82333;
          border-color: #c82333;
          color: #fff;
        }
        .dtd-btn-danger:hover {
          filter: brightness(1.06);
        }
      `}</style>
    </div>
  );
};

export default DeleteTicketDialog;
