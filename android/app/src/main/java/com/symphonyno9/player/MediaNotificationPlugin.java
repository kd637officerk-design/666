package com.symphonyno9.player;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "MediaNotification")
public class MediaNotificationPlugin extends Plugin {
    private static WeakReference<MediaNotificationPlugin> instanceRef = new WeakReference<>(null);

    @Override
    public void load() {
        instanceRef = new WeakReference<>(this);
    }

    public static void dispatchMediaAction(String action, long positionMs) {
        MediaNotificationPlugin plugin = instanceRef.get();
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        if (positionMs >= 0) {
            data.put("positionMs", positionMs);
        }
        plugin.notifyListeners("mediaAction", data);
    }

    @PluginMethod
    public void updateMedia(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_UPDATE);
        intent.putExtra(MediaPlaybackService.EXTRA_TITLE, call.getString("title", "Symphony No. 9"));
        intent.putExtra(MediaPlaybackService.EXTRA_ARTIST, call.getString("artist", "Local Audio"));
        intent.putExtra(MediaPlaybackService.EXTRA_ALBUM, call.getString("album", "Symphony No. 9"));
        intent.putExtra(MediaPlaybackService.EXTRA_IS_PLAYING, Boolean.TRUE.equals(call.getBoolean("isPlaying", false)));
        intent.putExtra(MediaPlaybackService.EXTRA_DURATION_MS, call.getLong("durationMs", 0L));
        intent.putExtra(MediaPlaybackService.EXTRA_POSITION_MS, call.getLong("positionMs", 0L));
        String artwork = call.getString("artworkBase64", "");
        if (artwork != null && !artwork.isEmpty()) {
            intent.putExtra(MediaPlaybackService.EXTRA_ARTWORK_BASE64, artwork);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearMedia(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_STOP);
        ctx.startService(intent);
        call.resolve();
    }
}
