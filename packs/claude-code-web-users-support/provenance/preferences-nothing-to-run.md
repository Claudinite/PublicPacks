## 2026-10-12 · born · a personal pack may declare no tasks and no env
- **Source:** Ariel, 2026-10-12 (thread "Claudinite security review", finding F6): "Create a check in the claud-code-web-user-support pack that it cannot declare any tasks in personal packs (nothing runs them)", then "Also check it declared no "env" sections in the pack.json."
- **Reason:** the engine skips temp packs when it discovers tasks, and runs no env step from them, so either reads as work that never happens.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a coded world check in this pack, blocking, over the store's `<path>/<login>/` directories.
