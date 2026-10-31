/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CrowdDensityInfo {
  status: 'serene' | 'moderate' | 'busy';
  label: string;
  badgeClass: string;
  advice: string;
}

/**
 * Calculates approximate distance in meters based on RSSI and measured power at 1 meter.
 * Uses the Log-Distance Path Loss Model: RSSI = -10 * n * log10(d) + TxPower
 */
export function calculateDistanceFromRssi(rssi: number, txPower: number = -59): number {
  if (rssi === 0) return 999;
  const ratio = (txPower - rssi) / (10 * 2.4); // n = 2.4 for heritage stone alleyway environment
  const distance = Math.pow(10, ratio);
  return Math.max(1, Math.round(distance * 10) / 10);
}

/**
 * BLE Hysteresis filter to prevent jittery flapping between inside/outside proximity states.
 * - Enters zone when RSSI > entryThreshold (e.g., -68 dBm)
 * - Exits zone only when RSSI falls below exitThreshold (e.g., -82 dBm)
 */
export function checkHysteresisProximity(
  currentRssi: number,
  isCurrentlyInside: boolean,
  entryThreshold: number = -68,
  exitThreshold: number = -82
): boolean {
  if (isCurrentlyInside) {
    // Remain inside until signal drops below exit threshold
    return currentRssi >= exitThreshold;
  } else {
    // Only enter if signal climbs above entry threshold
    return currentRssi >= entryThreshold;
  }
}

/**
 * Categorizes pedestrian crowd density from privacy-first ESP32 Edge Impulse headcount.
 * No video frames are ever recorded or transmitted.
 */
export function getCrowdDensityInfo(headcount: number): CrowdDensityInfo {
  if (headcount <= 5) {
    return {
      status: 'serene',
      label: 'Serene Alley (Low Density)',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      advice: 'Ideal, quiet time to watch master artisans work undisturbed.',
    };
  } else if (headcount <= 14) {
    return {
      status: 'moderate',
      label: 'Moderate Footfall',
      badgeClass: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
      advice: 'Gentle pedestrian traffic; normal workshop atmosphere.',
    };
  } else {
    return {
      status: 'busy',
      label: 'Crowded Heritage Lane',
      badgeClass: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
      advice: 'Narrow lane is busy; consider visiting in 20-30 minutes.',
    };
  }
}

/**
 * Proof of Presence validator for the anti-bot review filter.
 * Tourists can only submit ratings & reviews if their device actively detects
 * the authentic ESP32 beacon within the lane entry threshold.
 */
export function canSubmitReviewWithProof(
  beaconDetected: boolean,
  currentRssi: number,
  requiredThreshold: number = -78
): { canReview: boolean; reason: string; verificationConfidence: number } {
  if (!beaconDetected) {
    return {
      canReview: false,
      reason: 'Physical Presence Required: You must be physically near the heritage lane beacon to review this artisan.',
      verificationConfidence: 0,
    };
  }

  if (currentRssi < requiredThreshold) {
    return {
      canReview: false,
      reason: `Beacon signal too weak (${currentRssi} dBm). Walk closer to the workshop inside the lane to unlock reviews.`,
      verificationConfidence: Math.max(10, Math.round(100 - (requiredThreshold - currentRssi) * 3)),
    };
  }

  const confidence = Math.min(100, Math.round(75 + Math.abs(currentRssi + 80) * 1.5));
  return {
    canReview: true,
    reason: `Verified Physical Presence! ESP32 Beacon authenticated at ${currentRssi} dBm.`,
    verificationConfidence: confidence,
  };
}
