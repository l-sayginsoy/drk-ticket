import React from 'react';

export interface CompleteOrderDialogProps {
  open: boolean;
  ticketId: string;
  ticketTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bestätigung vor endgültigem Abschluss eines Auftrags (Ja / Nein). */
const CompleteOrderDialog: React.FC<CompleteOrderDialogProps> = ({
  open,
  ticketId,
  ticketTitle,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="cod-root" role="presentation">
      <div className="cod-backdrop" onClick={onCancel} aria-hidden />
      <div className="cod-panel" role="dialog" aria-modal="true" aria-labelledby="cod-heading">
        <h2 id="cod-heading" className="cod-heading">
          Auftrag abschließen?
        </h2>
        <p className="cod-lead">Möchten Sie diesen Auftrag wirklich als erledigt markieren?</p>
        <p className="cod-meta">
          <strong>Ticket {ticketId}</strong>
        </p>
        <p className="cod-title">{ticketTitle}</p>
        <div className="cod-actions">
          <button type="button" className="cod-btn cod-btn-secondary" onClick={onCancel}>
            Nein
          </button>
          <button type="button" className="cod-btn cod-btn-primary" onClick={onConfirm}>
            Ja, abschließen
          </button>
        </div>
      </div>
      <style>{`
        .cod-root {
          position: fixed;
          inset: 0;
          z-index: 10050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .cod-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
        }
        .cod-panel {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem 1.5rem 1.25rem;
          box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.18));
        }
        .cod-heading {
          margin: 0 0 0.5rem;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .cod-lead {
          margin: 0 0 0.75rem;
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .cod-meta {
          margin: 0 0 0.25rem;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .cod-title {
          margin: 0 0 1.25rem;
          font-size: 0.88rem;
          color: var(--text-muted);
          line-height: 1.4;
          word-break: break-word;
        }
        .cod-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .cod-btn {
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .cod-btn-secondary {
          background: var(--bg-tertiary);
          border-color: var(--border);
          color: var(--text-primary);
        }
        .cod-btn-secondary:hover {
          background: var(--border);
        }
        .cod-btn-primary {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #fff;
        }
        .cod-btn-primary:hover {
          filter: brightness(1.05);
        }
      `}</style>
    </div>
  );
};

export default CompleteOrderDialog;
