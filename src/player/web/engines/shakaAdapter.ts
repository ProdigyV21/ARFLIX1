/**
 * Shaka Player Adapter
 * Handles DASH/HLS streams with advanced features
 */

export class ShakaAdapter {
  private player: any;
  private video: HTMLVideoElement;
  private config: any;

  constructor(video: HTMLVideoElement, config: any = {}) {
    this.video = video;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const shaka = await import('shaka-player');
    this.player = new shaka.Player(this.video);
    this.configure();
  }

  private configure(): void {
    this.player.configure({
      streaming: {
        bufferingGoal: this.config.maxBufferLength || 30,
        rebufferingGoal: 2,
        bufferBehind: 30,
        useNativeHlsOnSafari: true,
        forceHTTPS: false,
        retryParameters: {
          timeout: 30000,
          maxAttempts: 3,
          baseDelay: 1000,
          backoffFactor: 2,
          fuzzFactor: 0.5
        }
      },
      abr: {
        enabled: this.config.enableABR !== false,
        useNetworkInformation: true,
        defaultBandwidthEstimate: 1000000,
        restrictions: {
          minWidth: 0,
          maxWidth: Infinity,
          minHeight: 0,
          maxHeight: Infinity,
          minPixels: 0,
          maxPixels: Infinity,
          minFrameRate: 0,
          maxFrameRate: Infinity,
          minBandwidth: 0,
          maxBandwidth: Infinity
        }
      },
      manifest: {
        retryParameters: {
          timeout: 30000,
          maxAttempts: 3,
          baseDelay: 1000,
          backoffFactor: 2,
          fuzzFactor: 0.5
        }
      }
    });
  }

  async load(url: string): Promise<void> {
    if (!this.player) {
      await this.initialize();
    }
    await this.player.load(url);
  }

  getVariantTracks(): any[] {
    return this.player.getVariantTracks();
  }

  getTextTracks(): any[] {
    return this.player.getTextTracks();
  }

  selectVariantTrack(track: any, clearBuffer: boolean = false): void {
    this.player.selectVariantTrack(track, clearBuffer);
  }

  selectTextTrack(track: any): void {
    this.player.selectTextTrack(track);
  }

  getStats(): any {
    return this.player.getStats();
  }

  getCurrentVariant(): any {
    const stats = this.player.getStats();
    return stats.getCurrentVariant();
  }

  async destroy(): Promise<void> {
    if (this.player) {
      await this.player.destroy();
    }
  }
}
