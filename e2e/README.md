# End-to-end walkthroughs

Playwright specs that drive the Expo **web** build unattended, in the Chrome already
installed on this machine.

The definition of done for a feature is a clean walkthrough, not a green unit suite
(CLAUDE.md, "The walkthrough loop"). **The reference document is
[`docs/qa/WALKTHROUGH.md`](../docs/qa/WALKTHROUGH.md)** — what the walkthrough covers, how
to add a step, and what it deliberately does not cover yet. This file is only a map of the
directory.

```bash
pnpm walkthrough          # start the web build, walk the app, tear it all down
```

There is no browser to install first. `playwright.config.ts` sets `channel: 'chrome'`, and
`npx playwright install` is forbidden — it downloads software, and the standing constraint
is packages only (`docs/decisions/DECISIONS.md` §1.3).

## The directory

| Path                         | What it is                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-walkthrough.mjs`        | The entry point behind `pnpm walkthrough`. Starts the web build if nobody else has, waits on a real HTTP response, runs the suite, and kills the whole process tree afterwards — on success, on failure, and on Ctrl-C. |
| `walkthrough/*.spec.ts`      | The walkthrough itself: ten numbered chapters, launch through error states.                                                                                                                                             |
| `support/`                   | The harness. Test-id contract, page probes, standing audits, the step recorder, diagnostics, and the staged API outage.                                                                                                 |
| `shell.spec.ts`              | The original routing scaffold check. It asserts on placeholder copy, so it is expected to go red as the real screens land; delete it with the last `PlaceholderScreen`.                                                 |
| `inline-badge-spike.spec.ts` | Drives `/spike/badges`. Delete it with the spike route once the reader renders badges for real.                                                                                                                         |

## The support layer

| Module                                                    | Responsibility                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test-ids.ts`                                             | The agreed vocabulary between the app's `testID` props and this harness.                            |
| `fixtures.ts`                                             | The `test` object every chapter imports: diagnostics attached, viewport named, step recorder ready. |
| `steps.ts`                                                | `walkthrough.step()` — perform, photograph, audit.                                                  |
| `audits.ts`                                               | The standing audit run after every step, and the scripture-serif assertion.                         |
| `probes-layout.ts` · `probes-text.ts` · `probes-theme.ts` | Measurements taken inside the page. Each documents the bug it exists to catch.                      |
| `diagnostics.ts`                                          | Console errors and failed requests, with a narrow, justified allowlist.                             |
| `api-outage.ts`                                           | Cuts the page off from the API deterministically, instead of stopping a container.                  |
| `journeys.ts`                                             | The shared moves — launch, open a tab, open the reader — and the facts every chapter agrees on.     |
| `viewports.ts`                                            | The three widths and the two breakpoints they straddle.                                             |
| `run-id.ts`                                               | One run id shared by the main process and every worker, and where its evidence goes.                |
| `global-setup.ts`                                         | Warms the first cold Metro bundle so no chapter absorbs it, and writes `run.json`.                  |
| `runner-server.mjs`                                       | Starting the dev server, and proving the port is free again afterwards.                             |
| `runner-utils.mjs`                                        | The run summary grouped by cause, and pruning old runs.                                             |
