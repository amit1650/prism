# 04 — Database Schema

## Supabase Tables

Run these SQL statements in the Supabase SQL editor in order.

---

### 1. Projects (Thread List)

```sql
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  status text not null default 'drafting'
    check (status in ('drafting', 'clarifying', 'compiling', 'ready', 'exported')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- RLS
alter table projects enable row level security;

create policy "Users can only access their own projects"
  on projects for all
  using (auth.uid() = user_id);
```

---

### 2. Project Messages (Chat History)

```sql
create table project_messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- RLS via project ownership
alter table project_messages enable row level security;

create policy "Users can access messages for their projects"
  on project_messages for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_messages.project_id
      and projects.user_id = auth.uid()
    )
  );
```

---

### 3. Project Documents (Uploaded Files)

```sql
create table project_documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  filename text not null,
  file_type text not null,  -- 'pdf', 'docx', 'txt', 'md'
  raw_text text not null,   -- parsed plain text content
  created_at timestamptz default now()
);

alter table project_documents enable row level security;

create policy "Users can access documents for their projects"
  on project_documents for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_documents.project_id
      and projects.user_id = auth.uid()
    )
  );
```

---

### 4. Knowledge Graph (Core Data Store)

```sql
create table project_knowledge (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null unique,
  version integer not null default 1,

  -- Confirmed facts (high confidence, explicit)
  confirmed_facts jsonb not null default '{}',

  -- Inferred facts (medium confidence, implied)
  inferred_facts jsonb not null default '{}',

  -- Tentative facts (low confidence, guessed)
  tentative_facts jsonb not null default '{}',

  -- Non-goals (explicitly out of scope)
  non_goals text[] not null default '{}',

  -- Decisions made with rationale
  decisions jsonb not null default '[]',

  -- Accepted tradeoffs
  tradeoffs jsonb not null default '[]',

  -- Surfaced assumptions (unstated beliefs)
  assumptions text[] not null default '{}',

  -- Open questions (unresolved gaps)
  open_questions jsonb not null default '[]',

  -- Detected conflicts between sources
  conflicts jsonb not null default '[]',

  -- Domain-specific terminology
  domain_language jsonb not null default '{}',

  -- Project type classification
  project_type text,

  -- One paragraph summary (AI optimized)
  summary text,

  updated_at timestamptz default now()
);

create trigger knowledge_updated_at
  before update on project_knowledge
  for each row execute function update_updated_at();

alter table project_knowledge enable row level security;

create policy "Users can access knowledge for their projects"
  on project_knowledge for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_knowledge.project_id
      and projects.user_id = auth.uid()
    )
  );
```

---

### 5. Q&A Sessions

```sql
create table project_qa_sessions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  questions jsonb not null default '[]',
  answers jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table project_qa_sessions enable row level security;

create policy "Users can access QA sessions for their projects"
  on project_qa_sessions for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_qa_sessions.project_id
      and projects.user_id = auth.uid()
    )
  );
```

---

### 6. Exports

```sql
create table project_exports (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  format text not null check (format in ('claude', 'chatgpt', 'cursor', 'raw')),
  content text not null,         -- the actual .md content
  knowledge_version integer not null,
  created_at timestamptz default now()
);

alter table project_exports enable row level security;

create policy "Users can access exports for their projects"
  on project_exports for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_exports.project_id
      and projects.user_id = auth.uid()
    )
  );
```

---

## TypeScript Types

```typescript
// src/types/project.ts

export type ProjectStatus =
  | 'drafting'
  | 'clarifying'
  | 'compiling'
  | 'ready'
  | 'exported'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface ProjectMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ProjectDocument {
  id: string
  project_id: string
  filename: string
  file_type: string
  raw_text: string
  created_at: string
}
```

```typescript
// src/types/knowledge.ts

export type ConfidenceLevel = 'confirmed' | 'inferred' | 'tentative'

export interface Fact {
  value: string | boolean | string[]
  confidence: ConfidenceLevel
  source?: string  // 'chat' | 'document:filename' | 'qa_session'
}

export interface Decision {
  topic: string
  choice: string
  rationale: string
  confidence: ConfidenceLevel
}

export interface Tradeoff {
  description: string
  accepted: boolean
  rationale: string
}

export interface OpenQuestion {
  topic: string
  priority: 'high' | 'medium' | 'low'
  context?: string
}

export interface Conflict {
  topic: string
  source_a: string
  value_a: string
  source_b: string
  value_b: string
  resolved: boolean
  resolution?: string
}

export interface KnowledgeGraph {
  id: string
  project_id: string
  version: number
  confirmed_facts: Record<string, Fact>
  inferred_facts: Record<string, Fact>
  tentative_facts: Record<string, Fact>
  non_goals: string[]
  decisions: Decision[]
  tradeoffs: Tradeoff[]
  assumptions: string[]
  open_questions: OpenQuestion[]
  conflicts: Conflict[]
  domain_language: Record<string, string>
  project_type: string | null
  summary: string | null
  updated_at: string
}
```

```typescript
// src/types/qa.ts

export interface Question {
  id: string
  topic: string
  question: string
  why_asking: string           // shown to user for context
  options: {
    a: string
    b: string
    c: string
    d: string                  // always "Custom answer..."
  }
  skippable: boolean
  skip_if: Record<string, string[]>  // { question_id: [answer_values_that_trigger_skip] }
}

export interface Answer {
  question_id: string
  selected: 'a' | 'b' | 'c' | 'd'
  custom_text?: string         // filled when d is selected
}
```
