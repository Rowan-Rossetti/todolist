export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  category: string
  dueDate: string
  createdAt: string
  completedAt?: string
  starred: boolean
  tags: string[]
  subtasks: { id: string; title: string; done: boolean }[]
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}
