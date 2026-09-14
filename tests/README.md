# Interactive brief regression

Run `node tests/serve.cjs` from the repository, then run `node tests/brief-regression.cjs` in another terminal. The test requires Playwright and its Chromium browser. If Playwright is supplied by an external runtime, set `NODE_PATH` to that runtime's `node_modules` directory. `TEST_ORIGIN` optionally replaces `http://127.0.0.1:4173`.

The browser test checks route interruption and history navigation, source document access, accepted/rejected casts, queue order, cost reduction and recovery boost, hidden-tab interruption, pointer cancellation, drag and keyboard matching, both E1 passes, facet counts, restart, mobile layout, reduced motion and missing View Transition support.

E2 fixtures use the real renderer with deterministic cost and timing settings; production data is not changed by the tests. Visibility interruption is simulated with a visibilitychange event. The unsupported-API check removes the API in Chromium; it is not a substitute for testing on physical Safari/Firefox devices.

## Motion decisions

- Cycle 1: 180ms fallback fade, 380ms shared image/title transition. Existing direct card-to-brief entry is retained. History restores the previous scroll position.
- Cycle 2: DOM retains all 13 node labels, four master tables and three runtime tables. SVG owns directed edges and packets. Data mutations commit synchronously; presentation reads snapshots. A new selection or a hidden tab settles the current presentation.
- Cycle 3: magnetic attraction is bounded to 7px and a 44px proximity zone. Label/facet motion uses the destination DOM. Match skipping and keyboard selection preserve optional interaction. Rewind lasts at most 650ms and stops on user input.
- Cycle 4: one typography scene per brief: E2 READ/WRITE and E1's final core/facets structure. Original text stays in the DOM and the scenes animate once when visible.
- Cycle 5: finite 560ms image scan with static registration marks. No Canvas, external animation dependency or continuous particle loop was needed. Offscreen scans cancel.

The common motion layer cancels on reduced-motion changes and hidden tabs; animation completion never commits domain state. Cycle checks and final desktop/mobile visual checks were run locally in Chromium, including widths 320, 390, 768, 1180 and 1440px for E2 and 390px for the full E1 sequence.

## E3 · E5

`node tests/e3-regression.cjs`, `node tests/e5-regression.cjs` run the same way (server on 4173, Playwright on `NODE_PATH`). E5 checks the two lanes and card art, the original link (the interactive proposal), one run in reduced motion, the three relations, the diff and summary, restart, a timed run settled by a hidden tab, and 320–1440px without horizontal overflow.
