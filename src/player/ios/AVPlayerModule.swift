/**
 * AVPlayerModule.swift - Native iOS module for AVPlayer integration
 * Provides React Native bridge to AVPlayer functionality
 */

import Foundation
import AVFoundation
import MediaPlayer
import React

@objc(AVPlayerModule)
class AVPlayerModule: RCTEventEmitter {
    
    private var players: [String: AVPlayer] = [:]
    private var playerItems: [String: AVPlayerItem] = [:]
    private var timeObservers: [String: Any] = [:]
    private var hasListeners = false
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onPlayerEvent"]
    }
    
    override func startObserving() {
        hasListeners = true
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    @objc func createPlayer(_ playerId: String, config: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            do {
                // Configure audio session
                let audioSession = AVAudioSession.sharedInstance()
                try audioSession.setCategory(.playback, mode: .moviePlayback, options: [])
                try audioSession.setActive(true)
                
                // Create player
                let player = AVPlayer()
                player.automaticallyWaitsToMinimizeStalling = true
                
                // Store references
                self.players[playerId] = player
                
                // Set up observers
                self.setupPlayerObservers(playerId: playerId, player: player)
                
                resolver(nil)
            } catch {
                rejecter("CREATE_PLAYER_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    @objc func loadSource(_ playerId: String, source: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            guard let urlString = source["url"] as? String,
                  let url = URL(string: urlString) else {
                rejecter("INVALID_URL", "Invalid URL", nil)
                return
            }
            
            // Create asset
            let asset = AVURLAsset(url: url)
            
            // Create player item
            let playerItem = AVPlayerItem(asset: asset)
            self.playerItems[playerId] = playerItem
            
            // Replace current item
            player.replaceCurrentItem(with: playerItem)
            
            // Set up item observers
            self.setupPlayerItemObservers(playerId: playerId, playerItem: playerItem)
            
            resolver(nil)
        }
    }
    
    @objc func play(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            player.play()
            resolver(nil)
        }
    }
    
    @objc func pause(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            player.pause()
            resolver(nil)
        }
    }
    
    @objc func seekTo(_ playerId: String, positionMs: NSNumber, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            let time = CMTime(seconds: positionMs.doubleValue / 1000.0, preferredTimescale: 1000)
            player.seek(to: time) { _ in
                resolver(nil)
            }
        }
    }
    
    @objc func setVolume(_ playerId: String, volume: NSNumber, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            player.volume = volume.floatValue
            resolver(nil)
        }
    }
    
    @objc func setMuted(_ playerId: String, muted: Bool, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let player = self.players[playerId] else {
                rejecter("PLAYER_NOT_FOUND", "Player not found", nil)
                return
            }
            
            player.isMuted = muted
            resolver(nil)
        }
    }
    
    @objc func getQualities(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            let asset = playerItem.asset
            let qualities = self.extractQualities(from: asset)
            resolver(qualities)
        }
    }
    
    @objc func setQualityMax(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            // For HLS streams, set preferred peak bit rate to 0 (highest quality)
            if let urlAsset = playerItem.asset as? AVURLAsset,
               urlAsset.url.absoluteString.contains("m3u8") {
                playerItem.preferredPeakBitRate = 0
            }
            
            resolver(nil)
        }
    }
    
    @objc func setQuality(_ playerId: String, quality: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            // For HLS streams, set preferred peak bit rate based on quality
            if let urlAsset = playerItem.asset as? AVURLAsset,
               urlAsset.url.absoluteString.contains("m3u8"),
               let bitrate = quality["bandwidth"] as? NSNumber {
                playerItem.preferredPeakBitRate = bitrate.doubleValue
            }
            
            resolver(nil)
        }
    }
    
    @objc func getAudioTracks(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            let audioTracks = self.extractAudioTracks(from: playerItem)
            resolver(audioTracks)
        }
    }
    
    @objc func setAudioTrack(_ playerId: String, trackId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            let asset = playerItem.asset
            let audioGroups = asset.mediaSelectionGroup(forMediaCharacteristic: .audible)
            
            if let audioGroups = audioGroups {
                for option in audioGroups.options {
                    if option.displayName == trackId || option.locale?.languageCode == trackId {
                        playerItem.select(option, in: audioGroups)
                        break
                    }
                }
            }
            
            resolver(nil)
        }
    }
    
    @objc func getTextTracks(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            let textTracks = self.extractTextTracks(from: playerItem)
            resolver(textTracks)
        }
    }
    
    @objc func setTextTrack(_ playerId: String, trackId: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerItem = self.playerItems[playerId] else {
                rejecter("PLAYER_ITEM_NOT_FOUND", "Player item not found", nil)
                return
            }
            
            let asset = playerItem.asset
            let textGroups = asset.mediaSelectionGroup(forMediaCharacteristic: .legible)
            
            if let textGroups = textGroups {
                if let trackId = trackId {
                    for option in textGroups.options {
                        if option.displayName == trackId || option.locale?.languageCode == trackId {
                            playerItem.select(option, in: textGroups)
                            break
                        }
                    }
                } else {
                    // Disable subtitles
                    playerItem.select(nil, in: textGroups)
                }
            }
            
            resolver(nil)
        }
    }
    
    @objc func destroy(_ playerId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            // Remove time observer
            if let timeObserver = self.timeObservers[playerId] {
                self.players[playerId]?.removeTimeObserver(timeObserver)
                self.timeObservers.removeValue(forKey: playerId)
            }
            
            // Remove player and item
            self.players.removeValue(forKey: playerId)
            self.playerItems.removeValue(forKey: playerId)
            
            resolver(nil)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupPlayerObservers(playerId: String, player: AVPlayer) {
        // Time observer
        let timeInterval = CMTime(seconds: 0.1, preferredTimescale: 1000)
        let timeObserver = player.addPeriodicTimeObserver(forInterval: timeInterval, queue: .main) { [weak self] time in
            guard let self = self, self.hasListeners else { return }
            
            let currentTime = CMTimeGetSeconds(time)
            let duration = CMTimeGetSeconds(player.currentItem?.duration ?? CMTime.zero)
            
            self.sendEvent(withName: "onPlayerEvent", body: [
                "type": "timeUpdate",
                "currentTime": currentTime,
                "duration": duration
            ])
        }
        
        timeObservers[playerId] = timeObserver
    }
    
    private func setupPlayerItemObservers(playerId: String, playerItem: AVPlayerItem) {
        // Status observer
        playerItem.addObserver(self, forKeyPath: "status", options: [.new], context: nil)
        
        // Buffer observer
        playerItem.addObserver(self, forKeyPath: "loadedTimeRanges", options: [.new], context: nil)
        
        // Track observers
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerItemDidReachEnd),
            name: .AVPlayerItemDidPlayToEndTime,
            object: playerItem
        )
    }
    
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        guard let playerItem = object as? AVPlayerItem,
              let playerId = playerItems.first(where: { $0.value == playerItem })?.key else {
            return
        }
        
        switch keyPath {
        case "status":
            if playerItem.status == .readyToPlay {
                sendEvent(withName: "onPlayerEvent", body: ["type": "ready"])
                
                // Load tracks
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.loadTracks(playerId: playerId, playerItem: playerItem)
                }
            } else if playerItem.status == .failed {
                sendEvent(withName: "onPlayerEvent", body: [
                    "type": "error",
                    "error": playerItem.error?.localizedDescription ?? "Unknown error"
                ])
            }
        case "loadedTimeRanges":
            if let timeRanges = playerItem.loadedTimeRanges.first?.timeRangeValue {
                let buffered = CMTimeGetSeconds(timeRanges.duration)
                let duration = CMTimeGetSeconds(playerItem.duration)
                let percent = duration > 0 ? (buffered / duration) * 100 : 0
                
                sendEvent(withName: "onPlayerEvent", body: [
                    "type": "bufferUpdate",
                    "buffered": percent
                ])
            }
        default:
            break
        }
    }
    
    @objc private func playerItemDidReachEnd(notification: Notification) {
        sendEvent(withName: "onPlayerEvent", body: ["type": "ended"])
    }
    
    private func loadTracks(playerId: String, playerItem: AVPlayerItem) {
        let asset = playerItem.asset
        
        // Get qualities
        let qualities = extractQualities(from: asset)
        
        // Get audio tracks
        let audioTracks = extractAudioTracks(from: playerItem)
        
        // Get text tracks
        let textTracks = extractTextTracks(from: playerItem)
        
        sendEvent(withName: "onPlayerEvent", body: [
            "type": "tracksLoaded",
            "qualities": qualities,
            "audio": audioTracks,
            "text": textTracks
        ])
    }
    
    private func extractQualities(from asset: AVAsset) -> [[String: Any]] {
        var qualities: [[String: Any]] = []
        
        let videoTracks = asset.tracks(withMediaType: .video)
        for track in videoTracks {
            let size = track.naturalSize
            let qualities = [
                "height": Int(size.height),
                "width": Int(size.width),
                "label": "\(Int(size.height))p"
            ]
            qualities.append(qualities)
        }
        
        return qualities
    }
    
    private func extractAudioTracks(from playerItem: AVPlayerItem) -> [[String: Any]] {
        var audioTracks: [[String: Any]] = []
        
        let asset = playerItem.asset
        let audioGroups = asset.mediaSelectionGroup(forMediaCharacteristic: .audible)
        
        if let audioGroups = audioGroups {
            for (index, option) in audioGroups.options.enumerated() {
                let track = [
                    "id": option.displayName,
                    "lang": option.locale?.languageCode ?? "unknown",
                    "label": option.displayName,
                    "embedded": true
                ] as [String : Any]
                audioTracks.append(track)
            }
        }
        
        return audioTracks
    }
    
    private func extractTextTracks(from playerItem: AVPlayerItem) -> [[String: Any]] {
        var textTracks: [[String: Any]] = []
        
        let asset = playerItem.asset
        let textGroups = asset.mediaSelectionGroup(forMediaCharacteristic: .legible)
        
        if let textGroups = textGroups {
            for option in textGroups.options {
                let track = [
                    "id": option.displayName,
                    "lang": option.locale?.languageCode ?? "unknown",
                    "kind": "subtitles",
                    "format": "vtt",
                    "label": option.displayName,
                    "embedded": true
                ] as [String : Any]
                textTracks.append(track)
            }
        }
        
        return textTracks
    }
}
