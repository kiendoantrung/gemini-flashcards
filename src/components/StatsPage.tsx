import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, Flame, Target } from 'lucide-react';
import type { Deck, ReviewStats } from '../types/flashcard';
import { LoadingSpinner } from './LoadingSpinner';
import { getReviewStats } from '../services/reviewStatsService';

export interface StatsPageProps {
  userId: string;
  decks: Deck[];
  onBack: () => void;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
});

/** Day keys are calendar dates, so they are read in UTC to avoid a shift. */
function weekdayLabel(dayKey: string): string {
  return WEEKDAY_FORMATTER.format(new Date(`${dayKey}T00:00:00Z`));
}

function shortDate(dayKey: string): string {
  return dayKey.slice(5).replace('-', '/');
}

/** Green above 80%, amber above 60%, red below. */
function retentionTone(percentage: number): string {
  if (percentage >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (percentage >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

/** Same thresholds as retentionTone, for the filled part of the bar. */
function retentionBar(percentage: number): string {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="p-4 bg-white border-2 border-duo-border rounded-2xl shadow-duo-card">
      <div className="flex items-center gap-2 text-duo-pencil mb-1">
        {icon}
        <span className="text-xs uppercase font-extrabold tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-heading font-black text-duo-charcoal">{value}</div>
      <div className="text-xs font-medium text-duo-pencil mt-0.5">{hint}</div>
    </div>
  );
}

export function StatsPage({ userId, decks, onBack }: StatsPageProps) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      setStats(await getReviewStats(userId, decks));
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
    // `decks` is only read for titles and card ids; refetching whenever the
    // array identity changes would re-run on unrelated dashboard updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const header = (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-extrabold text-duo-pencil hover:text-duo-charcoal hover:bg-white rounded-xl border-2 border-transparent hover:border-duo-border transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
      <h2 className="text-lg font-heading font-black text-duo-charcoal">Statistics</h2>
    </div>
  );

  if (isLoading) {
    return (
      <section className="max-w-4xl mx-auto">
        {header}
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner />
          <p className="mt-4 text-duo-pencil font-bold">Loading statistics...</p>
        </div>
      </section>
    );
  }

  if (loadError || !stats) {
    return (
      <section className="max-w-4xl mx-auto">
        {header}
        <div className="p-8 bg-white border-2 border-duo-red rounded-3xl shadow-duo-card text-center">
          <h3 className="text-xl font-heading font-black text-duo-charcoal mb-2">
            Unable to Load Statistics
          </h3>
          <p className="text-duo-pencil mb-6 font-medium">{loadError}</p>
          <button
            onClick={() => void fetchStats()}
            className="px-5 py-2.5 bg-duo-blue text-white font-extrabold rounded-2xl shadow-duo-button hover:bg-duo-blue-dark transition-all"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (stats.totalReviews === 0) {
    return (
      <section className="max-w-4xl mx-auto">
        {header}
        <div className="p-10 bg-white border-2 border-duo-border rounded-3xl shadow-duo-card text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-duo-blue-subtle text-duo-blue rounded-2xl border-2 border-duo-blue flex items-center justify-center">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-heading font-black text-duo-charcoal mb-2">No reviews yet</h3>
          <p className="text-duo-pencil font-medium max-w-md mx-auto">
            Finish a spaced review session and your retention, streak and forecast will show up here.
          </p>
        </div>
      </section>
    );
  }

  const maxDailyTotal = Math.max(1, ...stats.daily.map((day) => day.total));
  const maxForecast = Math.max(1, ...stats.forecast.map((day) => day.due));

  return (
    <section className="max-w-4xl mx-auto">
      {header}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryTile
          icon={<BarChart3 className="w-4 h-4" />}
          label="Reviews"
          value={String(stats.totalReviews)}
          hint="last 30 days"
        />
        <SummaryTile
          icon={<Target className="w-4 h-4" />}
          label="Retention"
          value={`${stats.retention}%`}
          hint={`${stats.passedReviews} of ${stats.totalReviews} recalled`}
        />
        <SummaryTile
          icon={<CalendarDays className="w-4 h-4" />}
          label="Active days"
          value={String(stats.activeDays)}
          hint="of the last 30"
        />
        <SummaryTile
          icon={<Flame className="w-4 h-4" />}
          label="Streak"
          value={`${stats.currentStreak}d`}
          hint={stats.currentStreak === 1 ? 'keep it going' : 'consecutive days'}
        />
      </div>

      <div className="p-5 bg-white border-2 border-duo-border rounded-2xl shadow-duo-card mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-heading font-black text-duo-charcoal">Reviews per day</h3>
          <div className="flex items-center gap-3 text-xs font-bold text-duo-pencil">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-duo-green" /> recalled
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-duo-red" /> again
            </span>
          </div>
        </div>

        <div className="flex items-end gap-[3px] h-40" role="img" aria-label="Reviews per day, last 30 days">
          {stats.daily.map((day) => (
            <div
              key={day.dayKey}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${shortDate(day.dayKey)}: ${day.total} review${day.total === 1 ? '' : 's'} (${day.again} again)`}
            >
              <div
                className="bg-duo-red rounded-t-sm"
                style={{ height: `${(day.again / maxDailyTotal) * 100}%` }}
                aria-hidden="true"
              />
              <div
                className="bg-duo-green rounded-t-sm"
                style={{ height: `${(day.passed / maxDailyTotal) * 100}%` }}
                aria-hidden="true"
              />
              {day.total === 0 && <div className="h-[2px] bg-duo-border rounded-sm" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[11px] font-bold text-duo-pencil">
          <span>{shortDate(stats.daily[0].dayKey)}</span>
          <span>{shortDate(stats.daily[stats.daily.length - 1].dayKey)}</span>
        </div>
      </div>

      <div className="p-5 bg-white border-2 border-duo-border rounded-2xl shadow-duo-card mb-6">
        <h3 className="font-heading font-black text-duo-charcoal mb-1">Next 7 days</h3>
        <p className="text-xs font-medium text-duo-pencil mb-4">
          Cards becoming due, with anything overdue counted on today.
        </p>
        <div className="flex items-end gap-2 h-28">
          {stats.forecast.map((day) => (
            <div key={day.dayKey} className="flex-1 h-full flex flex-col justify-end items-center">
              <span className="text-xs font-extrabold text-duo-charcoal mb-1">{day.due}</span>
              <div
                className="w-full bg-duo-blue rounded-t-sm"
                style={{ height: `${Math.max(2, (day.due / maxForecast) * 100)}%` }}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold text-duo-pencil mt-1">
                {weekdayLabel(day.dayKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 bg-white border-2 border-duo-border rounded-2xl shadow-duo-card">
        <h3 className="font-heading font-black text-duo-charcoal mb-4">Retention by deck</h3>
        {stats.byDeck.length === 0 ? (
          <p className="text-sm font-medium text-duo-pencil">
            Reviews exist, but their decks have since been deleted.
          </p>
        ) : (
          <ul className="space-y-3">
            {stats.byDeck.map((deck) => (
              <li key={deck.deckId} className="flex items-center gap-3">
                <span className="w-32 sm:w-44 shrink-0 text-sm font-bold text-duo-charcoal truncate">
                  {deck.title}
                </span>
                <div className="flex-1 h-3 bg-duo-border/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${retentionBar(deck.retention)}`}
                    style={{ width: `${deck.retention}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 text-xs font-extrabold rounded-full border ${retentionTone(deck.retention)}`}
                >
                  {deck.retention}%
                </span>
                <span className="shrink-0 w-16 text-right text-xs font-bold text-duo-pencil">
                  {deck.total} rev
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
