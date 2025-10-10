import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, Power, Loader2, ExternalLink, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useFocusManager, useFocusable } from '../lib/focus';
import { addonAPI } from '../lib/api';
import type { Addon } from '../lib/supabase';

const AIOSTREAMS_CONFIGURE_URL = 'https://aiostreams.elfhosted.com/stremio/configure';

export function AddonsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const aioButtonRef = useRef<HTMLButtonElement>(null);

  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configureWarning, setConfigureWarning] = useState(false);
  const [healthChecking, setHealthChecking] = useState<Set<string>>(new Set());

  useFocusable(addButtonRef);
  useFocusable(aioButtonRef);

  useFocusManager(containerRef, {
    autofocus: false,
  });

  useEffect(() => {
    loadAddons();
  }, []);

  async function loadAddons() {
    try {
      setLoading(true);
      const { addons: data } = await addonAPI.list();
      setAddons(data);
    } catch (err) {
      console.error('Failed to load addons:', err);
      setError('Failed to load add-ons');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAddon() {
    if (!newAddonUrl.trim()) return;

    const url = newAddonUrl.trim();

    if (url.includes('/configure')) {
      setConfigureWarning(true);
      setError('This is a configuration link. Complete setup there and paste the final add-on URL that returns manifest.json.');
      return;
    }

    try {
      setAdding(true);
      setError(null);
      setConfigureWarning(false);
      await addonAPI.add(url);
      setNewAddonUrl('');
      await loadAddons();
    } catch (err: any) {
      console.error('Failed to add addon:', err);
      setError(err.message || 'Failed to add add-on');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(addon: Addon) {
    try {
      await addonAPI.toggle(addon.url, !addon.enabled);
      await loadAddons();
    } catch (err) {
      console.error('Failed to toggle addon:', err);
    }
  }

  async function handleRemove(url: string) {
    if (!confirm('Are you sure you want to remove this add-on?')) return;

    try {
      await addonAPI.remove(url);
      await loadAddons();
    } catch (err) {
      console.error('Failed to remove addon:', err);
    }
  }

  async function handleCheckHealth(url: string) {
    try {
      setHealthChecking(prev => new Set(prev).add(url));
      await addonAPI.checkHealth(url);
      await loadAddons();
    } catch (err) {
      console.error('Failed to check health:', err);
    } finally {
      setHealthChecking(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen p-8 max-w-6xl mx-auto">
      <h1 className="text-5xl font-bold mb-8">Add-ons Manager</h1>

      <div className="mb-12 bg-secondary/50 backdrop-blur rounded-lg p-8">
        <h2 className="text-2xl font-semibold mb-4">Add New Add-on</h2>
        <p className="text-muted-foreground mb-6">
          Configure AIOStreams or paste any Stremio add-on manifest URL
        </p>

        <div className="mb-6">
          <button
            ref={aioButtonRef}
            data-focusable="true"
            onClick={() => window.open(AIOSTREAMS_CONFIGURE_URL, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/30 rounded-lg font-semibold transition-all group"
          >
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="text-lg">Configure AIOStreams (Recommended)</span>
            <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
          </button>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Complete setup there (including debrid keys if you have them), then paste the URL below
          </p>
        </div>

        <div className="flex gap-4">
          <input
            ref={inputRef}
            type="text"
            value={newAddonUrl}
            onChange={(e) => setNewAddonUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAddon()}
            placeholder="https://example.com/manifest.json"
            className="flex-1 px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent"
          />

          <button
            ref={addButtonRef}
            data-focusable="true"
            onClick={handleAddAddon}
            disabled={adding || !newAddonUrl.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Add-on
              </>
            )}
          </button>
        </div>

        {error && (
          <div className={`mt-4 p-4 border rounded-lg flex items-start gap-3 ${
            configureWarning
              ? 'bg-yellow-500/20 border-yellow-500/50'
              : 'bg-red-500/20 border-red-500/50'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              configureWarning ? 'text-yellow-300' : 'text-red-300'
            }`} />
            <p className={configureWarning ? 'text-yellow-200' : 'text-red-200'}>{error}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-accent/30 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">Example add-on URLs:</p>
          <div className="space-y-1">
            <code className="block text-sm text-white/80">
              https://v3-cinemeta.strem.io/manifest.json
            </code>
            <code className="block text-sm text-white/80">
              https://aiostreams.elfhosted.com/stremio/manifest.json
            </code>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-semibold mb-6">Your Add-ons ({addons.length})</h2>

        {addons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-xl">No add-ons yet. Add one above to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {addons.map((addon) => (
              <div
                key={addon.id}
                className="bg-secondary/50 backdrop-blur rounded-lg p-6 flex items-center gap-6 hover:bg-secondary/70 transition-colors"
              >
                {addon.icon && (
                  <img
                    src={addon.icon}
                    alt={addon.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-semibold">{addon.name}</h3>
                    {addon.version && (
                      <span className="text-xs px-2 py-1 bg-white/10 rounded">
                        v{addon.version}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      addon.last_health === 'ok'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {addon.last_health === 'ok' ? 'Healthy' : 'Error'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground/60 truncate">
                    {addon.url}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-focusable="true"
                    onClick={() => handleCheckHealth(addon.url)}
                    disabled={healthChecking.has(addon.url)}
                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Check health"
                  >
                    {healthChecking.has(addon.url) ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    data-focusable="true"
                    onClick={() => handleToggle(addon)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                      ${addon.enabled
                        ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'}
                    `}
                  >
                    <Power className="w-4 h-4" />
                    {addon.enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    data-focusable="true"
                    onClick={() => handleRemove(addon.url)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    aria-label="Remove add-on"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
