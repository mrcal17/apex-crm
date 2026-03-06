import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CACHE_TTL_DAYS = 30;

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Solar API key not configured' }, { status: 500 });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const addressKey = normalizeAddress(address);

    // Check DB cache
    const { data: cached } = await supabaseAdmin
      .from('solar_cache')
      .select('solar_data')
      .eq('address_key', addressKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      return NextResponse.json(cached.solar_data);
    }

    // Step 1: Geocode address to lat/lng
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Call Google Solar API
    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
    const solarRes = await fetch(solarUrl);

    if (!solarRes.ok) {
      const errBody = await solarRes.text();
      console.error('Solar API error:', solarRes.status, errBody);
      return NextResponse.json({ error: 'No solar data available for this location' }, { status: 404 });
    }

    const solarData = await solarRes.json();
    const sp = solarData.solarPotential;

    const maxConfig = sp?.solarPanelConfigs?.length
      ? sp.solarPanelConfigs[sp.solarPanelConfigs.length - 1]
      : null;

    const responseData = {
      solarPotential: sp,
      location: { lat, lng },
      roofSegmentStats: sp?.roofSegmentStats ?? [],
      panelDimensions: {
        panelHeightMeters: sp?.panelHeightMeters ?? 1.65,
        panelWidthMeters: sp?.panelWidthMeters ?? 0.99,
        panelCapacityWatts: sp?.panelCapacityWatts ?? 400,
      },
      roofSegmentSummaries: maxConfig?.roofSegmentSummaries ?? [],
    };

    // Upsert into solar_cache with TTL
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await supabaseAdmin
      .from('solar_cache')
      .upsert({
        address_key: addressKey,
        lat,
        lng,
        solar_data: responseData,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'address_key' });

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Solar route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
