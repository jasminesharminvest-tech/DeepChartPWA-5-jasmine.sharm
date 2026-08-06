import { serverClock } from '@/data/server-clock';

export type SessionName = 'sydney' | 'tokyo' | 'london' | 'newyork';
export type SessionRegime = SessionName | 'overlap' | 'closed';

interface SessionWindow {
  name: SessionName;
  openUtcHour: number;
  closeUtcHour: number;
}

const SESSIONS: SessionWindow[] = [
  { name: 'sydney', openUtcHour: 22, closeUtcHour: 7 },
  { name: 'tokyo', openUtcHour: 0, closeUtcHour: 9 },
  { name: 'london', openUtcHour: 8, closeUtcHour: 17 },
  { name: 'newyork', openUtcHour: 13, closeUtcHour: 22 },
];

export function getSessionRegime(now: number = serverClock.now()): SessionRegime {
  const hourUtc = new Date(now).getUTCHours();
  const dayUtc = new Date(now).getUTCDay();
  if (dayUtc === 0 || dayUtc === 6) return 'closed';

  const active = SESSIONS.filter((s) => {
    if (s.openUtcHour < s.closeUtcHour) {
      return hourUtc >= s.openUtcHour && hourUtc < s.closeUtcHour;
    }
    return hourUtc >= s.openUtcHour || hourUtc < s.closeUtcHour;
  });

  if (active.length >= 2) return 'overlap';
  if (active.length === 1) return active[0].name;
  return 'closed';
}

export function isHighLiquiditySession(regime: SessionRegime): boolean {
  return regime === 'london' || regime === 'newyork' || regime === 'overlap';
}
