---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user until you reach a shared understanding, then do all the work in one go. The user answers by **clicking**, so keep it fast.

## 1. Gather facts first

Finding _facts_ is your job, never the user's. Before asking anything, look up what you need yourself (files, git history, tools, sub-agents). Never ask the user for something you could find out.

## 2. Build the whole question list up front

Write down every decision the user must make for this request: where, what, how, scope, follow-ups. Skip questions that the project rules (CLAUDE.md) already answer. Where you can, fold a decision that depends on another one into the options, so the list is complete from the start.

## 3. Ask them all at once with the AskUserQuestion tool

- Put **every question in a single AskUserQuestion call** (up to 4 questions per call) so the user can click through and move straight to the next question. Never ask one question, wait, and then ask the next.
- More than 4 questions: make the next AskUserQuestion call right away, with no commentary in between.
- Every question gets 2-4 options. Put the recommended option first and add "(Recommended)" to its label. Each option's description says what will happen if it is chosen.
- Never write the questions out as a numbered text list.

## 4. Then make every change in one batch

When the answers come back, don't ask again for confirmation. Apply all the decisions together: edit the code and docs, and deploy if the project rules say so. Ask a follow-up AskUserQuestion round only if an answer opens up a decision you could not foresee, or the user picked "Other" with text that needs clarifying.
