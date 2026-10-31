# Virasat Edge — Hidden Heritage

Privacy-first Android app that helps visitors discover authentic heritage artisans hidden inside
historic lanes. Each lane has a low-cost **ESP32 iBeacon**; when the phone physically detects it,
the app shows the lane's verified masters, raises a lane alert, and unlocks **Proof-of-Presence
reviews** — reviews can only be written by someone actually standing in the lane, so bot/click-farm
ratings are impossible.

Built with React 19 + Vite + Tailwind 4, wrapped as a native Android app with Capacitor 8.
Saved artisans and verified reviews sync in real time through Firestore (with an offline cache).

**Live demo:** https://lavish9463.github.io/virasat-edge/
— the web version runs in demo mode (a slider stands in for walking, because browsers can't read
Bluetooth beacon signal). Real beacon detection, lane alerts and verified reviews need the Android
app built from this repo.

---

## How Proof-of-Presence works

| Where it runs | Source of presence | Can unlock reviews? |
|---|---|---|
| **Installed Android app** | The real ESP32 beacon, scanned over Bluetooth LE | Yes — only while the real signal is present |
| Web preview (browser) | On-screen distance simulator (browsers can't read BLE signal strength) | Yes, but reviews are labelled **Simulated** and never synced |

On the phone:

1. The native scanner (`android/.../ble/BeaconScanner.java`) reads every advertisement and parses the
   iBeacon frame. A beacon counts as a heritage beacon if it advertises the Virasat UUID, the name
   "Virasat Edge", or a MAC you paired manually.
2. The beacon's **minor** maps it to its lane, and the Radar jumps to that lane.
3. RSSI is smoothed with a **median of the last ~4 s** (raw BLE readings jump 5–10 dBm).
4. **Hysteresis**: you enter the lane at ≥ −68 dBm (~2–3 m) and only leave below −82 dBm, so the
   state doesn't flicker at the edge. Signing a review additionally needs ≥ −78 dBm.
5. If the beacon is silent for **7 s**, it is treated as gone and reviews **re-lock**. The review
   form re-checks presence live, so walking away mid-review locks "Publish".
6. Presence is **per lane**: being verified in one lane never unlocks artisans in another.

Use **"Unlock reviews from here"** (Nearby → More details) to calibrate the unlock distance for your phone
and venue (stored on the device, also applied to background alerts).

### Lane alerts
- A heads-up **system notification + vibration** fires when you walk into a lane.
- With **"Lane alerts with the app closed"** on (default), a foreground service keeps a filtered,
  battery-friendly scan running while the app is minimized; a persistent notification (with a
  **Stop** action) shows while it watches.

---

## ESP32 beacon configuration

Flash each lane node as an **iBeacon**:

| Field | Value |
|---|---|
| UUID | `e2c56db5-dffb-48d2-b060-d0f5a71096e0` (same for every lane) |
| Major | `101` |
| Minor | unique per lane — `2001` Gangaur Ghat, `2` Jagdish Temple, `3` Hathi Pol, `4` Bhatiyani |
| Measured power (1 m) | `-59` dBm |
| Device name | `Virasat Edge` |

Lane ↔ minor mapping lives in `src/data/mockData.ts` (`hardware.minor`). You can verify a node with
nRF Connect: it should show "Virasat Edge (iBeacon)" with the values above.

---

## Deployment

Every push to `main` runs the tests, builds the web app and publishes it to GitHub Pages
(`.github/workflows/deploy-pages.yml`). Asset paths are relative (`base: './'` in
`vite.config.ts`), so the same build works on Pages, inside the Android app and at any domain root.
Environment files (`.env*`) are git-ignored and never committed.

---

## Run, test, build

Prerequisites: Node.js 20+, and for the APK Android Studio (its bundled JDK and SDK are enough).

```bash
npm install
npm run dev          # web preview at http://localhost:3000 (simulator mode)
npm test             # JS unit tests (presence logic, beacon math)
npm run lint         # TypeScript type check
```

Build the Android app:

```bash
npm run android:sync                 # build the web app and copy it into android/
cd android && gradlew assembleDebug  # or: npx cap open android, then Run in Android Studio
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a phone
with `gradlew installDebug` (USB debugging on) or by sideloading the file.

Native unit tests (iBeacon parsing, presence state machine):

```bash
cd android && gradlew testDebugUnitTest
```

> On Windows the commands above use `gradlew`; on macOS/Linux use `./gradlew`. If Gradle can't find
> Java, point `JAVA_HOME` at Android Studio's bundled runtime (`…/Android Studio/jbr`).

---

## Data security (Firestore rules)

`firestore.rules` is default-deny. The only allowed writes are the exact shapes the app produces:
saved artisans (only the real artisans, fixed fields) and beacon-verified reviews (append-only, can't
be edited or deleted, rating 1–5, bounded text, known tags, plausible signal strength). Everything else,
including any other collection, is refused.

```bash
npm run test:rules     # run the rules against the Firestore emulator (needs Java)
npm run deploy:rules   # publish to the live database (Firebase CLI login required)
```

Without user sign-in, rules can't prove a write came from the real app; they make abuse hard and
bounded rather than impossible. For stronger guarantees, add Firebase App Check (Play Integrity).

---

## Permissions (Android)

| Permission | Why |
|---|---|
| Nearby devices (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) | Detect lane beacons. |
| Precise location (all versions) + Location switched on | Android delivers iBeacon packets only to apps that hold precise location while Location is on. (Declaring `neverForLocation` makes Android silently drop iBeacons — that was the cause of beacons not being detected.) The app never reads or stores GPS coordinates. |
| Notifications | Lane-entry alerts and the background-detection notice. |
| Foreground service | Lane alerts while the app is minimized. |

The Nearby card shows the single thing blocking detection (permission missing, "Approximate"
location, Bluetooth off, Location off, scanner error) with a one-tap fix. **More details → Signal
check** lists every requirement and when the Virasat beacon was last heard.

---

## Project layout

```
src/
  App.tsx                     presence model, review gating, Firestore sync, back-button handling
  hooks/useLiveBeacon.ts      live readings from the native scanner: smoothing, lane resolution, expiry
  utils/presence.ts           pure presence rules (tested in presence.test.ts)
  utils/beaconLogic.ts        RSSI → distance, hysteresis, review gate (tested)
  utils/bleBridge.ts          typed wrapper around window.AndroidBleScanner
  components/NearbyStatusCard  the one "where am I" card (phone: real beacon, web: demo slider)
  components/SignalDetails     signal, calibration, background alerts, Signal check (phone)
  utils/scannerBlocker.ts      what's blocking detection + the fix (tested)
  firebase.ts                 Firestore with offline persistence
android/app/src/main/java/com/virasatedge/heritage/
  MainActivity.java           JS bridge, permissions, back button, lifecycle → scanner
  ble/BeaconScanner.java      single app-wide BLE scanner (foreground/background modes)
  ble/BeaconScanService.java  foreground service for alerts with the app closed
  ble/PresenceTracker.java    median smoothing + hysteresis + staleness (JUnit tested)
  ble/IBeaconParser.java      iBeacon frame parser (JUnit tested)
  ble/LaneNotifier.java       lane alerts and the service notification
```

---

## Troubleshooting

- **Beacon not detected** — open Nearby → More details → Signal check. Every line must be green:
  Bluetooth on, Nearby devices allowed, Location set to **Precise**, Location switched on. If all
  pass but the beacon is "not heard", check nRF Connect sees it and that it's powered and in range.
- **Unlocks too far away / too close** — stand where reviews should unlock and tap
  "Unlock reviews from here"; "Reset" restores the default.
- **No background alerts** — keep "Lane alerts with the app closed" on, allow notifications, and on
  aggressive battery savers exclude Virasat Edge from battery optimisation.
- **Crowd counts** in the lane cards are sample telemetry; the beacon is used for proximity only.
