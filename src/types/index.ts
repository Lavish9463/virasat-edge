/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CraftCategory =
  | 'miniature_art'
  | 'puppets'
  | 'pottery'
  | 'silver'
  | 'handloom'
  | 'sweets'
  | 'leather_craft';

export interface VerifiedReview {
  id: string;
  userName: string;
  userCity: string;
  date: string;
  rating: number;
  comment: string;
  proofOfPresenceBeaconId: string;
  verifiedRssi: number;
  tags: string[];
  isVerifiedPresence: boolean;
  /**
   * How presence was established: 'ble' = the phone detected the real lane beacon (verified);
   * 'simulator' = web-preview simulation (never counted as verified, never synced).
   * Legacy reviews without this field were all hardware/beacon verified.
   */
  presenceSource?: 'ble' | 'simulator';
}

export interface Artisan {
  id: string;
  name: string;
  title: string;
  generation: string;
  estYear: number;
  craftCategory: CraftCategory;
  categoryLabel: string;
  laneId: string;
  laneName: string;
  city: string;
  distanceMeters: number;
  exactAddress: string;
  bio: string;
  craftHeritageStory: string;
  audioStoryDuration: string;
  audioStoryTranscript: string;
  audioStoryTitle: string;
  verifiedHeritageScore: number;
  verifiedReviewsCount: number;
  pricingRange: string;
  specialties: string[];
  images: string[];
  heritageBadges: string[];
  coordinates: { lat: number; lng: number };
  walkingDirectionsStep: string;
  reviews: VerifiedReview[];
}

export interface HardwareNodeSpecs {
  model: string;
  firmware: string;
  edgeImpulseModel: string;
  inferenceTimeMs: number;
  framesRetained: 0;
  costInr: number;
  batteryPercentage: number;
  solarPowered: boolean;
  bleUuid: string;
  major: number;
  minor: number;
  txPowerDbm: number;
}

export interface LaneBeacon {
  id: string;
  beaconCode: string;
  laneName: string;
  hindiName: string;
  landmark: string;
  city: string;
  macAddress: string;
  currentRssi: number;
  entryThreshold: number;
  exitThreshold: number;
  artisanCount: number;
  liveCrowdCount: number;
  hardware: HardwareNodeSpecs;
}

export type AndroidTab = 'discover' | 'artisans' | 'favorites' | 'about';

export interface PairedHardware {
  id: string;
  name: string;
  pairedAt: string;
  beaconCode: string;
  /** Signal seen when the device was paired (live readings come from the scanner, not here). */
  rssi?: number;
  distanceMeters?: number;
  autoReconnect: boolean;
  ipAddress?: string;
  macAddress?: string;
  connectionType?: 'ble' | 'mac' | 'ip';
}
