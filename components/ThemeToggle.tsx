import React from 'react';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';

interface ThemeToggleProps {
  theme: string;
  setTheme: (theme: string) => void;
  isCollapsed: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, isCollapsed }) => {
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  const label = theme === 'light' ? 'Dark Mode' : 'Light Mode';

  return (
    <button onClick={toggleTheme} className="theme-toggle" title={label}>
        <style>{`
            .theme-toggle {
                background: var(--bg-tertiary);
                border: 1px solid var(--border);
                color: var(--text-secondary);
                width: 100%;
                padding: 0.75rem;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                cursor: pointer;
                font-weight: 500;
                font-size: 0.9rem;
                transition: var(--transition-smooth);
            }
            .theme-toggle:hover {
                background: var(--border);
                color: var(--text-primary);
            }
            .theme-toggle svg {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                transition: var(--transition-smooth);
            }
            .theme-label {
                white-space: nowrap;
                transition: opacity 0.2s ease;
                opacity: 1;
            }
            .sidebar.collapsed .theme-label {
                 opacity: 0;
                 width: 0;
                 overflow: hidden;
            }
            .sidebar.collapsed .theme-toggle {
                gap: 0;
                padding: 0.875rem;
            }
        `}</style>
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        <span className="theme-label">{label}</span>
    </button>
  );
};

export default ThemeToggle;