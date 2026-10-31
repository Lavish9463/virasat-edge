package com.virasatedge.heritage.ble;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PresenceTrackerTest {

    private static PresenceTracker newTracker() {
        // entry -68, exit -82, 4 s window, 9 samples, stale after 7 s
        return new PresenceTracker(-68, -82, 4_000, 9, 7_000);
    }

    @Test
    public void entersWhenSmoothedSignalPassesEntryThreshold() {
        PresenceTracker t = newTracker();
        assertEquals(PresenceTracker.Event.ENTERED, t.onSample(-60, 0));
        assertTrue(t.isInside());
    }

    @Test
    public void singleSpikeDoesNotTriggerEntry() {
        PresenceTracker t = newTracker();
        assertEquals(PresenceTracker.Event.NONE, t.onSample(-80, 0));
        assertEquals(PresenceTracker.Event.NONE, t.onSample(-79, 300));
        // One strong outlier: the median of (-80, -79, -55) is -79, still below entry.
        assertEquals(PresenceTracker.Event.NONE, t.onSample(-55, 600));
        assertFalse(t.isInside());
    }

    @Test
    public void hysteresisKeepsVisitorInsideBetweenThresholds() {
        PresenceTracker t = newTracker();
        t.onSample(-60, 0);
        assertTrue(t.isInside());
        // Weaker than entry (-68) but stronger than exit (-82): stay inside.
        for (int i = 1; i <= 9; i++) assertEquals(PresenceTracker.Event.NONE, t.onSample(-75, i * 300L));
        assertTrue(t.isInside());
    }

    @Test
    public void exitsWhenSmoothedSignalDropsBelowExitThreshold() {
        PresenceTracker t = newTracker();
        t.onSample(-60, 0);
        PresenceTracker.Event last = PresenceTracker.Event.NONE;
        for (int i = 1; i <= 9; i++) {
            PresenceTracker.Event e = t.onSample(-90, i * 300L);
            if (e != PresenceTracker.Event.NONE) last = e;
        }
        assertEquals(PresenceTracker.Event.EXITED, last);
        assertFalse(t.isInside());
    }

    @Test
    public void silentBeaconIsTreatedAsGone() {
        PresenceTracker t = newTracker();
        t.onSample(-60, 0);
        assertEquals(PresenceTracker.Event.NONE, t.onTick(5_000));
        assertTrue(t.isInside());
        assertEquals(PresenceTracker.Event.EXITED, t.onTick(7_500));
        assertFalse(t.isInside());
        assertNull(t.smoothedRssi());
    }

    @Test
    public void oldSamplesAgeOutOfTheWindow() {
        PresenceTracker t = newTracker();
        t.onSample(-90, 0);
        t.onSample(-90, 100);
        // 5 s later the old weak samples are outside the 4 s window; only the new one counts.
        assertEquals(PresenceTracker.Event.ENTERED, t.onSample(-60, 5_100));
        assertEquals(Integer.valueOf(-60), t.smoothedRssi());
    }

    @Test
    public void calibratedThresholdsApplyImmediately() {
        PresenceTracker t = newTracker();
        t.setThresholds(-55, -69);
        assertEquals(PresenceTracker.Event.NONE, t.onSample(-60, 0));
        assertEquals(PresenceTracker.Event.ENTERED, t.onSample(-50, 300)); // median(-60,-50) = -55
    }
}
