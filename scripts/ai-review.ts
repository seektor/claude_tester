import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

import { SYSTEM_PROMPT as JUNIOR_PROMPT } from "./reviewers/junior-dev.ts";
import { SYSTEM_PROMPT as SENIOR_PROMPT } from "./reviewers/senior-dev.ts";
import { buildSystemPrompt as buildTechLeadPrompt } from "./reviewers/tech-lead.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

const CommentSchema = z.object({
  path: z.string().describe("File path relative to repo root"),
  line: z.number().int().describe("Line number in the new file"),
  body: z.string().describe("The inline comment text"),
});

const ReviewerSchema = z.object({
  body: z.string().describe("Top-level summary for this agent's review"),
  event: z.literal("COMMENT"),
  comments: z.array(CommentSchema),
});

const TechLeadSchema = z.object({
  body: z.string().describe("Top-level summary with final verdict"),
  event: z.enum(["APPROVE", "REQUEST_CHANGES"]),
  comments: z.array(CommentSchema),
});

type AgentReview = z.infer<typeof ReviewerSchema> | z.infer<typeof TechLeadSchema>;

interface CommentableLine {
  line: number;
  content: string;
  isAdded: boolean;
}

interface DiffFile {
  path: string;
  lines: CommentableLine[];
}

// ─── Diff parsing ─────────────────────────────────────────────────────────────

function parseDiff(rawDiff: string): { files: DiffFile[]; validLines: Set<string> } {
  const files: DiffFile[] = [];
  const validLines = new Set<string>();
  let currentFile: DiffFile | null = null;
  let newLineNum = 0;

  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      const path = line.slice(6);
      currentFile = { path, lines: [] };
      files.push(currentFile);
      newLineNum = 0;
    } else if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        newLineNum = parseInt(match[1]!, 10) - 1;
      }
    } else if (currentFile) {
      if (line.startsWith("+")) {
        newLineNum++;
        currentFile.lines.push({ line: newLineNum, content: line.slice(1), isAdded: true });
        validLines.add(`${currentFile.path}:${newLineNum}`);
      } else if (line.startsWith(" ")) {
        newLineNum++;
        currentFile.lines.push({ line: newLineNum, content: line.slice(1), isAdded: false });
        validLines.add(`${currentFile.path}:${newLineNum}`);
      }
      // '-' lines: removed from old file, not commentable in new file
    }
  }

  return { files, validLines };
}

function formatDiffForAgent(files: DiffFile[]): string {
  if (files.length === 0) return "(no reviewable changes)";

  return files
    .map((file) => {
      const lineRows = file.lines
        .map(({ line, content, isAdded }) => {
          const prefix = isAdded ? "+" : " ";
          return `${prefix} ${String(line).padStart(4)} | ${content}`;
        })
        .join("\n");
      return `### ${file.path}\n\n${lineRows}`;
    })
    .join("\n\n");
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function githubRequest(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

async function fetchPR(
  repo: string,
  prNumber: string,
  token: string,
): Promise<{ title: string; body: string; diff: string }> {
  const [metaRes, diffRes] = await Promise.all([
    githubRequest(`/repos/${repo}/pulls/${prNumber}`, token),
    githubRequest(`/repos/${repo}/pulls/${prNumber}`, token, {
      headers: { Accept: "application/vnd.github.v3.diff" },
    }),
  ]);

  if (!metaRes.ok) {
    throw new Error(`Failed to fetch PR metadata: ${metaRes.status} ${await metaRes.text()}`);
  }
  if (!diffRes.ok) {
    throw new Error(`Failed to fetch PR diff: ${diffRes.status} ${await diffRes.text()}`);
  }

  const meta = (await metaRes.json()) as { title: string; body: string | null };
  const diff = await diffRes.text();

  return { title: meta.title, body: meta.body ?? "", diff };
}

async function postReview(
  repo: string,
  prNumber: string,
  token: string,
  label: string,
  review: AgentReview,
  validLines: Set<string>,
): Promise<void> {
  const filteredComments = review.comments
    .filter(({ path, line }) => {
      const key = `${path}:${line}`;
      if (!validLines.has(key)) {
        console.warn(`[${label}] Skipping comment on ${key} (not in diff)`);
        return false;
      }
      return true;
    })
    .map((comment) => ({ ...comment, body: `**[${label}]** ${comment.body}` }));

  const payload = {
    body: `**[${label}]**\n\n${review.body}`,
    event: review.event,
    comments: filteredComments,
  };

  const res = await githubRequest(`/repos/${repo}/pulls/${prNumber}/reviews`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    // Retry without inline comments if the diff has moved
    if (res.status === 422 && filteredComments.length > 0) {
      console.warn(`[${label}] 422 with inline comments, retrying as top-level only`);
      const fallback = await githubRequest(`/repos/${repo}/pulls/${prNumber}/reviews`, token, {
        method: "POST",
        body: JSON.stringify({ body: payload.body, event: review.event, comments: [] }),
      });
      if (!fallback.ok) {
        throw new Error(`[${label}] Failed to post review: ${fallback.status} ${await fallback.text()}`);
      }
    } else {
      throw new Error(`[${label}] Failed to post review: ${res.status} ${text}`);
    }
  }

  console.log(`[${label}] Review posted (${filteredComments.length} inline comments)`);
}

// ─── Claude API calls ─────────────────────────────────────────────────────────

async function runReviewer(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userMessage: string,
  schema: typeof ReviewerSchema,
): Promise<z.infer<typeof ReviewerSchema>>;
async function runReviewer(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userMessage: string,
  schema: typeof TechLeadSchema,
): Promise<z.infer<typeof TechLeadSchema>>;
async function runReviewer(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userMessage: string,
  schema: typeof ReviewerSchema | typeof TechLeadSchema,
): Promise<z.infer<typeof ReviewerSchema> | z.infer<typeof TechLeadSchema>> {
  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: zodOutputFormat(schema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Reviewer returned null output");
  }
  return response.parsed_output as z.infer<typeof ReviewerSchema> | z.infer<typeof TechLeadSchema>;
}

function buildUserMessage(
  prTitle: string,
  prBody: string,
  formattedDiff: string,
): string {
  return `PR Title: ${prTitle}

PR Description:
${prBody || "(no description)"}

---

Diff to review (format: [+/-/space] [line number] | [content]):
- Lines starting with "+" are additions (new code)
- Lines starting with " " are context (unchanged)
- Only comment on line numbers shown — any other line number is invalid

${formattedDiff}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const useOpusForLead = process.env.USE_OPUS_FOR_LEAD === "true";

  if (!anthropicKey || !githubToken || !repo || !prNumber) {
    throw new Error(
      "Missing required environment variables: ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER",
    );
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const sonnet = "claude-sonnet-4-6";
  const opus = "claude-opus-4-6";

  console.log(`Fetching PR #${prNumber} from ${repo}…`);
  const { title: prTitle, body: prBody, diff: rawDiff } = await fetchPR(repo, prNumber, githubToken);

  const { files, validLines } = parseDiff(rawDiff);
  const hasReviewableLines = validLines.size > 0;

  if (!hasReviewableLines) {
    console.log("No reviewable lines in diff (e.g. lockfile-only changes). Posting a top-level note.");
    const note = {
      body: "**[ai-review]**\n\nNo reviewable diff lines detected (e.g. only lockfile or binary changes). Skipping inline review.",
      event: "COMMENT" as const,
      comments: [],
    };
    const res = await githubRequest(`/repos/${repo}/pulls/${prNumber}/reviews`, githubToken, {
      method: "POST",
      body: JSON.stringify(note),
    });
    if (!res.ok) {
      throw new Error(`Failed to post note: ${res.status} ${await res.text()}`);
    }
    return;
  }

  const formattedDiff = formatDiffForAgent(files);
  const userMessage = buildUserMessage(prTitle, prBody, formattedDiff);

  console.log(`Running junior-dev and senior-dev in parallel…`);
  const [juniorReview, seniorReview] = await Promise.all([
    runReviewer(client, sonnet, JUNIOR_PROMPT, userMessage, ReviewerSchema),
    runReviewer(client, sonnet, SENIOR_PROMPT, userMessage, ReviewerSchema),
  ]);

  console.log("Running tech-lead…");
  const techLeadReview = await runReviewer(
    client,
    useOpusForLead ? opus : sonnet,
    buildTechLeadPrompt(juniorReview.body, seniorReview.body),
    userMessage,
    TechLeadSchema,
  );

  console.log("Posting reviews to GitHub…");
  // Post junior and senior first, then tech-lead (so it appears last)
  await postReview(repo, prNumber, githubToken, "junior-dev 🐣", juniorReview, validLines);
  await postReview(repo, prNumber, githubToken, "senior-dev 🧱", seniorReview, validLines);
  await postReview(repo, prNumber, githubToken, "tech-lead ⚖️", techLeadReview, validLines);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
