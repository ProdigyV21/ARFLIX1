import { Home, Search, Bookmark, Settings } from 'lucide-react';
import ArflixLogo from './ArflixLogo';
import type { Page } from '../types/navigation';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const navItems: Array<{ id: Page; icon: any; label: string }> = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'watchlist', icon: Bookmark, label: 'Watchlist' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[90px] flex flex-col items-center py-8 z-50 bg-gradient-to-r from-black/80 via-black/40 to-transparent">
      <div className="mb-12">
        <ArflixLogo size="md" compact />
      </div>

      <nav className="flex-1 flex flex-col gap-8 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all focus-glow ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              aria-label={item.label}
            >
              <Icon className="w-6 h-6" strokeWidth={2} />
            </button>
          );
        })}
      </nav>

      <button
        className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 overflow-hidden focus-glow shadow-lg"
        aria-label="Profile"
      >
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
          alt="Profile"
          className="w-full h-full"
        />
      </button>
    </aside>
  );
}
