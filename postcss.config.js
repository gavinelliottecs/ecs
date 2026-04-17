// ─── Projects ───
export type Project = {
  id: number;
  userId: string;
  name: string;
  address: string;
  description: string;
  status: string;
  startDate: string;
  color: string;
};
export type InsertProject = Omit<Project, "id" | "userId">;

// ─── Phases ───
export type Phase = {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
  color: string;
};
export type InsertPhase = Omit<Phase, "id">;

// ─── Tasks ───
export type Task = {
  id: number;
  projectId: number;
  phaseId: number | null;
  name: string;
  startDate: string;
  durationWeeks: number;
  status: string;
  category: string;
  notes: string;
  sortOrder: number;
};
export type InsertTask = Omit<Task, "id">;

// ─── Budgets ───
export type Budget = {
  id: number;
  projectId: number;
  originalValue: number;
  notes: string;
};
export type InsertBudget = Omit<Budget, "id">;

// ─── Cost Items ───
export type CostItem = {
  id: number;
  projectId: number;
  type: "extra" | "expense" | "labour" | "adhoc";
  category: string;
  description: string;
  amount: number;
  date: string;
  reference: string;
  supplier: string;
  notes: string;
  attachmentUrl: string;
  workerName: string;
  hoursWorked: number;
  dayRate: number;
  createdAt: string;
};
export type InsertCostItem = Omit<CostItem, "id" | "createdAt">;

// ─── Schedule Entries ───
export type ScheduleEntry = {
  id: number;
  projectId: number;
  date: string;
  taskDescription: string;
  workers: string;
  notes: string;
  color: string;
  sourceLabourId: number | null;
  createdAt: string;
};
export type InsertScheduleEntry = Omit<ScheduleEntry, "id" | "createdAt">;

// ─── Schedule Absences ───
export type ScheduleAbsence = {
  id: number;
  date: string;
  workerName: string;
  reason: string;
  createdAt: string;
};
export type InsertScheduleAbsence = Omit<ScheduleAbsence, "id" | "createdAt">;

// ─── Worker Profiles ───
export type WorkerProfile = {
  id: number;
  name: string;
  defaultDayRate: number;
  defaultCategory: string;
  defaultSupplier: string;
  updatedAt: string;
};
export type InsertWorkerProfile = Omit<WorkerProfile, "id" | "updatedAt">;

// ─── DB row → camelCase mappers ───
export function toProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as number,
    userId: row.user_id as string,
    name: row.name as string,
    address: (row.address as string) ?? "",
    description: (row.description as string) ?? "",
    status: (row.status as string) ?? "active",
    startDate: row.start_date as string,
    color: (row.color as string) ?? "#01696F",
  };
}

export function toPhase(row: Record<string, unknown>): Phase {
  return {
    id: row.id as number,
    projectId: row.project_id as number,
    name: row.name as string,
    sortOrder: (row.sort_order as number) ?? 0,
    color: (row.color as string) ?? "#01696F",
  };
}

export function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as number,
    projectId: row.project_id as number,
    phaseId: (row.phase_id as number | null) ?? null,
    name: row.name as string,
    startDate: row.start_date as string,
    durationWeeks: (row.duration_weeks as number) ?? 1,
    status: (row.status as string) ?? "upcoming",
    category: (row.category as string) ?? "General",
    notes: (row.notes as string) ?? "",
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export function toBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as number,
    projectId: row.project_id as number,
    originalValue: parseFloat(String(row.original_value)) || 0,
    notes: (row.notes as string) ?? "",
  };
}

export function toCostItem(row: Record<string, unknown>): CostItem {
  return {
    id: row.id as number,
    projectId: row.project_id as number,
    type: row.type as CostItem["type"],
    category: (row.category as string) ?? "General",
    description: (row.description as string) ?? "",
    amount: parseFloat(String(row.amount)) || 0,
    date: row.date as string,
    reference: (row.reference as string) ?? "",
    supplier: (row.supplier as string) ?? "",
    notes: (row.notes as string) ?? "",
    attachmentUrl: (row.attachment_url as string) ?? "",
    workerName: (row.worker_name as string) ?? "",
    hoursWorked: parseFloat(String(row.hours_worked)) || 0,
    dayRate: parseFloat(String(row.day_rate)) || 0,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function toScheduleEntry(row: Record<string, unknown>): ScheduleEntry {
  return {
    id: row.id as number,
    projectId: row.project_id as number,
    date: row.date as string,
    taskDescription: (row.task_description as string) ?? "",
    workers: (row.workers as string) ?? "",
    notes: (row.notes as string) ?? "",
    color: (row.color as string) ?? "#DBEAFE",
    sourceLabourId: (row.source_labour_id as number | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function toScheduleAbsence(row: Record<string, unknown>): ScheduleAbsence {
  return {
    id: row.id as number,
    date: row.date as string,
    workerName: (row.worker_name as string) ?? "",
    reason: (row.reason as string) ?? "Holiday",
    createdAt: (row.created_at as string) ?? "",
  };
}

export function toWorkerProfile(row: Record<string, unknown>): WorkerProfile {
  return {
    id: row.id as number,
    name: row.name as string,
    defaultDayRate: parseFloat(String(row.default_day_rate)) || 0,
    defaultCategory: (row.default_category as string) ?? "",
    defaultSupplier: (row.default_supplier as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}
