# Demo walkthrough — The Tribunal

A 3–5 minute live demo. Eleven beats, each with a time budget and speaker
notes. Total budgeted talk time is **≈ 4 minutes 10 seconds**, which leaves
slack inside a five-minute slot.

Everything below describes the screen as it actually renders. Nothing here
is aspirational.

---

## Before you start

**Run mode this script assumes: real-provider mode.** The demo shows the
application calling the real Anthropic API through the local proxy, because
that is the product. Two processes must already be running.

> **A real-provider run spends real API tokens.** One run is seven sequential
> model calls (four representatives + three judges). The dev fake-client mode
> below spends **nothing** — use it for every rehearsal.

```sh
# Terminal 1 — the proxy. The API key lives in this process and nowhere else.
ANTHROPIC_API_KEY=<your-api-key> node src/server/anthropicProxy.mjs
```

```sh
# Terminal 2 — the app. Start it from a shell that has no ANTHROPIC_API_KEY set.
VITE_TRIBUNAL_LLM=real npm run dev     # or: npm run build && npm run preview
```

The README writes the first command with an elided placeholder after
`ANTHROPIC_API_KEY=`; substitute your own key there. There is **no**
`npm run proxy` script — start the proxy with `node` exactly as above.

Token-free rehearsal mode, same eleven beats:

```sh
npm run dev     # deterministic fake client; no provider call, no tokens
```

In rehearsal mode the screen carries an extra line above the button —
*"Development preview: these statements and verdicts come from a deterministic
fake LLM client…"* — and every transcript and opinion body is prefixed
`[deterministic test client]`. **That line is absent in the real-provider
demo.** If you see it during the real demo, terminal 2 is running plain
`npm run dev` and nothing is reaching the provider.

**Two-minute pre-flight, before the audience is watching**

1. Terminal 1 prints `ANTHROPIC_API_KEY present: true` and the port it bound
   to. If it says `false`, the key is not in that shell.
2. Terminal 2 prints `Local: http://localhost:5173/`. **Check the port.** If
   5173 was busy Vite silently falls back to 5174, and the proxy's origin
   guard only allows `:5173` and `:4173` by default — the run will then fail
   with an origin error. Free the port, or add the origin to
   `TRIBUNAL_ALLOWED_ORIGINS` in terminal 1.
3. Have the repository open in an editor on a second window or tab for beat 10.
4. The page is one long scrolling column. Scroll to the top before you begin.

---

## The eleven beats

### 1. Introduce The Tribunal — 15s

**On screen:** top of the page. `The Tribunal` as the page's single large
heading, with `The Realm v. Jon Snow` beneath it.

> "This is The Tribunal. It's a small React application that runs a fictional
> legal hearing as a multi-agent reasoning workflow: seven language-model
> agents, orchestrated by ordinary deterministic code. The guiding principle
> is *code orchestrates, the LLM decides* — the code controls who speaks, in
> what order, and with what context; the model supplies every word of the
> actual reasoning."

---

### 2. State the case — 20s

**On screen:** the **Case background** section — a neutral paragraph, then a
sub-heading *The question before the tribunal*, the question itself, and a
"Considering:" list of four items.

> "After King's Landing surrendered, Daenerys Targaryen used Drogon against
> civilians and announced the campaign would continue. Jon Snow then killed
> her, while she was unarmed and not attacking him. The tribunal decides one
> question — was that killing justified as the necessary defense of others and
> of the realm?"

**Note:** the four considerations on screen are *what Jon knew at the time,
the scale of the threatened harm, whether safer alternatives existed,* and
*Jon's lack of formal authority*. The summary text deliberately states no
conclusion — point that out if asked.

---

### 3. The four representatives — 20s

**On screen:** two sections, **Defense representatives** then **Prosecution
representatives**, each a pair of cards with a name and a one-line descriptor.

> "Four representatives argue the case. Jon Snow and Tyrion Lannister for the
> defense; Daenerys Targaryen and Grey Worm for the prosecution."

**Note:** the descriptors are style, not stance — "Speaks plainly…",
"Analytical and ironic…". Worth one sentence: *an assigned side fixes a
representative's role only. Their arguments aren't scripted, and the prompts
explicitly allow them to concede a difficult fact or revise a position.*

---

### 4. The three judicial approaches — 25s

**On screen:** the **Independent judicial panel** section — three cards.

> "Three judges then rule, each modelled on a different real Israeli
> jurist's reasoning method. The Aharon Barak model is systematic,
> rights-centered and principle-driven. The Menachem Elon model is
> tradition-minded, historical, cautious about excessive judicial power. The
> Meir Shamgar model is institutional, restrained and fact-focused."

**Note:** the display names include the word *model* on purpose — these are
reasoning styles, not the people. Each profile says **how** a judge reasons
and never **what** they conclude; no verdict is hard-coded anywhere.

---

### 5. Press Start Tribunal — 10s

**On screen:** the **Begin** section at the bottom of the page, with a single
`Start Tribunal` button. Click it once.

> "That's everyone. Let's run it."

**Note:** the button immediately disables and a status line appears beneath
it reading *"Running the tribunal. Jon Snow, Tyrion Lannister, Daenerys
Targaryen and Grey Worm speak in turn, then the three judges reason
independently."* It is one fixed notice, not a per-speaker progress bar —
don't promise the audience live per-turn updates.

---

### 6. What is happening while it runs — 30s

This beat covers the wait. A real run took **20–30 seconds** end to end when
it was measured (seven sequential calls; see `src/mission-003/evidence/`).
Keep talking.

> "Seven model calls are going out, one at a time. The representatives run
> sequentially, and each one is given the transcript of everyone who spoke
> before — so Tyrion sees Jon's statement, Daenerys sees both, Grey Worm sees
> all three. Then the transcript is frozen, and each judge gets the identical
> finished record plus their own reasoning profile. No judge sees another
> judge's opinion."

**Note, if asked:** *independent* means isolated context, not parallel
execution — all seven calls run one after another in a single process. And
the representatives don't message each other; a later speaker simply receives
the earlier text as prompt context.

---

### 7. The transcript — 30s

**On screen:** a **Transcript** section has appeared, plus a status line
reading *"The tribunal has finished. The transcript and the three judicial
opinions are below."* The transcript is a numbered list of four entries; each
shows the speaker's name, a `Defense` or `Prosecution` label, and their
statement.

> "Here's what was actually said, in the order it was said: Jon Snow, Tyrion
> Lannister, Daenerys Targaryen, Grey Worm."

**Note:** scroll through one or two entries rather than reading them out. Say
plainly that the name and side label are the *only* things the application
added — the body text is returned by the model and rendered unmodified.

---

### 8. The three judicial opinions — 30s

**On screen:** a **Judicial opinions** section below the transcript. A lead-in
paragraph, then three entries in order — Aharon Barak model, Menachem Elon
model, Meir Shamgar model — each with a `Verdict: Justified` or
`Verdict: Not justified` line above its reasoning.

> "And here are the three opinions. Each judge reached a verdict and wrote
> their own reasoning to support it."

**Note:** do **not** rehearse which way the judges will go — the verdicts are
the model's and can differ between runs, including across all three judges.
If they happen to agree, say they happened to agree this time. Pick one
opinion and show that its reasoning reads in that judge's style.

---

### 9. There is no combined verdict — 20s

**On screen:** the lead-in line under **Judicial opinions**, which reads
*"Each judge reasoned independently. These opinions are reported separately
and are not combined into a single verdict."* Scroll to the bottom: the page
ends after the third opinion.

> "Notice what isn't here. There's no tally, no majority, no line that says
> 'the tribunal finds'. That's deliberate. Combining the three would be the
> application deciding the case, and the whole point is that it doesn't — the
> data type the engine returns has no field for a combined verdict to live in."

---

### 10. Architecture and code organization — 30s

Switch to the editor. Have `ARCHITECTURE.md` and the `src/` tree visible.

> "The structure follows the flow. `src/data` is the single source of truth —
> the case facts, the seven agent profiles and the prompt builders; no tribunal
> content is written into a component. `src/llm` is the client seam: one
> interface, with a deterministic fake for tests and a real client for the
> provider. `src/tribunal` is the engine — the speaking order, the transcript
> loop and the verdict parser. `src/components` just renders what came back.
> And `src/server/anthropicProxy.mjs` is a standalone Node script that holds
> the key."

**Note:** the honest framing to offer here — the speaking order, transcript
accumulation, context delivery, verdict validation and UI state are all
deterministic code. The arguments, the interpretation and the judicial
conclusions are entirely the model's. The verdict parser accepts exactly
`JUSTIFIED` or `NOT_JUSTIFIED` and throws on anything else; it never guesses
or defaults.

---

### 11. The API secret never reaches the browser — 20s

Switch to terminal 1.

> "One last thing. The API key is only ever in this proxy process. The browser
> bundle has no key, no Anthropic hostname and no auth header in it — it can
> only POST to the local endpoint `/api/llm/complete`. The proxy logs whether
> a credential is present as a boolean and never prints the key itself, and a
> test in the repo fails the build if browser-side code ever starts handling
> credentials."

**On screen:** the proxy's startup line — `ANTHROPIC_API_KEY present: true` —
and its request log, which shows method, path and status only, never bodies.

**Note:** the enforcing test is `src/llm/secretBoundary.test.ts`. If someone
asks whether that's verified rather than asserted: the production bundle was
grepped after a real build and contains none of those three things.

---

## Recovery notes

| If this happens | Say / do |
| --- | --- |
| The run fails with a red error | Read it out. The message leads with *"The tribunal could not be completed, so no transcript or verdict is shown."* Point out that it fails honestly and never falls back to the fake client or invents a result. The button re-enables — you can retry. |
| An origin error appears | Vite is on the wrong port (see pre-flight step 2). |
| The error says the proxy could not be reached | Terminal 1 died, or is on a different port. The message quotes the command to restart it — `node src/server/anthropicProxy.mjs`. |
| `ANTHROPIC_API_KEY present: false` | Terminal 1 has no key in its environment. |
| You are out of time | Beats 6 and 10 are the compressible ones. Beats 8, 9 and 11 are the ones worth keeping. |
