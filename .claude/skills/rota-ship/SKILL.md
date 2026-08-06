---
name: rota-ship
description: Ship staged Rota changes end-to-end — commit on the dev branch, squash-merge to main with the same message, push main, then reset the dev branch back to main and force-with-lease push it. Use this whenever the user says "ship", "ship it", "deploy", "push this", "commit and deploy", or otherwise asks to release the current working diff, and also proactively at the end of any substantive edit session unless the user has told you to hold off. Vercel auto-deploys main to both sacrament-program-app.vercel.app and rameumptom-multi.vercel.app; this skill is the ONE reliable way to get changes into that build.
---

# rota-ship

Ships uncommitted (or already-committed-on-branch) Rota changes to production. Rota has an unusual deploy shape — two Vercel projects auto-deploy the same `main` branch, and the owner's iteration loop is faster when new changes always land as a single squash-commit on `main` per iteration. This skill encodes that shape so you don't have to remember the sequence.

## When to use this

Invoke this skill whenever:
- The user says "ship", "ship it", "deploy", "push", "release", "cut a build", or similar.
- You've finished a substantive edit and want to hand off a running Vercel build. Ship one logical change per invocation — don't batch unrelated edits.
- The user asks for a URL, tests it in production, or otherwise implies "get it live".

Skip if:
- The user has explicitly asked to hold off (`"don't push yet"`, `"let me review first"`).
- There are no changes to ship (working tree clean AND branch is already at `origin/main`).

## Preflight

Do these in parallel; use the results to decide whether to stage or how to describe the change:

1. `git status` — see what's uncommitted and which branch you're on. Confirm the active branch matches CLAUDE.md §2 (currently `claude/fix-bookmark-update-phone-I4E1D`).
2. `git diff --stat` — see what's about to move.
3. `git log --oneline -5` — pick up the recent commit-message style (short imperative headline, blank line, wrapped body explaining the *why*).

If the working tree has anything suspicious (large binaries, `.env`, `credentials.*`, unexpected files), stop and ask before staging — see the Git Safety Protocol in the main prompt.

## The ship sequence

All in one shell block so it's a single atomic action. Substitute `<BRANCH>` (dev branch from CLAUDE.md §2), `<COMMIT_MESSAGE>` (the message you drafted, passed via HEREDOC), and `<FILES_TO_STAGE>` (specific paths — never `git add .`).

```bash
git add <FILES_TO_STAGE> && \
git commit -m "$(cat <<'EOF'
<COMMIT_MESSAGE>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Claude-Session: <session-url>
EOF
)" && \
git checkout -B main origin/main && \
git merge --squash <BRANCH> && \
git commit -m "$(cat <<'EOF'
<COMMIT_MESSAGE>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Claude-Session: <session-url>
EOF
)" && \
git push origin main 2>&1 | tail -3 && \
git checkout <BRANCH> && \
git reset --hard origin/main && \
git push -u origin <BRANCH> --force-with-lease 2>&1 | tail -3
```

Why this exact shape:
- Two commits with the same message — the branch commit is for readable branch history; the squash on `main` is what Vercel actually deploys.
- `git checkout -B main origin/main` starts from the current `origin/main` so we squash-merge cleanly on top of what's already deployed.
- The branch reset + force-with-lease keeps the dev branch pointing at the merged commit so subsequent iterations start from a clean, up-to-date base. `--force-with-lease` (never `--force`) protects against clobbering someone else's push.
- `2>&1 | tail -3` keeps the summary readable in the reply without dumping the full push output.

## Commit message conventions

Match what's already there (`git log --oneline -20`). Broadly:
- Headline is one short imperative line, no scope prefix. Examples in the repo: `"Editor footer: drop the Unpublish button"`, `"Fix: chorister role can edit hymns / chorister / organist again"`, `"Perf: cut latency across every navigation"`.
- Blank line, then the body — explain the *why* and any subtle tradeoff. Bullet points are welcome for multi-change commits. Wrap around 72 chars.
- End with the standard trailer:

  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  Claude-Session: <session-url>
  ```

  The session URL comes from the Claude-Session line the harness embedded in the main system prompt — reuse it verbatim.

Never skip hooks (`--no-verify`), never bypass signing. If a hook fails, fix the underlying issue and make a NEW commit — don't amend.

## After the push

- Report back with the commit sha on `main` (from the `git push origin main` output — the second sha in the `hash..hash` fragment). Vercel takes ~1-2 min to build; the owner will hard-refresh once it's up. If a specific behavior changed, briefly say what to look for.
- Do NOT open a PR unless the user explicitly asks. This branch is developed against `main` directly by owner preference.
- If the push failed on network, retry up to 4 times with exponential backoff (2s / 4s / 8s / 16s), per the harness's git safety notes.

## Related knowledge

- CLAUDE.md §2 for the active branch name (updates over time).
- CLAUDE.md §3 for the two-Vercel-app deploy topology.
- CLAUDE.md §6 for the canonical deploy workflow (this skill implements it).
- CLAUDE.md §7 if the shipped change includes a new SQL migration — that must be pasted into the "robertboot's Project" SQL editor separately. Call this out in the reply so the owner knows.
