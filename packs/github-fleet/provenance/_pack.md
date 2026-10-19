## 2026-10-19 · born · the github-fleet pack: the account a fleet bills to
- **Source:** Engine's Actions storage filled the account's monthly allowance (ClaudiniteEngine
  #372). GitHub bills it per account, so per-repository readings were proxies for it.
- **Actor:** @missingbulb (owner), asking for a pack Shepherd declares that watches the account
  rather than one repository.
- **Model:** Claude Opus 5.5 (1M context)
- **Mechanism:** a canon pack declared by hand on a fleet manager, so any fleet's manager can take
  it; the engine's embedded fleet pack keeps membership and updates.
- **Rejected:** a per-repository task in git-github, whose readings say nothing about the account
  total.
