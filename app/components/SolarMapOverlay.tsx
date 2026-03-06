'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface RoofSegmentStat {
  pitchDegrees: number;
  azimuthDegrees: number;
  stats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
    groundAreaMeters2: number;
  };
  center: { latitude: number; longitude: number };
  boundingBox: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  planeHeightAtCenterMeters: number;
}

interface RoofSegmentSummary {
  pitchDegrees: number;
  azimuthDegrees: number;
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

interface PanelDimensions {
  panelHeightMeters: number;
  panelWidthMeters: number;
  panelCapacityWatts: number;
}

interface SolarMapOverlayProps {
  roofSegmentStats: RoofSegmentStat[];
  panelDimensions: PanelDimensions;
  roofSegmentSummaries: RoofSegmentSummary[];
}

const SEGMENT_COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function metersToLatLng(lat: number, dxMeters: number, dyMeters: number): [number, number] {
  const dLat = dyMeters / 111320;
  const dLng = dxMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [dLat, dLng];
}

function rotatePoint(x: number, y: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
}

export default function SolarMapOverlay({ roofSegmentStats, panelDimensions, roofSegmentSummaries }: SolarMapOverlayProps) {
  const map = useMap();
  const overlaysRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (!map || !roofSegmentStats?.length) return;

    // Clear previous overlays
    overlaysRef.current.forEach((p) => p.setMap(null));
    overlaysRef.current = [];

    const { panelHeightMeters, panelWidthMeters } = panelDimensions;

    roofSegmentStats.forEach((segment, idx) => {
      if (!segment.boundingBox) return;

      const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
      const sw = segment.boundingBox.sw;
      const ne = segment.boundingBox.ne;

      // Draw segment bounding box outline
      const segmentPoly = new google.maps.Polygon({
        paths: [
          { lat: sw.latitude, lng: sw.longitude },
          { lat: sw.latitude, lng: ne.longitude },
          { lat: ne.latitude, lng: ne.longitude },
          { lat: ne.latitude, lng: sw.longitude },
        ],
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.12,
        map,
      });
      overlaysRef.current.push(segmentPoly);

      // Find how many panels this segment has in the max config
      const summary = roofSegmentSummaries.find((s) => s.segmentIndex === idx);
      const panelCount = summary?.panelsCount ?? 0;
      if (panelCount === 0) return;

      // Calculate panel grid within segment bounding box
      const azimuth = segment.azimuthDegrees ?? 0;
      const centerLat = segment.center?.latitude ?? (sw.latitude + ne.latitude) / 2;
      const centerLng = segment.center?.longitude ?? (sw.longitude + ne.longitude) / 2;

      // Bounding box dimensions in meters
      const bboxWidthM = (ne.longitude - sw.longitude) * 111320 * Math.cos((centerLat * Math.PI) / 180);
      const bboxHeightM = (ne.latitude - sw.latitude) * 111320;

      // Gap between panels
      const gapM = 0.3;
      const cellW = panelWidthMeters + gapM;
      const cellH = panelHeightMeters + gapM;

      const cols = Math.max(1, Math.floor(bboxWidthM / cellW));
      const rows = Math.max(1, Math.floor(bboxHeightM / cellH));

      // Place panels starting from center, filling outward
      let placed = 0;
      const startX = -(cols * cellW) / 2 + cellW / 2;
      const startY = -(rows * cellH) / 2 + cellH / 2;

      for (let r = 0; r < rows && placed < panelCount; r++) {
        for (let c = 0; c < cols && placed < panelCount; c++) {
          const cx = startX + c * cellW;
          const cy = startY + r * cellH;

          // Panel corner offsets from panel center (before rotation)
          const hw = panelWidthMeters / 2;
          const hh = panelHeightMeters / 2;
          const corners: [number, number][] = [
            [-hw, -hh],
            [hw, -hh],
            [hw, hh],
            [-hw, hh],
          ];

          // Rotate each corner by azimuth, then offset from panel center
          const path = corners.map(([px, py]) => {
            const [rx, ry] = rotatePoint(px, py, azimuth);
            const totalX = cx + rx;
            const totalY = cy + ry;
            const [dLat, dLng] = metersToLatLng(centerLat, totalX, totalY);
            return { lat: centerLat + dLat, lng: centerLng + dLng };
          });

          const panelPoly = new google.maps.Polygon({
            paths: path,
            strokeColor: '#2563eb',
            strokeOpacity: 0.8,
            strokeWeight: 0.5,
            fillColor: '#3b82f6',
            fillOpacity: 0.55,
            map,
          });
          overlaysRef.current.push(panelPoly);
          placed++;
        }
      }
    });

    return () => {
      overlaysRef.current.forEach((p) => p.setMap(null));
      overlaysRef.current = [];
    };
  }, [map, roofSegmentStats, panelDimensions, roofSegmentSummaries]);

  return null;
}
