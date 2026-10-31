package com.virasatedge.heritage.ble;

import java.util.Locale;

/**
 * Pure (Android-free) parser for Apple iBeacon advertisements, so it can be unit tested on the JVM.
 *
 * Input is the manufacturer-specific payload for company id 0x004C as returned by
 * ScanRecord#getManufacturerSpecificData(0x004C), i.e. WITHOUT the 2-byte company id:
 * [0x02][0x15][16-byte UUID][2-byte major][2-byte minor][1-byte signed measured power]
 */
public final class IBeaconParser {

    public static final int APPLE_COMPANY_ID = 0x004C;
    private static final int PAYLOAD_LENGTH = 23;

    private IBeaconParser() {}

    public static final class Beacon {
        /** Lowercase dashed UUID, e.g. e2c56db5-dffb-48d2-b060-d0f5a71096e0. */
        public final String uuid;
        public final int major;
        public final int minor;
        /** Calibrated RSSI at 1 m, in dBm. */
        public final int txPower;

        Beacon(String uuid, int major, int minor, int txPower) {
            this.uuid = uuid;
            this.major = major;
            this.minor = minor;
            this.txPower = txPower;
        }

        /** Hand-built JSON (org.json is unavailable in plain JVM unit tests). UUID is hex-only. */
        public String toJson() {
            return String.format(
                    Locale.US,
                    "{\"uuid\":\"%s\",\"major\":%d,\"minor\":%d,\"txPower\":%d}",
                    uuid, major, minor, txPower);
        }
    }

    /** Returns the decoded beacon, or null if the payload is not an iBeacon frame. */
    public static Beacon parse(byte[] data) {
        if (data == null || data.length < PAYLOAD_LENGTH) return null;
        if ((data[0] & 0xFF) != 0x02 || (data[1] & 0xFF) != 0x15) return null;

        StringBuilder uuid = new StringBuilder(36);
        for (int i = 2; i < 18; i++) {
            uuid.append(String.format(Locale.US, "%02x", data[i] & 0xFF));
            if (i == 5 || i == 7 || i == 9 || i == 11) uuid.append('-');
        }
        int major = ((data[18] & 0xFF) << 8) | (data[19] & 0xFF);
        int minor = ((data[20] & 0xFF) << 8) | (data[21] & 0xFF);
        int txPower = data[22]; // signed byte
        return new Beacon(uuid.toString(), major, minor, txPower);
    }

    /** UUID string (dashed or not) to its 16 raw bytes. */
    public static byte[] uuidToBytes(String uuid) {
        String hex = uuid.replace("-", "").toLowerCase(Locale.US);
        if (hex.length() != 32) throw new IllegalArgumentException("UUID must be 32 hex chars: " + uuid);
        byte[] out = new byte[16];
        for (int i = 0; i < 16; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    /** Manufacturer data for a ScanFilter matching any major/minor of the given iBeacon UUID. */
    public static byte[] filterData(String uuid) {
        byte[] data = new byte[PAYLOAD_LENGTH];
        data[0] = 0x02;
        data[1] = 0x15;
        System.arraycopy(uuidToBytes(uuid), 0, data, 2, 16);
        return data;
    }

    /** Mask for {@link #filterData}: match type, length and UUID; ignore major/minor/power. */
    public static byte[] filterMask() {
        byte[] mask = new byte[PAYLOAD_LENGTH];
        for (int i = 0; i < 18; i++) mask[i] = (byte) 0xFF;
        return mask;
    }
}
