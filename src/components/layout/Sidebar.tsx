import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Users,
  Film,
  Mic2,
  Wand2,
  Scissors,
  MessageSquareQuote,
  CalendarDays,
  Share2,
  CheckCircle2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { NavigationPageId } from '../../types/clipmatrix';
import { ClipMatrixLogo } from '../brand/ClipMatrixLogo';

export interface NavItemConfig {
  id: NavigationPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Workspace' | 'AI Production' | 'Distribution & Insights';
}

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'live-streams', label: 'Live Streams', icon: Radio, group: 'Workspace' },
  { id: 'my-streamers', label: 'My Streamers', icon: Users, group: 'Workspace' },
  { id: 'long-video', label: 'Long Video to Clips', icon: Film, group: 'AI Production' },
  { id: 'podcast-clips', label: 'Podcast Clips', icon: Mic2, group: 'AI Production' },
  { id: 'ai-editing', label: 'AI Editing Studio', icon: Wand2, group: 'AI Production' },
  { id: 'generated-clips', label: 'Generated Clips', icon: Scissors, group: 'AI Production' },
  { id: 'caption-studio', label: 'Caption Studio', icon: MessageSquareQuote, group: 'AI Production' },
  { id: 'content-calendar', label: 'Content Calendar', icon: CalendarDays, group: 'Distribution & Insights' },
  { id: 'social-accounts', label: 'Social Accounts', icon: Share2, group: 'Distribution & Insights' },
  { id: 'upload-approval', label: 'Upload Approval', icon: CheckCircle2, group: 'Distribution & Insights' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Distribution & Insights' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Distribution & Insights' },
];

interface SidebarProps {
  activePage: NavigationPageId;
  onNavigate: (page: NavigationPageId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  liveCount: number;
  pendingApprovalCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  liveCount,
  pendingApprovalCount,
}) => {
  const groups: ('Workspace' | 'AI Production' | 'Distribution & Insights')[] = [
    'Workspace',
    'AI Production',
    'Distribution & Insights',
  ];

  const handleSelect = (id: NavigationPageId) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary Sidebar Navigation"
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#0C0E16] border-r border-[#1C2030] transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-64'} shrink-0`}
      >
        {/* Top Brand Row */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#1C2030]">
          <button
            type="button"
            onClick={() => handleSelect('overview')}
            className="flex items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-purple-500 rounded-lg"
            aria-label="ClipMatrix Home Overview"
          >
            <ClipMatrixLogo collapsed={collapsed} />
          </button>

          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-white hover:bg-[#171B29] transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-white hover:bg-[#171B29]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {groups.map((groupName) => {
            const items = SIDEBAR_NAV_ITEMS.filter((item) => item.group === groupName);
            return (
              <div key={groupName} className="space-y-1">
                {!collapsed && (
                  <div className="px-2.5 pb-1 text-[11px] font-medium text-slate-500 tracking-wide">
                    {groupName}
                  </div>
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  const countValue =
                    item.id === 'live-streams'
                      ? liveCount
                      : item.id === 'upload-approval'
                      ? pendingApprovalCount
                      : null;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/15 text-white border border-purple-500/35'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#141824] border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-purple-400' : 'text-slate-400'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>

                      {!collapsed && countValue !== null && countValue > 0 && (
                        <span className="text-xs font-mono tabular-nums text-slate-300">
                          {countValue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Studio Note */}
        <div className="p-3 border-t border-[#1C2030]">
          {!collapsed ? (
            <div className="px-2.5 py-2 rounded-lg bg-[#111420] border border-[#1E2436] text-xs text-slate-400 space-y-0.5">
              <div className="font-medium text-slate-200">ClipMatrix Studio v2.0</div>
              <div className="text-[11px] text-slate-400">
                AI Video &amp; Clipping Engine
              </div>
            </div>
          ) : (
            <div
              className="text-center text-[10px] font-mono text-slate-400"
              title="ClipMatrix Studio v2.0"
            >
              v2
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
