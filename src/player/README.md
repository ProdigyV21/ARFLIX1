# Multi-Platform Media Player

A unified media player architecture supporting Web, Android, iOS, and Electron platforms with advanced subtitle support and quality management.

## Architecture

```
/player/
├── core/           # Shared TypeScript API and types
├── web/            # Web implementation (Shaka + hls.js)
├── android/        # Android ExoPlayer integration
├── ios/            # iOS AVPlayer integration
├── electron/       # Electron mpv integration (optional)
└── ui/             # React UI components
```

## Features

- **Multi-platform support**: Web, Android, iOS, Electron
- **Advanced subtitle support**: VTT overlay, ASS rendering with libass-wasm
- **Quality management**: Auto-highest quality, manual selection
- **Audio track switching**: Multiple language support
- **External subtitle attachment**: VTT, ASS, SRT formats
- **Safe-area positioning**: Responsive subtitle placement
- **Source details**: Provider, size, codec information

## Platform-Specific Setup

### Web Platform

**Dependencies:**
```bash
npm install shaka-player hls.js libass-wasm
```

**Features:**
- Shaka Player for DASH/HLS streams
- hls.js fallback for compatibility
- VTT overlay with custom positioning
- ASS rendering with libass-wasm
- Cross-browser subtitle support

**Usage:**
```typescript
import { createPlayer, detectPlatform } from './player/core/PlayerCore';

const platform = detectPlatform(); // 'web'
const player = createPlayer(platform, {
  preferHighestOnStart: true,
  autoPlay: false
});
```

### Android Platform

**Dependencies:**
```bash
# Add to android/app/build.gradle
implementation 'androidx.media3:media3-exoplayer:1.2.1'
implementation 'androidx.media3:media3-exoplayer-hls:1.2.1'
implementation 'androidx.media3:media3-exoplayer-dash:1.2.1'
```

**Features:**
- ExoPlayer integration via React Native bridge
- Native subtitle rendering
- Hardware acceleration
- Background playback support

**Setup:**
1. Add ExoPlayerModule.kt to your Android project
2. Register the module in MainApplication.java
3. Use AndroidPlayer.ts in your React Native code

### iOS Platform

**Dependencies:**
```bash
# Add to ios/Podfile
pod 'AVFoundation'
```

**Features:**
- AVPlayer integration via React Native bridge
- Native subtitle rendering
- AirPlay support
- Picture-in-Picture support

**Setup:**
1. Add AVPlayerModule.swift to your iOS project
2. Register the module in AppDelegate.m
3. Use IOSPlayer.ts in your React Native code

### Electron Platform (Optional)

**Dependencies:**
```bash
npm install node-mpv
```

**Features:**
- mpv/libmpv integration for high-performance playback
- Advanced subtitle support (ASS/SSA)
- Hardware decoding
- Custom video filters

**Setup:**
1. Install mpv on target systems
2. Use MpvBridge.ts for Electron integration
3. Configure preload.ts for IPC communication

## Usage Examples

### Basic Player Setup

```typescript
import { PlayerCore, createPlayer, detectPlatform } from './player/core/PlayerCore';
import { PlayerUI } from './player/ui/PlayerUI';

function App() {
  const [player, setPlayer] = useState<PlayerCore | null>(null);

  useEffect(() => {
    const platform = detectPlatform();
    const playerInstance = createPlayer(platform, {
      preferHighestOnStart: true,
      autoPlay: false,
      preferredAudioLang: 'en',
      preferredTextLang: 'en'
    });
    
    setPlayer(playerInstance);
    
    return () => playerInstance.destroy();
  }, []);

  return (
    <PlayerUI
      source={{
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        provider: 'Example Provider'
      }}
      config={{
        preferHighestOnStart: true,
        autoPlay: false
      }}
      onReady={() => console.log('Player ready')}
      onError={(error) => console.error('Player error:', error)}
    />
  );
}
```

### Subtitle Management

```typescript
// Attach external subtitle
await player.attachExternalSubtitle(
  'https://example.com/subtitle.vtt',
  'vtt',
  'en',
  'English'
);

// List available tracks
const textTracks = await player.listText();
const audioTracks = await player.listAudio();
const qualities = await player.listQualities();

// Switch tracks
await player.setText('subtitle-track-id');
await player.setAudio('audio-track-id');
await player.setQuality({ height: 1080, label: '1080p' });
```

### Event Handling

```typescript
const unsubscribe = player.on((event) => {
  switch (event.type) {
    case 'ready':
      console.log('Player ready');
      break;
    case 'tracks':
      console.log('Tracks loaded:', event.audio, event.text, event.qualities);
      break;
    case 'time':
      console.log('Time update:', event.current, event.duration);
      break;
    case 'qualityChanged':
      console.log('Quality changed:', event.quality);
      break;
  }
});

// Cleanup
unsubscribe();
```

## Configuration Options

```typescript
interface PlayerConfig {
  preferHighestOnStart?: boolean;    // Auto-select highest quality
  autoPlay?: boolean;                // Auto-start playback
  startTime?: number;                // Start position in seconds
  volume?: number;                   // Initial volume (0-1)
  muted?: boolean;                   // Initial mute state
  preferredAudioLang?: string;       // Preferred audio language
  preferredTextLang?: string;        // Preferred subtitle language
  enableABR?: boolean;               // Enable adaptive bitrate
  maxBufferSize?: number;            // Max buffer size in bytes
  maxBufferLength?: number;          // Max buffer length in seconds
}
```

## CSS Customization

The player includes comprehensive CSS for subtitle positioning and responsive design:

```css
/* Subtitle overlay positioning */
.player .subs {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(8vh, 64px);
  width: min(90%, 1200px);
  text-align: center;
  line-height: 1.25;
  text-shadow: 0 0 1px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.7);
}

/* Responsive design */
@media (max-width: 768px) {
  .player .subs {
    font-size: clamp(14px, 4vw, 20px);
    bottom: max(10vh, 80px);
  }
}
```

## Testing

### Web Testing
```bash
npm run dev
# Test in browser with various video formats
```

### Mobile Testing
```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

### Electron Testing
```bash
npm run electron:dev
```

## Performance Considerations

- **Web**: Use Shaka Player for optimal DASH/HLS performance
- **Android**: ExoPlayer provides hardware acceleration
- **iOS**: AVPlayer leverages native optimizations
- **Electron**: mpv offers best performance for desktop

## Browser Compatibility

- **Chrome/Edge**: Full support with Shaka Player
- **Firefox**: Full support with hls.js fallback
- **Safari**: Native HLS support with AVPlayer
- **Mobile**: Native player integration

## License Notes

- **Web/Mobile**: MIT licensed components
- **Electron/mpv**: GPL licensed (desktop only)
- **Shaka Player**: Apache 2.0
- **hls.js**: Apache 2.0
- **libass-wasm**: MIT

## Troubleshooting

### Common Issues

1. **Subtitles not showing**: Check subtitle format and URL accessibility
2. **Quality not switching**: Verify stream has multiple quality levels
3. **Audio tracks not detected**: Ensure stream includes multiple audio tracks
4. **Mobile playback issues**: Check native module registration

### Debug Mode

Enable debug logging:
```typescript
const player = createPlayer(platform, {
  ...config,
  debug: true
});
```

## Contributing

1. Follow the existing architecture patterns
2. Add platform-specific implementations in respective directories
3. Update types in `core/types.ts` for new features
4. Add tests for new functionality
5. Update documentation for API changes
