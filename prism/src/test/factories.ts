import type { Project, ProjectStatus } from '@/types/project'

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
