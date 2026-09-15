// src/components/navbar.tsx
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NotificationBell from './notificationBell';
import LanguageSwitcher from './languageSwitcher';

interface NavLeaf<T extends string> {
  key: T;
  /** i18next translation key, e.g. 'nav.quality' — not literal display text. */
  label: string;
  adminOnly?: boolean;
}

interface NavGroup<T extends string> {
  type: 'group';
  /** i18next translation key, e.g. 'nav.aiTools' — not literal display text. */
  label: string;
  adminOnly?: boolean;
  items: NavLeaf<T>[];
}

// Regular tab entries keep their original shape (key/label[/adminOnly]) —
// no forced `type` field, so existing callers (home.tsx) don't need to
// change. Only "group" entries need type:'group'.
export type NavEntry<T extends string> = NavLeaf<T> | NavGroup<T>;

// Generic T carries whatever Tab type the caller passes in.
interface NavbarProps<T extends string> {
  currentUser: string | null;
  activeTab: T;
  onTabChange: (tab: T) => void;
  onLogout: () => void;
  isAdmin: boolean;

  // Custom nav-button entries (lets each page dynamically supply its own
  // buttons). Supports two entry types: a regular tab (NavLeaf) or a
  // dropdown group (NavGroup, which nests several related tabs under one
  // button — e.g. "Process Simulation" + "AI Model Tuning").
  navItems: readonly NavEntry<T>[];

  // The tab to navigate to when the notification center's "View all" is clicked (usually "Real-Time Alerts")
  onViewAllNotifications?: () => void;
}

function isGroup<T extends string>(entry: NavEntry<T>): entry is NavGroup<T> {
  return (entry as NavGroup<T>).type === 'group';
}

function MenuIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function Navbar<T extends string>({
  currentUser,
  activeTab,
  onTabChange,
  onLogout,
  isAdmin,
  navItems,
  onViewAllNotifications,
}: NavbarProps<T>) {
  const { t } = useTranslation();
  const visibleEntries: NavEntry<T>[] = navItems
    .filter((entry) => !entry.adminOnly || isAdmin)
    .map((entry) =>
      isGroup(entry) ? { ...entry, items: entry.items.filter((item) => !item.adminOnly || isAdmin) } : entry
    );

  // Flattened into a single page list — used both for the "everything
  // doesn't fit" fallback menu and for looking up "the current tab's
  // display text," regardless of whether that page is nested in a group.
  const flatLeaves: NavLeaf<T>[] = visibleEntries.flatMap((entry) => (isGroup(entry) ? entry.items : [entry]));

  // As tab buttons accumulate, a narrow window may not fit them all; use
  // an actual measurement (not a fixed breakpoint) to decide whether the
  // "fully expanded tab row" fits, falling back to a dropdown menu if not.
  // A group entry only counts as ONE button's width in this measurement
  // row (the group's own label), not the sum of its children's widths —
  // that's the entire point of a group: fold several related tabs into
  // one button to reduce the row's total required width.
  const navAreaRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null);
  const groupRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useLayoutEffect(() => {
    const el = navAreaRef.current;
    const measure = measureRef.current;
    if (!el || !measure) return;

    const check = () => {
      setCollapsed(measure.scrollWidth > el.clientWidth);
    };
    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [visibleEntries.length]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (openGroupIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const container = groupRefs.current[openGroupIndex];
      if (container && !container.contains(e.target as Node)) setOpenGroupIndex(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openGroupIndex]);

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-8 py-4 flex justify-between items-center gap-4">
      <div className="flex items-center gap-6 min-w-0 flex-1">
        <h1 className="text-xl font-bold text-blue-400 flex-shrink-0">{t('common.appTitle')}</h1>

        <div ref={navAreaRef} className="relative flex-1 min-w-0">
          {/* Invisible measurement row: same content as the real button
              row, but never wraps or clips — used to measure how wide the
              fully-expanded row would need to be. Hidden off-screen, no
              layout impact. */}
          <div ref={measureRef} className="absolute invisible flex gap-2 pointer-events-none" aria-hidden="true">
            {visibleEntries.map((entry, i) => (
              <span key={isGroup(entry) ? `group-${i}` : entry.key} className="px-3 py-1.5 text-sm font-medium whitespace-nowrap">
                {t(entry.label)}
              </span>
            ))}
          </div>

          {collapsed ? (
            <div className="relative w-fit" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              >
                <MenuIcon />
                {t(flatLeaves.find((item) => item.key === activeTab)?.label ?? 'navbar.menu')}
              </button>

              {menuOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                  {visibleEntries.map((entry, i) => {
                    if (isGroup(entry)) {
                      // Group structure must be preserved even when collapsed
                      // into a single dropdown — expand the children under
                      // their own "AI Tools"-style node instead of flattening
                      // them into the overall list, so a user on a narrow
                      // window can still see "these two belong together."
                      return (
                        <div key={`group-${i}`} className="border-t border-slate-700/60 first:border-t-0 mt-1 pt-1 first:mt-0 first:pt-0">
                          <div className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {t(entry.label)}
                          </div>
                          {entry.items.map((item) => (
                            <button
                              key={item.key}
                              onClick={() => {
                                onTabChange(item.key);
                                setMenuOpen(false);
                              }}
                              className={`w-full text-left pl-6 pr-4 py-2 text-sm transition-colors ${
                                activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {t(item.label)}
                            </button>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={entry.key}
                        onClick={() => {
                          onTabChange(entry.key);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          activeTab === entry.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t(entry.label)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <nav className="flex gap-2">
              {visibleEntries.map((entry, i) => {
                if (isGroup(entry)) {
                  const groupActive = entry.items.some((item) => item.key === activeTab);
                  return (
                    <div
                      key={`group-${i}`}
                      className="relative"
                      ref={(el) => {
                        groupRefs.current[i] = el;
                      }}
                    >
                      <button
                        onClick={() => setOpenGroupIndex((cur) => (cur === i ? null : i))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                          groupActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t(entry.label)}
                        <ChevronIcon />
                      </button>
                      {openGroupIndex === i && (
                        <div className="absolute left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                          {entry.items.map((item) => (
                            <button
                              key={item.key}
                              onClick={() => {
                                onTabChange(item.key);
                                setOpenGroupIndex(null);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {t(item.label)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={entry.key}
                    onClick={() => onTabChange(entry.key)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === entry.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t(entry.label)}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <NotificationBell onViewAll={onViewAllNotifications} />
        <LanguageSwitcher />
        <span className="text-sm text-slate-300 hidden sm:inline">
          {t('navbar.userLabel')}: <span className="text-white font-semibold">{currentUser}</span>
        </span>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded text-sm transition-colors"
        >
          {t('navbar.logout')}
        </button>
      </div>
    </header>
  );
}
