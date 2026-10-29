# Figma Integration

Attach Figma files, pages and frames to tasks so the design sits next to the work.

## Add a connection

Connections belong to a **team**. Go to **Team settings → Integrations** (admins and owners) and add a Figma connection:

| Field                 | Notes                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Name                  | Display name, for example "Design team".                                                                                            |
| Personal access token | Create one in Figma under **Settings → Security → Personal access tokens**. When editing, leave it blank to keep the current token. |
| Active                | Only active connections can be used to link files.                                                                                  |

Recommended token scopes:

- **File metadata (Read)**: file names, thumbnails and last-modified dates. Needed to link anything.
- **File content (Read)**: node names, page contents and rendered previews. Without it, links still work but have no previews or node details.

Figma personal access tokens expire (the settings page notes 90 days), so plan to rotate them. Use **Test** to check a token; it reports the Figma account it belongs to. Tokens are stored encrypted with the app key (`APP_KEY`).

## Link a file to a task

On a task, open the **Figma** section, choose a connection, paste a Figma URL, and add it. Any team member who can edit the task can add or remove links.

Accepted URLs contain `figma.com/design/<key>`, `figma.com/file/<key>` or `figma.com/board/<key>`. An optional `node-id=` query parameter (as in Figma's "Copy link to selection") points the link at a specific page or frame.

When you add a link, PulseBoard reads from the Figma API once and stores:

| Link target          | Stored details                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Whole file           | File name, file thumbnail URL, last-modified date                                                  |
| Page (`CANVAS` node) | Page name and the names of up to 12 top-level frames, components, component sets or sections on it |
| Frame or other node  | Node name, node type, and a rendered preview image of that node                                    |

The task shows the name, type, preview image (for node links), page contents (for page links) and last-modified date, with a link that opens Figma.

## Limitations

- Link details are captured **once**, when the link is added. There is no background refresh, so names, previews and modified dates can go stale. Remove and re-add a link to refresh it. Preview image URLs come from Figma's image API and may stop working after some time.
- Figma links are not part of task activity and don't trigger notifications or automations.
- Removing a connection deletes the task links made through it.

## API

Task Figma links are also available in the [REST API](api.md): `GET`, `POST` and `DELETE` on `/api/v1/teams/{team}/boards/{board}/tasks/{task}/figma`.
