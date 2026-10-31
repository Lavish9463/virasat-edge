package com.virasatedge.heritage.ble;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Iterator;

/**
 * Pure (Android-free) proximity state machine for one beacon/lane.
 *
 * Raw BLE RSSI jumps by 5-10 dBm between packets, so readings are smoothed with the median of a
 * short sliding window. Entry/exit use hysteresis (enter above {@code entryThreshold}, leave only
 * below {@code exitThreshold}) and a beacon that stops advertising for {@code staleMs} counts as
 * gone. Mirrors src/utils/presence.ts so background alerts match what the UI shows.
 */
public final class PresenceTracker {

    public enum Event { NONE, ENTERED, EXITED }

    private final long windowMs;
    private final int maxSamples;
    private final long staleMs;
    private int entryThreshold;
    private int exitThreshold;

    /** Each entry is {timestampMs, rssi}. */
    private final ArrayDeque<long[]> samples = new ArrayDeque<>();
    private boolean inside = false;
    private long lastSeenMs = -1;

    public PresenceTracker(int entryThreshold, int exitThreshold, long windowMs, int maxSamples, long staleMs) {
        this.entryThreshold = entryThreshold;
        this.exitThreshold = exitThreshold;
        this.windowMs = windowMs;
        this.maxSamples = maxSamples;
        this.staleMs = staleMs;
    }

    public synchronized void setThresholds(int entryThreshold, int exitThreshold) {
        this.entryThreshold = entryThreshold;
        this.exitThreshold = exitThreshold;
    }

    /** Feed one advertisement. */
    public synchronized Event onSample(int rssi, long nowMs) {
        lastSeenMs = nowMs;
        samples.addLast(new long[] {nowMs, rssi});
        prune(nowMs);
        Integer smoothed = smoothedRssi();
        if (smoothed == null) return Event.NONE;
        boolean next = inside ? smoothed >= exitThreshold : smoothed >= entryThreshold;
        return transition(next);
    }

    /** Call periodically; reports EXITED once the beacon has gone quiet for longer than staleMs. */
    public synchronized Event onTick(long nowMs) {
        if (lastSeenMs >= 0 && nowMs - lastSeenMs > staleMs) {
            samples.clear();
            lastSeenMs = -1;
            return transition(false);
        }
        return Event.NONE;
    }

    public synchronized boolean isInside() {
        return inside;
    }

    /** Median of the current window, or null when there are no recent samples. */
    public synchronized Integer smoothedRssi() {
        if (samples.isEmpty()) return null;
        long[] values = new long[samples.size()];
        int i = 0;
        for (long[] s : samples) values[i++] = s[1];
        Arrays.sort(values);
        int mid = values.length / 2;
        if (values.length % 2 == 1) return (int) values[mid];
        return (int) Math.round((values[mid - 1] + values[mid]) / 2.0);
    }

    private void prune(long nowMs) {
        Iterator<long[]> it = samples.iterator();
        while (it.hasNext()) {
            if (nowMs - it.next()[0] > windowMs) it.remove();
        }
        while (samples.size() > maxSamples) samples.removeFirst();
    }

    private Event transition(boolean next) {
        if (next == inside) return Event.NONE;
        inside = next;
        return next ? Event.ENTERED : Event.EXITED;
    }
}
