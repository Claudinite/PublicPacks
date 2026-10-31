## 2026-09-18 · born · a migration record declares public-website beside cloudflare-site (#2101)
- **Reason:** versioning left for `public-website`, so a member serving from Cloudflare needed that
  pack declared to keep its versioning without a hand edit.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Fable 5.1, per the commit trailer.
- **Mechanism:** a `migrations/` record the Node engine's updater ran.
- **Landed:** #2101

## 2026-10-05 · retired · the Node engine's migration records leave the pack
- **Reason:** `migrations/` held records only the Node engine's updater ran; cn reads none of them,
  and no member of the new engine carries the shapes they converted.
- **Actor:** @missingbulb (owner), asking that ClaudinitePacks keep only code still needed.
- **Model:** Claude Opus 5.5
- **Mechanism:** the `migrations/` directory, deleted. cloudflare-site 1.61005.1.
