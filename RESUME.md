# Bug batch: resume notes

Branch `worktree-agent-a2aa9de53722c42af`, based on `feat/custom-fields-mcp-keyboard-oidc`. All work is committed. The full PHPUnit suite passed at commit 00c9d17: 888 passed, 2 skipped. I did not look at which tests were skipped. `npx tsc --noEmit` was clean after the last frontend change. I ran Vitest only per file (dashboardUtils and taskCardLabel both passed), never the whole suite.

| #   | Status       | Fix                                                                                                                                                                                                                                                                                                  | Tests                                              |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | done, tested | `app/Services/TeamStatsService.php`, shared by the web and API stats. Velocity and cycle time now come from `completed_at`.                                                                                                                                                                          | TeamStatsTest, DashboardApiTest, DashboardTest     |
| 8   | done, tested | Same service. Archived boards are excluded everywhere. Workload counts open tasks only, and the CSV Status column follows `completed_at`.                                                                                                                                                            | TeamStatsTest                                      |
| 2   | done, tested | A notification is stored when either channel is on. A new `notifications.in_app` column (migration 2026_10_28_100001) marks email-only rows. `User::notifications()` hides those rows. A custom `database` channel sets the flag. Email-only rows get no live broadcast and are pruned after 7 days. | NotificationChannelPreferencesTest                 |
| 3   | done, tested | `User::defaultNotificationPreferences()` (all on, which is what the server already did) and `notificationPreferences()`. The profile page passes the resolved prefs to the form.                                                                                                                     | ProfilePreferencesTest                             |
| 4   | done, tested | `app/Support/Recurrence.php` is a pure calculator for the schedule. It is anchored on the due date, or on `anchor_date` when there is none. Copies are due on their occurrence. The end date stops recurrence. The request now validates the config.                                                 | tests/Unit/RecurrenceTest, RecurringTaskTest       |
| 5   | done, tested | Label actions now go through SyncTaskLabels. Unassign and watcher actions are logged through ActivityLogger, with new `watcher_added`/`watcher_removed` entries rendered in the feed and on the dashboard.                                                                                           | AutomationActivityLoggingTest, dashboardUtils.test |
| 6   | done, tested | MoveTask refreshes the task's board and column relations after a move. For a cross-board move, only the destination board's rules run, and they see `from_column_id = null`.                                                                                                                         | CrossBoardMoveAutomationTest                       |
| 7   | done, tested | `Task::withBlockedState()` adds `is_blocked`. The frontend uses `isTaskBlocked()`. Finished dependencies are struck through on the task page.                                                                                                                                                        | TaskBlockedStateTest, taskCardLabel.test           |
| 9   | done, tested | `CommentPolicy::deleteAny` is passed to the page as `can.deleteAnyComment`. Admins see Delete, but not Edit, on other people's comments.                                                                                                                                                             | TaskShowPageTest                                   |

Docs were updated for each bug in `docs/`.

## Next steps

- Run `npm run test:run` (full) and `npx vite build`. Neither was run at the end.
- Worktree quirk: the `vendor` symlink breaks the test container. Remove it before `docker compose ... run test`, then recreate it so the pre-commit Pint hook works.

## New bugs noticed (not fixed)

- Live in-app notification broadcasts (`NotificationCreated`) never fire. Laravel clones the notification before giving it an id, so `$notification->id` is null in the caller. See `app/Services/TaskActivityNotifier.php` (`broadcastDatabaseNotification`) and `app/Actions/Automation/ExecuteAutomationRules.php` (`actionSendNotification`).
- A recurring task's own copy keeps its past due date, so the task gets daily overdue reminders.
- The personal dashboard counts "done" as completed OR in a done column (`DashboardController::boardSummaries`). The team stats use `completed_at` only.
