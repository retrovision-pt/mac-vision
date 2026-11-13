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
- Numeric PINs are verified only server-side against peppered PBKDF2 hashes with reserved-attempt lockouts, then a real Auth session is issued server-side; Auth identities keep random unknown passwords so provider password rules and leaked-password checks stay enabled.
- Bridge and adapter translate provider, database and script errors into Portuguese before the original document displays them.
- Provision new wallets only with a hashed, expiring, one-use private setup grant; consume it alongside wallet/account/role creation in one locked transaction, compensating only the newly created unassigned Auth identity on failure, because existing accounts must never authorize wallet takeover.
- After an authorized account reset, automatic setup is development-only and requires a server-pepper-derived, expiring single-use grant plus absence of a valid GA; production never receives that capability, and preserved wallets cannot be reassigned.
- Treat Cloud acknowledgement as the only persistence success signal; snapshots and same-field conflict rejection prevent queued writes and refreshes from hiding unsaved changes.
- Persist original registry metadata transactionally through the privileged registry function after server authorization; personal preferences use atomic per-key updates separate from roles.
- Registry saves send only changed records and never infer deletion from missing users; access removal has a separate admin-authorized RPC to protect concurrent accounts.
- PIN login performs read-only credential validation, including legacy accounts; credential writes belong only to account creation or explicit authorized password changes.
- Persist administrator subtypes in protected account fields, not registry metadata, so full MAC administrator access survives reopening without name-based privileges.
- Initial wallet setup may finish with stores only; store managers and collaborators are added later through the original access menus, so setup never forces placeholder accounts.
- The public login directory lists only wallets with a valid GA and their own stores/accounts, so orphaned records never resurface after a reset.
- User photos live once per Cloud user ID in the private mac-photos bucket, referenced by profiles.avatar_url and applied by the bridge to every registry/employee copy; employees link to IDs only by a unique name match so duplicate names never borrow a photo.
- Delegated collaborator permissions live per user and store in the Cloud permissions table, written only through the admin/store-manager RPC and enforced by the document, sales and commission write functions; the original script's `macCan` only mirrors them for UI, so frontend gates never become the security boundary.
- MOVIIK imports by collaborators require delegated imports.moviik on the target store (store tickets) and on any wallet store for the shared pending-MOVIIK document; enforced in mac_put_document so revocation applies server-side immediately.
- Schedule access security is decided by the Cloud function mac_shift_status (Europe/Lisbon, shift start −15 min to end +15 min, per-store setting in the store document): checked at PIN login after the password, re-checked during the session, and enforced by write triggers, so browser timers never act as the security boundary.
- Original MOVIIK files live in the private mac-imports bucket under <store>/<importId>/, with metadata in mac_import_files written only via mac_record_import (admin, store manager or delegated imports.moviik); history entries reference cloud:<id> and downloads use short signed URLs, so no browser storage holds originals.
