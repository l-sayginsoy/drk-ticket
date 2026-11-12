import React from 'react';
import { ClipboardPlus, SearchCheck, ArrowRight, LogIn, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Eingangsseite des Serviceportals (Hauptmenü im Portal).
 * Aufbau wie bisher (weiße Karte · Logo · rotes Band · zwei Kacheln),
 * optisch modernisiert: rotes Band als abgerundete Fläche in der Karte,
 * ruhigere Kacheln mit Symbol-Plakette, Anmelden als dezenter Knopf.
 */
interface ModernDashboardProps {
  onReportIssue: () => void;
  onCheckStatus: () => void;
  onAdminLogin: () => void;
  appName: string;
  subtitle: string;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
}

const ModernDashboard: React.FC<ModernDashboardProps> = ({
  onReportIssue,
  onCheckStatus,
  onAdminLogin,
  appName,
  subtitle,
  maintenanceEnabled,
  maintenanceMessage,
}) => {
  const handleReport = () => {
    if (maintenanceEnabled) {
      window.alert(maintenanceMessage);
      return;
    }
    onReportIssue();
  };

  return (
    <div className="sp-root">
      <style>{`
        .sp-root {
          position: fixed;
          inset: 0;
          overflow-y: auto;
          --sp-red: #C8000A;
          --sp-red-dark: #9A0008;
          --sp-ink: #111827;
          --sp-muted: #6B7280;
          --sp-line: #E8EAEE;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 32px 20px;
          box-sizing: border-box;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--sp-ink);
          background:
            radial-gradient(circle at 15% 0%, #ffffff 0%, transparent 45%),
            radial-gradient(circle at 100% 100%, rgba(200, 0, 10, .06), transparent 40%),
            #EEF0F3;
        }
        .sp-root *, .sp-root *::before, .sp-root *::after { box-sizing: border-box; }

        .sp-card {
          width: 100%;
          max-width: 960px;
          background: #fff;
          border-radius: 28px;
          border: 1px solid rgba(17, 24, 39, .06);
          box-shadow: 0 1px 2px rgba(17,24,39,.04), 0 24px 60px -24px rgba(17,24,39,.18);
          padding: 28px;
        }

        /* Kopf mit Logo */
        .sp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 4px 8px 24px;
        }
        .sp-logo { height: 58px; width: auto; max-width: 100%; display: block; object-fit: contain; }

        /* Rotes Band */
        .sp-hero {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 44px 40px;
          color: #fff;
          background: linear-gradient(135deg, var(--sp-red) 0%, var(--sp-red-dark) 100%);
        }
        .sp-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,.22) 1.4px, transparent 1.6px);
          background-size: 18px 18px;
          -webkit-mask-image: linear-gradient(110deg, transparent 45%, #000 100%);
                  mask-image: linear-gradient(110deg, transparent 45%, #000 100%);
        }
        .sp-hero-inner { position: relative; z-index: 1; }
        .sp-title {
          margin: 0;
          font-size: clamp(32px, 5vw, 50px);
          font-weight: 800;
          letter-spacing: -.035em;
          line-height: 1.05;
        }
        .sp-subtitle {
          margin: 12px 0 0;
          font-size: clamp(15px, 1.8vw, 19px);
          font-weight: 500;
          opacity: .92;
        }
        .sp-maintenance {
          margin-top: 16px;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,.16);
          border: 1px solid rgba(255,255,255,.28);
          font-size: 14px; font-weight: 600;
        }

        /* Kacheln */
        .sp-actions {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .sp-tile {
          position: relative;
          min-width: 0;
          min-height: 190px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          text-align: left;
          border-radius: 22px;
          border: 1px solid var(--sp-line);
          background: #F7F8FA;
          color: var(--sp-ink);
          font: inherit;
          cursor: pointer;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease;
          -webkit-appearance: none;
          appearance: none;
          margin: 0;
        }
        .sp-tile:hover { transform: translateY(-3px); border-color: #D9DCE2; background: #fff; box-shadow: 0 18px 40px -18px rgba(17,24,39,.22); }
        .sp-tile:active { transform: scale(.99); }
        .sp-tile:focus-visible { outline: 3px solid rgba(200,0,10,.35); outline-offset: 3px; }

        .sp-tile.is-primary {
          border-color: transparent;
          color: #fff;
          background: linear-gradient(135deg, var(--sp-red) 0%, var(--sp-red-dark) 100%);
          box-shadow: 0 14px 34px -16px rgba(200,0,10,.55);
        }
        .sp-tile.is-primary:hover { background: linear-gradient(135deg, #D6000B 0%, #A50009 100%); box-shadow: 0 22px 44px -18px rgba(200,0,10,.6); }
        .sp-tile.is-disabled { opacity: .55; cursor: not-allowed; }
        .sp-tile.is-disabled:hover { transform: none; }

        .sp-icon {
          width: 56px; height: 56px;
          display: grid; place-items: center;
          border-radius: 16px;
          background: #fff;
          color: var(--sp-red);
          border: 1px solid var(--sp-line);
          flex-shrink: 0;
        }
        .is-primary .sp-icon { background: rgba(255,255,255,.16); color: #fff; border-color: rgba(255,255,255,.22); }

        .sp-tile-text { min-width: 0; }
        .sp-tile-title { display: block; font-size: clamp(21px, 2.4vw, 27px); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
        .sp-tile-sub { display: block; margin-top: 6px; font-size: 15px; font-weight: 500; color: var(--sp-muted); }
        .is-primary .sp-tile-sub { color: rgba(255,255,255,.85); }

        .sp-arrow {
          position: absolute; top: 26px; right: 26px;
          width: 40px; height: 40px;
          display: grid; place-items: center;
          border-radius: 999px;
          background: #fff;
          border: 1px solid var(--sp-line);
          color: var(--sp-ink);
          transition: transform .2s ease;
        }
        .is-primary .sp-arrow { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.25); color: #fff; }
        .sp-tile:hover .sp-arrow { transform: translateX(3px); }

        /* Fuß */
        .sp-foot { display: flex; justify-content: center; padding: 22px 0 2px; }
        .sp-login {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid var(--sp-line);
          background: #fff;
          color: #4B5563;
          font: 600 14px 'Geist', sans-serif;
          cursor: pointer;
          transition: color .2s, border-color .2s, background .2s;
        }
        .sp-login:hover { color: var(--sp-red); border-color: rgba(200,0,10,.3); background: #FFF7F7; }
        .sp-login:focus-visible { outline: 3px solid rgba(200,0,10,.3); outline-offset: 2px; }

        /* Handy */
        @media (max-width: 700px) {
          .sp-root { padding: 0; align-items: flex-start; background: #fff; }
          .sp-card { max-width: none; min-height: 100%; border-radius: 0; border: 0; box-shadow: none; padding: 20px 16px 24px; display: flex; flex-direction: column; }
          .sp-head { justify-content: center; padding: 8px 4px 20px; }
          .sp-logo { height: 44px; }
          .sp-hero { padding: 30px 24px; border-radius: 20px; text-align: center; }
          .sp-hero::after { -webkit-mask-image: linear-gradient(180deg, transparent 30%, #000 100%); mask-image: linear-gradient(180deg, transparent 30%, #000 100%); }
          .sp-actions { grid-template-columns: 1fr; gap: 12px; margin-top: 16px; }
          .sp-tile { min-height: 116px; flex-direction: row; align-items: center; justify-content: flex-start; padding: 18px; gap: 16px; border-radius: 18px; }
          .sp-icon { width: 50px; height: 50px; border-radius: 14px; }
          .sp-tile-text { flex: 1; }
          .sp-tile-sub { font-size: 14px; margin-top: 3px; }
          .sp-arrow { position: static; width: 34px; height: 34px; flex-shrink: 0; }
          .sp-foot { padding-top: 22px; }
        }
      `}</style>

      <motion.div
        className="sp-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="sp-head">
          <img src="/drk-logo-wide.png" alt="Deutsches Rotes Kreuz" className="sp-logo" />
        </div>

        <div className="sp-hero">
          <div className="sp-hero-inner">
            <h1 className="sp-title">{appName}</h1>
            <p className="sp-subtitle">{subtitle}</p>
            {maintenanceEnabled && (
              <div className="sp-maintenance" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{maintenanceMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="sp-actions">
          <button
            type="button"
            onClick={handleReport}
            className={`sp-tile is-primary${maintenanceEnabled ? ' is-disabled' : ''}`}
            aria-disabled={maintenanceEnabled}
          >
            <span className="sp-icon"><ClipboardPlus size={26} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="sp-tile-text">
              <span className="sp-tile-title">Meldung erfassen</span>
              <span className="sp-tile-sub">{maintenanceEnabled ? 'Aktuell gesperrt (Wartung)' : 'Ticket wird erstellt'}</span>
            </span>
            <span className="sp-arrow" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.2} /></span>
          </button>

          <button type="button" onClick={onCheckStatus} className="sp-tile">
            <span className="sp-icon"><SearchCheck size={26} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="sp-tile-text">
              <span className="sp-tile-title">Status prüfen</span>
              <span className="sp-tile-sub">Ticketstatus verfolgen</span>
            </span>
            <span className="sp-arrow" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.2} /></span>
          </button>
        </div>

        <div className="sp-foot">
          <button type="button" className="sp-login" onClick={onAdminLogin}>
            <LogIn size={16} strokeWidth={2.2} aria-hidden="true" />
            Service-Team &amp; Admin anmelden
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ModernDashboard;
