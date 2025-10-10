import { useState, useEffect } from 'react';
import { AuthWrapper } from './components/AuthWrapper';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { DetailsPage } from './pages/DetailsPage';
import { PlayerPage } from './pages/PlayerPage';
import { AddonsPage } from './pages/AddonsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SearchPage } from './pages/SearchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { addonAPI } from './lib/api';
import type { Addon } from './lib/supabase';

type Page = 'home' | 'search' | 'addons' | 'watchlist' | 'settings' | 'details' | 'player';

interface PageState {
  page: Page;
  data?: any;
}

function App() {
  const [pageHistory, setPageHistory] = useState<PageState[]>([{ page: 'home' }]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const currentPage = pageHistory[pageHistory.length - 1];

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await loadAddons();
      }
    }

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAddons() {
    try {
      const { addons: data } = await addonAPI.list();
      setAddons(data);

      if (data.length === 0 && checkingOnboarding) {
        setShowOnboarding(true);
      }
      setCheckingOnboarding(false);
    } catch (error) {
      console.error('Failed to load addons:', error);
      setCheckingOnboarding(false);
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    loadAddons();
  }

  function navigate(page: Page, data?: any) {
    setPageHistory([...pageHistory, { page, data }]);
  }

  function goBack() {
    if (pageHistory.length > 1) {
      setPageHistory(pageHistory.slice(0, -1));
    }
  }

  function renderPage() {
    switch (currentPage.page) {
      case 'home':
        return <HomePage onNavigate={navigate} />;

      case 'search':
        return <SearchPage onNavigate={navigate} />;

      case 'addons':
        return <AddonsPage />;

      case 'watchlist':
        return <WatchlistPage onNavigate={navigate} />;

      case 'settings':
        return <SettingsPage />;

      case 'details':
        return (
          <DetailsPage
            contentId={currentPage.data?.id}
            contentType={currentPage.data?.type}
            addonId={currentPage.data?.addonId}
            onNavigate={navigate}
            onBack={goBack}
          />
        );

      case 'player':
        return (
          <PlayerPage
            contentId={currentPage.data?.id}
            contentType={currentPage.data?.type}
            addonId={currentPage.data?.addonId}
            title={currentPage.data?.title || 'Playing'}
            seasonNumber={currentPage.data?.season}
            episodeNumber={currentPage.data?.episode}
            onBack={goBack}
          />
        );

      default:
        return <HomePage onNavigate={navigate} />;
    }
  }

  return (
    <AuthWrapper>
      {() => (
        <div className="min-h-screen text-white">
          {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}

          {currentPage.page !== 'player' && (
            <Sidebar currentPage={currentPage.page} onNavigate={navigate} />
          )}

          <main className={currentPage.page !== 'player' ? 'ml-[90px]' : ''}>
            {renderPage()}
          </main>
        </div>
      )}
    </AuthWrapper>
  );
}

export default App;
