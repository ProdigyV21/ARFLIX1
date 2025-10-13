/**
 * VTT Overlay - Custom subtitle renderer for WebVTT subtitles
 * Provides precise positioning and styling control
 */

import React, { useEffect, useRef, useState } from 'react';
import { TextTrack } from '../../../core/types';

interface VttCue {
  startTime: number;
  endTime: number;
  text: string;
  id?: string;
}

interface VttOverlayProps {
  video: HTMLVideoElement;
  track?: TextTrack;
  className?: string;
}

export class VttOverlay {
  private video: HTMLVideoElement;
  private container: HTMLElement;
  private currentCues: VttCue[] = [];
  private activeCue?: VttCue;
  private track?: TextTrack;
  private isVisible: boolean = false;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.container = this.createOverlayContainer();
    this.setupEventListeners();
  }

  private createOverlayContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'player-subs-overlay';
    container.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: max(8vh, 64px);
      width: min(90%, 1200px);
      text-align: center;
      line-height: 1.25;
      letter-spacing: 0.01em;
      text-shadow: 0 0 1px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.7);
      pointer-events: none;
      z-index: 1000;
      font-family: 'Inter Tight', Arial, sans-serif;
      font-weight: 700;
      color: white;
      font-size: clamp(16px, 2.5vw, 24px);
    `;

    // Find the video container and append overlay
    const videoContainer = this.video.parentElement;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(container);
    }

    return container;
  }

  private setupEventListeners(): void {
    this.video.addEventListener('timeupdate', () => {
      this.updateActiveCue();
    });

    this.video.addEventListener('seeking', () => {
      this.updateActiveCue();
    });
  }

  async loadTrack(track: TextTrack): Promise<void> {
    this.track = track;
    this.isVisible = true;
    
    // If it's an embedded track, use the native text track
    if (track.embedded) {
      this.loadEmbeddedTrack(track);
    }
  }

  async loadFromUrl(url: string, track: TextTrack): Promise<void> {
    this.track = track;
    this.isVisible = true;

    try {
      const response = await fetch(url);
      const vttText = await response.text();
      this.parseVtt(vttText);
    } catch (error) {
      console.error('Failed to load VTT from URL:', error);
    }
  }

  private loadEmbeddedTrack(track: TextTrack): void {
    // Find the corresponding native text track
    for (let i = 0; i < this.video.textTracks.length; i++) {
      const nativeTrack = this.video.textTracks[i];
      if (nativeTrack.language === track.lang && nativeTrack.kind === track.kind) {
        nativeTrack.mode = 'showing';
        this.setupNativeTrackListener(nativeTrack);
        break;
      }
    }
  }

  private setupNativeTrackListener(nativeTrack: TextTrack): void {
    nativeTrack.addEventListener('cuechange', () => {
      const activeCues = nativeTrack.activeCues;
      if (activeCues && activeCues.length > 0) {
        const cue = activeCues[0] as any;
        this.displayCue({
          startTime: cue.startTime,
          endTime: cue.endTime,
          text: cue.text,
          id: cue.id
        });
      } else {
        this.hideCue();
      }
    });
  }

  private parseVtt(vttText: string): void {
    const lines = vttText.split('\n');
    const cues: VttCue[] = [];
    let currentCue: Partial<VttCue> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === 'WEBVTT') {
        continue;
      }

      if (line.includes('-->')) {
        // Time line
        const [start, end] = line.split('-->').map(t => this.parseTime(t.trim()));
        currentCue.startTime = start;
        currentCue.endTime = end;
      } else if (line && currentCue.startTime !== undefined) {
        // Text line
        if (currentCue.text) {
          currentCue.text += '\n' + line;
        } else {
          currentCue.text = line;
        }
      } else if (!line && currentCue.text) {
        // Empty line - end of cue
        cues.push(currentCue as VttCue);
        currentCue = {};
      }
    }

    // Add the last cue if it exists
    if (currentCue.text) {
      cues.push(currentCue as VttCue);
    }

    this.currentCues = cues;
  }

  private parseTime(timeStr: string): number {
    const parts = timeStr.split(':');
    const seconds = parts[2].split('.')[0];
    const milliseconds = parts[2].split('.')[1] || '000';
    
    return parseInt(parts[0]) * 3600 + 
           parseInt(parts[1]) * 60 + 
           parseInt(seconds) + 
           parseInt(milliseconds) / 1000;
  }

  private updateActiveCue(): void {
    if (!this.isVisible || this.currentCues.length === 0) {
      return;
    }

    const currentTime = this.video.currentTime;
    const activeCue = this.currentCues.find(cue => 
      currentTime >= cue.startTime && currentTime <= cue.endTime
    );

    if (activeCue && activeCue !== this.activeCue) {
      this.displayCue(activeCue);
    } else if (!activeCue && this.activeCue) {
      this.hideCue();
    }
  }

  private displayCue(cue: VttCue): void {
    this.activeCue = cue;
    this.container.innerHTML = this.formatCueText(cue.text);
    this.container.style.display = 'block';
  }

  private hideCue(): void {
    this.activeCue = undefined;
    this.container.style.display = 'none';
  }

  private formatCueText(text: string): string {
    // Handle basic VTT styling tags
    return text
      .replace(/<b>/g, '<strong>')
      .replace(/<\/b>/g, '</strong>')
      .replace(/<i>/g, '<em>')
      .replace(/<\/i>/g, '</em>')
      .replace(/<u>/g, '<span style="text-decoration: underline">')
      .replace(/<\/u>/g, '</span>')
      .replace(/\n/g, '<br>');
  }

  show(): void {
    this.isVisible = true;
    if (this.activeCue) {
      this.container.style.display = 'block';
    }
  }

  hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  destroy(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

// React component for integration
export const VttOverlayComponent: React.FC<VttOverlayProps> = ({ 
  video, 
  track, 
  className = '' 
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [currentCue, setCurrentCue] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (!video || !track) return;

    const handleTimeUpdate = () => {
      // Implementation would be similar to the class-based version
      // but using React state management
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [video, track]);

  if (!isVisible || !currentCue) {
    return null;
  }

  return (
    <div 
      ref={overlayRef}
      className={`player-subs-overlay ${className}`}
      dangerouslySetInnerHTML={{ __html: currentCue }}
    />
  );
};
