import React from 'react';

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

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {

  const accentColor = toast.type === 'new-ticket' ? '#dc3545' : '#d97706';
  const bgColor = toast.type === 'new-ticket' ? 'rgba(220,53,69,0.08)' : 'rgba(217,119,6,0.08)';
  const icon = toast.type === 'new-ticket' ? '🔔' : '📋';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        border: `1px solid ${accentColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 10,
        padding: '0.85rem 1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: 280,
        maxWidth: 360,
        animation: 'toastSlideIn 0.3s ease',
        background: bgColor,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{toast.title}</p>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, padding: 0, flexShrink: 0, marginTop: 1 }}
        aria-label="Schließen"
      >
        ✕
      </button>
    </div>
  );
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
};

export default ToastContainer;
