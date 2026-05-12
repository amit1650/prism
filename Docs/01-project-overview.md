# 01 — Project Overview

## What Is Prism?

Prism is a **Project Intelligence Platform**. It helps users define a software project deeply and precisely, then exports a structured context file that can be fed to any LLM (Claude, ChatGPT, Gemini, Cursor, etc.) to start building immediately — without lengthy back-and-forth discussions.

---

## The Core Problem It Solves

When developers or product owners start a new project with an LLM, they spend the first 30-60 minutes just explaining context. The LLM asks basic questions. The user re-explains things already said. Important details get missed. Assumptions go unstated.

Prism flips this. You define the project once, properly. Every LLM you work with gets the full picture instantly.

---

## What It Is NOT

- Not a project management tool (no tasks, no tickets)
- Not a team collaboration tool (no people, no roles, no assignments)
- Not a time tracking or delivery tool (no deadlines, no sprints)
- Not a code editor or IDE plugin
- Not a replacement for your LLM — it feeds your LLM

---

## The User Journey (Phase 1)

```
Sign In
  ↓
Dashboard — see all project threads
  ↓
Create New Project Thread
  ↓
Chat Intake — describe project freely, upload docs
  ↓
Agent Summary — agent shows what it understood
  ↓
Q&A Wizard — targeted questions to fill gaps (max 25)
  ↓
Compile Review — final structured view before export
  ↓
Export — .md file optimized for LLM consumption
```

---

## Core Principles

### 1. Prebuilt UI, Not Custom Built
The chat interface uses **Chatscope** — a production-ready React chat UI kit. We do not build chat components from scratch. Ever.

### 2. Structured Knowledge, Not Transcripts
We don't save Q&A transcripts. We build a **knowledge graph** — structured, versioned, queryable facts about the project.

### 3. Export Is The Product
The `.md` export file is the entire point. Everything else serves it. It must be clean, structured, and immediately useful when pasted into any LLM.

### 4. Adaptive Q&A, Not Linear Interrogation
Questions are generated from gaps in the knowledge graph. Answering one question may eliminate several others. Max 25 questions per session.

### 5. Confidence Is Explicit
Every fact in the knowledge graph has a confidence level: `confirmed`, `inferred`, or `tentative`. The export file reflects this — LLMs know what to trust and what to probe.

---

## The Export File Structure

Every export follows this template regardless of format:

```markdown
# PROJECT CONTEXT — [Name]
> Version N | Compiled by Prism

## WHAT THIS IS
## WHAT THIS IS NOT
## CONFIRMED FACTS
## TECHNICAL DECISIONS & RATIONALE
## ACCEPTED TRADEOFFS
## ASSUMPTIONS (do not contradict)
## OPEN QUESTIONS (flag if encountered)
## DOMAIN LANGUAGE
## PRE-ANSWERED LLM QUESTIONS
```

The last section — **PRE-ANSWERED LLM QUESTIONS** — contains the 10-15 questions any LLM would ask when starting work on this project, already answered. This eliminates back-and-forth entirely.

---

## Export Formats

| Format | Target | Notes |
|--------|--------|-------|
| Claude Projects | Claude Opus / Sonnet | Full .md with system prompt wrapper |
| ChatGPT | GPT-4o / Custom GPT | Optimized prompt format |
| Cursor / Claude Code | IDE AI tools | .cursorrules / CLAUDE.md format |
| Raw Markdown | Universal | Clean .md, works everywhere |

---

## Success Criteria For Phase 1

- [ ] User can sign in and create project threads
- [ ] User can chat and upload documents to describe their project
- [ ] Agent correctly extracts confirmed facts, inferences, assumptions, gaps
- [ ] Q&A wizard generates relevant targeted questions only
- [ ] Exported .md file is immediately useful when fed to Claude or ChatGPT
- [ ] A developer reading the export understands the project without asking follow-up questions
