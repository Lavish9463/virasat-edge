/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface ArtisanImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Artisan photo with a branded fallback: if the image is missing or fails to load (e.g. offline
 * with an external URL), show the artisan's initials on a warm gradient instead of a broken icon.
 */
export const ArtisanImage: React.FC<ArtisanImageProps> = ({ src, alt, className = '', loading }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initials = alt
      .replace(/^(pt\.|master)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} flex items-center justify-center bg-gradient-to-br from-amber-900/70 via-stone-800 to-stone-950 text-amber-300 font-bold select-none`}
        style={{ containerType: 'inline-size' }}
      >
        <span className="tracking-wider" style={{ fontSize: 'clamp(10px, 28cqi, 48px)' }}>
          {initials || 'VE'}
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading={loading} onError={() => setFailed(true)} />;
};
