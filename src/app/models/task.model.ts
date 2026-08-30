export interface Subtask { id:string; title:string; completed:boolean; priority?:TaskPriority; dueDate?:string; }
export type TaskStatus='todo'|'doing'|'done'|'waiting'|'blocked'|'cancelled';
export type TaskPriority='none'|'low'|'normal'|'high'|'urgent';
export interface Task {
 id:string; title:string; description:string; notes:string; completed:boolean; status:TaskStatus; priority:TaskPriority;
 subtasks:Subtask[]; createdAt:string; updatedAt:string; startDate:string; dueDate:string; dueTime:string; estimatedMinutes:number;
 spentMinutes:number; category:string; project:string; tags:string[]; favorite:boolean; pinned:boolean; archived:boolean; color:string;
 recurrence:string; reminder:string; links:string[]; dependencies:string[];
}
