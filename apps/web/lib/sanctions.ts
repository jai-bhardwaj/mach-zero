// OFAC + EU sanctions geo-blocking.
//
// We refuse signups from comprehensively-sanctioned jurisdictions because
// providing trading software to residents of these regions plausibly
// triggers OFAC obligations regardless of our non-custodial posture.
// The list errs toward over-inclusion — easier to relax later than to
// undo a violation.
//
// India is NOT on this list (it's not sanctioned). India is excluded for
// regulatory reasons (SEBI; see docs/0002-legal-counsel-checklist.md §5),
// and that gate is implemented separately at the residency-declaration
// step.

import 'server-only';
import type { NextRequest } from 'next/server';

// ISO-3166-1 alpha-2 country codes. Crimea / Donetsk / Luhansk are
// regions, not countries; OFAC treats them as part of UA but with
// sub-regional sanctions. We rely on Vercel's geo header which does not
// resolve sub-region, so we accept the limitation that a Crimea-resident
// using a Ukrainian IP will not be blocked at this layer. Document as a
// known gap; counsel review per legal §5.
export const SANCTIONED_COUNTRIES = new Set<string>([
  'IR',  // Iran
  'KP',  // North Korea
  'CU',  // Cuba
  'SY',  // Syria
  // Russia: comprehensive sanctions cover financial services. Including
  // here means we don't onboard Russian users — counsel may want this
  // restricted further (e.g., not include if our user base is exclusively
  // Russian dissidents using non-Russian IPs).
  'RU',
  'BY',  // Belarus (sanctions due to Russia support)
]);

export function isSanctionedCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return SANCTIONED_COUNTRIES.has(code.toUpperCase());
}

// Best-effort country detection from a NextRequest. Vercel sets
// `x-vercel-ip-country` in production. In local dev this header is
// absent; callers should fall back via shouldFailClosedOnMissingCountry
// rather than treat absent-country as "unsanctioned."
export function detectCountry(req: NextRequest): string | null {
  return (
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-country-code') ||
    null
  );
}

// In production with no country header, we fail closed — the deployment
// is misconfigured (Vercel's geo header missing) and "allow everyone"
// is the wrong default for a regulated workflow. An operator can set
// BYPASS_GEOBLOCK=1 to override for incident response.
export function shouldFailClosedOnMissingCountry(): boolean {
  if (process.env.BYPASS_GEOBLOCK === '1') return false;
  return process.env.NODE_ENV === 'production';
}

export type GeoblockResult =
  | { ok: true; country: string | null }
  | { ok: false; reason: 'sanctioned' | 'unknown'; country: string | null };

export function evaluateGeoblock(req: NextRequest): GeoblockResult {
  const country = detectCountry(req);

  if (country && isSanctionedCountry(country)) {
    return { ok: false, reason: 'sanctioned', country };
  }

  if (!country && shouldFailClosedOnMissingCountry()) {
    return { ok: false, reason: 'unknown', country: null };
  }

  return { ok: true, country };
}
