package __PACKAGE__

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle

// Adds real lockscreen/notification media controls (title, subtitle, and a
// working play/pause button) on top of the plain "keep the process alive"
// foreground service this already was. The play/pause button on the
// lockscreen doesn't touch any native audio track - this app's audio is
// really an HTML5 <video> playing inside a WebView - so pressing it just
// forwards the intent to BackgroundAudioModule, which emits an event to JS,
// which injects `video.play()`/`video.pause()` into the active tab.
class BackgroundAudioService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaSession: MediaSessionCompat? = null
    private var currentTitle: String = "AI Browser"
    private var currentArtist: String = "Playing in background"
    private var isPlaying: Boolean = true

    companion object {
        const val CHANNEL_ID = "background_audio_channel"
        const val NOTIFICATION_ID = 4471
        const val ACTION_STOP = "__PACKAGE__.ACTION_STOP_BG_AUDIO"
        const val ACTION_UPDATE_METADATA = "__PACKAGE__.ACTION_UPDATE_METADATA"
        const val ACTION_SET_PLAYING = "__PACKAGE__.ACTION_SET_PLAYING"
        const val ACTION_TOGGLE_PLAY_PAUSE = "__PACKAGE__.ACTION_TOGGLE_PLAY_PAUSE"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_ARTIST = "extra_artist"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        initMediaSession()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_METADATA -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: currentArtist
                refreshSessionAndNotification()
                return START_STICKY
            }
            ACTION_SET_PLAYING -> {
                isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                refreshSessionAndNotification()
                return START_STICKY
            }
            ACTION_TOGGLE_PLAY_PAUSE -> {
                // Lockscreen/notification button pressed. Flip our own
                // state immediately so the icon updates without waiting on
                // a round trip to JS, then tell JS to actually pause/play
                // the real <video> element.
                isPlaying = !isPlaying
                refreshSessionAndNotification()
                BackgroundAudioModule.instance?.emitAction(if (isPlaying) "play" else "pause")
                return START_STICKY
            }
        }

        currentTitle = intent?.getStringExtra(EXTRA_TITLE) ?: currentTitle
        currentArtist = intent?.getStringExtra(EXTRA_ARTIST) ?: currentArtist
        isPlaying = true
        mediaSession?.isActive = true
        refreshSessionAndNotification()
        startForeground(NOTIFICATION_ID, buildNotification())
        acquireWakeLock()
        return START_STICKY
    }

    private fun initMediaSession() {
        mediaSession = MediaSessionCompat(this, "AIBrowserBackgroundAudio")
        mediaSession?.setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() {
                isPlaying = true
                refreshSessionAndNotification()
                BackgroundAudioModule.instance?.emitAction("play")
            }
            override fun onPause() {
                isPlaying = false
                refreshSessionAndNotification()
                BackgroundAudioModule.instance?.emitAction("pause")
            }
        })
    }

    private fun refreshSessionAndNotification() {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .build()
        )
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_PLAY_PAUSE)
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build()
        )
        val mgr = getSystemService(NotificationManager::class.java)
        mgr?.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val toggleIntent = Intent(this, BackgroundAudioService::class.java).apply {
            action = ACTION_TOGGLE_PLAY_PAUSE
        }
        val togglePendingIntent = PendingIntent.getService(
            this, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(playPauseIcon, playPauseLabel, togglePendingIntent)
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession?.sessionToken)
                    .setShowActionsInCompactView(0)
            )
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID, "Background playback", NotificationManager.IMPORTANCE_LOW
            )
            mgr.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "$packageName:BackgroundAudioWakeLock"
        )
        // Safety cap so a stuck reference can't hold the wakelock forever.
        wakeLock?.acquire(4 * 60 * 60 * 1000L)
    }

    override fun onDestroy() {
        if (wakeLock?.isHeld == true) wakeLock?.release()
        mediaSession?.isActive = false
        mediaSession?.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
