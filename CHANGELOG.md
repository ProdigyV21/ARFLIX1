# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multi-platform media player architecture** with unified TypeScript API
- **Web platform**: Shaka Player primary + hls.js fallback for DASH/HLS streams
- **Android platform**: ExoPlayer integration via React Native bridge
- **iOS platform**: AVPlayer integration via React Native bridge  
- **Electron platform**: mpv/libmpv integration for high-performance playback
- **Advanced subtitle support**: VTT overlay + ASS renderer with libass-wasm
- **Quality management**: Auto-highest quality on start, manual selection
- **Audio track switching**: Multiple language support with embedded tracks
- **Text track management**: Embedded + external subtitle attachment
- **External subtitle formats**: VTT, ASS, SRT with automatic format detection
- **Safe-area positioning**: Responsive subtitle placement with CSS
- **Source details display**: Provider, size, codec, resolution information
- **Progress tracking**: Per-episode watch progress with resume functionality
- **Event system**: Comprehensive player events for UI integration
- **Configuration options**: PREFER_HIGHEST_ON_START, language preferences
- **Acceptance tests**: Complete test suite for all platforms
- **Documentation**: Comprehensive README with setup instructions

### Changed
- **BREAKING**: Complete player architecture rewrite with unified API
- **BREAKING**: Player initialization now uses `createPlayer(platform, config)`
- **BREAKING**: Event handling now uses `player.on(listener)` pattern
- **BREAKING**: Subtitle positioning now uses safe-area CSS with bottom-center
- **BREAKING**: Quality selection now uses `setQualityMax()` and `setQuality()`
- **BREAKING**: Audio/text track switching now uses `setAudio()` and `setText()`

### Technical Details
- **Dependencies added**: shaka-player, libass-wasm, node-mpv, @types/shaka-player
- **File structure**: New `/player/` directory with platform-specific implementations
- **CSS enhancements**: Responsive subtitle overlay with safe-area positioning
- **Type safety**: Comprehensive TypeScript types for all player operations
- **Error handling**: Graceful fallbacks and error recovery across platforms
- **Performance**: Platform-optimized engines (Shaka/ExoPlayer/AVPlayer/mpv)

### Platform Support
- **Web**: Chrome, Firefox, Safari, Edge with Shaka Player + hls.js fallback
- **Android**: ExoPlayer with hardware acceleration and native subtitles
- **iOS**: AVPlayer with AirPlay and Picture-in-Picture support
- **Electron**: mpv with advanced subtitle rendering and hardware decoding

### Migration Guide
```typescript
// Old way
const video = document.createElement('video');
video.src = source.url;

// New way  
const player = createPlayer(detectPlatform(), {
  preferHighestOnStart: true,
  autoPlay: false
});
await player.load(source);
```

### Testing
- **Unit tests**: PlayerCore, WebPlayer, PlayerUI components
- **Integration tests**: Complete playback workflow testing
- **Platform tests**: Web, Android, iOS, Electron specific tests
- **Acceptance criteria**: All features tested across platforms

### Documentation
- **README**: Complete setup guide for all platforms
- **API docs**: Comprehensive TypeScript interfaces
- **Examples**: Usage examples for all major features
- **Troubleshooting**: Common issues and solutions

## [Previous Versions]
<!-- Previous changelog entries would go here -->
