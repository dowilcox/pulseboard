# PulseBoard - Project Management Application
## Comprehensive Implementation Plan

---

## 1. Project Overview

**Application Name:** PulseBoard

**Description:** A self-hosted, multi-team Kanban-based project management application with deep GitLab integration. Built for teams that need flexible task management, real-time collaboration, and tight coupling with their GitLab development workflow.

**Problem Statement:** Existing tools either lack critical features (GitLab's native issue boards lack multi-assignee support and rich project management features) or are bloated SaaS products that don't integrate deeply enough with self-hosted GitLab instances. PulseBoard fills the gap: a self-hosted, purpose-built PM tool designed around GitLab workflows.

**Target Users:**
- Small to mid-size development and design teams (2-20 people per team)
- Teams already using self-hosted GitLab for version control and CI/CD
- Organizations where multiple teams share a single instance with overlapping members
- Primary user persona: a technical team lead managing developers and designers, coordinating work across GitLab repositories

**Success Criteria:**
- Multiple assignees per task
- Teams operate independently with their own boards while sharing a user base
- Real-time board updates across all connected clients
- GitLab integration that surfaces MR status, pipeline results, and allows MR creation from the app
- SSO via SAML2/Okta alongside local authentication
- Replaces GitLab issue boards as the primary project management interface

---

## 2. Technology Stack

### Frontend
| Technology | Justification |
|---|---|
| **React 18+** | Component-based architecture, massive ecosystem, strong TypeScript support |
| **TypeScript** | Type safety across the frontend, better IDE support, catches bugs at compile time |
| **Inertia.js** | Bridges Laravel and React without building a separate API layer. Server-side routing with client-side rendering. Eliminates the need for a REST/GraphQL API for the frontend |
| **MUI (Material UI) v6** | Comprehensive component library with built-in theming, accessibility, and dark mode support. Reduces custom CSS work significantly |
| **@dnd-kit** | Modern drag-and-drop library for React. Tree-shakeable, accessible, performant. Used for board card/column dragging |
| **Laravel Echo + Pusher/Reverb** | Real-time event broadcasting on the frontend. Echo is Laravel's official WebSocket client |

### Backend
| Technology | Justification |
|---|---|
| **Laravel 11+** | Mature PHP framework with excellent ORM, migration system, queue workers, broadcasting, and middleware. Strong ecosystem for auth (Breeze/Fortify) |
| **Laravel Actions** | Single-responsibility classes that can serve as controllers, jobs, listeners, and commands. Keeps business logic organized and testable outside of controllers |
| **Laravel Reverb** | First-party WebSocket server for Laravel. No external service dependency (unlike Pusher). Self-hosted, fits the deployment model |
| **Laravel Sanctum** | API token authentication for any future API needs, plus SPA cookie-based auth for Inertia |
| **Socialite / SAML2 Provider** | `socialiteproviders/saml2` package integrates SAML2 SSO through Laravel's Socialite interface. Clean, well-maintained, supports multiple IdPs |

### Database and Caching
| Technology | Justification |
|---|---|
| **MySQL 8.0+** | Widely supported, well-understood, strong Laravel integration. JSON column support covers custom fields. Familiar and reliable for self-hosted deployments |
| **Redis** | Cache layer, queue backend, session store, and WebSocket pub/sub for Reverb. Single dependency that covers multiple infrastructure needs |

### Infrastructure
| Technology | Justification |
|---|---|
| **Docker / Docker Compose** | Primary deployment method for self-hosted instances. Packages app, database, Redis, and Reverb together |
| **Nginx** | Reverse proxy and static asset serving |
| **Local filesystem (default)** | File storage for attachments. Uses Laravel's filesystem abstraction, so switching to S3 or MinIO is a config change |
| **Laravel Horizon** | Dashboard and configuration for Redis queues. Manages job workers for background tasks (GitLab sync, notifications, etc.) |

---

## 3. Information Architecture

### 3.1 Data Model

#### Core Entities

**Organization**
The top-level container. A single PulseBoard instance hosts one organization. All teams, users, and data live under it.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | string | Organization name |
| slug | string | URL-friendly identifier |
| settings | json | Global settings (default theme, etc.) |
| created_at | timestamp | |
| updated_at | timestamp | |

**User**
A person who can belong to multiple teams.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | string | Display name |
| email | string | Unique, used for local auth and notifications |
| password | string (nullable) | Null for SSO-only users |
| avatar_url | string (nullable) | Profile image |
| auth_provider | enum | 'local', 'saml2', 'okta' |
| auth_provider_id | string (nullable) | External IdP user identifier |
| is_admin | boolean | Organization-level admin |
| email_notification_prefs | json | Per-event notification preferences |
| theme_preference | enum | 'light', 'dark', 'system' |
| created_at | timestamp | |
| updated_at | timestamp | |

**Team**
A group of users with their own boards and workflow.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | string | Team display name |
| slug | string | URL-friendly identifier |
| description | text (nullable) | |
| settings | json | Team-level defaults |
| created_at | timestamp | |
| updated_at | timestamp | |

**TeamMember** (pivot)

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| team_id | uuid | FK to teams |
| user_id | uuid | FK to users |
| role | enum | 'owner', 'admin', 'member' |
| created_at | timestamp | |

**Board**
A Kanban board belonging to a team.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| team_id | uuid | FK to teams |
| name | string | Board name |
| description | text (nullable) | |
| is_archived | boolean | Soft archive |
| default_task_template_id | uuid (nullable) | FK to task_templates |
| sort_order | integer | Ordering within team |
| created_at | timestamp | |
| updated_at | timestamp | |

**Column**
A status column on a board.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| board_id | uuid | FK to boards |
| name | string | Column name (e.g., "To Do", "In Review") |
| color | string | Hex color code |
| wip_limit | integer (nullable) | Work-in-progress limit, null means unlimited |
| sort_order | integer | Left-to-right ordering |
| is_done_column | boolean | Marks this as a "completed" state for metrics |
| created_at | timestamp | |
| updated_at | timestamp | |

**Task**
The core work item.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| board_id | uuid | FK to boards |
| column_id | uuid | FK to columns |
| parent_task_id | uuid (nullable) | FK to tasks (for subtasks) |
| title | string | Task title |
| description | text (nullable) | Rich text / Markdown |
| priority | enum | 'urgent', 'high', 'medium', 'low', 'none' |
| sort_order | integer | Ordering within column |
| due_date | date (nullable) | |
| effort_estimate | integer (nullable) | Story points or T-shirt size mapped to int |
| custom_fields | json | Flexible custom field storage |
| created_by | uuid | FK to users |
| created_at | timestamp | |
| updated_at | timestamp | |

**TaskAssignee** (pivot, enables multiple assignees)

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | FK to tasks |
| user_id | uuid | FK to users |
| assigned_at | timestamp | When the assignment was made |
| assigned_by | uuid | FK to users |

**Label**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| team_id | uuid | FK to teams |
| name | string | Label text |
| color | string | Hex color |
| created_at | timestamp | |

**TaskLabel** (pivot)

| Attribute | Type | Notes |
|---|---|---|
| task_id | uuid | FK to tasks |
| label_id | uuid | FK to labels |

**Comment**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | FK to tasks |
| user_id | uuid | FK to users |
| body | text | Markdown content, supports @mentions |
| created_at | timestamp | |
| updated_at | timestamp | |

**Attachment**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | FK to tasks |
| user_id | uuid | FK to users |
| filename | string | Original filename |
| file_path | string | Storage path |
| file_size | integer | Bytes |
| mime_type | string | |
| created_at | timestamp | |

**Activity**
Audit log for every change to a task.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | FK to tasks |
| user_id | uuid (nullable) | FK to users, null for system events |
| action | string | 'created', 'moved', 'assigned', 'commented', 'field_changed', etc. |
| changes | json | Before/after values, e.g., `{"column": {"from": "To Do", "to": "In Progress"}}` |
| created_at | timestamp | |

#### GitLab Integration Entities

**GitlabConnection**
A configured connection to a GitLab instance.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | string | Display name for this connection |
| base_url | string | GitLab instance URL (e.g., https://gitlab.umflint.edu) |
| api_token | string (encrypted) | Personal Access Token or OAuth token |
| webhook_secret | string (encrypted) | Secret for validating incoming webhooks |
| is_active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

**GitlabProject**
A GitLab project (repo) linked to a PulseBoard team.

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| gitlab_connection_id | uuid | FK to gitlab_connections |
| team_id | uuid | FK to teams |
| gitlab_project_id | integer | GitLab's internal project ID |
| name | string | Cached project name |
| path_with_namespace | string | e.g., "its-web/umflint-theme" |
| default_branch | string | e.g., "main" |
| web_url | string | Link back to GitLab |
| last_synced_at | timestamp (nullable) | |
| created_at | timestamp | |
| updated_at | timestamp | |

**TaskGitlabLink**
Links a PulseBoard task to GitLab artifacts (issues, MRs, branches).

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | FK to tasks |
| gitlab_project_id | uuid | FK to gitlab_projects |
| link_type | enum | 'issue', 'merge_request', 'branch' |
| gitlab_iid | integer (nullable) | GitLab internal ID (issue number, MR number) |
| gitlab_ref | string (nullable) | Branch name if link_type is 'branch' |
| title | string (nullable) | Cached title |
| state | string (nullable) | 'opened', 'closed', 'merged', etc. |
| url | string | Direct link to the GitLab resource |
| pipeline_status | string (nullable) | 'success', 'failed', 'running', 'pending' |
| author | string (nullable) | Cached author name |
| meta | json | Additional cached data (approvals count, reviewers, etc.) |
| last_synced_at | timestamp | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### Workflow Automation Entities

**AutomationRule**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| board_id | uuid | FK to boards |
| name | string | Human-readable rule name |
| trigger_type | enum | 'task_moved', 'task_created', 'task_assigned', 'label_added', 'due_date_reached', 'gitlab_mr_merged', 'gitlab_pipeline_status' |
| trigger_config | json | Trigger-specific config (e.g., which column triggers it) |
| action_type | enum | 'move_to_column', 'assign_user', 'add_label', 'send_notification', 'update_field' |
| action_config | json | Action-specific config |
| is_active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### Template and View Entities

**TaskTemplate**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| team_id | uuid | FK to teams |
| name | string | Template name |
| title_template | string (nullable) | Pre-filled title pattern |
| description_template | text (nullable) | Pre-filled description |
| default_labels | json | Array of label IDs |
| default_priority | enum (nullable) | |
| default_effort | integer (nullable) | |
| custom_fields_template | json | Default custom field values |
| created_at | timestamp | |
| updated_at | timestamp | |

**BoardTemplate**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| team_id | uuid (nullable) | Null means org-wide template |
| name | string | |
| description | text (nullable) | |
| column_config | json | Array of column definitions with names, colors, WIP limits |
| created_at | timestamp | |
| updated_at | timestamp | |

**SavedFilter**

| Attribute | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| board_id | uuid (nullable) | Null means cross-board filter |
| name | string | |
| filter_config | json | Serialized filter criteria (assignees, labels, priorities, date ranges, etc.) |
| is_default | boolean | Auto-apply when opening the board |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.2 Entity Relationship Summary

```
Organization (1)
  └── Users (many)
  └── Teams (many)
        ├── TeamMembers (many) ──> Users
        ├── Labels (many)
        ├── TaskTemplates (many)
        ├── BoardTemplates (many)
        ├── GitlabProjects (many) ──> GitlabConnection
        └── Boards (many)
              ├── Columns (many, ordered)
              ├── AutomationRules (many)
              └── Tasks (many)
                    ├── TaskAssignees (many) ──> Users
                    ├── TaskLabels (many) ──> Labels
                    ├── Subtasks (self-referential)
                    ├── Comments (many)
                    ├── Attachments (many)
                    ├── Activities (many)
                    └── TaskGitlabLinks (many) ──> GitlabProject
```

### 3.3 Key Database Indexes

- `tasks`: composite index on `(board_id, column_id, sort_order)` for board rendering
- `tasks`: index on `parent_task_id` for subtask queries
- `task_assignees`: composite unique on `(task_id, user_id)`
- `task_labels`: composite unique on `(task_id, label_id)`
- `activities`: index on `(task_id, created_at)` for activity feed
- `team_members`: composite unique on `(team_id, user_id)`
- `task_gitlab_links`: index on `(task_id)`; index on `(gitlab_project_id, gitlab_iid)` for webhook lookups
- `saved_filters`: index on `(user_id, board_id)`

---

## 4. Feature Specification

### 4.1 Authentication and Authorization

**User Story:** As a user, I want to log in with my university SSO or a local account so I can access my teams and boards.

**Acceptance Criteria:**
- Local registration and login with email/password (Laravel Fortify)
- SAML2 SSO login via configured IdP (university Shibboleth, Okta, Azure AD)
- Users can have either local auth, SSO auth, or both (linked accounts)
- SSO users are auto-provisioned on first login (JIT provisioning)
- Organization admins can configure SSO settings through an admin panel
- Session management with "remember me" support
- Password reset flow for local accounts

**Auth Provider Strategy:**
- Use `socialiteproviders/saml2` for SAML2 integration through Socialite's familiar interface
- Store `auth_provider` and `auth_provider_id` on user model
- Support multiple IdP configurations for organizations with multiple SSO providers
- Fallback to local auth is always available unless admin disables it

**Role-Based Access Control:**
- Organization Admin: manage teams, users, GitLab connections, SSO config, board templates
- Team Owner: full control over their team's boards, members, labels, templates
- Team Admin: manage boards, columns, labels, members within the team
- Team Member: create/edit/move tasks, comment, manage their own assignments

**Edge Cases:**
- SSO user whose account is deactivated in the IdP should be gracefully handled (session invalidation on next request)
- Email conflicts between SSO and local accounts need a merge/link flow
- Team owners cannot remove themselves (must transfer ownership first)

### 4.2 Team Management

**User Story:** As an organization admin or team owner, I want to create and manage teams so that different groups can work independently.

**Acceptance Criteria:**
- Create teams with name, description, and initial members
- Invite users to teams by email (existing users added directly, new users receive invite)
- Users can belong to multiple teams simultaneously
- Each team has its own labels, board templates, task templates, and GitLab project links
- Team settings page for owners/admins to manage members, roles, and defaults
- Team switching in the UI (sidebar or top nav dropdown)
- Team member list with role badges

**Data Requirements:** Teams, TeamMembers, Users

**UI Notes:**
- Team selector in the main sidebar
- Team settings accessible via gear icon
- Member management as a table with role dropdowns and remove buttons

### 4.3 Board Management

**User Story:** As a team member, I want to create and customize Kanban boards so I can organize work the way my team prefers.

**Acceptance Criteria:**
- Create boards from scratch or from a board template
- Customize columns: add, remove, reorder, rename, set color, set WIP limit
- Archive boards (soft delete, accessible but hidden from main nav)
- Board settings page for name, description, default task template, and linked GitLab projects
- Multiple boards per team
- Board list view in team sidebar with drag-to-reorder

**Edge Cases:**
- Deleting a column prompts to move its tasks to another column
- WIP limit exceeded shows a visual warning (column header turns red/amber) but does not hard-block adding tasks
- Archiving a board does not delete data; it can be restored

### 4.4 Task Management (Core)

**User Story:** As a team member, I want to create, organize, and track tasks with rich detail so nothing falls through the cracks.

**Acceptance Criteria:**
- Create tasks with title (required), description (markdown), priority, due date, effort estimate, labels, assignees
- Multiple assignees per task (the #1 feature request)
- Subtasks (one level deep) with their own assignees, priority, and status
- Drag-and-drop tasks between columns and within a column to reorder
- Task detail modal/panel that slides open from the board view
- Inline editing of task title directly on the card
- Bulk actions: select multiple tasks and move, assign, label, or delete them
- Task cards show: title, assignees (avatars), priority badge, label chips, due date, subtask count/progress, comment count, GitLab status indicators
- Filter tasks on board by assignee, label, priority, due date range
- Sort tasks within column by priority, due date, creation date, or custom order
- Search across all tasks in a board (or team-wide)
- Create tasks from templates

**Data Requirements:** Tasks, TaskAssignees, TaskLabels, Columns, Labels, TaskTemplates

**UI Notes:**
- Task cards should be compact but information-dense
- Use MUI's Chip component for labels, Avatar/AvatarGroup for assignees
- Priority indicated by colored left-border on the card (urgent = red, high = orange, medium = blue, low = gray)
- Subtask progress shown as a small progress bar on the parent card
- Filter bar at top of board with dropdowns for assignee, label, priority
- Task detail panel takes up roughly 40% of the screen width, overlaying the board

### 4.5 Comments and Activity

**User Story:** As a team member, I want to discuss tasks in context and see a full history of changes so I have complete visibility.

**Acceptance Criteria:**
- Add comments with markdown support and @mention teammates
- @mentions trigger email notifications to the mentioned user(s)
- Edit and delete own comments
- Activity feed on each task showing all changes (created, moved, assigned, field changed, commented)
- Activity entries are auto-generated by the system (not manually created)
- Clear visual distinction between user comments and system activity entries

**Data Requirements:** Comments, Activities

**UI Notes:**
- Combined timeline view in the task detail panel showing both comments and activity interleaved chronologically
- Activity entries styled as smaller, muted text
- Comments styled as full message bubbles with user avatar

### 4.6 Attachments

**User Story:** As a team member, I want to attach files to tasks so that relevant documents, designs, and screenshots are always accessible.

**Acceptance Criteria:**
- Upload files via drag-and-drop or file picker
- Support common file types (images, PDFs, documents, archives)
- Image attachments show inline preview
- File size limit configurable by admin (default 25MB per file)
- Download and delete attachments
- Attachment count shown on task card

**Data Requirements:** Attachments

### 4.7 Real-Time Updates

**User Story:** As a team member viewing a board, I want to see changes made by others in real time so we never work with stale data.

**Acceptance Criteria:**
- When any user moves a task, all other users viewing that board see the card animate to its new position
- New tasks appear on the board without refresh
- Task edits (title, assignees, labels, priority) update live on all clients
- Column changes (add, remove, reorder, rename) propagate in real time
- New comments appear instantly in open task detail panels
- Connection status indicator (connected / reconnecting / disconnected)
- Graceful reconnection with state catch-up after temporary disconnection

**Technical Approach:**
- Laravel Reverb as the WebSocket server (self-hosted, no external dependency)
- Laravel Echo on the frontend for channel subscriptions
- Presence channels per board (shows who is currently viewing the board)
- Private channels per team for team-wide notifications
- Events are dispatched from Laravel Actions after successful database operations
- Optimistic UI updates on the initiating client; broadcast confirmation to others

**Channel Structure:**
- `private-board.{boardId}` - board-level events (task moved, created, deleted, column changed)
- `private-task.{taskId}` - task-level events (comments, field changes, assignment changes)
- `presence-board.{boardId}` - who is currently viewing this board
- `private-team.{teamId}` - team-wide notifications

### 4.8 GitLab Integration

**User Story:** As a developer, I want to see GitLab merge requests, pipelines, and branches linked to my tasks without leaving PulseBoard so I have full context in one place.

**Acceptance Criteria:**

*Connection Setup:*
- Organization admin configures GitLab connection(s) with instance URL and API token
- Team admins link GitLab projects to their team
- Webhook auto-registration on linked GitLab projects (push, MR, pipeline events)

*Task-Level Integration:*
- Link a task to a GitLab project (select from team's linked projects)
- Create a new branch from a task (auto-names it based on task ID and title, e.g., `pb-123-add-login-page`)
- Create a new merge request from a task (pre-fills title and description with task info)
- View linked MRs on the task card and detail panel: title, status (open/merged/closed), approval count, pipeline status
- View linked branches with latest commit info
- Pipeline status badge on task card (green check, red X, yellow spinner, gray pending)

*Webhook-Driven Updates:*
- MR opened referencing a task ID in the description or branch name auto-links to the task
- MR status changes (approved, merged, closed) update the task's GitLab link in real time
- Pipeline status changes update the task's pipeline badge in real time
- Automation rules can trigger on GitLab events (e.g., "when MR is merged, move task to Done")

*GitLab API Usage:*
- `GET /api/v4/projects/{id}/merge_requests` - list MRs
- `POST /api/v4/projects/{id}/merge_requests` - create MR
- `POST /api/v4/projects/{id}/repository/branches` - create branch
- `GET /api/v4/projects/{id}/pipelines` - get pipeline status
- `GET /api/v4/projects/{id}/repository/commits` - recent commits on a branch

**Data Requirements:** GitlabConnection, GitlabProject, TaskGitlabLink

**Edge Cases:**
- GitLab instance is unreachable: queue retries with exponential backoff, show "sync pending" status
- API token expires or is revoked: surface error in admin panel, mark connection as inactive
- Webhook secret mismatch: reject payload, log warning
- Branch name sanitization (strip special characters, enforce max length)

### 4.9 Workflow Automation

**User Story:** As a team admin, I want to set up rules that automatically perform actions when certain events occur so we reduce manual busywork.

**Acceptance Criteria:**
- Create rules per board with a trigger and an action
- Supported triggers: task moved to column, task created, task assigned, label added, due date reached, GitLab MR merged, GitLab pipeline failed
- Supported actions: move to column, assign user, add label, send notification, update custom field
- Rules can be enabled/disabled without deleting them
- Rules execute in order and stop if a condition is not met
- Audit log shows when automation rules fire

**Data Requirements:** AutomationRules

**UI Notes:**
- Board settings tab for "Automations"
- Each rule shown as a card: "When [trigger] then [action]"
- Dropdown selectors for trigger type, trigger config, action type, action config
- Toggle switch for enable/disable

### 4.10 Views and Filtering

**User Story:** As a team member, I want multiple ways to view and filter my work so I can focus on what matters to me.

**Acceptance Criteria:**

*Board Views:*
- **Kanban Board** (default): columns with draggable task cards
- **List/Table View**: spreadsheet-like view with sortable columns (title, assignees, priority, due date, labels, status)
- **Calendar View**: tasks plotted on a calendar by due date
- **Timeline View**: Gantt-style horizontal bars showing task duration and dependencies
- **Workload View**: per-person task count/effort breakdown, color-coded capacity indicators

*Filtering:*
- Filter by: assignee(s), label(s), priority, due date range, has GitLab link, created by, keyword search
- Combine filters with AND logic
- Save filters as named "Saved Views" per user
- Set a saved view as the default for a board
- "My Tasks" global view showing all tasks assigned to the current user across all boards

*Dashboard:*
- Team-level dashboard with configurable widgets
- Available widgets: tasks by status (pie/bar chart), tasks by assignee, burndown chart, cycle time chart, overdue tasks list, recent activity feed
- Dashboard is read-only overview, not a task management surface

**Data Requirements:** SavedFilters

### 4.11 Reporting and Analytics

**User Story:** As a team lead, I want to see metrics about my team's throughput and bottlenecks so I can improve our process.

**Acceptance Criteria:**
- **Burndown Chart:** for a board or date range, shows tasks remaining over time
- **Cycle Time:** average time tasks spend in each column (uses Activity log timestamps)
- **Velocity:** tasks completed per week/sprint (configurable time window)
- **Workload Distribution:** tasks per person, effort per person
- **Overdue Tasks Report:** list of tasks past their due date
- Export reports as CSV
- Date range selector for all reports

**Technical Approach:**
- Reports generated from Activity table data (every status change is logged)
- Computed on-demand with caching (Redis) for expensive queries
- No separate analytics tables needed; Activity + Tasks provide all the raw data

### 4.12 Notifications

**User Story:** As a team member, I want to be notified about changes relevant to me so I stay informed without constantly checking the app.

**Acceptance Criteria:**
- In-app notification bell with unread count
- Email notifications for: assigned to task, @mentioned in comment, task due soon (24h), task overdue, automation rule triggered affecting your task
- Per-user notification preferences (toggle each event type on/off for email and in-app)
- Mark as read / mark all as read
- Notification links directly to the relevant task

**Technical Approach:**
- Laravel's built-in notification system with database and mail channels
- Queued notifications via Redis/Horizon for performance
- In-app notifications stored in `notifications` table (Laravel's default)
- Real-time in-app notifications via WebSocket broadcast

### 4.13 Admin Panel

**User Story:** As an organization admin, I want to manage users, teams, SSO, and GitLab connections from a central admin area.

**Acceptance Criteria:**
- User management: list, create, deactivate, reset password, assign org admin role
- Team oversight: view all teams, their members, and boards
- SSO configuration: add/edit SAML2 IdP settings (entity ID, login URL, certificates)
- GitLab connection management: add/edit/test connections
- Organization-wide board templates
- System health: queue status (Horizon dashboard link), WebSocket connection count
- Branding: upload logo, set organization name

### 4.14 Dark Mode

**User Story:** As a user, I want to switch between light and dark themes so I can work comfortably in any environment.

**Acceptance Criteria:**
- Light, dark, and system-preference modes
- Persisted per user in their profile
- MUI's built-in theming handles the heavy lifting
- All custom components respect the theme
- Task card colors, label chips, and priority badges remain readable in both modes

---

## 5. Application Architecture

### 5.1 High-Level System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React + Inertia)            │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │  Board    │  │  Task    │  │  Dashboard │  ...       │
│  │  View     │  │  Detail  │  │  View      │            │
│  └──────────┘  └──────────┘  └────────────┘            │
│         │              │              │                  │
│         └──────────────┼──────────────┘                  │
│                        │                                 │
│              Laravel Echo (WebSocket Client)              │
└────────────────────────┼─────────────────────────────────┘
                         │ HTTP (Inertia)    │ WSS
                         ▼                   ▼
┌────────────────────────────────┐  ┌──────────────────┐
│        Laravel Application     │  │  Laravel Reverb   │
│  ┌────────────────────┐       │  │  (WebSocket Srv)  │
│  │   Inertia Routes   │       │  └────────┬─────────┘
│  │   + Controllers     │       │           │
│  └────────┬───────────┘       │           │
│           ▼                    │     Redis Pub/Sub
│  ┌────────────────────┐       │           │
│  │  Laravel Actions    │◄─────┼───────────┘
│  │  (Business Logic)   │       │
│  └────────┬───────────┘       │
│           │                    │
│     ┌─────┼──────┐            │
│     ▼     ▼      ▼            │
│  ┌─────┐┌─────┐┌──────────┐  │
│  │ DB  ││Redis││  Queue    │  │
│  │(PG) ││     ││ (Horizon) │  │
│  └─────┘└─────┘└────┬─────┘  │
│                      │        │
│              ┌───────▼──────┐ │
│              │  GitLab API  │ │
│              │  HTTP Client │ │
│              └──────────────┘ │
└────────────────────────────────┘
         ▲
         │ Webhooks (POST)
         │
┌────────┴───────────┐
│   GitLab Instance   │
│  (self-hosted)      │
└─────────────────────┘
```

### 5.2 Frontend Architecture

**Routing:** Server-side via Laravel routes, rendered client-side via Inertia. No client-side router needed.

**State Management:**
- Inertia's page props are the primary state source (server-authoritative)
- Local React state (useState/useReducer) for UI state (modals open, drag state, filter selections)
- React Context for global concerns (auth user, theme, WebSocket connection status, notifications)
- No Redux or Zustand needed; Inertia's shared data and partial reloads cover most cases

**Component Tree:**

```
<App>
  <ThemeProvider> (MUI theme, dark/light mode)
    <AuthProvider> (current user context)
      <WebSocketProvider> (Echo connection, event subscriptions)
        <NotificationProvider> (in-app notifications)
          <Layout>
            <Sidebar>
              <TeamSelector />
              <BoardList />
              <Navigation />
            </Sidebar>
            <MainContent>
              {/* Inertia page components */}
              <BoardPage />
              <TaskDetailPanel />
              <DashboardPage />
              <SettingsPage />
              <AdminPage />
            </MainContent>
          </Layout>
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  </ThemeProvider>
</App>
```

**Key Page Components:**

| Route | Component | Description |
|---|---|---|
| `/login` | LoginPage | Local + SSO login |
| `/teams/{team}` | TeamDashboard | Team overview, recent activity |
| `/teams/{team}/boards/{board}` | BoardPage | Main Kanban board view |
| `/teams/{team}/boards/{board}/list` | BoardListView | Table/list view |
| `/teams/{team}/boards/{board}/calendar` | BoardCalendarView | Calendar view |
| `/teams/{team}/boards/{board}/timeline` | BoardTimelineView | Gantt/timeline view |
| `/teams/{team}/workload` | WorkloadPage | Team workload view |
| `/teams/{team}/dashboard` | DashboardPage | Reporting dashboard |
| `/teams/{team}/settings` | TeamSettingsPage | Team management |
| `/my-tasks` | MyTasksPage | Cross-team personal task list |
| `/admin` | AdminPanel | Organization administration |
| `/admin/sso` | SSOConfigPage | SAML2/SSO configuration |
| `/admin/gitlab` | GitlabConfigPage | GitLab connection management |

### 5.3 Backend Architecture (Laravel Actions)

All business logic lives in Action classes. Controllers are thin, just calling actions and returning Inertia responses.

**Action Organization:**

```
app/
├── Actions/
│   ├── Auth/
│   │   ├── LoginUser.php
│   │   ├── RegisterUser.php
│   │   ├── HandleSamlCallback.php
│   │   └── LogoutUser.php
│   ├── Teams/
│   │   ├── CreateTeam.php
│   │   ├── UpdateTeam.php
│   │   ├── AddTeamMember.php
│   │   ├── RemoveTeamMember.php
│   │   └── UpdateMemberRole.php
│   ├── Boards/
│   │   ├── CreateBoard.php
│   │   ├── UpdateBoard.php
│   │   ├── ArchiveBoard.php
│   │   ├── CreateColumn.php
│   │   ├── UpdateColumn.php
│   │   ├── ReorderColumns.php
│   │   └── DeleteColumn.php
│   ├── Tasks/
│   │   ├── CreateTask.php
│   │   ├── UpdateTask.php
│   │   ├── MoveTask.php
│   │   ├── AssignTask.php
│   │   ├── UnassignTask.php
│   │   ├── DeleteTask.php
│   │   ├── BulkMoveTasks.php
│   │   ├── BulkAssignTasks.php
│   │   ├── BulkLabelTasks.php
│   │   ├── AddComment.php
│   │   ├── UpdateComment.php
│   │   ├── DeleteComment.php
│   │   ├── AddAttachment.php
│   │   └── DeleteAttachment.php
│   ├── Labels/
│   │   ├── CreateLabel.php
│   │   ├── UpdateLabel.php
│   │   └── DeleteLabel.php
│   ├── Gitlab/
│   │   ├── CreateGitlabConnection.php
│   │   ├── TestGitlabConnection.php
│   │   ├── LinkGitlabProject.php
│   │   ├── SyncGitlabProject.php
│   │   ├── CreateBranchFromTask.php
│   │   ├── CreateMergeRequestFromTask.php
│   │   ├── HandleGitlabWebhook.php
│   │   └── RefreshGitlabLinks.php
│   ├── Automation/
│   │   ├── CreateAutomationRule.php
│   │   ├── UpdateAutomationRule.php
│   │   ├── DeleteAutomationRule.php
│   │   └── ExecuteAutomationRules.php
│   ├── Filters/
│   │   ├── SaveFilter.php
│   │   ├── UpdateFilter.php
│   │   └── DeleteFilter.php
│   ├── Notifications/
│   │   ├── SendTaskNotification.php
│   │   ├── MarkNotificationRead.php
│   │   └── MarkAllNotificationsRead.php
│   └── Admin/
│       ├── ManageUsers.php
│       ├── ConfigureSSO.php
│       └── ManageOrganization.php
├── Events/
│   ├── TaskMoved.php
│   ├── TaskUpdated.php
│   ├── TaskCreated.php
│   ├── TaskDeleted.php
│   ├── CommentAdded.php
│   ├── ColumnUpdated.php
│   ├── BoardUpdated.php
│   └── GitlabLinkUpdated.php
├── Models/
│   ├── User.php
│   ├── Team.php
│   ├── TeamMember.php
│   ├── Board.php
│   ├── Column.php
│   ├── Task.php
│   ├── TaskAssignee.php
│   ├── Label.php
│   ├── Comment.php
│   ├── Attachment.php
│   ├── Activity.php
│   ├── GitlabConnection.php
│   ├── GitlabProject.php
│   ├── TaskGitlabLink.php
│   ├── AutomationRule.php
│   ├── TaskTemplate.php
│   ├── BoardTemplate.php
│   └── SavedFilter.php
├── Http/
│   ├── Controllers/       # Thin controllers, delegate to Actions
│   ├── Middleware/
│   │   ├── EnsureTeamMember.php
│   │   ├── EnsureTeamAdmin.php
│   │   ├── EnsureOrgAdmin.php
│   │   └── VerifyGitlabWebhook.php
│   └── Requests/          # Form request validation classes
├── Policies/
│   ├── TeamPolicy.php
│   ├── BoardPolicy.php
│   ├── TaskPolicy.php
│   └── CommentPolicy.php
└── Services/
    ├── GitlabApiService.php       # HTTP client wrapper for GitLab API
    ├── ActivityLogger.php          # Records all task changes to Activity table
    └── AutomationEngine.php        # Evaluates and executes automation rules
```

### 5.4 File and Folder Structure (Full Project)

```
pulseboard/
├── app/                          # Laravel application (see 5.3 above)
├── bootstrap/
├── config/
│   ├── saml2.php                 # SAML2 configuration
│   ├── gitlab.php                # GitLab defaults
│   ├── broadcasting.php          # Reverb config
│   └── horizon.php               # Queue dashboard config
├── database/
│   ├── migrations/               # All table migrations
│   ├── seeders/
│   │   ├── DatabaseSeeder.php
│   │   ├── DemoTeamSeeder.php    # Seeds demo data for development
│   │   └── BoardTemplateSeeder.php
│   └── factories/                # Model factories for testing
├── resources/
│   ├── js/
│   │   ├── app.tsx               # Inertia app bootstrap
│   │   ├── types/                # TypeScript type definitions
│   │   │   ├── models.d.ts       # Types matching backend models
│   │   │   ├── inertia.d.ts      # Inertia page props types
│   │   │   └── gitlab.d.ts       # GitLab API response types
│   │   ├── Components/
│   │   │   ├── Layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TeamSelector.tsx
│   │   │   │   └── NotificationBell.tsx
│   │   │   ├── Board/
│   │   │   │   ├── BoardCanvas.tsx        # Main board with columns
│   │   │   │   ├── BoardColumn.tsx        # Single column
│   │   │   │   ├── TaskCard.tsx           # Card on the board
│   │   │   │   ├── TaskDetailPanel.tsx    # Slide-out detail view
│   │   │   │   ├── TaskForm.tsx           # Create/edit task form
│   │   │   │   ├── ColumnHeader.tsx       # Column name + WIP indicator
│   │   │   │   ├── FilterBar.tsx          # Board filter controls
│   │   │   │   └── BoardViewSwitcher.tsx  # Toggle between views
│   │   │   ├── Task/
│   │   │   │   ├── AssigneeSelector.tsx
│   │   │   │   ├── LabelSelector.tsx
│   │   │   │   ├── PriorityBadge.tsx
│   │   │   │   ├── SubtaskList.tsx
│   │   │   │   ├── CommentThread.tsx
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   ├── AttachmentList.tsx
│   │   │   │   └── GitlabPanel.tsx        # MR/pipeline/branch info
│   │   │   ├── Gitlab/
│   │   │   │   ├── MergeRequestBadge.tsx
│   │   │   │   ├── PipelineStatusIcon.tsx
│   │   │   │   ├── CreateBranchDialog.tsx
│   │   │   │   ├── CreateMRDialog.tsx
│   │   │   │   └── GitlabProjectSelector.tsx
│   │   │   ├── Views/
│   │   │   │   ├── ListView.tsx
│   │   │   │   ├── CalendarView.tsx
│   │   │   │   ├── TimelineView.tsx
│   │   │   │   └── WorkloadView.tsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── DashboardGrid.tsx
│   │   │   │   ├── BurndownChart.tsx
│   │   │   │   ├── CycleTimeChart.tsx
│   │   │   │   ├── VelocityChart.tsx
│   │   │   │   └── WorkloadDistribution.tsx
│   │   │   ├── Admin/
│   │   │   │   ├── UserManagement.tsx
│   │   │   │   ├── SSOConfig.tsx
│   │   │   │   ├── GitlabConnections.tsx
│   │   │   │   └── OrgSettings.tsx
│   │   │   └── Common/
│   │   │       ├── MarkdownEditor.tsx
│   │   │       ├── AvatarGroup.tsx
│   │   │       ├── ConfirmDialog.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       └── LoadingSpinner.tsx
│   │   ├── Contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ThemeContext.tsx
│   │   │   ├── WebSocketContext.tsx
│   │   │   └── NotificationContext.tsx
│   │   ├── Hooks/
│   │   │   ├── useBoardChannel.ts      # Subscribe to board events
│   │   │   ├── useTaskChannel.ts       # Subscribe to task events
│   │   │   ├── usePresence.ts          # Board presence (who's viewing)
│   │   │   ├── useDragAndDrop.ts       # DnD kit wrapper
│   │   │   └── useFilters.ts           # Filter state management
│   │   ├── Pages/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   └── ForgotPassword.tsx
│   │   │   ├── Teams/
│   │   │   │   ├── Index.tsx
│   │   │   │   ├── Show.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── Boards/
│   │   │   │   ├── Show.tsx             # Main board page
│   │   │   │   ├── List.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   ├── Timeline.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── Dashboard/
│   │   │   │   └── Index.tsx
│   │   │   ├── MyTasks/
│   │   │   │   └── Index.tsx
│   │   │   ├── Workload/
│   │   │   │   └── Index.tsx
│   │   │   └── Admin/
│   │   │       ├── Index.tsx
│   │   │       ├── Users.tsx
│   │   │       ├── SSO.tsx
│   │   │       └── Gitlab.tsx
│   │   └── Utils/
│   │       ├── dates.ts
│   │       ├── colors.ts
│   │       └── gitlab.ts
│   └── css/
│       └── app.css                # Minimal global styles (MUI handles most)
├── routes/
│   ├── web.php                    # All Inertia routes
│   ├── channels.php               # WebSocket channel authorization
│   └── console.php                # Scheduled commands
├── tests/
│   ├── Feature/
│   │   ├── Auth/
│   │   ├── Teams/
│   │   ├── Boards/
│   │   ├── Tasks/
│   │   ├── Gitlab/
│   │   └── Automation/
│   └── Unit/
│       ├── Actions/
│       ├── Services/
│       └── Models/
├── docker/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── php.ini
│   ├── supervisord.conf           # Runs PHP-FPM, Horizon, Reverb
│   └── entrypoint.sh
├── docker-compose.yml             # App, MySQL, Redis, Nginx, Reverb
├── .env.example
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js             # Only if supplementing MUI with Tailwind utilities
├── composer.json
├── package.json
└── README.md
```

---

## 6. Security Plan

### 6.1 Authentication Flow

**Local Auth:**
1. User submits email/password to `/login`
2. Laravel Fortify validates credentials, creates session
3. Inertia redirects to team dashboard
4. Session cookie (HttpOnly, Secure, SameSite=Lax) maintains auth state

**SAML2 SSO:**
1. User clicks "Login with SSO" on login page
2. App redirects to IdP login URL via Socialite SAML2 driver
3. IdP authenticates user, POSTs SAML assertion back to app's ACS URL
4. App validates assertion, looks up or creates user (JIT provisioning)
5. Creates Laravel session, redirects to dashboard
6. SLO (Single Logout) handled via IdP-initiated logout endpoint

### 6.2 Authorization

- Laravel Policies on every model (TeamPolicy, BoardPolicy, TaskPolicy, CommentPolicy)
- Middleware stack: `auth` -> `EnsureTeamMember` -> controller
- Team role checked in policies: owner/admin/member determines what actions are allowed
- Organization admin bypasses team-level checks for administrative functions
- WebSocket channel authorization via `channels.php` (private and presence channels)
- GitLab webhook endpoint uses HMAC signature verification (no session auth)

### 6.3 Input Validation

- Laravel Form Requests for all write operations (server-side validation)
- TypeScript types on the frontend provide compile-time checks
- Markdown content sanitized on render (allow safe HTML subset, strip scripts)
- File upload validation: type whitelist, size limit, virus scanning (optional ClamAV integration)
- UUID validation on all route parameters

### 6.4 Data Protection

- Database: encrypted `api_token` and `webhook_secret` fields using Laravel's `Crypt` facade
- Passwords: bcrypt hashing (Laravel default)
- All traffic over HTTPS (enforced at Nginx level)
- CSRF protection on all state-changing requests (Inertia handles this automatically)
- Rate limiting on auth endpoints (Laravel's built-in throttle middleware)
- Session fixation protection (regenerate session ID on login)

### 6.5 OWASP Top 10 Considerations

| Risk | Mitigation |
|---|---|
| Injection | Eloquent ORM parameterized queries; no raw SQL without bindings |
| Broken Auth | Fortify handles secure auth flows; SAML2 via trusted library |
| Sensitive Data Exposure | Encrypted API tokens; HTTPS enforced; no secrets in frontend |
| XML External Entities | Not applicable (no XML processing except SAML, handled by library) |
| Broken Access Control | Policies on every model; middleware on every route group |
| Security Misconfiguration | Docker image with hardened defaults; `.env` for all config |
| XSS | React's default escaping; markdown sanitization on render |
| Insecure Deserialization | Laravel's signed/encrypted cookies; no user-controlled deserialization |
| Using Components with Known Vulnerabilities | Dependabot / `composer audit` / `npm audit` in CI |
| Insufficient Logging | Activity log on tasks; Laravel log for auth events; webhook delivery logging |

---

## 7. Implementation Phases

### Phase 1: Foundation
**Goal:** Bootable application with auth, teams, and basic board structure.

**Deliverables:**
- [ ] Laravel project scaffolded with Inertia + React + TypeScript + MUI
- [ ] MySQL and Redis configured in Docker Compose
- [ ] User model with local auth (registration, login, logout, password reset) via Fortify
- [ ] Organization, Team, TeamMember models and migrations
- [ ] Team CRUD: create, update, add/remove members, role management
- [ ] Board and Column models and migrations
- [ ] Board CRUD: create, update, archive, column management (add, remove, reorder)
- [ ] App layout with sidebar, team selector, board list
- [ ] Dark/light mode theming with MUI

**Definition of Done:** A user can register, create a team, invite a member, create a board with custom columns, and see it rendered as an empty Kanban board.

**Claude Code Handoff Notes:**
- Start with `laravel new pulseboard --breeze --stack=react --typescript`
- Replace Breeze's default React setup with Inertia + MUI (remove Tailwind defaults if not supplementing MUI)
- Install: `lorisleiva/laravel-actions`, `@mui/material`, `@emotion/react`, `@emotion/styled`
- Set up Docker Compose: `app` (PHP 8.3 + Nginx), `mysql:8.0`, `redis:7`
- Use UUIDs for all primary keys from the start
- Implement Actions pattern from day one; no business logic in controllers

### Phase 2: Core Task Management
**Goal:** Full task lifecycle on the board.

**Deliverables:**
- [ ] Task model with all fields, migrations
- [ ] Task CRUD via Actions: create, update, delete
- [ ] Multiple assignees (TaskAssignee pivot) with AssigneeSelector component
- [ ] Labels (team-scoped) with CRUD and LabelSelector component
- [ ] Subtasks (parent_task_id self-referential)
- [ ] Drag-and-drop: move tasks between columns and reorder within columns (@dnd-kit)
- [ ] Task detail panel (slide-out) with all fields, assignees, labels, description (markdown)
- [ ] Task cards on board showing: title, avatars, priority, labels, due date, subtask progress
- [ ] Priority system with visual indicators
- [ ] Activity logging (ActivityLogger service records every change)
- [ ] Comments with markdown and @mentions
- [ ] Attachments upload and display
- [ ] Filter bar: filter by assignee, label, priority, due date
- [ ] Search within board
- [ ] Bulk actions (select multiple, move/assign/label)
- [ ] Task templates: create, apply when making new tasks

**Definition of Done:** A user can fully manage tasks: create from template, assign multiple people, add subtasks, comment, attach files, drag between columns, filter, and bulk-operate. Every change is logged in the activity feed.

**Claude Code Handoff Notes:**
- Task sort_order uses fractional indexing (e.g., between 1.0 and 2.0, insert at 1.5) to avoid reindexing all tasks on every move
- @mentions in comments: parse `@username` patterns, resolve to user IDs, store as markdown, render as links
- Activity entries created by `ActivityLogger` service called from every Task-related Action
- Drag-and-drop: use `@dnd-kit/core` and `@dnd-kit/sortable`, emit Inertia POST on drop with new column_id and sort_order

### Phase 3: Real-Time and Notifications
**Goal:** Live collaboration and notification system.

**Deliverables:**
- [ ] Laravel Reverb installed and configured
- [ ] Laravel Echo configured on frontend
- [ ] Board-level WebSocket channel: task moved, created, updated, deleted events broadcast
- [ ] Task-level channel: comment added, field changed events
- [ ] Presence channel per board (show who's viewing)
- [ ] Optimistic UI updates on action initiator; server broadcast to others
- [ ] Connection status indicator in UI
- [ ] Reconnection logic with state catch-up (Inertia reload on reconnect)
- [ ] In-app notification system (database channel)
- [ ] Notification bell with unread count
- [ ] Email notifications via queued jobs (assigned, mentioned, due soon, overdue)
- [ ] Per-user notification preferences in profile settings
- [ ] Scheduled command: check for tasks due in 24h, send reminders

**Definition of Done:** Two users viewing the same board see each other's changes in real time. Notifications arrive in-app and via email based on user preferences.

**Claude Code Handoff Notes:**
- Reverb runs as a separate process in the Docker setup (add to supervisord.conf)
- Broadcasting events: dispatch from Actions after DB commit (use `afterCommit` on events)
- Channel auth in `channels.php`: verify user is a member of the board's team
- Notification preferences stored as json on user model; check before dispatching
- Use Laravel's `Notification` class with `via()` method reading user prefs

### Phase 4: GitLab Integration
**Goal:** Deep, bidirectional GitLab workflow integration.

**Deliverables:**
- [ ] GitlabConnection model and admin UI for managing connections
- [ ] GitLab API service class (HTTP client wrapper with auth, error handling, retries)
- [ ] "Test Connection" button that validates the API token
- [ ] GitlabProject model; team admins link GL projects to their team
- [ ] Auto-register webhooks on linked GitLab projects
- [ ] Webhook receiver endpoint with HMAC signature verification
- [ ] Task-to-GitLab linking: select a GitLab project on a task
- [ ] Create branch from task (generates name from task ID + title slug)
- [ ] Create merge request from task (pre-fills title/description, links back to task)
- [ ] Display linked MRs on task card and detail panel (status, approvals, author)
- [ ] Pipeline status badge on task cards
- [ ] Webhook handlers: MR opened/updated/merged/closed, pipeline status change
- [ ] Auto-link: MR description or branch name containing task ID auto-creates TaskGitlabLink
- [ ] Background sync job: periodically refresh GitLab link data (fallback for missed webhooks)
- [ ] GitLab events feed automation triggers (MR merged, pipeline failed)

**Definition of Done:** A user can link a task to a GitLab project, create a branch and MR directly from the task, see live MR and pipeline status updates, and have tasks auto-move when MRs are merged via automation rules.

**Claude Code Handoff Notes:**
- `GitlabApiService` should use Laravel's HTTP client with a base URL macro
- Webhook endpoint: `POST /api/webhooks/gitlab/{connection}` with `VerifyGitlabWebhook` middleware
- Auto-link parsing: look for `PB-{taskId}` pattern in MR title, description, and source branch name
- Background sync: scheduled job every 15 minutes, only refreshes links updated more than 15 min ago
- Encrypt API tokens at rest using Laravel's `encrypted` cast on the model attribute

### Phase 5: Views, Dashboard, and Automation
**Goal:** Alternative views, reporting, and workflow automation.

**Deliverables:**
- [ ] List/Table view with sortable columns
- [ ] Calendar view (tasks by due date on a monthly calendar)
- [ ] Timeline/Gantt view (horizontal task bars with drag-to-resize for dates)
- [ ] Workload view (per-person task count and effort, capacity indicators)
- [ ] "My Tasks" cross-board personal view
- [ ] Saved filters (save, load, set default per board)
- [ ] Board view switcher in header
- [ ] Team dashboard with configurable widget grid
- [ ] Burndown chart widget
- [ ] Cycle time chart widget
- [ ] Velocity chart widget
- [ ] Workload distribution widget
- [ ] Overdue tasks list widget
- [ ] CSV export for reports
- [ ] Automation rule CRUD UI (board settings)
- [ ] Automation engine: evaluate rules on task events, execute actions
- [ ] Board templates: create template from existing board, create board from template

**Definition of Done:** Users can view their work in five different formats, see team performance metrics on a dashboard, export data, and set up automation rules that trigger on board and GitLab events.

**Claude Code Handoff Notes:**
- For charts, use Recharts (already available in React ecosystem, lightweight)
- Calendar view: consider `@fullcalendar/react` or build a simple month grid with MUI
- Timeline view: custom component using horizontal bars; no need for a heavy Gantt library
- Automation engine: `ExecuteAutomationRules` action called from a listener on task events; evaluate trigger_config against the event payload, then dispatch the action
- Saved filters serialize the filter state as JSON; deserialize and apply on page load

### Phase 6: SSO and Admin Polish
**Goal:** Enterprise auth and administrative completeness.

**Deliverables:**
- [ ] SAML2 SSO integration via `socialiteproviders/saml2`
- [ ] SSO configuration UI in admin panel (entity ID, login URL, logout URL, certificate)
- [ ] JIT user provisioning on first SSO login
- [ ] Account linking (local + SSO for same user)
- [ ] Admin panel: user management (list, create, deactivate, reset password)
- [ ] Admin panel: team oversight (view all teams, members, boards)
- [ ] Admin panel: organization settings (name, logo/branding)
- [ ] Admin panel: system health (link to Horizon dashboard, WebSocket status)
- [ ] Profile page: change name, email, password, avatar, notification prefs, theme
- [ ] Polish: loading states, error boundaries, empty states, responsive layout
- [ ] Accessibility audit: keyboard navigation, ARIA labels, color contrast (WCAG 2.2 AA)
- [ ] Documentation: README with setup instructions, environment variables, deployment guide

**Definition of Done:** The application supports SAML2 SSO alongside local auth, has a complete admin panel, and is polished enough for production use with proper error handling, loading states, and accessibility.

**Claude Code Handoff Notes:**
- `socialiteproviders/saml2` integrates through Socialite's driver interface; configure in `config/services.php`
- SSO config stored in database (not .env) so it can be managed through the admin UI
- JIT provisioning: on SAML callback, check if user exists by `auth_provider_id`; if not, create with data from SAML attributes
- Account linking: if SSO email matches existing local user, prompt to link accounts
- Accessibility: MUI components are generally accessible; focus on custom components (drag-and-drop, task cards)

---

## 8. Testing Strategy

### 8.1 Unit Tests
- All Actions tested in isolation with mocked dependencies
- Model relationship tests (ensure correct eager loading, scoping)
- `ActivityLogger` tests: verify correct change detection and logging
- `AutomationEngine` tests: verify rule evaluation logic
- `GitlabApiService` tests: mock HTTP responses, verify request construction

### 8.2 Feature/Integration Tests
- Auth flows: local login, registration, SSO callback, session management
- Team management: create, invite, role changes, multi-team membership
- Board lifecycle: create, customize columns, archive, restore
- Task CRUD: create, move (verify sort_order), assign multiple users, subtasks
- GitLab integration: webhook receipt, auto-linking, MR creation (mocked GitLab API)
- Automation rules: trigger evaluation and action execution
- Authorization: verify policies prevent unauthorized access at every level
- WebSocket: verify events are broadcast on task mutations

### 8.3 End-to-End Tests
- Use Laravel Dusk or Playwright
- Critical paths: login -> create team -> create board -> create task -> drag to new column -> verify real-time update in second browser
- SSO login flow (with mock IdP)
- GitLab integration flow (with mock GitLab server)

### 8.4 Key Test Scenarios

| Scenario | Type | Priority |
|---|---|---|
| User registers, creates team, invites member | Feature | High |
| Task created with multiple assignees, all notified | Feature | High |
| Task dragged between columns, real-time update verified | Feature | High |
| WIP limit exceeded shows warning, allows override | Feature | Medium |
| GitLab webhook updates MR status on task | Feature | High |
| Automation moves task when MR merged | Feature | High |
| SSO user provisioned on first login | Feature | High |
| Non-team-member cannot access board | Feature | High |
| Bulk actions on 50+ tasks perform within 2s | Performance | Medium |
| Board with 500 tasks renders within 3s | Performance | Medium |
| Concurrent drag-and-drop by two users resolves correctly | Feature | Medium |

---

## 9. Conventions and Standards

### 9.1 Code Style
- **PHP:** PSR-12 via Laravel Pint
- **TypeScript/React:** Prettier + ESLint with `@typescript-eslint`
- **Naming:** Laravel conventions (snake_case DB columns, camelCase PHP properties, PascalCase components)

### 9.2 Git Conventions
- Branch naming: `feature/pb-{number}-short-description`, `fix/pb-{number}-short-description`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- All work on feature branches, merge via MR

### 9.3 Database Conventions
- All tables use UUID primary keys
- All tables include `created_at` and `updated_at`
- Foreign keys always cascade on delete for pivot tables; restrict for entity tables
- Soft deletes only where explicitly noted (boards via `is_archived`)
- JSON columns use `json` type (MySQL 8.0+ native JSON support)

### 9.4 API/Route Conventions
- RESTful route naming following Laravel conventions
- All routes behind `auth` middleware except login/register/SSO callback/webhook
- Inertia routes return page components; no JSON API except webhook endpoint
- Route model binding with UUID

---

## 10. Open Questions and Decisions Log

| # | Question | Options | Status |
|---|---|---|---|
| 1 | Application name | PulseBoard (pairs with Impulse editor) | **Decided: PulseBoard** |
| 2 | Should the app support multiple GitLab instances simultaneously? | Plan currently supports it via GitlabConnection model | **Decided: Yes** |
| 3 | Markdown editor library | TipTap (rich, extensible) vs. simple textarea with preview | **Open** - recommend TipTap for @mention support |
| 4 | File storage backend | Local filesystem by default, Laravel filesystem abstraction allows switching to S3/MinIO via config | **Decided: Local default, swappable** |
| 5 | Should automation rules support multi-step chains? | Single trigger-action vs. trigger -> action -> action chains | **Recommend single for v1**, extend later |
| 6 | Task ID format for GitLab references | `PB-{uuid-short}` vs. `PB-{auto-increment}` | **Recommend auto-increment** per board for human readability (e.g., PB-123) |
| 7 | Mobile responsiveness scope | Desktop-first with easy mobile viewing | **Decided: Desktop-first, mobile viewing** |
| 8 | Should there be a public/shared board option for cross-team visibility? | Teams are fully isolated, no public sharing | **Decided: No** |

---

## 11. Reference Links

| Resource | URL |
|---|---|
| Laravel 11 Docs | https://laravel.com/docs/11.x |
| Laravel Actions | https://laravelactions.com |
| Inertia.js | https://inertiajs.com |
| MUI (Material UI) | https://mui.com/material-ui/ |
| @dnd-kit | https://dndkit.com |
| Laravel Reverb | https://reverb.laravel.com |
| Laravel Echo | https://laravel.com/docs/11.x/broadcasting |
| Laravel Horizon | https://laravel.com/docs/11.x/horizon |
| Socialite SAML2 Provider | https://socialiteproviders.com/Saml2/ |
| GitLab REST API v4 | https://docs.gitlab.com/ee/api/rest/ |
| GitLab Webhooks | https://docs.gitlab.com/ee/user/project/integrations/webhooks.html |
| Recharts | https://recharts.org |
| FullCalendar React | https://fullcalendar.io/docs/react |
| TipTap Editor | https://tiptap.dev |
| MySQL 8.0 JSON Functions | https://dev.mysql.com/doc/refman/8.0/en/json.html |
