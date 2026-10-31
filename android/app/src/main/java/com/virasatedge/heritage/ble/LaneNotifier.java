package com.virasatedge.heritage.ble;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.virasatedge.heritage.MainActivity;
import com.virasatedge.heritage.R;
import java.util.HashMap;
import java.util.Map;

/** System notifications: lane-entry alerts (heads-up + vibration) and the background-scan notice. */
public final class LaneNotifier {

    public static final String CHANNEL_ALERTS = "virasat_lane_alerts";
    public static final String CHANNEL_SERVICE = "virasat_background_scan";
    public static final int SERVICE_NOTIFICATION_ID = 4201;

    /** Never alert for the same lane more often than this, even if the signal flaps at the edge. */
    private static final long MIN_GAP_PER_LANE_MS = 30_000;
    private static final long[] VIBRATION_PATTERN = {0, 220, 120, 220};
    private static final int BRAND_AMBER = Color.parseColor("#F59E0B");

    private static final Map<String, Long> lastAlertAt = new HashMap<>();

    private LaneNotifier() {}

    public static void ensureChannels(Context ctx) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        nm.createNotificationChannel(
                new NotificationChannelCompat.Builder(CHANNEL_ALERTS, NotificationManagerCompat.IMPORTANCE_HIGH)
                        .setName("Heritage lane alerts")
                        .setDescription("Alerts when you walk into a verified heritage lane")
                        .setVibrationEnabled(true)
                        .setVibrationPattern(VIBRATION_PATTERN)
                        .setLightsEnabled(true)
                        .setLightColor(BRAND_AMBER)
                        .build());
        nm.createNotificationChannel(
                new NotificationChannelCompat.Builder(CHANNEL_SERVICE, NotificationManagerCompat.IMPORTANCE_LOW)
                        .setName("Background lane detection")
                        .setDescription("Shown while Virasat Edge watches for lane beacons in the background")
                        .setShowBadge(false)
                        .build());
    }

    public static boolean notificationsAllowed(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    /**
     * Post a heads-up "you are near ..." alert. Falls back to a plain vibration when notifications
     * are blocked so the visitor still gets a physical cue. Returns true if an alert was raised.
     */
    @SuppressLint("MissingPermission")
    public static synchronized boolean notifyLaneEntered(Context ctx, String laneKey, String title, String body) {
        long now = SystemClock.elapsedRealtime();
        Long last = lastAlertAt.get(laneKey);
        if (last != null && now - last < MIN_GAP_PER_LANE_MS) return false;
        lastAlertAt.put(laneKey, now);

        ensureChannels(ctx);
        if (notificationsAllowed(ctx)) {
            Notification notification = new NotificationCompat.Builder(ctx, CHANNEL_ALERTS)
                    .setSmallIcon(R.drawable.ic_stat_virasat)
                    .setColor(BRAND_AMBER)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
                    .setVibrate(VIBRATION_PATTERN)
                    .setAutoCancel(true)
                    .setContentIntent(openAppIntent(ctx))
                    .build();
            try {
                NotificationManagerCompat.from(ctx).notify(alertId(laneKey), notification);
                return true;
            } catch (SecurityException ignored) {
                // Permission revoked between the check and the post; fall through to vibration.
            }
        }
        vibrate(ctx);
        return true;
    }

    public static Notification buildServiceNotification(Context ctx) {
        ensureChannels(ctx);
        PendingIntent stopIntent = PendingIntent.getService(
                ctx,
                1,
                new Intent(ctx, BeaconScanService.class).setAction(BeaconScanService.ACTION_STOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(ctx, CHANNEL_SERVICE)
                .setSmallIcon(R.drawable.ic_stat_virasat)
                .setColor(BRAND_AMBER)
                .setContentTitle("Lane alerts are on")
                .setContentText("Watching for heritage lane beacons nearby")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openAppIntent(ctx))
                .addAction(0, "Stop", stopIntent)
                .build();
    }

    private static PendingIntent openAppIntent(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                ctx, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static int alertId(String laneKey) {
        return 5000 + (laneKey.hashCode() & 0x0FFF);
    }

    @SuppressWarnings("deprecation")
    private static void vibrate(Context ctx) {
        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, -1));
            } else {
                vibrator.vibrate(VIBRATION_PATTERN, -1);
            }
        } catch (Exception ignored) {
            // Vibration is a best-effort cue.
        }
    }
}
