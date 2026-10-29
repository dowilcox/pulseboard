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

1. It collects notifications that have not been emailed yet and were created between 2 and 60 minutes ago. The 2-minute settling window lets bursts of activity batch together.
2. For each person, it keeps only the types they want by email.
3. If 3 or more remain, it sends one **digest** email. Otherwise it sends one email per notification.
4. Everything in the batch is then marked as emailed, including notifications the person opted out of. If sending fails, the batch is retried on the next run.

Consequences worth knowing:

- **In-app and email are independent.** A notification is recorded when either switch is on for its type. With in-app off and email on, the record is kept out of the bell, the notification list, the unread count, live pop-ups and the API, but it is still emailed (and batched into digests) as above. With both off, nothing is recorded. Email-only records are deleted after 7 days.
- Notifications older than an hour are never emailed, so if the scheduler or mail server is down for more than an hour, those emails are skipped rather than sent late.
- Deactivated accounts receive no email.

Email requires a working mailer configuration (`MAIL_*` variables, see the README) and a running scheduler.

## Preferences

Each person sets preferences on their **Profile** page under **Notification Preferences**: an **In-App** and an **Email** switch for each of the eight configurable types above. Remember to choose **Save Preferences**.

Defaults: every type is on for both in-app and email until you change it. The form always shows what the server will actually do, so there is no need to save once just to make the form and delivery agree.

## Reminders

Two scheduled commands create due-date notifications for the assignees of open (not completed) tasks:

| Command                        | Schedule                                      | Selects                              | De-duplication                          |
| ------------------------------ | --------------------------------------------- | ------------------------------------ | --------------------------------------- |
| `tasks:send-due-reminders`     | Hourly                                        | Tasks due today or tomorrow          | One per task per person within 24 hours |
| `tasks:send-overdue-reminders` | Daily at 09:00 (app timezone, UTC by default) | Tasks whose due date is before today | One per task per person per day         |

Overdue reminders repeat every day until the task is completed. Watchers do not get due-soon or overdue reminders. Both commands create notifications that follow your preferences like any other type: in-app if you have in-app on, emailed through the email run above if you have email on.

See [Administration](administration.md#scheduler-and-queue) for running the scheduler.
