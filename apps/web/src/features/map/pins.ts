import { STATUS_URGENCY, type AdmissionStatus } from '@flyms/shared';
import L from 'leaflet';
import { STATUS_LABEL } from '@/lib/format';

/** White glyphs inside pins — status is never shown by colour alone. */
const GLYPH: Record<AdmissionStatus, string> = {
  open: '<circle cx="8" cy="8" r="4" fill="currentColor"/>',
  closing_soon:
    '<path d="M4.5 2.5h7M4.5 13.5h7M5.5 2.5c0 3.5 5 3.5 5 5.5s-5 2-5 5.5M10.5 2.5c0 3.5-5 3.5-5 5.5s5 2 5 5.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  opening_soon:
    '<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 5v3l2 1.2" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  closed: '<circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  unknown:
    '<path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.6-.8 1.1v.6M8 12v.01" stroke="currentColor" stroke-width="1.6" fill="none"/>',
};

export interface PinOptions extends L.MarkerOptions {
  flyStatus: AdmissionStatus;
}

export function pinIcon(status: AdmissionStatus, openCount: number, selected: boolean): L.DivIcon {
  const badge =
    openCount > 0 ? `<span class="fly-pin__badge" aria-hidden="true">${openCount}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<div class="fly-pin fly-pin--${status}${selected ? ' fly-pin--selected' : ''}">
      <svg viewBox="0 0 16 16" class="fly-pin__glyph" aria-hidden="true">${GLYPH[status]}</svg>${badge}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const markers = cluster.getAllChildMarkers();
  let status: AdmissionStatus = 'unknown';
  for (const m of markers) {
    const s = (m.options as PinOptions).flyStatus;
    if (STATUS_URGENCY[s] > STATUS_URGENCY[status]) status = s;
  }
  const count = markers.length;
  const size = count < 5 ? 38 : count < 15 ? 44 : 52;
  return L.divIcon({
    className: '',
    html: `<div class="fly-cluster fly-cluster--${status}" style="width:${size}px;height:${size}px" title="${count} universities · most urgent: ${STATUS_LABEL[status]}">${count}</div>`,
    iconSize: [size, size],
  });
}
