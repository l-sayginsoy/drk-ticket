import React from 'react';
import { AlertTriangle, ClipboardList, Search, Home, Wrench, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface ModernDashboardProps {
  onReportIssue: () => void;
  onCheckStatus: () => void;
  onAdminLogin: () => void;
}

const ChevronRightIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const MeldungIcon = ({ size = 66 }: { size?: number }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 8H16C13.7909 8 12 9.79086 12 12V52C12 54.2091 13.7909 56 16 56H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M40 8L52 20V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M40 8V20H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 24H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 34H36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 44H30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="44" cy="44" r="12" fill="#990000" stroke="currentColor" strokeWidth="2"/>
    <path d="M44 38V50M38 44H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const StatusIcon = ({ size = 66 }: { size?: number }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 8H18C15.7909 8 14 9.79086 14 12V52C14 54.2091 15.7909 56 18 56H46C48.2091 56 50 54.2091 50 52V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M38 6C38 4.89543 37.1046 4 36 4H28C26.8954 4 26 4.89543 26 6V10C26 11.1046 26.8954 12 28 12H36C37.1046 12 38 11.1046 38 10V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 24L26 28L34 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M40 24H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 38L26 42L34 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="46" cy="46" r="10" fill="white" stroke="currentColor" strokeWidth="2"/>
    <path d="M53 53L60 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const ModernDashboard: React.FC<ModernDashboardProps> = ({ 
  onReportIssue, 
  onCheckStatus, 
  onAdminLogin 
}) => {
  return (
    <div className="modern-app-root">
      <style>{`
        /* --- GLOBAL & DESKTOP STYLES (ORIGINAL) --- */
        .modern-app-root {
          width: 100%;
          min-height: 100vh;
          background: #f0f2f5;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          font-family: 'Geist', -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .page-corner-dot {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, white 0%, transparent 70%);
          opacity: 0.8;
          z-index: 0;
          pointer-events: none;
        }
        .dot-top-left { top: -200px; left: -200px; }
        .dot-bottom-right { bottom: -200px; right: -200px; }

        .main-card {
          width: 100%;
          max-width: 980px;
          background: white;
          border-radius: 32px;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.15);
          overflow: hidden;
          position: relative;
          z-index: 10;
        }
        
        .desktop-view { display: block; }
        .mobile-view { display: none; }

        .desktop-view .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 30px 40px;
          background: white;
        }
        .desktop-view .header-logo-group { display: flex; align-items: center; gap: 15px; }
        .desktop-view .drk-logo-img {
          height: 75px; 
          width: auto;
          object-fit: contain;
        }

        .desktop-view .hero {
          background: #990000;
          padding: 60px 40px;
          color: white;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .desktop-view .hero-halftone {
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 1;
        }
        .desktop-view .hero-title { font-size: 56px; font-weight: 800; margin: 0; letter-spacing: -2px; line-height: 1; }
        .desktop-view .hero-subtitle { font-size: 22px; opacity: 1; margin-top: 15px; font-weight: 500; }
        
        .desktop-view .actions-container {
          padding: 60px 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        
        .desktop-view .card-base {
          border-radius: 32px;
          padding: 40px;
          height: 240px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          cursor: pointer;
          border: none;
          position: relative;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          box-shadow: 0 10px 40px rgba(0,0,0,0.06);
        }
        .desktop-view .card-base:hover { transform: translateY(-10px); box-shadow: 0 30px 60px rgba(0,0,0,0.12); }
        
        .desktop-view .card-red { background: #990000; color: white; }
        .desktop-view .card-white { background: #f4f3ec; color: #000000; border: 1px solid #eae8df; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }

        .desktop-view .icon-top-left {
          position: absolute; top: 40px; left: 40px;
        }
        
        .desktop-view .card-main-label { font-size: 32px; font-weight: 800; display: block; line-height: 1; margin-bottom: 8px; letter-spacing: -0.5px; }
        .desktop-view .card-sub-label { font-size: 18px; opacity: 0.9; font-weight: 500; }

        .desktop-view .card-action-icon {
          position: absolute; right: 35px; top: 50%; transform: translateY(-50%);
        }
        .desktop-view .card-white .card-action-icon { color: #000000; }

        .desktop-view .footer {
          padding: 0 40px 40px; text-align: center;
        }
        .desktop-view .footer-link {
          background: none; border: none; color: #adb5bd; font-size: 18px; font-weight: 600; cursor: pointer; transition: color 0.2s;
        }
        .desktop-view .footer-link:hover { color: #e30613; text-decoration: underline; }

        /* --- MOBILE STYLES (NEW DESIGN) --- */
        @media (max-width: 900px) {
          .desktop-view { display: none !important; }
          
          .mobile-view { 
            display: flex; 
            flex-direction: column; 
            min-height: 100dvh; 
            background: #f4f6f8; 
            width: 100%; 
            overflow-y: auto;
          }
          
          .modern-app-root { 
            padding: 0; 
            min-height: 100dvh; 
            background: #f4f6f8; 
          }
          
          .main-card { 
            max-width: 100%; 
            min-height: 100dvh; 
            border-radius: 0; 
            box-shadow: none; 
            display: flex; 
            flex-direction: column; 
            background: #f4f6f8; 
          }
          
          .page-corner-dot { display: none; }
          
          .mobile-view .header {
            padding: 35px 20px 30px; 
            background: white;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
          }

          .mobile-view .drk-logo-img {
            max-width: 100%;
            height: auto;
            max-height: 65px; 
            object-fit: contain;
          }

          .mobile-view .hero {
            background: #990000; 
            padding: 40px 24px; 
            color: white;
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
          }

          .mobile-view .hero-content {
            position: relative;
            z-index: 2;
            text-align: center;
          }

          .mobile-view .hero h1 {
            font-size: 26px;
            font-weight: 800;
            line-height: 1.15;
            margin: 0 0 6px 0;
            letter-spacing: -0.5px;
          }

          .mobile-view .hero p {
            font-size: 14px;
            margin: 0;
            opacity: 0.95;
            font-weight: 500;
          }

          .mobile-view .hero-halftone {
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            pointer-events: none;
            overflow: hidden;
            z-index: 1;
          }

          .mobile-view .actions-container {
            padding: 32px 24px 24px; 
            display: flex;
            flex-direction: column;
            gap: 20px; 
            flex-grow: 1;
            width: 100%;
            box-sizing: border-box;
            align-items: stretch;
          }

          .mobile-view .action-card {
            width: 100%;
            flex: 1; 
            max-height: 145px; 
            min-height: 125px; 
            border-radius: 20px;
            padding: 0 24px;
            display: flex;
            align-items: center;
            gap: 20px;
            border: none;
            cursor: pointer;
            text-align: left;
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            box-sizing: border-box;
            -webkit-appearance: none;
            appearance: none;
            margin: 0;
          }

          .mobile-view .action-card:active {
            transform: scale(0.98);
          }

          .mobile-view .card-icon {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .mobile-view .card-text {
            flex-grow: 1;
            min-width: 0; 
          }

          .mobile-view .card-text h2 {
            font-size: clamp(15px, 4.5vw, 19px); 
            font-weight: 800;
            margin: 0 0 4px 0;
            line-height: 1.2;
            color: inherit;
            white-space: nowrap;
          }

          .mobile-view .card-text p {
            font-size: clamp(12px, 3.5vw, 14px);
            margin: 0;
            font-weight: 500;
            opacity: 0.9;
            color: inherit;
            padding-right: 8px;
            white-space: nowrap;
          }

          .mobile-view .card-chevron {
            flex-shrink: 0;
          }

          .mobile-view .red-card {
            background: #990000;
            color: white;
          }
          .mobile-view .red-card .card-icon { color: white; }

          .mobile-view .white-card {
            background: #f4f3ec; /* leichtes grau-beige */
            color: black;
            box-shadow: 0 8px 24px rgba(0,0,0,0.05); /* slightly softer shadow */
            border: 1px solid #eae8df; /* subtle border to separate from background */
          }
          .mobile-view .white-card .card-icon, .mobile-view .white-card .card-chevron { color: #b00000; }

          .mobile-view .footer {
            flex-shrink: 0;
            text-align: center;
            padding: 16px 24px 24px;
          }

          .mobile-view .footer-link {
            background: none;
            border: none;
            color: #000;
            font-size: 13px;
            text-decoration: underline;
            cursor: pointer;
            font-weight: 500;
            transition: color 0.2s;
          }
          .mobile-view .footer-link:hover { color: #b0000a; }
        }
      `}</style>

      {/* Decorative Background Dots */}
      <div className="page-corner-dot dot-top-left" />
      <div className="page-corner-dot dot-bottom-right" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="main-card"
      >
        {/* DESKTOP VIEW */}
        <div className="desktop-view">
          <div className="header">
            <div className="header-logo-group">
              <img src="/drk-logo-wide.png" alt="Deutsches Rotes Kreuz" className="drk-logo-img" />
            </div>
          </div>

          <div className="hero">
            <div className="hero-halftone">
              <svg width="100%" height="100%">
                <defs>
                  <filter id="dot-glow-desktop" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#ffffff" floodOpacity="0.2" />
                  </filter>
                </defs>
                <g filter="url(#dot-glow-desktop)">
                  {Array.from({ length: 12 }).map((_, r) => {
                    /* Desktop is taller, so we use 12 rows. Same diagonal rule. */
                    const numColsForThisRow = Math.floor(6 + r * 2.2); 
                    
                    return Array.from({ length: numColsForThisRow }).map((_, c) => {
                      const processLeftToRight = (numColsForThisRow - 1 - c) / (numColsForThisRow - 1);
                      
                      const radius = 1.2 + Math.pow(processLeftToRight, 1.2) * 5.0;
                      
                      return (
                        <circle 
                          key={`${r}-${c}`} 
                          cx={`calc(100% - ${-10 + c * 22}px)`} 
                          cy={24 + r * 22} 
                          r={radius} 
                          fill="#ffffff"
                          opacity="0.12" 
                        />
                      );
                    });
                  })}
                </g>
              </svg>
            </div>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <h1 className="hero-title">Haustechnik Service</h1>
              <p className="hero-subtitle">Meldungen schnell erfassen & verfolgen</p>
            </div>
          </div>

          <div className="actions-container">
            <button onClick={onReportIssue} className="card-base card-red">
              <div className="icon-top-left">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MeldungIcon size={80} />
                </div>
              </div>
              <div className="card-info">
                <span className="card-main-label">Meldung erfassen</span>
                <span className="card-sub-label">Ticket wird erstellt</span>
              </div>
              <div className="card-action-icon">
                <ChevronRightIcon size={44} />
              </div>
            </button>

            <button onClick={onCheckStatus} className="card-base card-white">
              <div className="icon-top-left">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <StatusIcon size={76} />
                </div>
              </div>
              <div className="card-info">
                <span className="card-main-label">Status prüfen</span>
                <span className="card-sub-label">Ticketstatus verfolgen</span>
              </div>
              <div className="card-action-icon">
                <ChevronRightIcon size={44} />
              </div>
            </button>
          </div>

          <div className="footer">
            <button onClick={onAdminLogin} className="footer-link">
              Haustechnik & Admin &rarr; Anmelden
            </button>
          </div>
        </div>

        {/* MOBILE VIEW */}
        <div className="mobile-view">
          <div className="header">
            <img src="/drk-logo-wide.png" alt="Deutsches Rotes Kreuz" className="drk-logo-img" />
          </div>

          <div className="hero">
            <div className="hero-content">
              <h1>Haustechnik Service</h1>
              <p>Meldungen schnell erfassen & verfolgen</p>
            </div>
            <div className="hero-halftone">
              <svg width="100%" height="100%">
                <defs>
                  <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#ffffff" floodOpacity="0.2" />
                  </filter>
                </defs>
                <g filter="url(#dot-glow)">
                  {Array.from({ length: 9 }).map((_, r) => {
                    const numColsForThisRow = Math.floor(4 + r * 1.5); 
                    
                    return Array.from({ length: numColsForThisRow }).map((_, c) => {
                      const processLeftToRight = (numColsForThisRow - 1 - c) / (numColsForThisRow - 1);
                      
                      /* Erhöhter Start-Radius (1.2 anstatt 0.5), weicheres Wachstum */
                      const radius = 1.2 + Math.pow(processLeftToRight, 1.2) * 3.5;
                      
                      return (
                        <circle 
                          key={`${r}-${c}`} 
                          cx={`calc(100% - ${-5 + c * 15}px)`} 
                          cy={14 + r * 15} 
                          r={radius} 
                          fill="#ffffff"
                          opacity="0.12" /* Starke Reduktion der Deckkraft, damit es nicht mehr drückt */
                        />
                      );
                    });
                  })}
                </g>
              </svg>
            </div>
          </div>

          <div className="actions-container">
            <button onClick={onReportIssue} className="action-card red-card">
              <div className="card-icon"><MeldungIcon /></div>
              <div className="card-text">
                <h2>Meldung erfassen</h2>
                <p>Ticket wird erstellt</p>
              </div>
              <div className="card-chevron"><ChevronRightIcon /></div>
            </button>

            <button onClick={onCheckStatus} className="action-card white-card">
              <div className="card-icon"><StatusIcon /></div>
              <div className="card-text">
                <h2>Status prüfen</h2>
                <p>Ticketstatus verfolgen</p>
              </div>
              <div className="card-chevron"><ChevronRightIcon /></div>
            </button>
          </div>

          <div className="footer">
            <button onClick={onAdminLogin} className="footer-link">
              Haustechnik & Admin &rarr; Anmelden
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModernDashboard;
