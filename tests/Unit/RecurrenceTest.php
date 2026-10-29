<?php

namespace Tests\Unit;

use App\Support\Recurrence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RecurrenceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function next(array $config, string $anchor, string $after): ?string
    {
        return Recurrence::nextOccurrence($config, Recurrence::day($anchor), Recurrence::day($after))
            ?->toDateString();
    }

    /**
     * Walk the schedule from the anchor and return the first $count dates.
     *
     * @return list<string>
     */
    private function sequence(array $config, string $anchor, int $count): array
    {
        $dates = [];
        $after = $anchor;

        while (count($dates) < $count && ($next = $this->next($config, $anchor, $after))) {
            $dates[] = $after = $next;
        }

        return $dates;
    }

    public static function dailyCases(): array
    {
        return [
            'daily' => ['daily', 1, ['2026-10-29', '2026-10-30', '2026-10-31']],
            'every 3 days' => ['daily', 3, ['2026-10-31', '2026-11-03', '2026-11-06']],
            'custom is every N days' => ['custom', 2, ['2026-10-30', '2026-11-01', '2026-11-03']],
        ];
    }

    #[DataProvider('dailyCases')]
    public function test_daily_and_custom_step_by_interval_days(string $frequency, int $interval, array $expected): void
    {
        $this->assertSame(
            $expected,
            $this->sequence(['frequency' => $frequency, 'interval' => $interval], '2026-10-28', 3),
        );
    }

    public function test_daily_stays_in_phase_when_starting_mid_interval(): void
    {
        $config = ['frequency' => 'daily', 'interval' => 3];

        // 2026-10-28 + 3k: …, 11-03, 11-06
        $this->assertSame('2026-11-06', $this->next($config, '2026-10-28', '2026-11-04'));
        $this->assertSame('2026-11-06', $this->next($config, '2026-10-28', '2026-11-03'));
    }

    public function test_next_before_the_anchor_is_the_anchor(): void
    {
        $this->assertSame('2026-11-10', $this->next(['frequency' => 'daily', 'interval' => 1], '2026-11-10', '2026-10-28'));
    }

    public function test_weekly_without_days_repeats_on_the_anchor_weekday(): void
    {
        // 2026-10-28 is a Wednesday.
        $this->assertSame(
            ['2026-11-04', '2026-11-11', '2026-11-18'],
            $this->sequence(['frequency' => 'weekly', 'interval' => 1], '2026-10-28', 3),
        );
    }

    public function test_weekly_on_selected_weekdays(): void
    {
        // Mon, Wed, Fri from Wednesday 2026-10-28.
        $this->assertSame(
            ['2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06'],
            $this->sequence(['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => [5, 1, 3]], '2026-10-28', 4),
        );
    }

    public function test_every_other_week_on_selected_weekdays_skips_off_weeks(): void
    {
        // Anchor week is Sun 10-25 … Sat 10-31; Monday 10-26 precedes the anchor.
        $this->assertSame(
            ['2026-11-09', '2026-11-11', '2026-11-23', '2026-11-25'],
            $this->sequence(['frequency' => 'weekly', 'interval' => 2, 'days_of_week' => [1, 3]], '2026-10-28', 4),
        );
    }

    public function test_weeks_start_on_sunday(): void
    {
        // Sunday 11-01 is in the week after the anchor's, so with a two-week
        // interval the first Sunday is 11-08.
        $this->assertSame(
            '2026-11-08',
            $this->next(['frequency' => 'weekly', 'interval' => 2, 'days_of_week' => [0]], '2026-10-28', '2026-10-28'),
        );
    }

    public function test_monthly_on_the_anchor_day(): void
    {
        $this->assertSame(
            ['2026-11-15', '2026-12-15', '2027-01-15'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1], '2026-10-15', 3),
        );
    }

    public function test_monthly_on_a_chosen_day_never_precedes_the_anchor(): void
    {
        // Day 10 of the anchor's own month is before the anchor (10-20).
        $this->assertSame(
            ['2026-11-10', '2026-12-10'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 10], '2026-10-20', 2),
        );

        // Day 25 of the anchor's own month is still ahead.
        $this->assertSame(
            ['2026-10-25', '2026-11-25'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 25], '2026-10-20', 2),
        );
    }

    public function test_monthly_clamps_short_months_without_drifting(): void
    {
        $this->assertSame(
            ['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1], '2027-01-31', 4),
        );

        // Leap year.
        $this->assertSame(
            ['2028-02-29', '2028-03-30'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 30], '2028-01-30', 2),
        );

        $this->assertSame(
            ['2027-02-28', '2027-03-29'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 29], '2027-01-29', 2),
        );
    }

    public function test_monthly_with_interval(): void
    {
        $this->assertSame(
            ['2027-01-31', '2027-04-30', '2027-07-31'],
            $this->sequence(['frequency' => 'monthly', 'interval' => 3, 'day_of_month' => 31], '2026-10-31', 3),
        );

        // Far from the anchor, still in phase.
        $this->assertSame(
            '2029-01-31',
            $this->next(['frequency' => 'monthly', 'interval' => 3, 'day_of_month' => 31], '2026-10-31', '2028-11-15'),
        );
    }

    public function test_end_date_is_inclusive_and_then_stops(): void
    {
        $config = ['frequency' => 'daily', 'interval' => 1, 'end_date' => '2026-10-30'];

        $this->assertSame(['2026-10-29', '2026-10-30'], $this->sequence($config, '2026-10-28', 5));
        $this->assertNull($this->next($config, '2026-10-28', '2026-10-30'));
    }

    public function test_unknown_frequency_has_no_occurrences(): void
    {
        $this->assertNull($this->next(['frequency' => 'yearly', 'interval' => 1], '2026-10-28', '2026-10-28'));
    }

    public function test_days_are_taken_in_the_app_timezone(): void
    {
        config()->set('app.timezone', 'America/New_York');

        // 03:00 UTC on 11-02 is still 11-01 in New York.
        $instant = CarbonImmutable::parse('2026-11-02 03:00:00', 'UTC');
        $this->assertSame('2026-11-01', Recurrence::day($instant)->toDateString());

        // Daily across the end of DST (2026-11-01) keeps whole days.
        $this->assertSame(
            ['2026-11-01', '2026-11-02', '2026-11-03'],
            $this->sequence(['frequency' => 'daily', 'interval' => 1], '2026-10-31', 3),
        );
        $this->assertSame(
            '2026-11-07',
            $this->next(['frequency' => 'weekly', 'interval' => 1], '2026-10-31', '2026-11-01'),
        );
    }

    public function test_normalize_keeps_only_keys_for_the_frequency(): void
    {
        $this->assertSame(
            ['frequency' => 'weekly', 'interval' => 2, 'days_of_week' => [1, 3]],
            Recurrence::normalize([
                'frequency' => 'weekly',
                'interval' => '2',
                'days_of_week' => [3, 1, 3],
                'day_of_month' => 12,
                'junk' => true,
            ]),
        );

        $this->assertSame(
            ['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 31, 'end_date' => '2027-01-01', 'anchor_date' => '2026-10-28'],
            Recurrence::normalize(
                ['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 31, 'days_of_week' => [1], 'end_date' => '2027-01-01'],
                Recurrence::day('2026-10-28'),
            ),
        );

        $this->assertNull(Recurrence::normalize(null));
        $this->assertNull(Recurrence::normalize(['frequency' => 'hourly', 'interval' => 1]));
    }

    public function test_schedule_anchors_on_a_future_due_date(): void
    {
        Carbon::setTestNow('2026-10-28 15:00:00');

        [$config, $next] = Recurrence::schedule(['frequency' => 'weekly', 'interval' => 1], '2026-11-06');

        $this->assertArrayNotHasKey('anchor_date', $config);
        $this->assertSame('2026-11-13 00:00:00', $next->toDateTimeString());
    }

    public function test_schedule_with_a_past_due_date_starts_after_today_in_phase(): void
    {
        Carbon::setTestNow('2026-10-28 15:00:00');

        // Fridays from 2026-10-02: the next one after today is 10-30.
        [, $next] = Recurrence::schedule(['frequency' => 'weekly', 'interval' => 1], '2026-10-02');

        $this->assertSame('2026-10-30', $next->toDateString());
    }

    public function test_schedule_without_a_due_date_anchors_on_today(): void
    {
        Carbon::setTestNow('2026-10-28 15:00:00');

        [$config, $next] = Recurrence::schedule(['frequency' => 'daily', 'interval' => 2], null);

        $this->assertSame('2026-10-28', $config['anchor_date']);
        $this->assertSame('2026-10-30 00:00:00', $next->toDateTimeString());
    }

    public function test_schedule_past_the_end_date_schedules_nothing(): void
    {
        Carbon::setTestNow('2026-10-28 15:00:00');

        [$config, $next] = Recurrence::schedule(
            ['frequency' => 'daily', 'interval' => 1, 'end_date' => '2026-10-28'],
            null,
        );

        $this->assertNotNull($config);
        $this->assertNull($next);
    }

    public function test_schedule_off(): void
    {
        $this->assertSame([null, null], Recurrence::schedule(null, '2026-11-06'));
    }
}
