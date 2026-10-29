# Notifications

PulseBoard notifies people in the app (the bell in the header) and by email. Nobody is notified about their own actions.

## Notification types

| Type (preference key)                      | Who gets it                                                                     | Trigger                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Task Assigned (`task_assigned`)            | Each newly added assignee                                                       | Someone assigns you to a task (including an `assign_user` automation).                                                          |
| Comment on Task (`task_commented`)         | Assignees, then watchers                                                        | A new top-level comment on the task.                                                                                            |
| Reply to Comment (`task_comment_replied`)  | The author of the original comment and everyone else who replied in that thread | A reply in a thread you're part of.                                                                                             |
| Mentioned in Comment (`task_mentioned`)    | Mentioned team members                                                          | You are `@mentioned` in a new comment or reply, newly mentioned in an edited comment, or newly mentioned in a task description. |
| Task Completed (`task_completed`)          | Assignees, the task's creator, and watchers                                     | The task is completed.                                                                                                          |
| Attachment Added (`task_attachment_added`) | Assignees, then watchers                                                        | A file is attached to the task.                                                                                                 |
| Task Due Soon (`task_due_soon`)            | Assignees                                                                       | The task is due today or tomorrow. See [Reminders](#reminders).                                                                 |
| Task Overdue (`task_overdue`)              | Assignees                                                                       | The task's due date has passed. See [Reminders](#reminders).                                                                    |
| Automation                                 | Whoever the rule targets                                                        | A `send_notification` [automation](automation.md) action. Always in-app, never emailed, not configurable.                       |

Each person gets at most one notification per event: if you are both an assignee and a watcher, or both a watcher and mentioned, you are notified once, under the first matching type in the "Who gets it" order.

## In-app notifications

- The bell shows your unread count and a paged list (20 per page) with links to the task, board or team. Links are built from current records, so they keep working after renames and cross-board moves. If you are no longer on the team, the notification has no link.
- Mark one or all as read, or clear them all.
- New notifications arrive live over the WebSocket connection (see [Real-time collaboration](real-time.md)).

## Email

Email is not sent at the moment of the event. Instead, the scheduler runs `notifications:send-emails` **every 5 minutes**:

1. It collects in-app notifications that have not been emailed yet and were created between 2 and 60 minutes ago. The 2-minute settling window lets bursts of activity batch together.
2. For each person, it keeps only the types they want by email.
3. If 3 or more remain, it sends one **digest** email. Otherwise it sends one email per notification.
4. Everything in the batch is then marked as emailed, including notifications the person opted out of. If sending fails, the batch is retried on the next run.

Consequences worth knowing:

- **Email depends on the in-app notification.** If you turn off in-app for a type, no record is created, so you also get no email for that type even with email switched on.
- Notifications older than an hour are never emailed, so if the scheduler or mail server is down for more than an hour, those emails are skipped rather than sent late.
- Deactivated accounts receive no email.

Email requires a working mailer configuration (`MAIL_*` variables, see the README) and a running scheduler.

## Preferences

Each person sets preferences on their **Profile** page under **Notification Preferences**: an **In-App** and an **Email** switch for each of the eight configurable types above. Remember to choose **Save Preferences**.

How defaults work today: if you have never saved preferences, the server treats **every** type as on for both in-app and email. The preferences form, however, displays email as off for Comment on Task, Task Completed and Attachment Added until you save. Saving the form stores what you see. To be sure your email settings match the form, save your preferences once.

## Reminders

Two scheduled commands create due-date notifications for the assignees of open (not completed) tasks:

| Command                        | Schedule                                      | Selects                              | De-duplication                          |
| ------------------------------ | --------------------------------------------- | ------------------------------------ | --------------------------------------- |
| `tasks:send-due-reminders`     | Hourly                                        | Tasks due today or tomorrow          | One per task per person within 24 hours |
| `tasks:send-overdue-reminders` | Daily at 09:00 (app timezone, UTC by default) | Tasks whose due date is before today | One per task per person per day         |

Overdue reminders repeat every day until the task is completed. Watchers do not get due-soon or overdue reminders. Both commands create in-app notifications; emails follow through the email run above, subject to preferences.

See [Administration](administration.md#scheduler-and-queue) for running the scheduler.
