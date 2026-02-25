import type { EventType } from '@/src/types/bookingForm';
import { EVENT_TYPE_DURATION_SORT_ORDER } from '@/src/constants/booking';

export function sortEventTypesByDuration(eventTypes: EventType[]): EventType[] {
  return [...eventTypes].sort((a, b) => {
    const dA = a.duration_minutes || 0;
    const dB = b.duration_minutes || 0;
    const iA = EVENT_TYPE_DURATION_SORT_ORDER.indexOf(dA as 15 | 30 | 45 | 60);
    const iB = EVENT_TYPE_DURATION_SORT_ORDER.indexOf(dB as 15 | 30 | 45 | 60);
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;
    if (dA >= 60 && dB >= 60) return dA - dB;
    if (dA >= 60) return 1;
    if (dB >= 60) return -1;
    return dA - dB;
  });
}

export function filterEventTypesBySlug(eventTypes: EventType[], slug: string): EventType[] {
  if (!slug) return eventTypes;
  return eventTypes.filter((t) => t.slug === slug);
}

export function filterEventTypesByDuration(eventTypes: EventType[], duration: number): EventType[] {
  return eventTypes.filter((t) => t.duration_minutes === duration);
}

/**
 * Parse event type duration from URL param (e.g. "15mins" -> 15, "30min" -> 30).
 * Returns null if not a valid duration string.
 */
export function parseEventTypeDurationParam(eventType: string | undefined): number | null {
  if (!eventType) return null;
  const match = eventType.match(/^(\d+)(?:min|mins|minute|minutes)?$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Filter by slug or duration, then sort. For embed eventType/eventTypeSlug URL params.
 */
export function getSortedFilteredEventTypes(
  eventTypes: EventType[],
  opts: { slug?: string; duration?: number | null }
): EventType[] {
  let filtered = eventTypes;
  if (opts.slug) filtered = filterEventTypesBySlug(filtered, opts.slug);
  else if (opts.duration != null) filtered = filterEventTypesByDuration(filtered, opts.duration);
  return sortEventTypesByDuration(filtered);
}
