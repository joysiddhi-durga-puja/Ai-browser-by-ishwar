package __PACKAGE__

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class BackgroundAudioModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        // Service and Module run in the same process, so the Service can
        // reach the current Module instance directly to forward lockscreen
        // button presses to JS, without needing a broadcast receiver.
        var instance: BackgroundAudioModule? = null
    }

    init {
        instance = this
    }

    override fun getName() = "BackgroundAudioModule"

    @ReactMethod
    fun start(title: String?, artist: String?) {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, BackgroundAudioService::class.java)
        intent.putExtra(BackgroundAudioService.EXTRA_TITLE, title ?: "AI Browser")
        intent.putExtra(BackgroundAudioService.EXTRA_ARTIST, artist ?: "Playing in background")
        ctx.startForegroundService(intent)
    }

    @ReactMethod
    fun updateMetadata(title: String?, artist: String?) {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_UPDATE_METADATA
        intent.putExtra(BackgroundAudioService.EXTRA_TITLE, title ?: "AI Browser")
        intent.putExtra(BackgroundAudioService.EXTRA_ARTIST, artist ?: "Playing in background")
        ctx.startService(intent)
    }

    @ReactMethod
    fun setPlaying(isPlaying: Boolean) {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_SET_PLAYING
        intent.putExtra(BackgroundAudioService.EXTRA_IS_PLAYING, isPlaying)
        ctx.startService(intent)
    }

    @ReactMethod
    fun stop() {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, BackgroundAudioService::class.java)
        intent.action = BackgroundAudioService.ACTION_STOP
        ctx.startService(intent)
    }

    // Called by the Service when a lockscreen/notification media button is
    // pressed, so JS can toggle the real <video> element playing inside
    // the WebView (the lockscreen button has nothing else to control).
    fun emitAction(action: String) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("BackgroundAudioAction", action)
    }

    // Required by RN's NativeEventEmitter contract even though we don't
    // need to do anything on subscribe/unsubscribe.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
