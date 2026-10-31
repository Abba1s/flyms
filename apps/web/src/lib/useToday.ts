import { berlinToday } from '@flyms/shared';
import { useEffect, useState } from 'react';

/** Today's Berlin date; re-renders when the date changes so statuses roll over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => berlinToday());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(berlinToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}
