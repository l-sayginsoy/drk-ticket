import React from 'react';
import { SearchIcon } from './icons/SearchIcon';

interface AppTopBarProps {
  collapsed: boolean;
  search: string;
  onSearch: (value: string) => void;
  showSearch: boolean;
}

export default function AppTopBar({ collapsed, search, onSearch, showSearch }: AppTopBarProps) {
  return <header className={`app-topbar${collapsed ? ' app-topbar--collapsed' : ''}`}>
    <style>{`
      .app-layout { position: relative; padding-top: 72px; }
      .app-topbar { position: absolute; inset: 0 0 auto; height: 72px; display: flex; align-items: center; background: #fff; border-bottom: 1px solid #e5e7eb; color: #20252b; z-index: 20; }
      .app-topbar__logo { width: 240px; height: 100%; flex-shrink: 0; display: flex; align-items: center; padding: 14px 28px; border-right: 1px solid #e5e7eb; transition: width .3s; }
      .app-topbar__logo img { width: 145px; max-width: 100%; height: 44px; object-fit: contain; object-position: left center; }
      .app-topbar--collapsed .app-topbar__logo { width: 70px; padding: 12px; }
      .app-topbar__name { font-size: 15px; font-weight: 600; margin-left: 32px; }
      .app-topbar__search { position: relative; margin: 0 32px 0 auto; width: min(340px, 35vw); }
      .app-topbar__search svg { position: absolute; width: 18px; height: 18px; left: 12px; top: 11px; color: #626b75; }
      .app-topbar__search input { width: 100%; height: 40px; border: 1px solid #dce1e6; border-radius: 8px; background: #f7f8fa; color: #20252b; padding: 8px 12px 8px 38px; font: inherit; font-size: 13px; }
      .app-topbar__search input:focus-visible { outline: 2px solid #b3000c; outline-offset: 2px; }
      .app-layout .sidebar-header { display: none; }
      .app-layout .sidebar { background: #252e37; }
      @media(max-width:767px) {
        .app-topbar__logo, .app-topbar--collapsed .app-topbar__logo { width: 110px; padding: 12px; }
        .app-topbar__name { display: none; }
        .app-topbar__search { margin-right: 16px; width: min(300px, 60vw); }
        .app-layout .sidebar { top: 72px; height: calc(100% - 72px); }
      }
      @media print { .app-topbar { display: none; } .app-layout { padding-top: 0; } }
    `}</style>
    <div className="app-topbar__logo"><img src="/drk-logo.png" alt="Deutsches Rotes Kreuz" /></div>
    <span className="app-topbar__name">DRK Serviceportal</span>
    {showSearch && <label className="app-topbar__search"><SearchIcon /><input aria-label="Tickets durchsuchen" placeholder="Tickets durchsuchen …" value={search} onChange={event => onSearch(event.target.value)} /></label>}
  </header>;
}
