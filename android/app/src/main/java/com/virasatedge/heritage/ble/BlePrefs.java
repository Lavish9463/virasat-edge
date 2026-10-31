package com.virasatedge.heritage.ble;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Small persisted settings store shared by the activity and the background scan service.
 * The web layer pushes configuration (thresholds, lane directory) through the JS bridge; it is
 * kept here so the foreground service can keep alerting correctly after the UI is gone.
 */
public final class BlePrefs {

    private static final String FILE = "virasat_ble";
    private static final String KEY_BACKGROUND_ENABLED = "background_enabled";
    private static final String KEY_CONFIG_JSON = "config_json";

    private BlePrefs() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** Background lane alerts default to ON (the user opted into this feature). */
    public static boolean isBackgroundEnabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_BACKGROUND_ENABLED, true);
    }

    public static void setBackgroundEnabled(Context ctx, boolean enabled) {
        prefs(ctx).edit().putBoolean(KEY_BACKGROUND_ENABLED, enabled).apply();
    }

    public static String getConfigJson(Context ctx) {
        return prefs(ctx).getString(KEY_CONFIG_JSON, null);
    }

    public static void setConfigJson(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY_CONFIG_JSON, json).apply();
    }
}
