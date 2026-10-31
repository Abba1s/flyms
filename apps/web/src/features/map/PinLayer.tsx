import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { STATUS_LABEL } from '@/lib/format';
import type { UniversityPin } from './aggregate';
import { clusterIcon, pinIcon, type PinOptions } from './pins';

interface PinLayerProps {
  pins: UniversityPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Clustered university pins. Rebuilt when pins or selection change (hundreds of markers at most). */
export function PinLayer({ pins, selectedId, onSelect }: PinLayerProps) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedRef = useRef(false);

  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 44,
    });
    for (const pin of pins) {
      const options: PinOptions = {
        icon: pinIcon(pin.status, pin.openCount, pin.id === selectedId),
        title: `${pin.name}: ${STATUS_LABEL[pin.status]}, ${pin.openCount} open now`,
        alt: pin.name,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: pin.id === selectedId ? 1000 : 0,
        flyStatus: pin.status,
      };
      const marker = L.marker([pin.lat, pin.lng], options);
      marker.on('click', () => onSelectRef.current(pin.id));
      marker.on('keypress', (e) => {
        const key = (e.originalEvent as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') onSelectRef.current(pin.id);
      });
      group.addLayer(marker);
    }
    map.addLayer(group);

    // Fit to the pins once, on first data.
    if (!fittedRef.current && pins.length > 0) {
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), {
        padding: [40, 40],
        maxZoom: 9,
        // No fly-in animation: pins appear in place, and never overlap mid-animation.
        animate: false,
      });
      fittedRef.current = true;
    }
    return () => {
      map.removeLayer(group);
    };
  }, [map, pins, selectedId]);

  return null;
}
