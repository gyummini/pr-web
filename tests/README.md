# Interactive brief regression

Run everything with two commands from `tests/`:

```bash
cd tests && npm run setup   # 처음 한 번 — playwright + chromium
npm test                    # 서버를 직접 띄우고 다섯 스위트를 돌린 뒤 내린다
```

`npm test` runs `run-all.cjs`, which starts `serve.cjs` on 4173, waits for it to answer, runs the five suites and always stops the server. Individual suites: `npm run test:brief`, `test:e3`, `test:e5`, `test:play`, `strings:check`. `TEST_ORIGIN` replaces `http://127.0.0.1:4173` and then the server is not started.

`package.json` lives in `tests/`, not at the repository root — Vercel treats a root `package.json` as a Node project and would turn the static deploy into a build. The site itself has no dependencies and no build step.

The browser test checks route interruption and history navigation, source document access, accepted/rejected casts, queue order, cost reduction and recovery boost, hidden-tab interruption, pointer cancellation, drag and keyboard matching, both E1 passes, facet counts, the end buttons (original document and back to the portfolio — the restart button was removed on 10/10), the E2 conclusion opening after the first cast with its line under the deck and the used cell shown inside its table box, phone sheets that keep their words, mobile layout, reduced motion and missing View Transition support.

E2 fixtures use the real renderer with deterministic cost and timing settings; production data is not changed by the tests. Visibility interruption is simulated with a visibilitychange event. The unsupported-API check removes the API in Chromium; it is not a substitute for testing on physical Safari/Firefox devices.

## Motion decisions

- Cycle 1: 180ms fallback fade, 380ms shared image/title transition. Existing direct card-to-brief entry is retained. History restores the previous scroll position.
- Cycle 2: DOM retains all 13 node labels, four master tables and three runtime tables. SVG owns directed edges and packets. Data mutations commit synchronously; presentation reads snapshots. A new selection or a hidden tab settles the current presentation.
- Cycle 3: magnetic attraction is bounded to 7px and a 44px proximity zone. Label/facet motion uses the destination DOM. Match skipping and keyboard selection preserve optional interaction. Rewind lasts at most 650ms and stops on user input.
- Cycle 4: one typography scene per brief: E2 READ/WRITE and E1's final core/facets structure. Original text stays in the DOM and the scenes animate once when visible.
- Cycle 5: finite 560ms image scan with static registration marks. No Canvas, external animation dependency or continuous particle loop was needed. Offscreen scans cancel.

The common motion layer cancels on reduced-motion changes and hidden tabs; animation completion never commits domain state. Cycle checks and final desktop/mobile visual checks were run locally in Chromium, including widths 320, 390, 768, 1180 and 1440px for E2 and 390px for the full E1 sequence.

## E3 · E5

`node tests/e3-regression.cjs`, `node tests/e5-regression.cjs` run the same way (server on 4173, Playwright on `NODE_PATH`). E5 checks the two lanes and card art, the original link (the interactive proposal), the cue and prompt on the run button, everything the set adds in one cell, the one-line caption (read from the data, so final copy needs no test change), the three relations, the end buttons without restart, the phone scroll to the result after the first pick, the 'one card' badge inside the picture, a timed run settled by a hidden tab, and 320–1440px without horizontal overflow. E3 also checks that the shortage notice fades after about two seconds and is gone once the materials are in, and the PC notice on narrow screens.

## On-screen text

`node tools/strings.cjs check` (also run by `npm test`) keeps `Text/strings.csv` — the list of strings that are not final yet — in step with the data: every key points at a real string, its text matches, every `[임시]` string is listed as DRAFT, data files stay in `JSON.stringify(…, null, 2)` form, no Korean text is hardcoded in `assets/js`, and every `ui.` key the code reads exists in `콘텐츠_화면문구.json`. `npm run strings` writes the GPT request (`Text/GPT_요청문.md`); `npm run strings:apply -- <answer file>` puts GPT's answer (`key = text` lines) into the data verbatim and marks the rows FINAL.
