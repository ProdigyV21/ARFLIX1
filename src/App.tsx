import { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationContainer } from './components/Notifications';
import { AuthWrapper } from './components/AuthWrapper';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { addonAPI } from './lib/api';
import type { Page } from './types/navigation';

// Lazy load heavy pages
const DetailsPage = lazy(() => import('./pages/DetailsPage').then(m => ({ default: m.DetailsPage })));
const PlayerPageNew = lazy(() => import('./pages/PlayerPageNew').then(m => ({ default: m.PlayerPageNew })));
const PlayerTestPage = lazy(() => import('./pages/PlayerTestPage').then(m => ({ default: m.PlayerTestPage })));
const AddonsPage = lazy(() => import('./pages/AddonsPage').then(m => ({ default: m.AddonsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

interface PageState {
  page: Page;
  data?: any;
}

function App() {
  const [pageHistory, setPageHistory] = useState<PageState[]>([{ page: 'home' }]);
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

  // Handle hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash.startsWith('player?')) {
        const dataParam = hash.split('?data=')[1];
        if (dataParam) {
          try {
            const data = JSON.parse(decodeURIComponent(dataParam));
            navigate('player', data);
          } catch (e) {
            console.error('Failed to parse player data from hash:', e);
          }
        }
      }
    };

    // Handle initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  async function loadAddons() {
    try {
      const { addons: data } = await addonAPI.list();

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
    const page = (() => {
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

        case 'player-test':
          return <PlayerTestPage onBack={goBack} />;

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
            <PlayerPageNew
              contentId={currentPage.data?.id}
              contentType={currentPage.data?.type}
              addonId={currentPage.data?.addonId}
              title={currentPage.data?.title || 'Playing'}
              poster={currentPage.data?.poster}
              backdrop={currentPage.data?.backdrop}
              seasonNumber={currentPage.data?.season}
              episodeNumber={currentPage.data?.episode}
              onBack={goBack}
            />
          );

        default:
          return <HomePage onNavigate={navigate} />;
      }
    })();

    return <Suspense fallback={<PageLoader />}>{page}</Suspense>;
  }

  return (
    <ErrorBoundary>
      <NotificationContainer />
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
    </ErrorBoundary>
  );
}

export default App;
