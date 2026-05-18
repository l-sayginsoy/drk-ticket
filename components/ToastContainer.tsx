import React, { useEffect } from 'react';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'new-ticket' | 'assigned';
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 8000;

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const isNew = toast.type === 'new-ticket';
  const accentColor = isNew ? '#e30613' : '#1a73e8';
  const bgColor = isNew ? '#fff' : '#fff';
  const iconClass = isNew ? 'ti ti-bell-ringing' : 'ti ti-user-check';

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <>
      <style>{`
        @keyframes toastSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .drk-toast {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-left: 4px solid ${accentColor};
          border-radius: 12px;
          padding: 0.9rem 1rem 0;
          box-shadow: 0 8px 28px rgba(0,0,0,0.14);
          min-width: 300px;
          max-width: 400px;
          animation: toastSlideUp 0.28s ease;
          overflow: hidden;
          position: relative;
        }
        [data-theme="dark"] .drk-toast {
          background: #1e1f20;
          border-color: #3a3b3c;
          border-left-color: ${accentColor};
        }
        .drk-toast-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: ${accentColor};
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 15px;
        }
        .drk-toast-body { flex: 1; min-width: 0; padding-bottom: 0.9rem; }
        .drk-toast-title { margin: 0; font-weight: 700; font-size: 0.88rem; color: var(--text-primary); }
        .drk-toast-msg   { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; }
        .drk-toast-close {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 0.95rem;
          padding: 0; flex-shrink: 0; margin-top: 1px; line-height: 1;
        }
        .drk-toast-close:hover { color: var(--text-primary); }
        .drk-toast-bar {
          position: absolute;
          bottom: 0; left: 0;
          height: 3px;
          background: ${accentColor};
          opacity: 0.35;
          border-radius: 0 0 0 2px;
          animation: toastProgress ${AUTO_DISMISS_MS}ms linear forwards;
        }
      `}</style>
      <div className="drk-toast">
        <div className="drk-toast-icon">
          <i className={iconClass} aria-hidden="true" />
        </div>
        <div className="drk-toast-body">
          <p className="drk-toast-title">{toast.title}</p>
          <p className="drk-toast-msg">{toast.message}</p>
        </div>
        <button className="drk-toast-close" onClick={() => onDismiss(toast.id)} aria-label="Schließen">✕</button>
        <div className="drk-toast-bar" />
      </div>
    </>
  );
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
