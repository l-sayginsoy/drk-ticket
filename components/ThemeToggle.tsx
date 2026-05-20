import React from 'react';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';

interface ThemeToggleProps {
  theme: string;
  setTheme: (theme: string) => void;
  isCollapsed: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, isCollapsed }) => {
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const label = theme === 'light' ? 'Dark Mode' : 'Light Mode';

  return (
    <button onClick={toggleTheme} className="theme-toggle" title={label}>
      <style>{`
        .theme-toggle {
          background: none;
          border: none;
          color: var(--text-muted);
          padding: 0.4rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .theme-toggle:hover {
          color: var(--text-secondary);
          background: var(--bg-tertiary);
        }
        .theme-toggle svg {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
        }
      `}</style>
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};

export default ThemeToggle;
