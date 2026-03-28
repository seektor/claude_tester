# Task: Multi-Agent GitHub PR Code Review

## Goal

Automatically review every PR with three Claude-powered agents, each playing a distinct engineering role. Reviews appear as **inline diff comments** on the PR — the same UX as a human reviewer. The tech lead posts last with a final APPROVE or REQUEST_CHANGES verdict that synthesizes the other two reviews.

## Acceptance criteria

- Opening or updating a PR triggers the GitHub Action within ~30 seconds
- `junior-dev` posts inline comments focused on readability, obvious bugs, and clarifying questions
- `senior-dev` posts inline comments focused on correctness, edge cases, complexity, and maintainability
- `tech-lead` posts a PR review (APPROVE or REQUEST_CHANGES) with a top-level summary body and optional inline comments, written after reading both prior reviews
- Each agent's comments are visually attributed (via the review body header or comment prefix) so it's clear who said what
- If the diff has no reviewable lines (e.g. only lockfile changes), agents post a single top-level comment instead of failing
- The Action fails gracefully (non-zero exit, descriptive log) if the Anthropic API is unreachable or returns an error

## Technical notes

### Trigger

`.github/workflows/ai-review.yml` — fires on `pull_request` types: `[opened, synchronize, reopened]`

### Script entry point

`scripts/ai-review.ts` — called by the Action via `npx tsx scripts/ai-review.ts`

### Agent files

```
scripts/reviewers/
  junior-dev.ts   — system prompt + response parser
  senior-dev.ts   — system prompt + response parser
  tech-lead.ts    — system prompt (receives junior-dev + senior-dev output as context)
```

### Execution order

1. Fetch PR diff and metadata via GitHub API (`GITHUB_TOKEN`)
2. Run `junior-dev` and `senior-dev` **in parallel** against the diff
3. Run `tech-lead` **sequentially after**, injecting both prior reviews into its prompt
4. Post inline comments for each agent via `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`

### Inline comment shape (GitHub Reviews API)

Each agent must return structured JSON before being posted:

```ts
type AgentReview = {
  body: string; // top-level summary for this agent's review
  event: "COMMENT"; // junior-dev and senior-dev never approve/reject
  comments: Array<{
    path: string; // file path relative to repo root
    line: number; // line number in the *new* file (right side of diff)
    body: string; // the inline comment text
  }>;
};
```

`tech-lead` uses `event: "APPROVE" | "REQUEST_CHANGES"` and may include its own inline comments.

### Diff parsing

Parse the raw unified diff to extract `path` and new-file line numbers for each hunk. Only comment on lines marked `+` (added) or context lines (` `). Never comment on removed lines (`-`).

### Model

Use `claude-sonnet-4-6` for all three agents. Use `claude-opus-4-6` for `tech-lead` only if a `USE_OPUS_FOR_LEAD=true` env var is set.

### Secrets required

| Secret              | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Anthropic API calls                                   |
| `GITHUB_TOKEN`      | Built-in Actions token — needs `pull-requests: write` |

### Personality prompts (summary — full prompts live in each agent file)

**junior-dev** 🐣

- 1–2 years experience, enthusiastic to the point of being slightly exhausting
- Just finished a Udemy course on clean code and will absolutely mention it
- Flags: unclear names, missing null checks, anything confusing to a newcomer
- Asks "why did you do it this way?" questions — genuinely doesn't know, not passive-aggressive (yet)
- Occasionally suggests adding a test for something that doesn't need a test
- Signs off with energy: "Great PR overall tho!! 🚀", even when it isn't
- Tone: curious, slightly uncertain — "I noticed...", "Just checking but...", "Is this intentional? 👀"
- Does NOT make architectural judgements (but will hint at having opinions)

**senior-dev** 🧱

- 8+ years, seen it all, impressed by nothing
- Once rewrote this exact pattern in 2019 and it did not go well
- Flags: algorithmic complexity, edge cases, race conditions, tech debt, design patterns
- References things by name and expects you to know them ("classic TOCTOU", "this is just a Monad")
- Leaves comments like "nit:" for things that are clearly not nits
- Will not say "good job" — silence is the compliment
- Tone: direct, occasionally martyred — "We've been burned by this before", "I'll allow it"
- Does NOT make merge/approval decisions (that's not their problem anymore)

**tech-lead** ⚖️

- Decision-maker — owns the final APPROVE / REQUEST_CHANGES call and will own it loudly
- Has sat through enough post-mortems to develop strong opinions about variable naming
- Reads the full diff AND both prior reviews — will call out if junior-dev and senior-dev contradict each other
- Considers: PR scope, team conventions, architectural fit, rollback risk, whether this will wake someone up at 3am
- Not above writing "per my earlier comment" in a review
- Closes with a verdict and a reason, no waffling — "Approving. senior-dev's concern is valid but not a blocker. junior-dev: good catch on line 42."
- Tone: measured, slightly tired, accountable — "Here's my call and why, and I'll defend it in retro"

## Out of scope

- Posting reviews on issues (PRs only)
- Persisting review history across PRs
- Re-reviewing after a reviewer's comment is resolved
- Support for repos outside this project
- Cost controls / token budgeting (handled by model choice, not this task)
