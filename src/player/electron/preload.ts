/**
 * Electron preload script for mpv integration
 * Handles IPC communication between renderer and main process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Player control methods
  createPlayer: (playerId: string, config: any) => 
    ipcRenderer.invoke('player:create', playerId, config),
  
  loadSource: (playerId: string, source: any) => 
    ipcRenderer.invoke('player:load', playerId, source),
  
  play: (playerId: string) => 
    ipcRenderer.invoke('player:play', playerId),
  
  pause: (playerId: string) => 
    ipcRenderer.invoke('player:pause', playerId),
  
  seek: (playerId: string, seconds: number) => 
    ipcRenderer.invoke('player:seek', playerId, seconds),
  
  setVolume: (playerId: string, volume: number) => 
    ipcRenderer.invoke('player:volume', playerId, volume),
  
  setMuted: (playerId: string, muted: boolean) => 
    ipcRenderer.invoke('player:muted', playerId, muted),
  
  // Quality management
  getQualities: (playerId: string) => 
    ipcRenderer.invoke('player:qualities', playerId),
  
  setQuality: (playerId: string, quality: any) => 
    ipcRenderer.invoke('player:set-quality', playerId, quality),
  
  setQualityMax: (playerId: string) => 
    ipcRenderer.invoke('player:set-quality-max', playerId),
  
  // Audio track management
  getAudioTracks: (playerId: string) => 
    ipcRenderer.invoke('player:audio-tracks', playerId),
  
  setAudioTrack: (playerId: string, trackId: string) => 
    ipcRenderer.invoke('player:set-audio', playerId, trackId),
  
  // Text track management
  getTextTracks: (playerId: string) => 
    ipcRenderer.invoke('player:text-tracks', playerId),
  
  setTextTrack: (playerId: string, trackId?: string) => 
    ipcRenderer.invoke('player:set-text', playerId, trackId),
  
  attachExternalSubtitle: (playerId: string, url: string, format: string, lang?: string, label?: string) => 
    ipcRenderer.invoke('player:attach-subtitle', playerId, url, format, lang, label),
  
  // Lifecycle
  destroy: (playerId: string) => 
    ipcRenderer.invoke('player:destroy', playerId),
  
  // Event listeners
  onPlayerEvent: (callback: (event: any) => void) => {
    const listener = (_: any, event: any) => callback(event);
    ipcRenderer.on('player:event', listener);
    return () => ipcRenderer.removeListener('player:event', listener);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      createPlayer: (playerId: string, config: any) => Promise<void>;
      loadSource: (playerId: string, source: any) => Promise<void>;
      play: (playerId: string) => Promise<void>;
      pause: (playerId: string) => Promise<void>;
      seek: (playerId: string, seconds: number) => Promise<void>;
      setVolume: (playerId: string, volume: number) => Promise<void>;
      setMuted: (playerId: string, muted: boolean) => Promise<void>;
      getQualities: (playerId: string) => Promise<any[]>;
      setQuality: (playerId: string, quality: any) => Promise<void>;
      setQualityMax: (playerId: string) => Promise<void>;
      getAudioTracks: (playerId: string) => Promise<any[]>;
      setAudioTrack: (playerId: string, trackId: string) => Promise<void>;
      getTextTracks: (playerId: string) => Promise<any[]>;
      setTextTrack: (playerId: string, trackId?: string) => Promise<void>;
      attachExternalSubtitle: (playerId: string, url: string, format: string, lang?: string, label?: string) => Promise<void>;
      destroy: (playerId: string) => Promise<void>;
      onPlayerEvent: (callback: (event: any) => void) => () => void;
    };
  }
}
