---
id: 0003-m6-paid-calls-verified
from: atlas
to: rachel
status: open
blocking: no
---

# M6's two paid calls now work — three bugs found doing it

## 2026-08-30 · atlas

Your tracker's last line said the remaining M6 work was `ContextSheet.tsx` plus "a real
`OPENAI_API_KEY`/`OPENROUTER_API_KEY` to exercise the two paid calls live." I have both keys
and a live Postgres, so I did that half. **Both paid paths now work end to end.** Pushed to
`main` as `bb853d7`.

Real output from `POST /assistant/ask`, asking who Lydia was:

> Lydia was a dealer in purple cloth from Thyatira and a worshiper of God who listened to
> Paul's message; the Lord opened her heart, she and her household were baptized, and she
> persuaded Paul and his companions to stay at her house [Acts 16:11]. The mention of purple
> cloth highlights her trade and likely social standing, as purple dye was expensive and
> associated with wealth and status.

Grounding confidence `medium`, 5 citations, `ai_spend_ledger` recorded it at **$0.000222**.
87 embedding vectors written for Acts, about $0.001. Your backend is sound — everything
below is plumbing, not design.

## The three bugs

**1 and 2 — the same mistake in both vendor clients.** `OpenAiEmbeddingClient` and
`OpenRouterChatClient` both did `httpx.AsyncClient(base_url=_ENDPOINT)` and then `post("")`.
httpx joins an empty path by appending a slash, so the requests went to `/v1/embeddings/`
and `/api/v1/chat/completions/`.

The OpenRouter one is worth knowing about because of how it *presents*: a bare
`404 Not Found` naming the model. It reads exactly like an unknown model id. I went and
checked all eight of our configured ids against the live 396-model catalogue before I
thought to look at the URL — every one of them exists. If you ever see a 404 naming a model,
suspect the path first.

Neither was catchable by test: every double accepts whatever URL it is handed.

**3 — `.env.example` still described Q-010's superseded plan.** It set
`EMBEDDING_MODEL=BAAI/bge-m3` and `EMBEDDING_DIMENSIONS=1024`, from the *provisional*
self-hosted answer. The owner later answered `Q-010` by choosing paid OpenAI embeddings, and
the code default and migration `0003` both followed that (`text-embedding-3-small`,
`vector(1536)`) — only the env file never moved. Anyone copying `.env.example` got a 400
"invalid model ID", and would have hit a 1024-vs-1536 dimension mismatch even if the model
had existed. Fixed, with the self-hosted vars kept commented out since the decision is
reversible.

Also worth noting for your sandbox: `docker compose restart` does **not** re-read `.env`.
It needs `up -d --force-recreate`. Cost me a confusing minute.

## One thing I did NOT fix — your call

The Lydia answer cites five verses: Acts 16:11, 9:32, 21:1, 8:26, 13:50. Only the first
supports the answer. The other four look like retrieval neighbours — semantically similar
travel narrative, nothing to do with Lydia or purple cloth.

Under pillar 3 that bothers me. Showing five citations implies five sources support the
claim, and four of them do not. A reader checking 8:26 and finding no Lydia learns the
citations are decorative, which is worse than showing one.

Options as I see them: cite only chunks the model actually drew on; threshold on retrieval
score; or keep all five but visually separate "sources used" from "related passages".

**I have not touched it** — it is a genuine product judgement inside your module, and
`Citation.from_chunk()` building citations from retrieved chunks rather than parsing the
model's text is a deliberate anti-hallucination design I do not want to undermine by
guessing. Tell me which way you want it and I will implement, or take it yourself.

## Where that leaves M6

Backend: done and now *proven*, not just code-complete. Remaining is the frontend —
`ContextSheet.tsx` into a live chat thread against `/assistant/ask`. That is squarely yours;
I am staying out of `features/sheets/textual/` as agreed.

If it would help, I can push a `test/` branch that exercises the endpoint from the client
side so you have a known-good request/response shape to build the UI against. Say the word.
