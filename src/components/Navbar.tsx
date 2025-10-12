import { Search, Bell } from 'lucide-react';
import ArflixLogo from './ArflixLogo';
import type { Page } from '../types/navigation';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const navItems: Array<{ id: Page; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'search', label: 'Search' },
    { id: 'addons', label: 'Add-ons' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="fixed top-0 left-[90px] right-0 z-40 bg-gradient-to-b from-black/80 to-transparent">
      <div className="px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <ArflixLogo size="sm" />
          <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`text-base font-medium transition-colors ${
                currentPage === item.id
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="p-2 hover:bg-white/10 rounded-full transition-colors focus-glow"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-white" />
          </button>

          <button
            className="p-2 hover:bg-white/10 rounded-full transition-colors focus-glow relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <button className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 overflow-hidden focus-glow">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
              alt="Profile"
              className="w-full h-full"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
