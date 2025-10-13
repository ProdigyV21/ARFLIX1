/**
 * ExoPlayerModule.kt - Native Android module for ExoPlayer integration
 * Provides React Native bridge to ExoPlayer functionality
 */

package com.arflix.player

import android.content.Context
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.exoplayer.trackselection.TrackSelectionOverride
import androidx.media3.exoplayer.trackselection.AdaptiveTrackSelection
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.common.Format
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.util.concurrent.Executors

class ExoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val players = mutableMapOf<String, ExoPlayer>()
    private val trackSelectors = mutableMapOf<String, DefaultTrackSelector>()
    private val eventEmitters = mutableMapOf<String, RCTEventEmitter>()
    
    override fun getName(): String = "ExoPlayerModule"
    
    @ReactMethod
    fun createPlayer(playerId: String, config: ReadableMap, promise: Promise) {
        try {
            val context = reactApplicationContext
            
            // Create track selector
            val trackSelector = DefaultTrackSelector(context).apply {
                setParameters(
                    buildUponParameters()
                        .setMaxVideoSizeSd()
                        .setAllowVideoMixedMimeTypeAdaptiveness(true)
                        .setAllowAudioMixedMimeTypeAdaptiveness(true)
                        .setAllowVideoMixedDecoderSupportAdaptiveness(true)
                        .setAllowAudioMixedDecoderSupportAdaptiveness(true)
                )
            }
            
            // Create ExoPlayer
            val player = ExoPlayer.Builder(context)
                .setTrackSelector(trackSelector)
                .setLoadControl(
                    androidx.media3.exoplayer.DefaultLoadControl.Builder()
                        .setBufferDurationsMs(
                            config.getInt("minBufferMs", 2500),
                            config.getInt("maxBufferMs", 5000),
                            config.getInt("bufferForPlaybackMs", 2500),
                            config.getInt("bufferForPlaybackAfterRebufferMs", 5000)
                        )
                        .build()
                )
                .build()
            
            // Store references
            players[playerId] = player
            trackSelectors[playerId] = trackSelector
            eventEmitters[playerId] = reactApplicationContext.getJSModule(RCTEventEmitter::class.java)
            
            // Set up event listeners
            setupPlayerListeners(playerId, player)
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CREATE_PLAYER_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun loadSource(playerId: String, source: ReadableMap, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val url = source.getString("url") ?: throw Exception("URL is required")
            
            val mediaItem = MediaItem.fromUri(Uri.parse(url))
            player.setMediaItem(mediaItem)
            player.prepare()
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("LOAD_SOURCE_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun play(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            player.play()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun pause(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            player.pause()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun seekTo(playerId: String, positionMs: Double, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            player.seekTo(positionMs.toLong())
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SEEK_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setVolume(playerId: String, volume: Double, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            player.volume = volume.toFloat()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_VOLUME_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setMuted(playerId: String, muted: Boolean, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            player.volume = if (muted) 0f else 1f
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_MUTED_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun getQualities(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(0) ?: emptyList()
            val qualities = mutableListOf<WritableMap>()
            
            for (i in trackGroups.indices) {
                val trackGroup = trackGroups[i]
                for (j in 0 until trackGroup.length) {
                    val format = trackGroup.getFormat(j)
                    if (format.height > 0) {
                        val quality = Arguments.createMap().apply {
                            putInt("height", format.height)
                            putInt("width", format.width)
                            putInt("bitrate", format.bitrate)
                            putString("codec", format.codecs)
                            putString("label", "${format.height}p")
                        }
                        qualities.add(quality)
                    }
                }
            }
            
            val result = Arguments.createArray()
            qualities.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_QUALITIES_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setQuality(playerId: String, quality: ReadableMap, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val height = quality.getInt("height")
            val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(0) ?: emptyList()
            
            for (i in trackGroups.indices) {
                val trackGroup = trackGroups[i]
                for (j in 0 until trackGroup.length) {
                    val format = trackGroup.getFormat(j)
                    if (format.height == height) {
                        val trackSelectionOverride = TrackSelectionOverride(trackGroup, j)
                        val parameters = trackSelector.buildUponParameters()
                            .setOverrideForType(DefaultTrackSelector.ParametersOverride(), trackSelectionOverride)
                        trackSelector.setParameters(parameters)
                        break
                    }
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_QUALITY_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setQualityMax(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(0) ?: emptyList()
            var maxHeight = 0
            var selectedTrackGroup: TrackGroup? = null
            var selectedTrackIndex = -1
            
            for (i in trackGroups.indices) {
                val trackGroup = trackGroups[i]
                for (j in 0 until trackGroup.length) {
                    val format = trackGroup.getFormat(j)
                    if (format.height > maxHeight) {
                        maxHeight = format.height
                        selectedTrackGroup = trackGroup
                        selectedTrackIndex = j
                    }
                }
            }
            
            if (selectedTrackGroup != null && selectedTrackIndex >= 0) {
                val trackSelectionOverride = TrackSelectionOverride(selectedTrackGroup, selectedTrackIndex)
                val parameters = trackSelector.buildUponParameters()
                    .setOverrideForType(DefaultTrackSelector.ParametersOverride(), trackSelectionOverride)
                trackSelector.setParameters(parameters)
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_QUALITY_MAX_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun getAudioTracks(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(1) ?: emptyList()
            val audioTracks = mutableListOf<WritableMap>()
            
            for (i in trackGroups.indices) {
                val trackGroup = trackGroups[i]
                for (j in 0 until trackGroup.length) {
                    val format = trackGroup.getFormat(j)
                    val audioTrack = Arguments.createMap().apply {
                        putString("id", "audio-$i-$j")
                        putString("lang", format.language ?: "unknown")
                        putInt("channels", format.channelCount)
                        putString("codec", format.codecs)
                        putString("label", "${format.language ?: "Unknown"} (${format.channelCount}ch)")
                        putBoolean("embedded", true)
                    }
                    audioTracks.add(audioTrack)
                }
            }
            
            val result = Arguments.createArray()
            audioTracks.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_AUDIO_TRACKS_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setAudioTrack(playerId: String, trackId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val parts = trackId.split("-")
            if (parts.size >= 3) {
                val groupIndex = parts[1].toInt()
                val trackIndex = parts[2].toInt()
                
                val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(1) ?: emptyList()
                if (groupIndex < trackGroups.size) {
                    val trackGroup = trackGroups[groupIndex]
                    if (trackIndex < trackGroup.length) {
                        val trackSelectionOverride = TrackSelectionOverride(trackGroup, trackIndex)
                        val parameters = trackSelector.buildUponParameters()
                            .setOverrideForType(DefaultTrackSelector.ParametersOverride(), trackSelectionOverride)
                        trackSelector.setParameters(parameters)
                    }
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_AUDIO_TRACK_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun getTextTracks(playerId: String, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(2) ?: emptyList()
            val textTracks = mutableListOf<WritableMap>()
            
            for (i in trackGroups.indices) {
                val trackGroup = trackGroups[i]
                for (j in 0 until trackGroup.length) {
                    val format = trackGroup.getFormat(j)
                    val textTrack = Arguments.createMap().apply {
                        putString("id", "text-$i-$j")
                        putString("lang", format.language ?: "unknown")
                        putString("kind", "subtitles")
                        putString("format", "vtt")
                        putString("label", format.language ?: "Unknown")
                        putBoolean("embedded", true)
                    }
                    textTracks.add(textTrack)
                }
            }
            
            val result = Arguments.createArray()
            textTracks.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_TEXT_TRACKS_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setTextTrack(playerId: String, trackId: String?, promise: Promise) {
        try {
            val player = players[playerId] ?: throw Exception("Player not found")
            val trackSelector = trackSelectors[playerId] ?: throw Exception("Track selector not found")
            
            if (trackId == null) {
                // Disable text tracks
                val parameters = trackSelector.buildUponParameters()
                    .setTrackTypeDisabled(2, true)
                trackSelector.setParameters(parameters)
            } else {
                val parts = trackId.split("-")
                if (parts.size >= 3) {
                    val groupIndex = parts[1].toInt()
                    val trackIndex = parts[2].toInt()
                    
                    val trackGroups = trackSelector.currentMappedTrackInfo?.getTrackGroups(2) ?: emptyList()
                    if (groupIndex < trackGroups.size) {
                        val trackGroup = trackGroups[groupIndex]
                        if (trackIndex < trackGroup.length) {
                            val trackSelectionOverride = TrackSelectionOverride(trackGroup, trackIndex)
                            val parameters = trackSelector.buildUponParameters()
                                .setTrackTypeDisabled(2, false)
                                .setOverrideForType(DefaultTrackSelector.ParametersOverride(), trackSelectionOverride)
                            trackSelector.setParameters(parameters)
                        }
                    }
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_TEXT_TRACK_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun destroy(playerId: String, promise: Promise) {
        try {
            val player = players.remove(playerId)
            trackSelectors.remove(playerId)
            eventEmitters.remove(playerId)
            
            player?.release()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DESTROY_ERROR", e.message, e)
        }
    }
    
    private fun setupPlayerListeners(playerId: String, player: ExoPlayer) {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                val eventEmitter = eventEmitters[playerId] ?: return
                val event = Arguments.createMap().apply {
                    putString("type", "stateChanged")
                    putString("state", when (playbackState) {
                        Player.STATE_READY -> "ready"
                        Player.STATE_BUFFERING -> "buffering"
                        Player.STATE_ENDED -> "ended"
                        Player.STATE_IDLE -> "idle"
                        else -> "unknown"
                    })
                }
                eventEmitter.receiveEvent(0, "onPlayerEvent", event)
            }
            
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val eventEmitter = eventEmitters[playerId] ?: return
                val event = Arguments.createMap().apply {
                    putString("type", "playingChanged")
                    putBoolean("playing", isPlaying)
                }
                eventEmitter.receiveEvent(0, "onPlayerEvent", event)
            }
            
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                val eventEmitter = eventEmitters[playerId] ?: return
                val event = Arguments.createMap().apply {
                    putString("type", "error")
                    putString("error", error.message ?: "Unknown error")
                }
                eventEmitter.receiveEvent(0, "onPlayerEvent", event)
            }
        })
    }
}
