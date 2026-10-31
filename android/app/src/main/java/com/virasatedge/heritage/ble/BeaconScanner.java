package com.virasatedge.heritage.ble;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * App-wide owner of the single BLE scanner.
 *
 * Both the visible activity and the background {@link BeaconScanService} go through this class, so
 * there is exactly one active scan at a time. Starting is idempotent: Android silently stops
 * delivering results to apps that start more than 5 scans in 30 seconds, so repeated start calls
 * must never restart a scan that is already running in the requested mode.
 *
 * Modes:
 *  - FOREGROUND: unfiltered, low latency. Feeds the live UI and the device-pairing list.
 *  - BACKGROUND: filtered to heritage beacons, balanced power. Filters are required for results to
 *    keep arriving while the screen is off.
 */
public final class BeaconScanner {

    public interface DeviceListener {
        void onDevice(String address, String name, int rssi, IBeaconParser.Beacon beacon);
    }

    public interface StatusListener {
        void onStatusChanged();
    }

    public enum Mode { FOREGROUND, BACKGROUND }

    /** Shared iBeacon UUID of every Virasat Edge lane node. */
    public static final String HERITAGE_UUID = "e2c56db5-dffb-48d2-b060-d0f5a71096e0";
    private static final String HERITAGE_NAME = "Virasat Edge";

    private static final long STALE_MS = 7_000;
    private static final long WINDOW_MS = 4_000;
    private static final int MAX_SAMPLES = 9;
    private static final long TICK_MS = 2_000;
    private static final long RETRY_MS = 10_000;
    /** Android downgrades unfiltered scans running > 30 min to opportunistic; refresh before that. */
    private static final long REFRESH_MS = 25 * 60 * 1000L;

    // Holds only the application context (see get()), which lives as long as the process: no leak.
    @SuppressLint("StaticFieldLeak")
    private static BeaconScanner instance;

    public static synchronized BeaconScanner get(Context ctx) {
        if (instance == null) instance = new BeaconScanner(ctx.getApplicationContext());
        return instance;
    }

    private static final class LaneInfo {
        final String id;
        final String name;
        final int artisanCount;

        LaneInfo(String id, String name, int artisanCount) {
            this.id = id;
            this.name = name;
            this.artisanCount = artisanCount;
        }
    }

    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CopyOnWriteArrayList<DeviceListener> deviceListeners = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<StatusListener> statusListeners = new CopyOnWriteArrayList<>();
    private final Map<String, PresenceTracker> trackers = new HashMap<>();
    private final Map<Integer, LaneInfo> lanesByMinor = new HashMap<>();
    private final Map<String, LaneInfo> lanesById = new HashMap<>();

    private BluetoothLeScanner leScanner;
    private ScanCallback callback;
    private Mode mode;
    private boolean scanning = false;
    private int lastErrorCode = 0;
    private boolean appVisible = false;
    private boolean serviceRunning = false;

    // Configuration pushed from the web layer (and persisted for the background service).
    private int entryThreshold = -68;
    private int exitThreshold = -82;
    private String defaultLaneId = null;
    private String pairedMac = null;

    // Diagnostics for the in-app "Signal check" (what the scanner actually receives).
    private final ArrayDeque<Long> heritagePacketTimes = new ArrayDeque<>();
    private long packetsSinceStart = 0;
    private long lastHeritageAt = -1;
    private int lastHeritageRssi = 0;

    private BeaconScanner(Context ctx) {
        this.ctx = ctx;
        loadConfig(BlePrefs.getConfigJson(ctx));
        registerSystemReceivers();
    }

    // ---------------------------------------------------------------------------------------------
    // Lifecycle coordination
    // ---------------------------------------------------------------------------------------------

    public synchronized void setAppVisible(boolean visible) {
        appVisible = visible;
        reconcile();
    }

    public synchronized boolean isAppVisible() {
        return appVisible;
    }

    public synchronized void setServiceRunning(boolean running) {
        serviceRunning = running;
        reconcile();
    }

    /** Bring the scanner in line with the current visibility/service state. */
    public synchronized boolean reconcile() {
        main.removeCallbacks(retryRunnable);
        boolean result;
        if (appVisible) {
            result = start(Mode.FOREGROUND);
        } else if (serviceRunning) {
            result = start(Mode.BACKGROUND);
        } else {
            stopInternal();
            trackers.clear();
            result = false;
        }
        notifyStatus();
        return result;
    }

    // ---------------------------------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------------------------------

    /**
     * JSON from the web layer:
     * {entry, exit, defaultLaneId, pairedMac, lanes:[{minor, laneId, laneName, artisanCount}]}
     */
    public synchronized void configure(String json) {
        if (json == null) return;
        BlePrefs.setConfigJson(ctx, json);
        String previousMac = pairedMac;
        loadConfig(json);
        // Background filters embed the paired MAC, so rebuild them if it changed.
        boolean macChanged = previousMac == null ? pairedMac != null : !previousMac.equalsIgnoreCase(String.valueOf(pairedMac));
        if (scanning && mode == Mode.BACKGROUND && macChanged) {
            stopInternal();
            start(Mode.BACKGROUND);
        }
    }

    private void loadConfig(String json) {
        if (json == null) return;
        try {
            JSONObject o = new JSONObject(json);
            entryThreshold = o.optInt("entry", -68);
            exitThreshold = o.optInt("exit", -82);
            defaultLaneId = o.isNull("defaultLaneId") ? null : o.optString("defaultLaneId", null);
            String mac = o.isNull("pairedMac") ? null : o.optString("pairedMac", null);
            pairedMac = mac == null || mac.isEmpty() ? null : mac.toUpperCase(Locale.US);

            lanesByMinor.clear();
            lanesById.clear();
            JSONArray lanes = o.optJSONArray("lanes");
            if (lanes != null) {
                for (int i = 0; i < lanes.length(); i++) {
                    JSONObject l = lanes.getJSONObject(i);
                    LaneInfo info = new LaneInfo(
                            l.getString("laneId"), l.optString("laneName", "a heritage lane"), l.optInt("artisanCount", 0));
                    lanesById.put(info.id, info);
                    if (l.has("minor")) lanesByMinor.put(l.getInt("minor"), info);
                }
            }
            for (PresenceTracker t : trackers.values()) t.setThresholds(entryThreshold, exitThreshold);
        } catch (JSONException ignored) {
            // Keep the previous configuration if the payload is malformed.
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Capability checks
    // ---------------------------------------------------------------------------------------------

    private BluetoothAdapter adapter() {
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        return bm != null ? bm.getAdapter() : null;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED;
    }

    public boolean isBluetoothSupported() {
        return adapter() != null && ctx.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
    }

    public boolean isBluetoothEnabled() {
        BluetoothAdapter a = adapter();
        return a != null && a.isEnabled();
    }

    /** Runtime permission needed to scan (Android 12+: Nearby devices; older: location). */
    public boolean hasScanPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // iBeacons are only delivered to apps that hold precise location (no neverForLocation).
            return granted(Manifest.permission.BLUETOOTH_SCAN) && granted(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        return granted(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    private boolean canReadDeviceName() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted(Manifest.permission.BLUETOOTH_CONNECT);
    }

    /** Before Android 12, BLE scans return nothing unless Location services are switched on. */
    public boolean locationServicesRequired() {
        return true; // Android withholds beacon results from location-using apps while Location is off
    }

    public boolean isLocationServicesEnabled() {
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        return lm != null && LocationManagerCompat.isLocationEnabled(lm);
    }

    // ---------------------------------------------------------------------------------------------
    // Scanning
    // ---------------------------------------------------------------------------------------------

    @SuppressLint("MissingPermission")
    private boolean start(Mode requested) {
        if (!hasScanPermissions() || !isBluetoothEnabled()) {
            if (scanning) stopInternal();
            return false;
        }
        if (scanning && callback != null && mode == requested) return true; // idempotent
        if (scanning) stopInternal();

        BluetoothAdapter a = adapter();
        leScanner = a != null ? a.getBluetoothLeScanner() : null;
        if (leScanner == null) return false;

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(requested == Mode.FOREGROUND
                        ? ScanSettings.SCAN_MODE_LOW_LATENCY
                        : ScanSettings.SCAN_MODE_BALANCED)
                .build();
        List<ScanFilter> filters = buildHeritageFilters();

        ScanCallback cb = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                handleResult(result);
            }

            @Override
            public void onBatchScanResults(List<ScanResult> results) {
                for (ScanResult r : results) handleResult(r);
            }

            @Override
            public void onScanFailed(int errorCode) {
                onFailed(this, errorCode);
            }
        };

        try {
            leScanner.startScan(filters, settings, cb);
        } catch (SecurityException | IllegalStateException | IllegalArgumentException e) {
            return false;
        }
        callback = cb;
        mode = requested;
        scanning = true;
        lastErrorCode = 0;
        main.removeCallbacks(tickRunnable);
        main.postDelayed(tickRunnable, TICK_MS);
        main.removeCallbacks(refreshRunnable);
        if (requested == Mode.FOREGROUND) main.postDelayed(refreshRunnable, REFRESH_MS);
        return true;
    }

    @SuppressLint("MissingPermission")
    private void stopInternal() {
        if (leScanner != null && callback != null) {
            try {
                leScanner.stopScan(callback);
            } catch (Exception ignored) {
                // Adapter may already be off.
            }
        }
        callback = null;
        scanning = false;
        mode = null;
        main.removeCallbacks(tickRunnable);
        main.removeCallbacks(refreshRunnable);
    }

    private synchronized void onFailed(ScanCallback cb, int errorCode) {
        if (cb != callback) return;
        callback = null;
        scanning = false;
        mode = null;
        lastErrorCode = errorCode;
        main.removeCallbacks(retryRunnable);
        main.postDelayed(retryRunnable, RETRY_MS);
        notifyStatus();
    }

    private List<ScanFilter> buildHeritageFilters() {
        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder()
                .setManufacturerData(
                        IBeaconParser.APPLE_COMPANY_ID,
                        IBeaconParser.filterData(HERITAGE_UUID),
                        IBeaconParser.filterMask())
                .build());
        filters.add(new ScanFilter.Builder().setDeviceName(HERITAGE_NAME).build());
        if (pairedMac != null && BluetoothAdapter.checkBluetoothAddress(pairedMac)) {
            filters.add(new ScanFilter.Builder().setDeviceAddress(pairedMac).build());
        }
        return filters;
    }

    @SuppressLint("MissingPermission")
    private void handleResult(ScanResult result) {
        if (result == null || result.getDevice() == null) return;
        String address = result.getDevice().getAddress();
        ScanRecord record = result.getScanRecord();

        // Prefer the advertised name; fall back to the cached device name when permitted.
        String name = record != null ? record.getDeviceName() : null;
        if ((name == null || name.trim().isEmpty()) && canReadDeviceName()) {
            try {
                name = result.getDevice().getName();
            } catch (SecurityException ignored) {
                name = null;
            }
        }
        if (name != null && name.trim().isEmpty()) name = null;

        IBeaconParser.Beacon beacon = record != null
                ? IBeaconParser.parse(record.getManufacturerSpecificData(IBeaconParser.APPLE_COMPANY_ID))
                : null;
        int rssi = result.getRssi();

        boolean heritage = isHeritage(address, name, beacon);
        recordDiagnostics(heritage, rssi);
        if (heritage) trackPresence(beacon, rssi);

        for (DeviceListener l : deviceListeners) {
            try {
                l.onDevice(address, name, rssi, beacon);
            } catch (Exception ignored) {
                // One faulty listener must not break the others.
            }
        }
    }

    private synchronized void recordDiagnostics(boolean heritage, int rssi) {
        packetsSinceStart++;
        if (!heritage) return;
        long now = SystemClock.elapsedRealtime();
        lastHeritageAt = now;
        lastHeritageRssi = rssi;
        heritagePacketTimes.addLast(now);
        while (heritagePacketTimes.size() > 500) heritagePacketTimes.removeFirst();
    }

    private int heritagePacketsInLast(long windowMs) {
        long cutoff = SystemClock.elapsedRealtime() - windowMs;
        while (!heritagePacketTimes.isEmpty() && heritagePacketTimes.peekFirst() < cutoff) heritagePacketTimes.removeFirst();
        return heritagePacketTimes.size();
    }

    public synchronized boolean isHeritage(String address, String name, IBeaconParser.Beacon beacon) {
        if (beacon != null && HERITAGE_UUID.equalsIgnoreCase(beacon.uuid)) return true;
        if (name != null) {
            String n = name.toLowerCase(Locale.US);
            if (n.contains("virasat") || n.contains("vedge")) return true;
        }
        return pairedMac != null && pairedMac.equalsIgnoreCase(address);
    }

    // ---------------------------------------------------------------------------------------------
    // Presence + lane alerts
    // ---------------------------------------------------------------------------------------------

    private LaneInfo resolveLane(IBeaconParser.Beacon beacon) {
        if (beacon != null && lanesByMinor.containsKey(beacon.minor)) return lanesByMinor.get(beacon.minor);
        return defaultLaneId != null ? lanesById.get(defaultLaneId) : null;
    }

    private void trackPresence(IBeaconParser.Beacon beacon, int rssi) {
        LaneInfo lane;
        PresenceTracker.Event event;
        synchronized (this) {
            lane = resolveLane(beacon);
            String key = lane != null ? lane.id : "default";
            PresenceTracker tracker = trackers.get(key);
            if (tracker == null) {
                tracker = new PresenceTracker(entryThreshold, exitThreshold, WINDOW_MS, MAX_SAMPLES, STALE_MS);
                trackers.put(key, tracker);
            }
            event = tracker.onSample(rssi, SystemClock.elapsedRealtime());
        }
        if (event == PresenceTracker.Event.ENTERED) announceEntry(lane);
    }

    private void announceEntry(LaneInfo lane) {
        String laneName = lane != null ? lane.name : "a heritage lane";
        int count = lane != null ? lane.artisanCount : 0;
        String title = "You are near " + laneName + "!";
        String body = count > 0
                ? count + (count == 1 ? " verified heritage artisan is" : " verified heritage artisans are")
                        + " just inside this lane. Tap to explore and leave a verified review."
                : "Verified heritage artisans are just inside this lane. Tap to explore.";
        LaneNotifier.notifyLaneEntered(ctx, lane != null ? lane.id : "default", title, body);
    }

    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            synchronized (BeaconScanner.this) {
                long now = SystemClock.elapsedRealtime();
                for (PresenceTracker t : trackers.values()) t.onTick(now);
                if (scanning) main.postDelayed(this, TICK_MS);
            }
        }
    };

    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            synchronized (BeaconScanner.this) {
                if (!scanning || mode == null) return;
                Mode current = mode;
                stopInternal();
                start(current);
            }
        }
    };

    private final Runnable retryRunnable = this::reconcile;

    // ---------------------------------------------------------------------------------------------
    // System state changes (Bluetooth / Location toggled)
    // ---------------------------------------------------------------------------------------------

    private void registerSystemReceivers() {
        IntentFilter filter = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
        filter.addAction(LocationManager.PROVIDERS_CHANGED_ACTION);
        ContextCompat.registerReceiver(ctx, new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                synchronized (BeaconScanner.this) {
                    if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(intent.getAction())) {
                        int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
                        if (state == BluetoothAdapter.STATE_ON) {
                            reconcile();
                        } else if (state == BluetoothAdapter.STATE_TURNING_OFF || state == BluetoothAdapter.STATE_OFF) {
                            stopInternal();
                            trackers.clear();
                            notifyStatus();
                        }
                    } else {
                        reconcile();
                    }
                }
            }
        }, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    // ---------------------------------------------------------------------------------------------
    // Listeners + status
    // ---------------------------------------------------------------------------------------------

    public void addDeviceListener(DeviceListener l) {
        deviceListeners.addIfAbsent(l);
    }

    public void removeDeviceListener(DeviceListener l) {
        deviceListeners.remove(l);
    }

    public void addStatusListener(StatusListener l) {
        statusListeners.addIfAbsent(l);
    }

    public void removeStatusListener(StatusListener l) {
        statusListeners.remove(l);
    }

    private void notifyStatus() {
        main.post(() -> {
            for (StatusListener l : statusListeners) {
                try {
                    l.onStatusChanged();
                } catch (Exception ignored) {
                    // ignore
                }
            }
        });
    }

    public synchronized boolean isScanning() {
        return scanning;
    }

    public synchronized String getStatusJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("bluetoothSupported", isBluetoothSupported());
            o.put("bluetoothEnabled", isBluetoothEnabled());
            o.put("hasPermissions", hasScanPermissions());
            o.put("scanning", scanning);
            o.put("mode", mode == null ? JSONObject.NULL : mode.name().toLowerCase(Locale.US));
            o.put("lastError", lastErrorCode);
            o.put("locationServicesRequired", locationServicesRequired());
            o.put("locationServicesEnabled", isLocationServicesEnabled());
            o.put("backgroundEnabled", BlePrefs.isBackgroundEnabled(ctx));
            o.put("backgroundRunning", BeaconScanService.isRunning());
            o.put("notificationsAllowed", LaneNotifier.notificationsAllowed(ctx));
            o.put("hasLocationPermission", granted(Manifest.permission.ACCESS_FINE_LOCATION));
            o.put("hasCoarseOnly", granted(Manifest.permission.ACCESS_COARSE_LOCATION)
                    && !granted(Manifest.permission.ACCESS_FINE_LOCATION));
            o.put("hasNearbyPermission", Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || granted(Manifest.permission.BLUETOOTH_SCAN));
            o.put("beaconPackets10s", heritagePacketsInLast(10_000));
            o.put("lastBeaconAgoMs", lastHeritageAt < 0 ? -1 : SystemClock.elapsedRealtime() - lastHeritageAt);
            o.put("lastBeaconRssi", lastHeritageRssi);
            o.put("packetsSinceStart", packetsSinceStart);
            o.put("sdkInt", Build.VERSION.SDK_INT);
        } catch (JSONException ignored) {
            // Values are primitives; cannot fail in practice.
        }
        return o.toString();
    }
}
