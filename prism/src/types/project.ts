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

export interface NewProjectInput {
  name: string
  description?: string
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
