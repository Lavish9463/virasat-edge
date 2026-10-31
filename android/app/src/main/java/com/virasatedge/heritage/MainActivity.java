package com.virasatedge.heritage;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.virasatedge.heritage.ble.BeaconScanService;
import com.virasatedge.heritage.ble.BeaconScanner;
import com.virasatedge.heritage.ble.BlePrefs;
import com.virasatedge.heritage.ble.IBeaconParser;
import com.virasatedge.heritage.ble.LaneNotifier;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int NOTIFICATION_REQUEST_CODE = 1002;
    /** Heritage beacons reach the UI up to 4x/s; other devices (pairing list) at most 1x/s. */
    private static final long HERITAGE_FORWARD_GAP_MS = 250;
    private static final long OTHER_FORWARD_GAP_MS = 1000;

    private BeaconScanner scanner;
    private final Map<String, Long> lastForwardedAt = new HashMap<>();
    private OnBackPressedCallback backCallback;
    private long notificationRequestedAt = 0;

    private final BeaconScanner.DeviceListener webForwarder = this::forwardToWeb;
    private final BeaconScanner.StatusListener statusForwarder = this::notifyWebStatusChanged;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        scanner = BeaconScanner.get(this);
        LaneNotifier.ensureChannels(this);

        // Register the bridge before the web layer's JS runs so window.AndroidBleScanner exists
        // on first page load.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new AndroidBleBridge(), "AndroidBleScanner");
        }

        scanner.addDeviceListener(webForwarder);
        scanner.addStatusListener(statusForwarder);
        setupBackHandling();
        applySystemBarAppearance();
    }

    @Override
    public void onStart() {
        super.onStart();
        scanner.setAppVisible(true);
        maybeStartBackgroundService();
    }

    @Override
    public void onStop() {
        // With background alerts on, the service keeps a filtered scan alive; otherwise this stops it.
        scanner.setAppVisible(false);
        super.onStop();
    }

    @Override
    public void onDestroy() {
        scanner.removeDeviceListener(webForwarder);
        scanner.removeStatusListener(statusForwarder);
        super.onDestroy();
    }

    // ---------------------------------------------------------------------------------------------
    // Permissions
    // ---------------------------------------------------------------------------------------------

    private boolean isGranted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    /** Scan permissions plus (Android 13+) notifications, requested together in one flow. */
    private String[] missingPermissions() {
        List<String> missing = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+: Nearby devices + precise location (beacons are hidden without location;
            // FINE must be requested together with COARSE on Android 12+).
            if (!isGranted(Manifest.permission.BLUETOOTH_SCAN)) missing.add(Manifest.permission.BLUETOOTH_SCAN);
            if (!isGranted(Manifest.permission.BLUETOOTH_CONNECT)) missing.add(Manifest.permission.BLUETOOTH_CONNECT);
            if (!isGranted(Manifest.permission.ACCESS_FINE_LOCATION)) {
                missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
                missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
        } else {
            // Before Android 12, receiving BLE scan results requires location permission.
            if (!isGranted(Manifest.permission.ACCESS_FINE_LOCATION)) missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
            if (!isGranted(Manifest.permission.ACCESS_COARSE_LOCATION)) missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !isGranted(Manifest.permission.POST_NOTIFICATIONS)) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        return missing.toArray(new String[0]);
    }

    private void requestBlePermissions() {
        String[] missing = missingPermissions();
        if (missing.length > 0) {
            ActivityCompat.requestPermissions(this, missing, PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            // An instant denial means Android didn't show a dialog (permanently denied): open settings.
            if (!granted && SystemClock.elapsedRealtime() - notificationRequestedAt < 400) openAppSettings();
            notifyWebStatusChanged();
            return;
        }
        if (requestCode != PERMISSION_REQUEST_CODE) return;
        // Start scanning straight away so live readings begin without another tap.
        if (scanner.hasScanPermissions()) {
            scanner.reconcile();
            maybeStartBackgroundService();
        }
        notifyWebStatusChanged();
    }

    /** Make sure we are scanning (requesting permission first if needed). Runs on the UI thread. */
    private boolean ensureScanning() {
        if (!scanner.hasScanPermissions()) {
            requestBlePermissions();
            return false;
        }
        boolean ok = scanner.reconcile();
        maybeStartBackgroundService();
        return ok;
    }

    /** Foreground services may only be started while visible, so this is called from the UI. */
    private void maybeStartBackgroundService() {
        if (BlePrefs.isBackgroundEnabled(this)
                && scanner.hasScanPermissions()
                && scanner.isBluetoothSupported()
                && !BeaconScanService.isRunning()) {
            BeaconScanService.start(this);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Native -> web forwarding
    // ---------------------------------------------------------------------------------------------

    /** Called on the main thread by the scanner for every advertisement. */
    private void forwardToWeb(String address, String name, int rssi, IBeaconParser.Beacon beacon) {
        if (!scanner.isAppVisible()) return; // don't wake the WebView while in the background

        long now = SystemClock.elapsedRealtime();
        long minGap = scanner.isHeritage(address, name, beacon) ? HERITAGE_FORWARD_GAP_MS : OTHER_FORWARD_GAP_MS;
        Long last = lastForwardedAt.get(address);
        if (last != null && now - last < minGap) return;
        lastForwardedAt.put(address, now);
        if (lastForwardedAt.size() > 400) pruneForwardMap(now);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        String js = "window.onAndroidBleDeviceFound&&window.onAndroidBleDeviceFound("
                + JSONObject.quote(address) + ","
                + JSONObject.quote(name == null ? "" : name) + ","
                + rssi + ","
                + (beacon == null ? "null" : JSONObject.quote(beacon.toJson()))
                + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void pruneForwardMap(long now) {
        Iterator<Map.Entry<String, Long>> it = lastForwardedAt.entrySet().iterator();
        while (it.hasNext()) {
            if (now - it.next().getValue() > 60_000) it.remove();
        }
    }

    private void notifyWebStatusChanged() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.onAndroidBleStatusChanged&&window.onAndroidBleStatusChanged()", null));
    }

    // ---------------------------------------------------------------------------------------------
    // Hardware back button: let the web layer close modals / return to the home tab first.
    // ---------------------------------------------------------------------------------------------

    private void setupBackHandling() {
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    performDefaultBack();
                    return;
                }
                webView.evaluateJavascript(
                        "(function(){try{return !!(window.__virasatHandleBack&&window.__virasatHandleBack());}catch(e){return false;}})()",
                        value -> {
                            if (!"true".equals(value)) performDefaultBack();
                        });
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    private void performDefaultBack() {
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        backCallback.setEnabled(true);
    }

    /** The UI is dark, so system bar icons must be light (otherwise they vanish in light mode). */
    private void applySystemBarAppearance() {
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }

    private void safeStartActivity(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
            // Settings screen not available on this device.
        }
    }

    // ---------------------------------------------------------------------------------------------
    // JS bridge: window.AndroidBleScanner
    // ---------------------------------------------------------------------------------------------

    public class AndroidBleBridge {

        @JavascriptInterface
        public boolean isNativeAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean isBluetoothEnabled() {
            return scanner.isBluetoothEnabled();
        }

        @JavascriptInterface
        public boolean hasPermissions() {
            return scanner.hasScanPermissions();
        }

        @JavascriptInterface
        public void requestPermissions() {
            runOnUiThread(MainActivity.this::requestBlePermissions);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                        && !isGranted(Manifest.permission.POST_NOTIFICATIONS)) {
                    notificationRequestedAt = SystemClock.elapsedRealtime();
                    ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[] {Manifest.permission.POST_NOTIFICATIONS},
                            NOTIFICATION_REQUEST_CODE);
                } else {
                    // Permission granted but notifications switched off in system settings.
                    openAppSettings();
                }
            });
        }

        /** Ensures scanning is running; returns the real result (BLE APIs run on the UI thread). */
        @JavascriptInterface
        public boolean startScan() {
            final boolean[] result = new boolean[1];
            final CountDownLatch latch = new CountDownLatch(1);
            runOnUiThread(() -> {
                try {
                    result[0] = ensureScanning();
                } finally {
                    latch.countDown();
                }
            });
            try {
                latch.await(3, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            return result[0];
        }

        /** Kept for compatibility. The scan lifecycle now follows app visibility natively. */
        @JavascriptInterface
        public void stopScan() {}

        @JavascriptInterface
        public String getStatusJson() {
            return scanner.getStatusJson();
        }

        @JavascriptInterface
        public void configure(String json) {
            scanner.configure(json);
        }

        @JavascriptInterface
        public void setBackgroundEnabled(boolean enabled) {
            runOnUiThread(() -> {
                BlePrefs.setBackgroundEnabled(MainActivity.this, enabled);
                if (enabled) {
                    maybeStartBackgroundService();
                } else {
                    BeaconScanService.stop(MainActivity.this);
                }
                notifyWebStatusChanged();
            });
        }

        @JavascriptInterface
        public void openBluetoothSettings() {
            safeStartActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
        }

        @JavascriptInterface
        public void openLocationSettings() {
            safeStartActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        }

        @JavascriptInterface
        public void openAppSettings() {
            MainActivity.this.openAppSettings();
        }
    }

    private void openAppSettings() {
        safeStartActivity(new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null)));
    }
}
