import type { Project, ProjectStatus } from '@/types/project'
import type { KnowledgeGraph } from '@/types/knowledge'

let counter = 0
function nextId() {
  counter += 1
  return `proj-${counter}`
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId(),
    user_id: 'user-1',
    name: 'Test project',
    description: null,
    status: 'drafting' satisfies ProjectStatus,
    created_at: '2026-05-11T00:00:00.000Z',
    updated_at: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<{ id: string; email: string }> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    ...overrides,
  }
}

export function makeKnowledgeGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    id: 'kg-1',
    project_id: 'proj-1',
    version: 1,
    project_type: 'web_app',
    summary: 'A test project.',
    confirmed_facts: { name: 'Test' },
    inferred_facts: {},
    tentative_facts: {},
    non_goals: [],
    decisions: [],
    tradeoffs: [],
    assumptions: [],
    open_questions: [],
    conflicts: [],
    domain_language: {},
    updated_at: '2026-05-12T00:00:00.000Z',
    ...overrides,
  }
}
