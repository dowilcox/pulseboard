<?php

namespace App\Support;

use App\Models\Task;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Recurring task schedule maths. Pure date arithmetic, no persistence.
 *
 * A schedule is a sequence of occurrence dates (whole days in the app
 * timezone) generated from a recurrence_config and an anchor date:
 *
 * - daily / custom: every `interval` days from the anchor.
 * - weekly: on `days_of_week` (0 = Sunday … 6 = Saturday; the anchor's
 *   weekday when empty), in every `interval`-th week counted from the week
 *   (Sunday to Saturday) that contains the anchor.
 * - monthly: on `day_of_month` (the anchor's day when empty) of every
 *   `interval`-th month from the anchor's month. Days past the end of a
 *   short month fall on its last day (31 → 30 April, 28/29 February),
 *   without drifting later months.
 *
 * Occurrences never precede the anchor and never follow `end_date`.
 *
 * The anchor is the recurring task's due date when it has one. Without a
 * due date it is the day recurrence was set up, stored as `anchor_date` in
 * the config so later runs stay in phase.
 */
class Recurrence
{
    public const FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'];

    /**
     * Reduce a submitted config to the keys that apply to its frequency,
     * stamping $anchorDate when given. Returns null when recurrence is off.
     */
    public static function normalize(?array $config, ?CarbonInterface $anchorDate = null): ?array
    {
        if (! $config || ! in_array($config['frequency'] ?? null, self::FREQUENCIES, true)) {
            return null;
        }

        $normalized = [
            'frequency' => $config['frequency'],
            'interval' => max(1, (int) ($config['interval'] ?? 1)),
        ];

        if ($config['frequency'] === 'weekly' && ! empty($config['days_of_week'])) {
            $days = array_values(array_unique(array_map('intval', $config['days_of_week'])));
            sort($days);
            $normalized['days_of_week'] = $days;
        }

        if ($config['frequency'] === 'monthly' && ! empty($config['day_of_month'])) {
            $normalized['day_of_month'] = (int) $config['day_of_month'];
        }

        if (! empty($config['end_date'])) {
            $normalized['end_date'] = self::day($config['end_date'])->toDateString();
        }

        if ($anchorDate) {
            $normalized['anchor_date'] = self::day($anchorDate)->toDateString();
        }

        return $normalized;
    }

    /**
     * The config to store and the first occurrence to schedule when
     * recurrence is set up or changed, or the task's due date changes.
     * The first copy is the first occurrence after both the anchor (the
     * task itself stands for the anchor occurrence) and today.
     *
     * @return array{0: ?array, 1: ?CarbonImmutable}
     */
    public static function schedule(?array $config, CarbonInterface|string|null $dueDate): array
    {
        $today = self::day(now());
        $anchor = $dueDate ? self::day($dueDate) : $today;
        $normalized = self::normalize($config, $dueDate ? null : $anchor);

        if (! $normalized) {
            return [null, null];
        }

        return [$normalized, self::nextOccurrence($normalized, $anchor, $anchor->max($today))];
    }

    /**
     * The first occurrence strictly after $after, or null when the schedule
     * has ended (or the config is invalid).
     */
    public static function nextOccurrence(array $config, CarbonInterface $anchor, CarbonInterface $after): ?CarbonImmutable
    {
        $anchor = self::day($anchor);
        $after = self::day($after);
        $interval = max(1, (int) ($config['interval'] ?? 1));

        $next = match ($config['frequency'] ?? null) {
            'daily', 'custom' => self::nextDaily($anchor, $after, $interval),
            'weekly' => self::nextWeekly($anchor, $after, $interval, $config['days_of_week'] ?? []),
            'monthly' => self::nextMonthly($anchor, $after, $interval, (int) ($config['day_of_month'] ?? 0)),
            default => null,
        };

        if ($next && ! empty($config['end_date']) && $next->gt(self::day($config['end_date']))) {
            return null;
        }

        return $next;
    }

    /**
     * The anchor for a task's stored schedule. Configs saved before anchors
     * were recorded fall back to the due date, then the scheduled occurrence.
     */
    public static function anchorFor(Task $task): CarbonImmutable
    {
        $config = $task->recurrence_config ?? [];

        return self::day(
            $config['anchor_date']
                ?? $task->due_date
                ?? $task->recurrence_next_at
                ?? now(),
        );
    }

    /**
     * A date as the start of its day in the app timezone. Date-only strings
     * are read as calendar days in that timezone.
     */
    public static function day(CarbonInterface|string $date): CarbonImmutable
    {
        $timezone = config('app.timezone');

        if (is_string($date)) {
            return CarbonImmutable::parse($date, $timezone)->startOfDay();
        }

        return CarbonImmutable::instance($date)->setTimezone($timezone)->startOfDay();
    }

    /**
     * Whole calendar days from $from to $to, safe across DST changes (a day
     * can be 23 or 25 hours long).
     */
    private static function daysBetween(CarbonImmutable $from, CarbonImmutable $to): int
    {
        return (int) round($from->diffInDays($to));
    }

    private static function nextDaily(CarbonImmutable $anchor, CarbonImmutable $after, int $interval): CarbonImmutable
    {
        if ($after->lt($anchor)) {
            return $anchor;
        }

        $steps = intdiv(self::daysBetween($anchor, $after), $interval) + 1;

        return $anchor->addDays($steps * $interval);
    }

    /**
     * @param  array<int, int|string>  $daysOfWeek
     */
    private static function nextWeekly(CarbonImmutable $anchor, CarbonImmutable $after, int $interval, array $daysOfWeek): CarbonImmutable
    {
        $days = $daysOfWeek
            ? array_map('intval', $daysOfWeek)
            : [$anchor->dayOfWeek];
        $anchorWeek = $anchor->startOfWeek(CarbonInterface::SUNDAY);

        $candidate = $after->lt($anchor) ? $anchor : $after->addDay();

        // Within (interval + 1) weeks there is always an "on" week with
        // every selected weekday in it.
        for ($i = 0; $i < 7 * ($interval + 1); $i++, $candidate = $candidate->addDay()) {
            $week = intdiv(self::daysBetween($anchorWeek, $candidate->startOfWeek(CarbonInterface::SUNDAY)), 7);

            if ($week % $interval === 0 && in_array($candidate->dayOfWeek, $days, true)) {
                return $candidate;
            }
        }

        // Unreachable with valid weekdays; fall back to a plain interval.
        return $after->addWeeks($interval);
    }

    private static function nextMonthly(CarbonImmutable $anchor, CarbonImmutable $after, int $interval, int $dayOfMonth): CarbonImmutable
    {
        $day = $dayOfMonth >= 1 && $dayOfMonth <= 31 ? $dayOfMonth : $anchor->day;
        $anchorMonth = $anchor->startOfMonth();

        $monthsBetween = ($after->year - $anchor->year) * 12 + ($after->month - $anchor->month);
        $step = max(0, intdiv(max(0, $monthsBetween), $interval) - 1);

        while (true) {
            $month = $anchorMonth->addMonthsNoOverflow($step * $interval);
            $candidate = $month->setDay(min($day, $month->daysInMonth));

            if ($candidate->gt($after) && $candidate->gte($anchor)) {
                return $candidate;
            }

            $step++;
        }
    }
}
