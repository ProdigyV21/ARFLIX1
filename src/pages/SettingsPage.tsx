import { useRef, useState, useEffect } from 'react';
import { Info, Languages, Link, Trash2, Plus, CheckCircle, XCircle, Copy } from 'lucide-react';
import { useFocusManager } from '../lib/focus';
import { supabase } from '../lib/supabase';
import { addonAPI } from '../lib/api';

const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'it', label: 'Italiano (Italian)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'ru', label: 'Русский (Russian)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
];

type Addon = {
  id: string;
  url: string;
  manifest_url?: string; // Keeping for backwards compatibility
  name: string;
  enabled: boolean;
};

export function SettingsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [preferredSubtitle, setPreferredSubtitle] = useState('en');
  const [saving, setSaving] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [addingAddon, setAddingAddon] = useState(false);
  const [addonError, setAddonError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Free subtitle addons that don't require API keys
  const freeSubtitleAddons = [
    {
      name: 'OpenSubtitles (Official)',
      url: 'https://opensubtitles-v3.strem.io/manifest.json',
      description: 'Free subtitles from OpenSubtitles.org - No API key needed'
    },
    {
      name: 'Subsource',
      url: 'https://subsource.stremio.net/manifest.json',
      description: 'Free subtitles from multiple sources'
    }
  ];

  useFocusManager(containerRef, {
    autofocus: true,
  });

  useEffect(() => {
    loadPreferences();
    loadAddons();
  }, []);

  async function loadPreferences() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('preferred_subtitle_language')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.preferred_subtitle_language) {
        setPreferredSubtitle(data.preferred_subtitle_language);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }

  async function updateSubtitlePreference(langCode: string) {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('users')
        .update({ preferred_subtitle_language: langCode })
        .eq('id', user.id);

      if (error) throw error;
      setPreferredSubtitle(langCode);
    } catch (error) {
      console.error('Failed to update preference:', error);
    } finally {
      setSaving(false);
    }
  }

  async function loadAddons() {
    try {
      const data = await addonAPI.list();
      setAddons(data.addons || []);
    } catch (error) {
      console.error('Failed to load addons:', error);
    }
  }

  async function addAddon() {
    if (!newAddonUrl.trim()) return;

    try {
      setAddingAddon(true);
      setAddonError('');
      await addonAPI.add(newAddonUrl.trim());
      setNewAddonUrl('');
      await loadAddons();
    } catch (error: any) {
      setAddonError(error.message || 'Failed to add add-on. Please check the URL.');
    } finally {
      setAddingAddon(false);
    }
  }

  async function removeAddon(addonUrl: string) {
    try {
      await addonAPI.remove(addonUrl);
      await loadAddons();
    } catch (error) {
      console.error('Failed to remove addon:', error);
      alert('Failed to remove addon. Please try again.');
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  return (
    <div ref={containerRef} className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-5xl font-bold mb-8">Settings</h1>

      <div className="space-y-8">
        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Languages className="w-8 h-8" />
            <h2 className="text-3xl font-semibold">Subtitle Preferences</h2>
          </div>

          <div className="space-y-4">
            <p className="text-muted-foreground mb-4">
              Select your preferred subtitle language. This will be automatically selected when playing content.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SUBTITLE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  data-focusable="true"
                  onClick={() => updateSubtitlePreference(lang.code)}
                  disabled={saving}
                  className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                    preferredSubtitle === lang.code
                      ? 'bg-white text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  } disabled:opacity-50`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link className="w-8 h-8" />
            <h2 className="text-3xl font-semibold">Manage Add-ons</h2>
          </div>

          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              View, add, or remove the add-on URLs connected to ArFlix. Add-ons provide streaming sources.
            </p>

            {addons.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Current Add-ons</h3>
                <div className="space-y-3">
                  {addons.map((addon) => (
                    <div
                      key={addon.id}
                      className="bg-white/5 rounded-lg p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{addon.name}</h4>
                          {addon.enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {addon.manifest_url}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          data-focusable="true"
                        onClick={() => copyUrl(addon.manifest_url || addon.url)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          {copiedUrl === addon.manifest_url ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          data-focusable="true"
                          onClick={() => removeAddon(addon.url || addon.manifest_url || '')}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Languages className="w-6 h-6 text-blue-400" />
                Free Subtitle Add-ons (No API Key Required)
              </h3>
              <div className="space-y-3 mb-6">
                {freeSubtitleAddons.map((addon) => (
                  <div
                    key={addon.url}
                    className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{addon.name}</h4>
                      <p className="text-sm text-blue-300 mb-2">{addon.description}</p>
                      <p className="text-xs text-muted-foreground truncate">{addon.url}</p>
                    </div>
                    <button
                      data-focusable="true"
                      onClick={() => {
                        setNewAddonUrl(addon.url);
                        addAddon();
                      }}
                      disabled={addingAddon || addons.some(a => a.url === addon.url || a.manifest_url === addon.url)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      {addons.some(a => a.url === addon.url || a.manifest_url === addon.url) ? 'Added' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Add Custom Add-on</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Paste a valid Stremio add-on URL (e.g., stremio://... or https://.../manifest.json)
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAddonUrl}
                  onChange={(e) => setNewAddonUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAddon()}
                  placeholder="https://example.com/manifest.json"
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                />
                <button
                  data-focusable="true"
                  onClick={addAddon}
                  disabled={addingAddon || !newAddonUrl.trim()}
                  className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {addingAddon ? 'Adding...' : 'Add'}
                </button>
              </div>
              {addonError && (
                <p className="mt-2 text-sm text-red-400">{addonError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Info className="w-8 h-8" />
            <h2 className="text-3xl font-semibold">About ArFlix</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-3">What is ArFlix?</h3>
              <p className="text-muted-foreground leading-relaxed">
                ArFlix is a streaming catalog and tracker. It helps you discover titles, watch trailers,
                and keep track of movies, series, and anime you're interested in.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2 font-semibold">
                ArFlix does not host, store, or distribute any audiovisual content.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">How It Works</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Browse catalogs and trailers from publicly available metadata providers</li>
                <li>Track what you've watched, add items to your watchlist, and resume where you left off</li>
                <li>Optional: Connect third-party Stremio add-ons to request streams</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                <strong className="text-white">Important:</strong> Playback via third-party add-ons is entirely at your own risk
                and subject to those services' terms and your local laws. ArFlix neither endorses nor verifies
                any specific add-on or source.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Add-ons (Optional)</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You may supply one or more Stremio add-on URLs. ArFlix simply passes your requests to the add-on;
                it does not bundle any add-ons itself.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                <strong className="text-white">Recommended:</strong> Use Torrentio for streaming content.
                Torrentio is a popular, reliable Stremio add-on that works well with ArFlix.
              </p>
              
              <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <p className="text-white font-medium mb-1">✨ With Debrid Service (Recommended)</p>
                  <p className="text-sm text-muted-foreground">
                    For the best experience, configure Torrentio with a debrid service like Real-Debrid, Torbox, or AllDebrid.
                    This provides instant, high-quality streams.
                  </p>
                </div>
                
                <div>
                  <p className="text-white font-medium mb-1">🌐 Without Debrid (Free)</p>
                  <p className="text-sm text-muted-foreground">
                    You can also use Torrentio without a debrid service. It will return torrent magnet links that work
                    with torrent streaming apps or WebTorrent-compatible players.
                  </p>
                </div>
              </div>
              
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-white">Tip:</strong> Use only sources and services that you are legally
                allowed to access in your jurisdiction.
              </p>
              <a
                href="https://torrentio.strem.fun/configure"
                target="_blank"
                rel="noopener noreferrer"
                data-focusable="true"
                className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Configure Torrentio →
              </a>
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-xl font-semibold mb-2">Version</p>
              <p className="text-sm text-muted-foreground mb-4">ArFlix v2.0.0</p>
              <p className="text-sm text-muted-foreground">
                ArFlix is a catalog browser and tracker. Use only lawful sources. Playback features are
                provided solely through user-supplied third-party add-ons.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-secondary/50 backdrop-blur rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-4">Navigation</h2>
          <div className="grid gap-4 text-muted-foreground">
            <div>
              <span className="text-white font-medium">Arrow Keys:</span> Navigate between elements
            </div>
            <div>
              <span className="text-white font-medium">Enter:</span> Select/activate
            </div>
            <div>
              <span className="text-white font-medium">Escape/Backspace:</span> Go back
            </div>
            <div>
              <span className="text-white font-medium">Tab:</span> Cycle through focusable elements
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
