# Income table and date picker — gate review

- **recommendation:** REJECT
- **visualVerdict:** REVISE
- **confidence:** HIGH
- **goalId:** `income-table-date-picker`
- **reviewType:** Visual fidelity and precision, read-only source review plus live browser reproduction

## Original intent

Change only the Income tab so its table reads `DATE | PARTICULAR | RECEIPT / REFERENCE NO. | REMARKS | AMOUNT`, rebalance those columns, and provide a date-picker input in the Income entry form. Preserve unrelated visuals and behavior.

## Desired outcome

At the supported desktop viewport, users can scan all five Income columns through the existing dense-table horizontal scroll model, no label is internally clipped, monetary values remain right-aligned, and the labeled Date field supports typing and calendar selection without focus or popover-placement regressions. Other report tabs remain unchanged.

## Recommendation and blockers

### Blocker 1 — unrelated Payment-tab changes

- **violatedCriterion:** `SC-04 — No accidental unrelated visual or behavioral changes outside the Income scope`
- **observation:** The sole changed source file also renames Payment fields and columns, uppercases Payment headers, adds four Payment type choices and badge colors, replaces Payment sample data, and applies the new date picker to Payment. These are visible, functional Payment-tab changes unrelated to the stated Income-only intent.
- **evidencePointer:** `git diff -- src/renderer/src/components/cashier-reports-content.tsx`; production source at `src/renderer/src/components/cashier-reports-content.tsx:32`, `:75`, `:96`, `:152`, `:207`, `:301`, `:375`, and the generic date branch at `:395`.
- **requiredResolution:** Remove the Payment-specific hunks or provide an explicit criterion expanding the task to include Payment, then recapture and re-review Income and Payment.

## User outcome review

| Criterion | Result | Evidence |
|---|---|---|
| `SC-01` Exact Income header order and copy | PASS | Source `incomeColumns` at lines 135–149 and live DOM row: `DATE`, `PARTICULAR`, `RECEIPT / REFERENCE NO.`, `REMARKS`, `AMOUNT`. |
| `SC-02` Width balance and unclipped labels | PASS at reviewed desktop viewport | Widths are 15/25/22/28/10%. Live 1360×633 metrics: 900px table inside a 492px horizontal scroller; receipt/reference cell 241px and its sort button stayed fully inside its cell. Right-scrolled state exposed `REMARKS` and `AMOUNT` completely. The initial cutoff is the declared scroll boundary, not text truncation. |
| `SC-03` Income date picker visible and operable | PASS | Live DOM exposed associated `Date` textbox plus `Select Date` button. Popover was a semantic dialog, measured fully within the viewport at x1087/y142, 236×276px. Selecting July 16 set the input to `2026-07-16`, closed the dialog, and returned focus to the trigger. |
| `SC-04` No unrelated visual changes | FAIL | Payment scope drift listed in Blocker 1. |
| Focus/accessibility | PASS for requested path | Add Entry focused the Date textbox; label/id association and explicit trigger name were present; calendar navigation and day buttons had accessible names. |
| Responsive behavior | NOTE | At 1280×800 the table scroller retained 668px. At 768×800 it narrowed to 156px but remained horizontally scrollable. At 375×800 the center table region collapsed to 0px and the three-panel shell relied on outer horizontal scrolling. This is poor mobile reflow, but the brief names an Electron desktop surface and does not state a mobile/minimum-width criterion, so it is not a blocker. |

## Evidence trace

- Default desktop, form open: viewport 1360×633; document width remained 1360 (no page-level overflow); Income table scroller `clientWidth=492`, `scrollWidth=900`, `overflow-x=auto`.
- Initial table position: `DATE` and `PARTICULAR` fully visible; the long receipt/reference header reaches the scroller edge as expected.
- Right-scrolled table position: `scrollLeft=408`; `REMARKS` and `AMOUNT` fully visible; all data-header sort buttons fit their own cells.
- Date field: textbox width 236px; calendar trigger width 24px; Date textbox received focus when the form opened.
- Calendar settled state: visible semantic dialog, fully composited after visibility wait, entirely inside viewport.
- Date selection: day button `Today, Thursday, July 16th, 2026` produced exact value `2026-07-16`; popover count became zero and focus returned to `Select Date`.
- Responsive captures inspected in-session at 1280×800, 768×800, and 375×800.

## Findings

1. **[product] [BLOCKING] Scope fidelity:** Payment has visible and behavioral changes outside the Income brief. Evidence: source/diff pointers in Blocker 1.
2. **[product] [NOTE] Narrow-width reflow:** the center table reaches 156px at 768 and 0px at 375, shifting responsibility to nested/outer horizontal scrolling. Evidence: live responsive metrics above. No stated mobile criterion was available.
3. **[product] [NOTE] Typed-invalid date synchronization:** after a valid selection, typing an invalid/partial value updates `value` but leaves the prior `date` selection in state (`ReportDatePicker`, lines 318–329). The brief only requires successful date selection, so this is not blocking.
4. **[evidence] [NOTE] No persisted screenshot artifact:** no task screenshot file was provided or found under the workspace. I reproduced and directly inspected fresh browser screenshots, but did not persist new screenshots because the review was read-only apart from this mandated report artifact.

## Programming and remove-ai-slops pass

- Diff scope contains one production TSX file and no changed tests.
- No excessive/useless, deletion-only, removal-verification, tautological, implementation-mirroring, or prose-pinning tests were added; there are no changed tests to create false confidence.
- No new dependency was introduced; `date-fns`, `lucide-react`, and the shared Calendar/Popover/InputGroup primitives already exist in `package.json` and the component layer.
- The date picker is a direct shared-primitive composition, not a hand-rolled calendar or unnecessary parsing abstraction.
- The Payment additions are scope drift and therefore blocking under `SC-04`.
- The touched component is oversized: 515 pure LOC now versus 434 at `HEAD` (+81). This is maintenance burden under the programming skill, but file size was not a stated success criterion and the file was already oversized; recorded as a NOTE, not a blocker.
- The duplicate `date`/`value` state can desynchronize for invalid typed edits; noted above. It does not fail the named successful-selection criterion.

## Verification reproduced

- `npm run typecheck:web` — PASS.
- `npx eslint --no-cache src/renderer/src/components/cashier-reports-content.tsx` — PASS (no output).
- `git diff --check` — no whitespace errors; only the existing Git LF→CRLF working-copy warning.
- Fresh live browser path at `http://localhost:5174/` — PASS for Income header order, horizontal access, focus, calendar compositing, and exact date selection.

## Checked artifact paths

- `D:/MarkDev/POSv2/cashiers-report/src/renderer/src/components/cashier-reports-content.tsx`
- `D:/MarkDev/POSv2/cashiers-report/src/renderer/src/components/report-data-table.tsx`
- `D:/MarkDev/POSv2/cashiers-report/src/renderer/src/components/ui/input-group.tsx`
- `D:/MarkDev/POSv2/cashiers-report/src/renderer/src/components/ui/calendar.tsx`
- `D:/MarkDev/POSv2/cashiers-report/src/renderer/src/components/login-form.tsx`
- `D:/MarkDev/POSv2/cashiers-report/DESIGN.md`
- `D:/MarkDev/POSv2/cashiers-report/package.json`
- Working-tree diff for the sole changed source file
- Live rendered surface: `http://localhost:5174/`

## Exact evidence gaps

- `omo ulw-loop status --json` wrapper failed; direct Node invocation reported `ULW_LOOP_PLAN_MISSING`, so no `currentAttemptDir` exists and this report uses the required fallback path.
- `.omo/evidence` contained no executor screenshot, code-review report, manual-QA matrix, or notepad artifact before this report was created.
- No screenshot path was supplied in the request and no relevant screenshot file was found in the workspace.
- No automated component/E2E test covers the Income header/date-picker behavior. Fresh live browser reproduction covers the requested visual gate, but durable regression coverage remains absent.
- No independent visual-review subagent tool was available in this session; the direct gate pass inspected source, DOM, computed geometry, focus state, and fresh screenshots itself.

## Blocking

Yes. Remove or explicitly authorize the Payment-tab changes, then rerun the visual gate on fresh evidence.

## Final gate addendum - current revision `2b4282619b1a95cc9eb9536482ad2b177b07e3b9`

- **recommendation:** REJECT
- **visualVerdict:** REVISE
- **confidence:** HIGH
- **reviewedState:** target source at `master` commit `2b42826`; the source bytes reviewed live before the concurrent commit match the committed diff. After review, unrelated untracked `.backlog/tasks/`, `ui/badge.tsx`, `ui/empty.tsx`, and `lib/installment-history.ts` paths appeared concurrently and were excluded.

### Additional blocker 2 - Clear does not reset the controlled Income date

- **violatedCriterion:** `SC-FI-01 - The requested Income date-picker must preserve the entry form's existing functional controls`
- **observation:** After selecting `Today, Thursday, July 16th, 2026`, the Date textbox contained `2026-07-16`. Activating the visible `Clear` button left the textbox at `2026-07-16`. The new field is controlled by local `value` state, while the form still relies only on native `type="reset"`; no reset handler clears that state.
- **evidencePointer:** Fresh live DOM reproduction at `http://localhost:5174/`; `src/renderer/src/components/cashier-reports-content.tsx:305-308`, `:312-321`, and `:516-532`.
- **requiredResolution:** Wire form reset to clear both the text value and selected calendar date, then reproduce Date selection followed by Clear and prove the textbox is empty and the calendar has no stale selection.

### Additional blocker 3 - Income date state leaks into Payment

- **violatedCriterion:** `SC-04 - No accidental unrelated visual or behavioral changes outside the Income scope`
- **observation:** With the entry panel open, selecting `2026-07-16` in Income and then switching to Payment produced a Payment Date textbox already containing `2026-07-16`. Both tabs render the generic Date branch, and the keyed `Date` child is reconciled as the same `ReportDatePicker` instance across tab changes.
- **evidencePointer:** Fresh live DOM reproduction returned `{ paymentDateCount: 1, paymentDateValue: '2026-07-16' }`; source at `src/renderer/src/components/cashier-reports-content.tsx:298-308`, `:363-380`, `:395-396`, and `:521`.
- **requiredResolution:** Keep the change Income-scoped or isolate/reset date-picker state by report tab. Reproduce Income -> Payment switching and prove Payment retains its prior behavior and does not inherit Income state.

### Direct final-gate checks

- Exact Income DOM headers and order: PASS.
- Income form labels and accessible names: PASS.
- Calendar dialog semantics, named navigation/day controls, and Today -> `2026-07-16`: PASS.
- Amount header/cells right aligned: PASS from computed style.
- `npm run typecheck`: PASS against the reviewed source.
- `npm run lint -- --no-cache`: PASS against the reviewed source.
- `git diff --check`: no whitespace errors; LF-to-CRLF warning only before the concurrent commit.
- LSP diagnostics: EVIDENCE GAP; TypeScript server is installed, but the OMO LSP daemon timed out twice. Project `tsc --noEmit` passed.
- Tests: EVIDENCE GAP; no test script or matching test/spec files cover this behavior.
- Responsive evidence: current reviewer directly measured 1280x800 only. At form-open state the 900px table used a 412px horizontal scroller and the right-side Date field remained visible. Fresh 900/768/375 reruns could not be completed because the Electron dev process repeatedly exited. The earlier report's claimed responsive captures were consulted but not treated as independent proof.

### Programming and remove-ai-slops confirmation

- The prior report explicitly covers excessive/useless, deletion-only, requested-removal, tautological, implementation-mirroring, and prose-pinning test classes; no tests were added, so none create false confidence.
- Direct diff pass found no new dependency and no hand-rolled calendar. Existing shared Calendar, Popover, InputGroup, and date-fns primitives are reused.
- Direct pass confirms scope drift, missing regression coverage, the 515-pure-LOC maintenance burden, controlled/reset lifecycle failure, cross-tab state leakage, and typed-invalid date/selection desynchronization. Only the two functional/scope failures above block; module size and absent durable tests remain notes because they are not standalone stated success criteria.

### Additional checked artifacts and evidence gaps

- Checked commit and history: `git show 2b4282619b1a95cc9eb9536482ad2b177b07e3b9`, `git reflog -5`, clean `master` status.
- Checked default Electron viewport declaration: `src/main/index.ts` (`900x670`).
- No ULW plan/currentAttemptDir exists; direct CLI returned `ULW_LOOP_PLAN_MISSING`, so this remains the fallback report path.
- No executor screenshot, separate code-review report, manual-QA matrix, or notepad artifact path was supplied. The committed report itself is the only review artifact found under `.omo/evidence`.

### Final blocking

Yes. Resolve Payment scope drift, stop Income date state from crossing tabs, and make Clear reset the controlled date before approval.
