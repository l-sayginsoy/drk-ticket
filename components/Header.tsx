import React from 'react';
import { SearchIcon } from './icons/SearchIcon';

interface HeaderProps {
  filters: { search: string; status: string };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  currentView: string;
}

const Header: React.FC<HeaderProps> = ({ filters, setFilters, currentView }) => {
  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'tech-dashboard':
        return 'Dashboard';
      case 'tickets':
        return 'Listenansicht';
      case 'routines':
        return 'Serienaufträge';
      case 'routine-nachweis':
        return 'Serien‑Nachweis';
      case 'erledigt':
        return 'Abgeschlossen';
      case 'techniker':
        return 'Team Übersicht';
      case 'reports':
        return 'Reports & Analysen';
      case 'settings':
        return 'Steuerzentrale';
      default:
        return 'Dashboard';
    }
  };

  const pageTitle = getPageTitle();
  const headerPaddingBottom = pageTitle ? '1.5rem' : '0';

  return (
    <header className="main-header">
      <style>{`
                .main-header {
                    padding-bottom: ${headerPaddingBottom};
                }
                .header-left {
                    display: flex;
                    align-items: flex-start;
                    gap: 1.5rem;
                }
                .header-actions {
                    display: flex;
                    align-items: flex-start;
                    gap: 1.5rem;
                }
                .search-container {
                    position: relative;
                }
                .search-input {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 0.6rem 1rem 0.6rem 2.5rem;
                    min-width: 250px;
                    transition: var(--transition-smooth);
                }
                .search-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
                }
                .search-icon {
                    position: absolute;
                    left: 0.8rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .search-icon svg { width: 18px; height: 18px; }
                                
                @media (max-width: 1024px) {
                    .header-actions {
                        justify-content: flex-end;
                    }
                }
                @media (max-width: 768px) {
                    .header-left { margin-bottom: 0.5rem; }
                    .header-actions {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 1rem;
                    }
                    .search-container { width: 100%; }
                    .search-input { width: 100%; }
                }

            `}</style>
      <div className="header-left">
        {pageTitle ? (
          <div className="header-title-container">
            <h3 className="header-title">{pageTitle}</h3>
          </div>
        ) : null}
      </div>
      <div className="header-actions">
        {currentView === 'tickets' || currentView === 'erledigt' ? (
          <div className="search-container">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Tickets durchsuchen..."
              value={filters.search}
              onChange={(e) => setFilters((prev: any) => ({ ...prev, search: e.target.value }))}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;
