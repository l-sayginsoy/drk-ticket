import React from 'react';

export interface CompleteOrderDialogProps {
  open: boolean;
  ticketId: string;
  ticketTitle: string;
  missingWorkTime: boolean;
  onConfirm: () => void;
  onEnterWorkTime: () => void;
  onCancel: () => void;
}

/** Bestätigung vor endgültigem Abschluss eines Auftrags (Ja / Nein). */
const CompleteOrderDialog: React.FC<CompleteOrderDialogProps> = ({
  open,
  ticketId,
  ticketTitle,
  missingWorkTime,
  onConfirm,
  onEnterWorkTime,
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
        {missingWorkTime ? (
          <div className="cod-warning" role="alert">
            <i className="ti ti-clock-exclamation" aria-hidden="true" />
            <span><strong>Es wurde noch keine Arbeitszeit eingetragen.</strong><br />Bitte buche zuerst die benötigte Zeit.</span>
          </div>
        ) : (
          <p className="cod-lead">Möchten Sie diesen Auftrag wirklich als erledigt markieren?</p>
        )}
        <p className="cod-meta">
          <strong>Ticket {ticketId}</strong>
        </p>
        <p className="cod-title">{ticketTitle}</p>
        <div className="cod-actions">
          {missingWorkTime ? (
            <>
              <button type="button" className="cod-btn cod-btn-secondary" onClick={onEnterWorkTime}>Zeit eintragen</button>
              <button type="button" className="cod-btn cod-btn-warning" onClick={onConfirm}>Trotzdem abschließen</button>
            </>
          ) : (
            <>
              <button type="button" className="cod-btn cod-btn-secondary" onClick={onCancel}>Nein</button>
              <button type="button" className="cod-btn cod-btn-primary" onClick={onConfirm}>Ja, abschließen</button>
            </>
          )}
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
        .cod-warning {
          display: flex;
          gap: 0.7rem;
          align-items: flex-start;
          margin: 0 0 1rem;
          padding: 0.8rem;
          border: 1px solid #f2c66d;
          border-radius: 9px;
          background: #fff8e7;
          color: #7a4b00;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .cod-warning i { font-size: 1.15rem; margin-top: 1px; }
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
        .cod-btn-warning {
          background: transparent;
          border-color: #d97706;
          color: #b45309;
        }
        .cod-btn-warning:hover { background: #fff8e7; }
        @media (max-width: 480px) {
          .cod-actions { display: grid; grid-template-columns: 1fr; }
          .cod-btn { width: 100%; min-height: 44px; }
        }
      `}</style>
    </div>
  );
};

export default CompleteOrderDialog;
