<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Original application boundary

- Serve the uploaded standalone document in a full-viewport same-origin iframe; the host must not reconstruct or restyle its UI because the document owns the existing application behavior and design.
- Keep Cloud profile fields separate from protected role assignments; user-editable profile data must never grant access.
- Track capability verification in the migration ledger; fresh installations never import browser records, and disposable verification data is removed only with explicit authorization.
- Use a same-origin message bridge and versioned Cloud documents for the original script; optimistic revisions and three-way merges preserve concurrent independent records without rebuilding forms.
- Create and update authentication credentials only through verified server handlers; synthetic internal addresses support the original username selectors without exposing credentials in documents.
- Treat Cloud acknowledgement as the only persistence success signal; snapshots and same-field conflict rejection prevent queued writes and refreshes from hiding unsaved changes.
- Persist original registry metadata transactionally through the privileged registry function after server authorization; personal preferences use atomic per-key updates separate from roles.
