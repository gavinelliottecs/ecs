import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { Project, ScheduleEntry, ScheduleAbsence } from "@/types";
import { toProject, toScheduleEntry, toScheduleAbsence } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  UserX,
  Loader2,
  Copy,
  Link2,
} from "lucide-react";

// ─── Helpers ───
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function fmtWeekHeader(monday: Date): string {
  const mStr = monday.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `w/c ${mStr}`;
}

const CELL_COLORS = [
  { label: "Blue", value: "#DBEAFE", text: "#1e3a5f" },
  { label: "Yellow", value: "#FEF9C3", text: "#713f12" },
  { label: "Green", value: "#DCFCE7", text: "#14532d" },
  { label: "Orange", value: "#FFEDD5", text: "#7c2d12" },
  { label: "Purple", value: "#F3E8FF", text: "#581c87" },
  { label: "Grey", value: "#F3F4F6", text: "#374151" },
  { label: "White", value: "#FFFFFF", text: "#111827" },
];

export default function WeeklySchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entryDialogState, setEntryDialogState] = useState<{
    open: boolean;
    editing: ScheduleEntry | null;
    prefillDate: string;
    prefillProjectId: number | null;
  }>({ open: false, editing: null, prefillDate: "", prefillProjectId: null });
  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    return addDays(m, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }, [monday]);

  const startDate = fmt(monday);
  const endDate = fmt(addDays(monday, 4));

  // Queries
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toProject(row as Record<string, unknown>));
    },
    enabled: !!user,
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery<ScheduleEntry[]>({
    queryKey: ["schedule_entries", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toScheduleEntry(row as Record<string, unknown>));
    },
    enabled: !!user,
  });

  const { data: absences = [] } = useQuery<ScheduleAbsence[]>({
    queryKey: ["schedule_absences", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_absences")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toScheduleAbsence(row as Record<string, unknown>));
    },
    enabled: !!user,
  });

  // One-time backfill: sync labour entries that don't yet have schedule entries
  const didSync = useRef(false);
  useEffect(() => {
    if (!didSync.current && user) {
      didSync.current = true;
      syncLabourToSchedule().then((synced) => {
        if (synced > 0) {
          queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
        }
      }).catch(() => {});
    }
  }, [user]);

  async function syncLabourToSchedule(): Promise<number> {
    const { data: projectRows } = await supabase.from("projects").select("id");
    if (!projectRows) return 0;
    let synced = 0;
    for (const pRow of projectRows) {
      const { data: costRows } = await supabase
        .from("cost_items")
        .select("*")
        .eq("project_id", pRow.id)
        .eq("type", "labour");
      if (!costRows) continue;
      for (const item of costRows) {
        if (!item.worker_name || !item.date) continue;
        const { data: existing } = await supabase
          .from("schedule_entries")
          .select("id")
          .eq("source_labour_id", item.id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("schedule_entries").insert({
            project_id: item.project_id,
            date: item.date,
            task_description: item.description ?? "",
            workers: item.worker_name ?? "",
            notes: "",
            color: "#DBEAFE",
            source_labour_id: item.id,
          });
          synced++;
        }
      }
    }
    return synced;
  }

  const activeProjects = useMemo(() => {
    const projectIds = new Set(entries.map((e) => e.projectId));
    const all = projects.filter((p) => p.status === "active" || projectIds.has(p.id));
    return all.sort((a, b) => {
      const aHas = projectIds.has(a.id) ? 0 : 1;
      const bHas = projectIds.has(b.id) ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.name.localeCompare(b.name);
    });
  }, [projects, entries]);

  const entryMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    entries.forEach((e) => {
      const key = `${e.projectId}-${e.date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [entries]);

  const absenceMap = useMemo(() => {
    const map = new Map<string, ScheduleAbsence[]>();
    absences.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    });
    return map;
  }, [absences]);

  const copyMutation = useMutation({
    mutationFn: async () => {
      const prevStart = fmt(addDays(monday, -7));
      const prevEnd = fmt(addDays(monday, -3));
      const { data: prevEntries } = await supabase
        .from("schedule_entries")
        .select("*")
        .gte("date", prevStart)
        .lte("date", prevEnd);

      for (const entry of prevEntries ?? []) {
        const oldDate = new Date(entry.date);
        const newDate = addDays(oldDate, 7);
        await supabase.from("schedule_entries").insert({
          project_id: entry.project_id,
          date: fmt(newDate),
          task_description: entry.task_description ?? "",
          workers: entry.workers ?? "",
          notes: "",
          color: entry.color ?? "#DBEAFE",
        });
      }
      return (prevEntries ?? []).length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries", startDate, endDate] });
      toast({ title: `Copied ${count} entries from last week` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleCellClick(projectId: number, date: string) {
    const key = `${projectId}-${date}`;
    const existing = entryMap.get(key);
    if (existing && existing.length > 0) {
      setEntryDialogState({ open: true, editing: existing[0], prefillDate: date, prefillProjectId: projectId });
    } else {
      setEntryDialogState({ open: true, editing: null, prefillDate: date, prefillProjectId: projectId });
    }
  }

  const isToday = (d: Date) => fmt(d) === fmt(new Date());
  const isThisWeek = weekOffset === 0;

  return (
    <div className="space-y-4" data-testid="weekly-schedule">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-schedule-title">
            <Calendar className="h-5 w-5 text-primary" />
            Weekly Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtWeekHeader(monday)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setEntryDialogState({ open: true, editing: null, prefillDate: fmt(new Date()), prefillProjectId: projects[0]?.id ?? null })}
            data-testid="button-add-entry"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Entry
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending}
            data-testid="button-copy-week"
          >
            {copyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy Last Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAbsenceDialog(true)}
            data-testid="button-add-absence"
          >
            <UserX className="h-3.5 w-3.5 mr-1.5" />
            Log Absence
          </Button>
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o - 1)}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isThisWeek ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setWeekOffset(0)}
              data-testid="button-this-week"
            >
              This Week
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o + 1)}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="schedule-table">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-900 text-white">
                <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-[180px] sticky left-0 bg-slate-800 dark:bg-slate-900 z-10">
                  Site
                </th>
                {weekDays.map((d) => (
                  <th
                    key={fmt(d)}
                    className={`text-center py-2.5 px-2 font-semibold text-xs uppercase tracking-wider min-w-[160px] ${
                      isToday(d) ? "bg-primary/80" : ""
                    }`}
                  >
                    <div>{fmtDay(d)}</div>
                    <div className="font-normal text-[10px] opacity-75">{fmtShort(d)}</div>
                  </th>
                ))}
                <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-[120px]">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.length === 0 && !loadingEntries && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No active projects. Add a project from the Dashboard first.
                  </td>
                </tr>
              )}
              {activeProjects.map((project) => {
                const weekNotes = entries
                  .filter((e) => e.projectId === project.id && e.notes)
                  .map((e) => e.notes)
                  .filter(Boolean);

                return (
                  <tr
                    key={project.id}
                    className="border-t hover:bg-muted/20 transition-colors"
                    data-testid={`row-schedule-${project.id}`}
                  >
                    <td className="py-2 px-3 sticky left-0 bg-background z-10 border-r">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate leading-tight">{project.name}</p>
                          {project.address && (
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {project.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {weekDays.map((d) => {
                      const dateStr = fmt(d);
                      const key = `${project.id}-${dateStr}`;
                      const cellEntries = entryMap.get(key) ?? [];
                      const hasEntry = cellEntries.length > 0;

                      return (
                        <td
                          key={dateStr}
                          className={`py-1 px-1.5 border-r border-l cursor-pointer transition-colors min-h-[56px] align-top ${
                            isToday(d) ? "bg-primary/5" : ""
                          }`}
                          onClick={() => handleCellClick(project.id, dateStr)}
                          data-testid={`cell-${project.id}-${dateStr}`}
                        >
                          {hasEntry ? (
                            <div className="space-y-1">
                              {cellEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded px-2 py-1.5 transition-shadow hover:shadow-sm relative"
                                  style={{
                                    backgroundColor: entry.color || "#DBEAFE",
                                    color: CELL_COLORS.find((c) => c.value === entry.color)?.text || "#1e3a5f",
                                  }}
                                >
                                  <p className="font-semibold text-xs leading-tight">
                                    {entry.taskDescription || "—"}
                                  </p>
                                  {entry.workers && (
                                    <p className="text-[10px] mt-0.5 opacity-80 leading-tight">
                                      {entry.workers}
                                    </p>
                                  )}
                                  {entry.sourceLabourId && (
                                    <div className="absolute top-0.5 right-0.5" title="Auto-synced from Labour">
                                      <Link2 className="h-2.5 w-2.5 opacity-40" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded min-h-[48px] flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity">
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-2 px-3 text-xs text-muted-foreground align-top">
                      {weekNotes.length > 0 ? weekNotes.join("; ") : ""}
                    </td>
                  </tr>
                );
              })}

              {/* Holidays / Absent Row */}
              <tr className="border-t-2 border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20">
                <td className="py-2 px-3 sticky left-0 bg-orange-50/50 dark:bg-orange-950/20 z-10 border-r">
                  <div className="flex items-center gap-2">
                    <UserX className="h-3.5 w-3.5 text-orange-500" />
                    <p className="font-semibold text-xs">Holidays / Absent</p>
                  </div>
                </td>
                {weekDays.map((d) => {
                  const dateStr = fmt(d);
                  const dayAbsences = absenceMap.get(dateStr) ?? [];
                  return (
                    <td
                      key={dateStr}
                      className={`py-1.5 px-1.5 border-r border-l align-top ${isToday(d) ? "bg-primary/5" : ""}`}
                    >
                      {dayAbsences.length > 0 ? (
                        <div className="space-y-1">
                          {dayAbsences.map((a) => (
                            <div
                              key={a.id}
                              className="rounded bg-orange-100 dark:bg-orange-900/40 px-2 py-1 text-[10px] font-medium text-orange-800 dark:text-orange-200"
                            >
                              {a.workerName}
                              {a.reason && a.reason !== "Holiday" && (
                                <span className="opacity-60 ml-1">({a.reason})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="min-h-[28px]" />
                      )}
                    </td>
                  );
                })}
                <td className="py-2 px-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {loadingEntries && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Entry Dialog */}
      {entryDialogState.open && (
        <EntryDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setEntryDialogState({ open: false, editing: null, prefillDate: "", prefillProjectId: null });
          }}
          projects={projects}
          existing={entryDialogState.editing}
          prefillDate={entryDialogState.prefillDate}
          prefillProjectId={entryDialogState.prefillProjectId}
          weekDays={weekDays}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Absence Dialog */}
      <AbsenceDialog
        open={showAbsenceDialog}
        onOpenChange={setShowAbsenceDialog}
        weekDays={weekDays}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

// ─── Entry Dialog ───
function EntryDialog({
  open,
  onOpenChange,
  projects,
  existing,
  prefillDate,
  prefillProjectId,
  weekDays,
  startDate,
  endDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  existing: ScheduleEntry | null;
  prefillDate: string;
  prefillProjectId: number | null;
  weekDays: Date[];
  startDate: string;
  endDate: string;
}) {
  const { toast } = useToast();
  const isEdit = !!existing;

  const [projectId, setProjectId] = useState<string>(
    existing ? existing.projectId.toString() : (prefillProjectId?.toString() || (projects[0]?.id.toString() ?? ""))
  );
  const [date, setDate] = useState(
    existing ? existing.date : (prefillDate || fmt(weekDays[0]))
  );
  const [taskDescription, setTaskDescription] = useState(existing?.taskDescription || "");
  const [workers, setWorkers] = useState(existing?.workers || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [color, setColor] = useState(existing?.color || "#DBEAFE");
  const [applyAllWeek, setApplyAllWeek] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        project_id: parseInt(projectId),
        date,
        task_description: taskDescription,
        workers,
        notes,
        color,
      };
      if (isEdit) {
        const { error } = await supabase
          .from("schedule_entries")
          .update(body)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else if (applyAllWeek) {
        for (const d of weekDays) {
          const { error } = await supabase.from("schedule_entries").insert({ ...body, date: fmt(d) });
          if (error) throw new Error(error.message);
        }
      } else {
        const { error } = await supabase.from("schedule_entries").insert(body);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries", startDate, endDate] });
      toast({ title: isEdit ? "Updated" : "Added" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_entries").delete().eq("id", existing!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries", startDate, endDate] });
      toast({ title: "Deleted" });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add"} Schedule Entry</DialogTitle>
          <DialogDescription>
            Assign a task and workers to a site for the day.
          </DialogDescription>
        </DialogHeader>
        {existing?.sourceLabourId && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            This entry was auto-created from a labour record. To change the worker or task, update the labour entry in the Financial Tracker.
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4 mt-2"
        >
          <div className="space-y-2">
            <Label>Site / Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-entry-project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                data-testid="input-entry-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Cell Colour</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger data-testid="select-entry-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CELL_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: c.value }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Task / Description</Label>
            <Input
              placeholder="e.g. General / 1st Fix Carp"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              data-testid="input-entry-task"
            />
          </div>

          <div className="space-y-2">
            <Label>Workers (comma-separated)</Label>
            <Input
              placeholder="e.g. Ant, Brian, Michael"
              value={workers}
              onChange={(e) => setWorkers(e.target.value)}
              data-testid="input-entry-workers"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-entry-notes"
            />
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={applyAllWeek}
                onChange={(e) => setApplyAllWeek(e.target.checked)}
                className="rounded border-border"
              />
              Apply to all 5 days (Mon–Fri)
            </label>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-entry"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-entry">
                {saveMutation.isPending ? "Saving..." : isEdit ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Absence Dialog ───
function AbsenceDialog({
  open,
  onOpenChange,
  weekDays,
  startDate,
  endDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekDays: Date[];
  startDate: string;
  endDate: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workerName, setWorkerName] = useState("");
  const [reason, setReason] = useState("Holiday");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setWorkerName("");
      setReason("Holiday");
      setSelectedDays([]);
    }
    onOpenChange(o);
  };

  const toggleDay = (d: string) => {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const date of selectedDays) {
        const { error } = await supabase.from("schedule_absences").insert({
          date,
          worker_name: workerName,
          reason,
          user_id: user!.id,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_absences", startDate, endDate] });
      toast({ title: "Absence logged" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Absence</DialogTitle>
          <DialogDescription>
            Record holiday or absence for a worker this week.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedDays.length === 0) {
              toast({ title: "Select at least one day", variant: "destructive" });
              return;
            }
            saveMutation.mutate();
          }}
          className="space-y-4 mt-2"
        >
          <div className="space-y-2">
            <Label>Worker Name</Label>
            <Input
              placeholder="e.g. Oscar"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              required
              data-testid="input-absence-worker"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger data-testid="select-absence-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Holiday">Holiday</SelectItem>
                <SelectItem value="Sick">Sick</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="College">College</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Days</Label>
            <div className="flex gap-2 flex-wrap">
              {weekDays.map((d) => {
                const ds = fmt(d);
                const selected = selectedDays.includes(ds);
                return (
                  <Button
                    key={ds}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => toggleDay(ds)}
                  >
                    {fmtDay(d)} {fmtShort(d)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-absence">
              {saveMutation.isPending ? "Saving..." : "Log Absence"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
