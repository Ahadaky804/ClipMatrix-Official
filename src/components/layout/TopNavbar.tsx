import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Menu,
  Plus,
  User,
  Settings,
  Database,
  Check,
  Film,
  Users,
  LayoutGrid,
} from 'lucide-react';
import {
  AppNotification,
  GeneratedClip,
  NavigationPageId,
  StreamerProfile,
} from '../../types/clipmatrix';
import { SIDEBAR_NAV_ITEMS } from './Sidebar';

interface TopNavbarProps {
  activePage: NavigationPageId;
  onNavigate: (page: NavigationPageId) => void;
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  notifications: AppNotification[];
  onMarkAllNotificationsRead: () => void;
  clips: GeneratedClip[];
  streamers: StreamerProfile[];
  onQuickCreateClip: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activePage,
  onNavigate,
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  notifications,
  onMarkAllNotificationsRead,
  clips,
  streamers,
  onQuickCreateClip,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const currentNavItem =
    SIDEBAR_NAV_ITEMS.find((item) => item.id === activePage) || SIDEBAR_NAV_ITEMS[0];

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchingPages = normalizedQuery
    ? SIDEBAR_NAV_ITEMS.filter((p) => p.label.toLowerCase().includes(normalizedQuery)).slice(0, 4)
    : [];
  const matchingClips = normalizedQuery
    ? clips.filter((c) => c.title.toLowerCase().includes(normalizedQuery)).slice(0, 3)
    : [];
  const matchingStreamers = normalizedQuery
    ? streamers
        .filter(
          (s) =>
            s.name.toLowerCase().includes(normalizedQuery) ||
            s.handle.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, 3)
    : [];

  return (
    <header className="h-16 px-4 lg:px-6 bg-[#0C0E16]/95 border-b border-[#1C2030] flex items-center justify-between gap-4 shrink-0 z-30">
      {/* Zone 1: Mobile Trigger + Breadcrumb Context */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#141824] border border-[#22283A] text-slate-300 hover:text-white"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-sm whitespace-nowrap">
          <span className="text-slate-500 hidden sm:inline">ClipMatrix</span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-display font-semibold text-white">
            {currentNavItem.label}
          </span>
        </div>
      </div>

      {/* Zone 2: Global Search Bar */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <label htmlFor="global-studio-search" className="sr-only">
          Search pages, clips, or streamers
        </label>
        <div className="relative flex items-center">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="global-studio-search"
            type="search"
            value={searchQuery}
            onFocus={() => setShowSearchDropdown(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowSearchDropdown(true);
            }}
            placeholder="Search pages, generated clips, or streamers..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#121521] border border-[#22283B] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
          />
        </div>

        {/* Instant Search Results Dropdown */}
        {showSearchDropdown && normalizedQuery.length > 0 && (
          <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#121624] border border-[#252C42] shadow-xl p-2 space-y-2 z-50 max-h-80 overflow-y-auto">
            {matchingPages.length === 0 &&
              matchingClips.length === 0 &&
              matchingStreamers.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-400">
                  No matching pages, clips, or streamers for "{searchQuery}".
                </div>
              )}

            {matchingPages.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                  Studio Pages
                </div>
                {matchingPages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onNavigate(p.id);
                      setShowSearchDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-[#1B2032] text-left"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
                    <span>Go to {p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {matchingClips.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                  Generated Clips
                </div>
                {matchingClips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onNavigate('generated-clips');
                      setShowSearchDropdown(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-[#1B2032] text-left"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {c.aspectRatio}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {matchingStreamers.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                  Streamers
                </div>
                {matchingStreamers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onNavigate('my-streamers');
                      setShowSearchDropdown(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-[#1B2032] text-left"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {s.name} ({s.handle})
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {s.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Quick Create Action, Notifications & User Profile Menu */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onQuickCreateClip}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Clip Job</span>
        </button>

        {/* Notification Bell Menu */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label={`Notifications (${unreadCount} unread)`}
            aria-expanded={showNotifications}
            className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#121521] border border-[#22283B] text-slate-300 hover:text-white transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-purple-600 text-[10px] font-mono text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#121624] border border-[#252C42] shadow-xl p-3 z-50 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E2436]">
                <span className="text-xs font-display font-semibold text-white">
                  Studio Notifications
                </span>
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onNavigate(n.targetPage);
                      setShowNotifications(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                      n.read
                        ? 'bg-[#0E111B] text-slate-400 hover:bg-[#171C2C]'
                        : 'bg-[#171C2E] text-slate-200 border border-purple-500/25 hover:bg-[#1E243B]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-medium text-white">
                      <span className="truncate">{n.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {n.detail}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="User profile menu"
            aria-expanded={showProfileMenu}
            className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg bg-[#121521] border border-[#22283B] hover:border-slate-700 text-xs text-slate-200 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-display font-bold text-[11px] text-white">
              CM
            </div>
            <span className="hidden md:inline font-medium whitespace-nowrap">
              Creator Studio
            </span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl bg-[#121624] border border-[#252C42] shadow-xl p-2 z-50 space-y-1">
              <div className="px-3 py-2 border-b border-[#1E2436]">
                <div className="text-xs font-semibold text-white">Personal AI Studio</div>
                <div className="text-[11px] text-slate-400">
                  Phase 1 · Sample Environment
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigate('settings');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#1B2032]"
              >
                <Settings className="w-3.5 h-3.5 text-purple-400" />
                <span>Studio &amp; Backend Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('social-accounts');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#1B2032]"
              >
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Connected Social Channels</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('settings');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#1B2032]"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>PostgreSQL &amp; FastAPI Specs</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
