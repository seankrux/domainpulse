/**
 * Pure Google Business Profile (GMB) lookup via the Google Places API.
 *
 * Dependency-free (only the global `fetch`) so it can be reused by the Vercel
 * handler, the local dev proxy, and unit tests without pulling in serverless
 * middleware (auth/rate-limit/@vercel/node).
 */

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const DETAIL_FIELDS = [
  'name',
  'rating',
  'user_ratings_total',
  'business_status',
  'opening_hours/open_now',
  'formatted_address',
  'formatted_phone_number',
  'website',
  'url',
  'place_id',
].join(',');

export interface GmbResult {
  status: 'OPERATIONAL' | 'CLOSED' | 'NOT_FOUND' | 'ERROR' | 'UNKNOWN';
  placeId?: string;
  name?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  openNow?: boolean;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  error?: string;
}

export async function lookupGmb(
  { placeId, query }: { placeId?: string; query?: string },
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
): Promise<GmbResult> {
  if (!apiKey) {
    return { status: 'UNKNOWN', error: 'GOOGLE_PLACES_API_KEY not configured on the server.' };
  }

  try {
    let resolvedId = placeId;

    // Resolve free-text query → place_id via Find Place.
    if (!resolvedId && query) {
      const findUrl =
        `${PLACES_BASE}/findplacefromtext/json?input=${encodeURIComponent(query)}` +
        `&inputtype=textquery&fields=place_id&key=${apiKey}`;
      const findRes = await fetch(findUrl);
      const findData = (await findRes.json()) as { candidates?: { place_id?: string }[]; status?: string };
      resolvedId = findData.candidates?.[0]?.place_id;
      if (!resolvedId) {
        return { status: 'NOT_FOUND', error: `No listing matched "${query}".` };
      }
    }

    const detailUrl =
      `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(resolvedId!)}` +
      `&fields=${DETAIL_FIELDS}&key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detailData = (await detailRes.json()) as {
      status?: string;
      error_message?: string;
      result?: {
        name?: string;
        rating?: number;
        user_ratings_total?: number;
        business_status?: string;
        opening_hours?: { open_now?: boolean };
        formatted_address?: string;
        formatted_phone_number?: string;
        website?: string;
        url?: string;
        place_id?: string;
      };
    };

    if (detailData.status === 'NOT_FOUND' || detailData.status === 'INVALID_REQUEST') {
      return { status: 'NOT_FOUND', error: detailData.error_message || 'Place not found.' };
    }
    if (detailData.status !== 'OK' || !detailData.result) {
      return { status: 'ERROR', error: detailData.error_message || `Places API status: ${detailData.status}` };
    }

    const r = detailData.result;
    const closed = r.business_status === 'CLOSED_TEMPORARILY' || r.business_status === 'CLOSED_PERMANENTLY';

    return {
      status: closed ? 'CLOSED' : 'OPERATIONAL',
      placeId: r.place_id || resolvedId,
      name: r.name,
      rating: r.rating,
      reviewCount: r.user_ratings_total,
      businessStatus: r.business_status,
      openNow: r.opening_hours?.open_now,
      address: r.formatted_address,
      phone: r.formatted_phone_number,
      website: r.website,
      mapsUrl: r.url,
    };
  } catch (error) {
    return { status: 'ERROR', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
