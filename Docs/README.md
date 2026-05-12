# Prism — Phase 1 Planning Docs

> Feed these files to Claude, ChatGPT, or any LLM to start building.
> Read in order. Each file is self-contained but references others.

---

## File Index

| File | Purpose | Read When |
|------|---------|-----------|
| `README.md` | This file — index and orientation | First |
| `01-project-overview.md` | What we're building, why, core principles | Before anything |
| `02-tech-stack.md` | Every tool, library, version, why chosen | Before setup |
| `03-architecture.md` | Folder structure, data flow, system design | Before coding |
| `04-database-schema.md` | Supabase tables, relationships, RLS policies | Before DB setup |
| `05-milestone-1-auth-dashboard.md` | Auth + Dashboard build tasks | M1 build |
| `06-milestone-2-chat-intake.md` | Chat UI + file upload + Claude API | M2 build |
| `07-milestone-3-parsing-pipeline.md` | Knowledge graph + parsing engine | M3 build |
| `08-milestone-4-qa-wizard.md` | Q&A wizard UI + question generation | M4 build |
| `09-milestone-5-export.md` | Export engine + format options | M5 build |
| `10-ui-ux-guidelines.md` | Design rules, component patterns, Chatscope usage | Throughout |

---

## How To Use These Docs

### With Claude (Sonnet/Opus)
Paste `01-project-overview.md` + the milestone file you're working on as a Project document. Tell Claude: *"Build this. Ask me if anything is unclear."*

### With Cursor / VS Code + Copilot
Add all files to your workspace root. Reference them in comments or Cursor chat. The architecture and schema files are especially useful here.

### With ChatGPT
Upload the relevant milestone file. Start with: *"I'm building this. Help me implement it step by step."*

---

## Phase 1 Goal

**A working web app where a user can:**
1. Sign in with Google or Email
2. Create project threads
3. Chat with an AI agent about their project, upload documents
4. Go through a smart Q&A wizard to clarify gaps
5. Export a structured `.md` file ready to feed any LLM

**Phase 2 (not in these docs):** Managing in-progress or completed projects.
