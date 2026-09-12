# Founder Mission 001 — The Tribunal (authoritative brief)

This file is the complete, verbatim Founder specification for Mission 001.
It is the authoritative source for scope, canonical facts, and character/
judicial profiles. Do not contradict it; if anything here is ambiguous,
prefer the smallest-reasonable interpretation described in "Keep The
Product Simple" below, and only escalate to the Founder for genuine
Founder-level ambiguity.

## Mission

Build the initial foundation for a small academic project called The
Tribunal. The product must remain as simple as reasonably possible. Do
not over-engineer the application just because an autonomous multi-agent
development team is available. The development *process* may use the
full AutonomousDevTeam workflow, but the PRODUCT itself should use the
smallest sound architecture that clearly demonstrates the academic
multi-agent concept.

## Project Concept

The Tribunal is a small web application that simulates a fictional legal
tribunal around: **The Realm v. Jon Snow**.

The central question is: Was Jon Snow's intentional killing of Daenerys
Targaryen justified as the necessary defense of others and of the realm,
considering:
- what Jon knew at the time,
- the scale of the threatened harm,
- whether safer alternatives existed,
- and Jon's lack of formal authority?

## Tribunal Participants

Four representative agents.

Defense:
1. Jon Snow
2. Tyrion Lannister

Prosecution:
3. Daenerys Targaryen
4. Grey Worm

Three independent judicial agents:
1. Aharon Barak model
2. Menachem Elon model
3. Meir Shamgar model

IMPORTANT: The assigned procedural side determines ONLY the
representative's role. Do NOT hard-code factual conclusions, specific
arguments, agreement or disagreement, final positions, or judge verdicts.
The LLM must reason from the canonical case facts and the tribunal
discussion. The three judges must reach their decisions independently.
Each judge returns JUSTIFIED or NOT JUSTIFIED plus a concise reasoned
opinion. Do NOT create a combined majority verdict in V1.

## Representative Character Profiles

### Jon Snow
Speaks plainly and rarely gives unnecessarily long explanations. Values:
duty, promises, family, protection of people who cannot defend
themselves. Dislikes: praise, titles, arguments based mainly on his
birthright. Accepts responsibility quickly and may undervalue his own
judgment. Should answer directly, admit uncertainty, tolerate difficult
facts, and revise his view when honor or evidence requires it. Do not
force Jon to defend himself at all costs — he may acknowledge serious
arguments against his own actions.

### Tyrion Lannister
Analytical, ironic, curious about motives and consequences. Prefers:
persuasion, negotiated limits, solutions that keep people alive, testing
both sides of an argument. Mistrusts: ideological purity, inherited
greatness, rulers who reject criticism. Notices contradictions and may
revise his position. His defense role does not require blind loyalty to
Jon.

### Daenerys Targaryen
Speaks with authority and moral intensity. Values: liberation, courage,
loyalty, decisive action against entrenched cruelty. Sensitive to:
betrayal, condescension, secret political maneuvering, challenges to her
legitimacy. May interpret caution as complicity. However, she must still
reason from the record and may acknowledge evidence that weighs against
her. Her prosecution role does not mean every argument must be
predetermined.

### Grey Worm
Concise, concrete and disciplined. Focuses on: witnessed conduct,
sequence of events, orders, loyalty, available alternatives. Little
patience for: speculative motives, elaborate political rhetoric. Grief
and loyalty may influence his perspective, but he should change his view
when strong evidence requires it.

## Judicial Reasoning Profiles

### Aharon Barak model
Systematic, rights-centered and principle-driven. Important
considerations: legal authority, proper purpose, rational connection,
proportionality, less harmful alternatives, balancing public benefit
against individual harm. Reasoning should normally: (1) define the
relevant principle, (2) identify the applicable tests, (3) apply them to
the facts, (4) address important counterarguments, (5) reach an
independent conclusion. Do NOT predefine whether Barak finds the killing
justified.

### Menachem Elon model
Tradition-minded, historical and cautious about excessive judicial power.
Important considerations: legal and moral tradition, duties as well as
rights, communal responsibility, continuity, institutional restraint,
limits of judicial authority, moral and historical context. Should be
willing to consider broader normative traditions while still resolving
the concrete dispute. Do NOT predefine whether Elon finds the killing
justified.

### Meir Shamgar model
Institutional, restrained, practical and fact-focused. Important
considerations: chronology, legal powers, authority, institutional
roles, personal responsibility, available alternatives, concrete rights,
practical consequences. Reasoning should be sober, structured,
fact-heavy, institutionally focused, no broader than needed to decide
the case. Do NOT predefine whether Shamgar finds the killing justified.

## Canonical Case Facts (single source of truth — treat as fixed)

- King's Landing had surrendered. Its bells rang and organized resistance
  had stopped.
- After the surrender, Daenerys used Drogon against streets and
  civilians, causing destruction on a massive scale.
- After the victory, Daenerys publicly declared that the campaign of
  "liberation" would continue beyond King's Landing.
- Jon witnessed the destruction and heard the speech.
- Tyrion Lannister resigned as Hand and was imprisoned.
- Tyrion warned Jon that Daenerys could eventually regard Jon's sisters
  and others who threatened her rule as enemies.
- Jon asked Daenerys to forgive Tyrion and show mercy.
- Daenerys refused to allow others to decide what was good and presented
  her own judgment as decisive.
- Daenerys was unarmed and was not attacking Jon when he killed her.
- Jon used their intimacy to approach her closely enough to stab her.
- Before killing Daenerys, Jon had NOT: convened a council, attempted
  detention, demanded a public surrender of power, or attempted another
  formal process.

Agents must not invent new canonical facts that materially alter the
legal or moral situation.

## V1 Product Flow

Keep the flow straightforward.

1. User opens the application.
2. The application displays: The Tribunal / The Realm v. Jon Snow /
   concise case background / representatives / judges.
3. User presses "Start Tribunal".
4. The four representative agents present arguments; their responses
   form a transcript.
5. Each judge independently receives: canonical facts, tribunal
   transcript, their own judicial profile.
6. Each judge returns JUSTIFIED / NOT JUSTIFIED plus a concise reasoned
   opinion.
7. The application displays the three opinions separately.

Sequential LLM calls are completely acceptable. The product does NOT
need seven independent processes, seven servers, agent-to-agent
networking, or a complicated autonomous-agent framework inside the
product itself.

A product-level agent may simply be: system prompt + canonical facts +
current transcript + LLM call.

**Core principle: Code orchestrates. The LLM decides.**

## Keep The Product Simple

Unless a concrete requirement makes one necessary, do NOT introduce:
authentication, user accounts, database, microservices, message queues,
vector database, event bus, Kubernetes, autonomous background workers,
complex internal agent frameworks, unnecessary cloud infrastructure,
premature abstractions, elaborate persistence, or unnecessary deployment
complexity.

Prefer: one application, minimal dependencies, simple readable code,
simple local development, clear prompts, a visually clean interface.

The project must be easy to run, understand, demonstrate, and explain to
a lecturer.

## Mission 001 Scope

This first mission is ONLY to establish a strong minimal foundation. The
Coordinator should autonomously decompose the work as appropriate.

Required outcomes:
1. Inspect the target repository.
2. Inspect any existing project rules/documentation.
3. Choose the smallest reasonable technical stack.
4. Initialize the repository if needed (already done: Git repo created
   with an initial commit before this mission started).
5. Create a concise README containing: project purpose, chosen stack,
   simple architecture, how the tribunal agents work conceptually, and
   how to install/run locally.
6. Create one clear source of truth for: canonical case facts, the four
   representative profiles, and the three judicial profiles (base this
   on the content above — do not alter the substance, but organize it
   however best fits the chosen stack, e.g. structured data + prompt
   templates).
7. Create the basic web application shell.
8. Build a clean first screen containing: The Tribunal title, "The Realm
   v. Jon Snow", short case summary, defense representatives,
   prosecution representatives, the three judges, and a "Start Tribunal"
   button.
9. Establish the minimal structure needed for later LLM integration (a
   small interface or stub is acceptable — do NOT build the entire
   tribunal engine yet).
10. Do NOT unnecessarily implement the entire tribunal engine during this
    mission.
11. Add only the validation/tests appropriate to this stage.
12. Run the normal AutonomousDevTeam integration and independent QA
    process.

## Decision Policy

Routine engineering choices (frontend libraries, CSS approach, filenames,
component names, folder names, testing utilities, formatting, minor
dependency choices) belong to the autonomous team — do not escalate
these. Choose the simplest reasonable solution. If several technically
valid solutions exist, prefer in this order: (1) simpler, (2) fewer
dependencies, (3) easier to explain, (4) easier to maintain, (5) easier
to demo. Escalate to the Founder only for genuine Founder-level
ambiguity (material product ambiguity, major architecture decision,
security-sensitive decision, destructive/irreversible operation,
conflicting legitimate product choices, or unavailable
credentials/permissions).

## Mission 001 Definition of Done

Do not report DONE merely because implementation agents completed
coding. DONE requires:
- target project repository exists
- chosen stack is documented
- application runs locally
- initial UI exists
- canonical project data is stored clearly
- project structure is understandable
- relevant validation passes
- integration is complete
- independent QA has run
- QA issues are fixed or explicitly surfaced
- re-validation is complete
- durable mission evidence/state is written
- final mission report is produced

## Final Mission Report (required content)

1. Stack selected and why.
2. Architecture selected.
3. Files/folders created.
4. What currently works.
5. Exact commands to run the project.
6. Tests/build/lint/typecheck results where applicable.
7. Independent QA verdict.
8. QA findings and how they were resolved.
9. What was intentionally NOT implemented to keep the product simple.
10. The smallest recommended next Founder Mission.

Do not expand scope beyond Mission 001 without a concrete reason.
