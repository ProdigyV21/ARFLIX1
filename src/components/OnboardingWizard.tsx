import { useState, useRef } from 'react';
import { Film, ExternalLink, Plus, ArrowRight } from 'lucide-react';
import { useFocusManager, useFocusable } from '../lib/focus';
import { addonAPI } from '../lib/api';

const AIOSTREAMS_CONFIGURE_URL = 'https://aiostreams.elfhosted.com/stremio/configure';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aioButtonRef = useRef<HTMLButtonElement>(null);
  const manualButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);

  const [step, setStep] = useState<'welcome' | 'addon'>('welcome');
  const [addonUrl, setAddonUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusable(aioButtonRef);
  useFocusable(manualButtonRef);
  useFocusable(addButtonRef);
  useFocusable(skipButtonRef);

  useFocusManager(containerRef, {
    autofocus: true,
  });

  async function handleAddAddon() {
    if (!addonUrl.trim()) return;

    try {
      setAdding(true);
      setError(null);
      await addonAPI.add(addonUrl.trim());
      onComplete();
    } catch (err: any) {
      console.error('Failed to add addon:', err);
      setError(err.message || 'Failed to add add-on. Please check the URL.');
    } finally {
      setAdding(false);
    }
  }

  function openAIOStreams() {
    window.open(AIOSTREAMS_CONFIGURE_URL, '_blank', 'noopener,noreferrer');
  }

  if (step === 'welcome') {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black flex items-center justify-center p-8 z-50"
      >
        <div className="max-w-2xl w-full text-center">
          <div className="mb-8">
            <Film className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-6xl font-bold mb-4">Welcome to ArFlix</h1>
            <p className="text-2xl text-muted-foreground">
              Your personal streaming catalog browser
            </p>
          </div>

          <div className="bg-secondary/50 backdrop-blur rounded-lg p-8 mb-8">
            <h2 className="text-3xl font-semibold mb-4">Get Started</h2>
            <p className="text-lg text-muted-foreground mb-6">
              ArFlix displays content from Stremio add-ons. Add your first add-on to begin
              browsing catalogs and watching streams.
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              ref={skipButtonRef}
              data-focusable="true"
              onClick={onComplete}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-lg font-medium transition-colors"
            >
              Skip for now
            </button>

            <button
              ref={aioButtonRef}
              data-focusable="true"
              onClick={() => setStep('addon')}
              className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-lg text-lg font-semibold hover:bg-white/90 transition-colors"
            >
              Add First Add-on
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center p-8 z-50"
    >
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Add Your First Add-on</h1>
          <p className="text-xl text-muted-foreground">
            Install AIOStreams for Stremio or add any other Stremio add-on URL
          </p>
        </div>

        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Step 1: Configure AIOStreams</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Install AIOStreams for Stremio. This lets you connect your own debrid keys
            (optional) on the AIOStreams site. After finishing, copy the final Stremio
            add-on URL and paste it below.
          </p>

          <button
            ref={aioButtonRef}
            data-focusable="true"
            onClick={openAIOStreams}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors w-full justify-center"
          >
            <ExternalLink className="w-5 h-5" />
            Configure AIOStreams (Opens in new tab)
          </button>
        </div>

        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            Step 2: Add Any Stremio Add-on URL
          </h2>

          <div className="space-y-4">
            <input
              type="text"
              value={addonUrl}
              onChange={(e) => setAddonUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAddon()}
              placeholder="Paste your Stremio add-on URL (e.g., https://aiostreams.../stremio/manifest.json)"
              className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent"
            />

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                ref={manualButtonRef}
                data-focusable="true"
                onClick={onComplete}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors"
              >
                Skip
              </button>

              <button
                ref={addButtonRef}
                data-focusable="true"
                onClick={handleAddAddon}
                disabled={adding || !addonUrl.trim()}
                className="flex-1 flex items-center gap-2 justify-center px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? (
                  <>Adding...</>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Add Add-on & Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Example: https://v3-cinemeta.strem.io/manifest.json</p>
        </div>
      </div>
    </div>
  );
}
