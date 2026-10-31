package com.virasatedge.heritage.ble;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service that keeps heritage-lane detection running while the app is minimized.
 *
 * It owns no scanning logic itself: it simply tells {@link BeaconScanner} that a background owner
 * exists, so the scanner switches to its filtered background mode instead of stopping when the
 * activity leaves the screen. Lane-entry alerts are raised by the scanner.
 *
 * It must be started while the app is visible (Android 12+ forbids starting foreground services
 * from the background), which is why it is launched from the activity / JS bridge.
 */
public class BeaconScanService extends Service {

    public static final String ACTION_STOP = "com.virasatedge.heritage.action.STOP_BACKGROUND_SCAN";

    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    /** Best-effort start; returns false if the system refused (e.g. app not in the foreground). */
    public static boolean start(Context ctx) {
        try {
            ContextCompat.startForegroundService(ctx, new Intent(ctx, BeaconScanService.class));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, BeaconScanService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            BlePrefs.setBackgroundEnabled(this, false);
            stopSelf();
            return START_NOT_STICKY;
        }

        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE | ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10/11 treat BLE scan results as location data; a location-type foreground
            // service grants "while in use" access without needing background location permission.
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        }

        try {
            ServiceCompat.startForeground(
                    this, LaneNotifier.SERVICE_NOTIFICATION_ID, LaneNotifier.buildServiceNotification(this), type);
        } catch (Exception e) {
            // Missing runtime permission or start not allowed: give up quietly.
            stopSelf();
            return START_NOT_STICKY;
        }

        running = true;
        BeaconScanner.get(this).setServiceRunning(true);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        BeaconScanner.get(this).setServiceRunning(false);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
