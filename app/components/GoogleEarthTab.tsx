'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Search, Layers, Eye, EyeOff } from 'lucide-react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import SolarMapOverlay from './SolarMapOverlay';

interface SolarData {
  location?: { lat: number; lng: number };
  roofSegmentStats?: any[];
  panelDimensions?: { panelHeightMeters: number; panelWidthMeters: number; panelCapacityWatts: number };
  roofSegmentSummaries?: any[];
}

interface GoogleEarthTabProps {
  focusAddress?: string;
  solarData?: SolarData | null;
  onSearch?: (address: string) => void;
}

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;

function MapController({ solarData }: { solarData?: SolarData | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !solarData?.location) return;
    map.panTo({ lat: solarData.location.lat, lng: solarData.location.lng });
    map.setZoom(21);
  }, [map, solarData?.location]);

  return null;
}

export default function GoogleEarthTab({ focusAddress, solarData, onSearch }: GoogleEarthTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (focusAddress) {
      setSearchQuery(focusAddress);
    }
  }, [focusAddress]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    onSearch?.(query);
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
  const hasSolarOverlay = !!(solarData?.roofSegmentStats && solarData.panelDimensions);

  return (
    <div className="flex flex-col glass-card-elevated rounded-2xl overflow-hidden h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-white/[0.06] bg-gradient-to-r from-blue-500/[0.04] to-transparent shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15">
            <Globe className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/90">Site Explorer</h3>
            <p className="text-xs text-white/40">Search project locations and verify site conditions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasSolarOverlay && (
            <button
              onClick={() => setShowOverlay((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                showOverlay
                  ? 'bg-blue-500/15 border-blue-500/20 text-blue-400'
                  : 'bg-white/[0.04] border-white/[0.06] text-gray-500 hover:text-gray-300'
              }`}
              title={showOverlay ? 'Hide solar overlay' : 'Show solar overlay'}
            >
              {showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
              <Layers size={13} />
            </button>
          )}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
              <input type="text" placeholder="Search address or location..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 input-field" style={{ paddingLeft: '2.25rem' }} />
            </div>
            <button type="submit" className="btn-primary px-4 py-2 text-white text-sm font-medium rounded-lg">Go</button>
          </form>
        </div>
      </div>

      <div className="relative flex-1 w-full bg-black/50">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <Map
              mapTypeId="satellite"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              gestureHandling="greedy"
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%' }}
            />
            <MapController solarData={solarData} />
            {showOverlay && hasSolarOverlay && (
              <SolarMapOverlay
                roofSegmentStats={solarData!.roofSegmentStats!}
                panelDimensions={solarData!.panelDimensions!}
                roofSegmentSummaries={solarData!.roofSegmentSummaries ?? []}
              />
            )}
          </APIProvider>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-white/40">Maps API key not configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
