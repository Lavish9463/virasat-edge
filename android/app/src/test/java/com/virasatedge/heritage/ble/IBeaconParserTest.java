package com.virasatedge.heritage.ble;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class IBeaconParserTest {

    /** Payload advertised by the real "Virasat Edge" node: UUID e2c56db5-..., major 101, minor 2001, -59 dBm. */
    private static byte[] realBeaconPayload() {
        byte[] uuid = IBeaconParser.uuidToBytes("e2c56db5-dffb-48d2-b060-d0f5a71096e0");
        byte[] data = new byte[23];
        data[0] = 0x02;
        data[1] = 0x15;
        System.arraycopy(uuid, 0, data, 2, 16);
        data[18] = 0x00;
        data[19] = 0x65; // major 101
        data[20] = 0x07;
        data[21] = (byte) 0xD1; // minor 2001
        data[22] = (byte) 0xC5; // -59 dBm
        return data;
    }

    @Test
    public void parsesRealVirasatBeacon() {
        IBeaconParser.Beacon beacon = IBeaconParser.parse(realBeaconPayload());
        assertNotNull(beacon);
        assertEquals("e2c56db5-dffb-48d2-b060-d0f5a71096e0", beacon.uuid);
        assertEquals(101, beacon.major);
        assertEquals(2001, beacon.minor);
        assertEquals(-59, beacon.txPower);
    }

    @Test
    public void serializesToJson() {
        IBeaconParser.Beacon beacon = IBeaconParser.parse(realBeaconPayload());
        assertNotNull(beacon);
        assertEquals(
                "{\"uuid\":\"e2c56db5-dffb-48d2-b060-d0f5a71096e0\",\"major\":101,\"minor\":2001,\"txPower\":-59}",
                beacon.toJson());
    }

    @Test
    public void rejectsNonIBeaconPayloads() {
        assertNull(IBeaconParser.parse(null));
        assertNull(IBeaconParser.parse(new byte[10]));

        byte[] wrongType = realBeaconPayload();
        wrongType[0] = 0x01;
        assertNull(IBeaconParser.parse(wrongType));

        byte[] wrongLength = realBeaconPayload();
        wrongLength[1] = 0x10;
        assertNull(IBeaconParser.parse(wrongLength));
    }

    @Test
    public void buildsScanFilterForUuidOnly() {
        byte[] data = IBeaconParser.filterData("e2c56db5-dffb-48d2-b060-d0f5a71096e0");
        byte[] mask = IBeaconParser.filterMask();
        assertEquals(23, data.length);
        assertEquals(23, mask.length);

        byte[] expectedPrefix = new byte[18];
        System.arraycopy(realBeaconPayload(), 0, expectedPrefix, 0, 18);
        byte[] actualPrefix = new byte[18];
        System.arraycopy(data, 0, actualPrefix, 0, 18);
        assertArrayEquals(expectedPrefix, actualPrefix);

        for (int i = 0; i < 18; i++) assertEquals((byte) 0xFF, mask[i]);
        for (int i = 18; i < 23; i++) assertEquals(0, mask[i]); // major/minor/power ignored
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsMalformedUuid() {
        IBeaconParser.uuidToBytes("not-a-uuid");
    }
}
