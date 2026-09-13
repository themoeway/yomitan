# Optional Japanese grammar wildcards

PLAN-1: Add one **Japanese grammar wildcards** switch under **Advanced → Translation**. Store it as `translation.enableGrammarWildcards`, with a default of `false`. It applies to all enabled dictionaries in the active profile, like the other translation settings.

PLAN-2: Keep the existing dictionary formats and schemas. Treat U+FF5E `～` inside a term or reading as a gap only when the setting is on and the lookup language is Japanese. Each gap matches one or more Unicode characters. Require literal text at both ends and between gaps. Support `X～Y` and `X～Y～Z`. Keep ASCII `~`, wave dash `〜`, leading/trailing markers, and repeated markers literal. Match from the start of the scanned text; the normal scan resolution and scan length still apply.

PLAN-3: Reuse the existing translator candidates, including normalization and deinflection. Collect unique literal prefixes followed by `～`, and issue one bulk prefix lookup through the existing expression/reading indexes. Match only patterns returned by enabled dictionaries. Use string matching with no generated regular expressions or recursive backtracking. Feed matches through the existing result grouping, metadata, and source-length paths. No full dictionary scan, new database index, import step, or pattern cache is needed. Dictionary imports and deletions therefore take effect through normal database reads.

PLAN-4: The disabled path must perform no wildcard queries or matching. Preserve the existing translator benchmark and add enabled benchmarks for dictionaries with and without grammar entries. Add a deterministic test that compares database calls and ordinary results with the option off. Local wall-clock measurements are diagnostic; CodSpeed CI is the controlled performance check.

PLAN-5: Follow the repository's Vitest practice: table-driven matcher cases, real dictionary archives imported into fake IndexedDB, translator assertions, options upgrade/default tests, and dictionary schema validation. Cover multiple gaps, long prefixes, Unicode, literal punctuation, term and reading matches, duplicate results, source lengths, text replacements, deinflection, disabled dictionaries, non-Japanese lookups, and existing explicit prefix/suffix searches.

PLAN-6: Follow the existing Playwright extension fixture and real settings import flow. Import the same small fixture into two dictionaries. Verify the default is off, literal searches still work, the switch persists after reload, both dictionaries match when enabled, disabling one dictionary removes its results, and switching the feature off restores ordinary lookup. Use behavioral assertions for the feature. Run existing integration tests and compare the visual suite against a baseline from the same platform where available; do not replace snapshots to hide failures.

PLAN-7: Run JavaScript lint, all TypeScript projects, HTML validation, JSON checks, Markdown formatting, unit tests, options tests, build checks, Playwright tests, and translator benchmarks. Record commands, results, and any environment limits below. Commit messages must explain why the change exists and its impact.

## Prior attempt

REF-1: [PR #2363](https://github.com/yomidevs/yomitan/pull/2363) adds a Japanese preprocessor that generates up to 51 variants. Its CodSpeed report shows 123.5 ms versus 329.6 ms for term lookup, or a 62.53% efficiency regression. The new implementation avoids expanding the language processor pipeline.

REF-2: The PR's five Playwright shard jobs report success, while the final report job reports failure. The workflow masks shard command failures with `|| true`, so shard status alone cannot establish test success. Historical logs returned HTTP 410 during this review; the precise failing tests or report step could not be recovered. Validate this implementation with fresh browser runs.

## Results

RESULT-1: Implemented on `codex/optional-grammar-wildcards`, based on upstream `d34832d7`. The fork is [ganqqwerty/yomitan](https://github.com/ganqqwerty/yomitan). No dictionary schema, import format, or database version changed. The existing backend passes the profile setting to both search-page and popup lookups, including the offscreen path.

RESULT-2: The full Vitest suite passed with 4,881 tests passed and 46 skipped. The separate options suite passed all 25 tests. The matcher has 100% statements, branches, functions, and lines covered. Tests import real version 3 dictionaries through the existing archive and fake IndexedDB helpers. They also cover dictionary deletion and reimport.

RESULT-3: JavaScript lint, all four TypeScript projects, HTML, CSS, Markdown, JSON/schema validation, the full extension build, and the dry-run build check passed. Lint reports one existing warning in `anki-note-builder.js`. JSON checks must run after Playwright teardown because the browser setup temporarily creates `ext/manifest-old.json`.

RESULT-4: The new Playwright test passed five consecutive runs, without retries. It covers the default, persisted toggles, two dictionaries, disabling a dictionary, literal searches, multiple gaps, reading patterns, a real Shift-hover popup, and selected source text. The test waits for the settings page's ready signal before changing controls. Use Node 22 for these runs; the pinned Playwright 1.49.1 stalled during collection under local Node 24.15.0.

RESULT-5: All 19 existing visual tests and the clipboard integration test passed on the final run with CI-style single-worker/retry settings. An earlier parallel run had one transient popup screenshot difference. The first comparison against untouched upstream passed all 16 popup screenshots and found only the intended new settings row. I inspected that row and replaced only the local advanced-settings snapshot. The repository keeps snapshots in CI artifacts and ignores them in git. Upstream CI will show this intended settings difference until its baseline is accepted.

RESULT-6: The existing `anki add` integration test fails at `integration.spec.js:103` because the save button stays invisible. It fails the same way on untouched upstream. It remains unchanged and enabled in the repository. The final broad diagnostic run excluded this known failure; this is not a claim that the entire upstream Playwright suite is green.

RESULT-7: Performance measurements are recorded below. Local wall-clock runs use the existing benchmark inputs with CodSpeed instrumentation removed only in a temporary config. The checked-in benchmarks still use the repository's CodSpeed plugin. Controlled CodSpeed CI and Linux screenshot validation remain upstream checks.

PERF-1: Median of three alternating upstream/feature wall-clock runs on this Mac, with no browser tests running. Values are the mean time for a whole benchmark batch, then the median across runs.

| Benchmark                        | Upstream | Feature off | Feature on |
| -------------------------------- | -------: | ----------: | ---------: |
| Existing 47 term lookups         | 31.10 ms |    31.11 ms |   41.35 ms |
| Seven grammar-dictionary lookups |        — |     6.03 ms |   10.06 ms |

PERF-2: The default path differs by about 0.04%, below local timing noise. Enabling the feature adds about 33% to the no-pattern batch because it searches the extra index ranges. The grammar batch also returns extra entries when enabled, so its two columns perform different work. These numbers do not claim zero cost when enabled, and they are not directly comparable to the older PR's CodSpeed measurements.

## Reproduce the checks

CHECK-1: Run normal project checks after Playwright has restored the manifest:

```sh
npm ci
npm run build:libs
npm run test:js
npm run test:ts
npm run test:unit
npm run test:unit:options
npm run test:json
npm run test:html
npm run test:css
npm run test:md
npm run test:build
npm run build
npm run bench -- --run benches/translator.bench.js
```

CHECK-2: Run the feature browser test with the repository's extension fixture:

```sh
npx playwright install chromium
npm exec --yes --package=node@22 -- node node_modules/playwright/cli.js test test/playwright/grammar-wildcards.spec.js --workers=1 --repeat-each=5 --reporter=line
```

CHECK-3: For visual comparisons, follow `.github/workflows/playwright.yml`: obtain its dictionaries and baseline screenshots, then run the visual suite. A local baseline must use the same operating system and fonts. I generated the baseline from the untouched upstream checkout, reviewed the one intended settings change, and ran:

```sh
npm exec --yes --package=node@22 -- node node_modules/playwright/cli.js test --grep-invert 'anki add' --workers=1 --retries=2 --reporter=line
```

CHECK-4: Keep the feature test in the normal Playwright suite. The command above excludes Anki only for the local diagnosis described in RESULT-6; no CI test filter or snapshot masking was added.
