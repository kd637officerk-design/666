package com.symphonyno9.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class MediaPlaybackService extends Service {
    public static final String CHANNEL_ID = "symphony_no9_media";
    public static final int NOTIFICATION_ID = 9001;

    public static final String ACTION_UPDATE = "com.symphonyno9.player.ACTION_UPDATE";
    public static final String ACTION_PLAY = "com.symphonyno9.player.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.symphonyno9.player.ACTION_PAUSE";
    public static final String ACTION_PREV = "com.symphonyno9.player.ACTION_PREV";
    public static final String ACTION_NEXT = "com.symphonyno9.player.ACTION_NEXT";
    public static final String ACTION_STOP = "com.symphonyno9.player.ACTION_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_ARTWORK_BASE64 = "artworkBase64";

    private MediaSessionCompat mediaSession;
    private Bitmap lastArtworkBitmap;
    private String lastArtworkSignature = "";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "SymphonyNo9Session");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                MediaNotificationPlugin.dispatchMediaAction("play", -1);
            }

            @Override
            public void onPause() {
                MediaNotificationPlugin.dispatchMediaAction("pause", -1);
            }

            @Override
            public void onSkipToPrevious() {
                MediaNotificationPlugin.dispatchMediaAction("previous", -1);
            }

            @Override
            public void onSkipToNext() {
                MediaNotificationPlugin.dispatchMediaAction("next", -1);
            }

            @Override
            public void onSeekTo(long pos) {
                MediaNotificationPlugin.dispatchMediaAction("seekto", pos);
            }

            @Override
            public void onStop() {
                MediaNotificationPlugin.dispatchMediaAction("stop", -1);
                stopForegroundCompat();
                stopSelf();
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_PLAY.equals(action)) {
            MediaNotificationPlugin.dispatchMediaAction("play", -1);
            return START_STICKY;
        }
        if (ACTION_PAUSE.equals(action)) {
            MediaNotificationPlugin.dispatchMediaAction("pause", -1);
            return START_STICKY;
        }
        if (ACTION_PREV.equals(action)) {
            MediaNotificationPlugin.dispatchMediaAction("previous", -1);
            return START_STICKY;
        }
        if (ACTION_NEXT.equals(action)) {
            MediaNotificationPlugin.dispatchMediaAction("next", -1);
            return START_STICKY;
        }
        if (ACTION_STOP.equals(action)) {
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            String album = intent.getStringExtra(EXTRA_ALBUM);
            boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
            long durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L);
            long positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
            String artData = intent.getStringExtra(EXTRA_ARTWORK_BASE64);

            Bitmap artBitmap = resolveArtworkBitmap(artData);
            updateSessionAndNotification(
                title != null ? title : "Symphony No. 9",
                artist != null ? artist : "Local Audio",
                album != null ? album : "Symphony No. 9",
                isPlaying,
                durationMs,
                positionMs,
                artBitmap
            );
        }

        return START_STICKY;
    }

    private Bitmap resolveArtworkBitmap(@Nullable String artData) {
        if (artData != null && !artData.isEmpty()) {
            String sig = artData.length() + ":" + artData.hashCode();
            if (sig.equals(lastArtworkSignature) && lastArtworkBitmap != null) {
                return lastArtworkBitmap;
            }
            try {
                String clean = artData;
                int comma = clean.indexOf(',');
                if (comma >= 0) {
                    clean = clean.substring(comma + 1);
                }
                byte[] decoded = Base64.decode(clean, Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                if (bmp != null) {
                    lastArtworkSignature = sig;
                    lastArtworkBitmap = bmp;
                    return bmp;
                }
            } catch (Exception ignored) {
                // Fall back to app icon below
            }
        }
        return BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
    }

    private void updateSessionAndNotification(
        String title,
        String artist,
        String album,
        boolean isPlaying,
        long durationMs,
        long positionMs,
        Bitmap artBitmap
    ) {
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, Math.max(0L, durationMs));

        if (artBitmap != null) {
            // Setting ALBUM_ART, ART, and DISPLAY_ICON allows Android SystemUI to render full lock-screen song art
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artBitmap);
        }
        mediaSession.setMetadata(metaBuilder.build());

        long actions =
            PlaybackStateCompat.ACTION_PLAY |
            PlaybackStateCompat.ACTION_PAUSE |
            PlaybackStateCompat.ACTION_PLAY_PAUSE |
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
            PlaybackStateCompat.ACTION_SEEK_TO |
            PlaybackStateCompat.ACTION_STOP;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, Math.max(0L, positionMs), isPlaying ? 1.0f : 0.0f)
            .build();
        mediaSession.setPlaybackState(playbackState);

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevIntent = serviceActionIntent(ACTION_PREV, 1);
        PendingIntent toggleIntent = serviceActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 2);
        PendingIntent nextIntent = serviceActionIntent(ACTION_NEXT, 3);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setLargeIcon(artBitmap)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_media_prev, "Previous", prevIntent)
            .addAction(
                isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                toggleIntent
            )
            .addAction(R.drawable.ic_media_next, "Next", nextIntent)
            .setStyle(
                new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build();

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                : 0
        );
    }

    private PendingIntent serviceActionIntent(String action, int requestCode) {
        Intent i = new Intent(this, MediaPlaybackService.class);
        i.setAction(action);
        return PendingIntent.getService(
            this,
            requestCode,
            i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Symphony No. 9 Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Lock screen artwork and media playback controls");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
