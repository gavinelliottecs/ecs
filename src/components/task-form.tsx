import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import type { Task, Phase } from "@/types";
import { toTask } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

const CATEGORIES = [
  "Groundworks", "Foundations", "Structure", "Roof", "Exterior",
  "Carpentry", "Services", "Interior", "Custom", "Finishing", "General",
];

const STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  phases: Phase[];
  task?: Task | null;
  onCascadeUpdate?: (taskId: number, updates: { durationWeeks?: number; startDate?: string }) => void;
}

export function TaskForm({ open, onOpenChange, projectId, phases, task, onCascadeUpdate }: Props) {
  const { toast } = useToast();
  const isEdit = !!task;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [status, setStatus] = useState("upcoming");
  const [category, setCategory] = useState("General");
  const [phaseId, setPhaseId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [durationChanged, setDurationChanged] = useState(false);
  const [dateChanged, setDateChanged] = useState(false);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setStartDate(task.startDate);
      setDurationWeeks(task.durationWeeks);
      setStatus(task.status);
      setCategory(task.category);
      setPhaseId(task.phaseId?.toString() ?? "");
      setNotes(task.notes);
      setDurationChanged(false);
      setDateChanged(false);
    } else {
      setName("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setDurationWeeks(1);
      setStatus("upcoming");
      setCategory("General");
      setPhaseId(phases[0]?.id.toString() ?? "");
      setNotes("");
      setDurationChanged(false);
      setDateChanged(false);
    }
  }, [task, open, phases]);

  const hasCascadeChanges = isEdit && (durationChanged || dateChanged);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        project_id: projectId,
        phase_id: phaseId ? Number(phaseId) : null,
        start_date: startDate,
        duration_weeks: durationWeeks,
        status,
        category,
        notes,
        sort_order: task?.sortOrder ?? 99,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("tasks")
          .update(body)
          .eq("id", task!.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("tasks").insert(body);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({ title: isEdit ? "Task updated" : "Task created" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", task!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({ title: "Task deleted" });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  function handleCascadeUpdate() {
    if (task && onCascadeUpdate) {
      const updates: { durationWeeks?: number; startDate?: string } = {};
      if (durationChanged) updates.durationWeeks = durationWeeks;
      if (dateChanged) updates.startDate = startDate;
      onCascadeUpdate(task.id, updates);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this task's details." : "Add a new task to the project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="task-name">Task Name</Label>
            <Input
              id="task-name"
              placeholder="e.g. Plumbing 2nd Fix"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="input-task-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-start">Start Date</Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (task && e.target.value !== task.startDate) setDateChanged(true);
                }}
                required
                data-testid="input-task-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-duration">Duration (weeks)</Label>
              <Input
                id="task-duration"
                type="number"
                min={1}
                max={52}
                value={durationWeeks}
                onChange={(e) => {
                  setDurationWeeks(Number(e.target.value));
                  if (task && Number(e.target.value) !== task.durationWeeks) setDurationChanged(true);
                }}
                required
                data-testid="input-task-duration"
              />
            </div>
          </div>

          {/* Cascade warning */}
          {hasCascadeChanges && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-orange-800 dark:text-orange-300">
                  Schedule change detected
                </p>
                <p className="text-orange-700 dark:text-orange-400 mt-0.5">
                  {durationChanged ? `Duration changed from ${task!.durationWeeks}w to ${durationWeeks}w. ` : ""}
                  {dateChanged ? `Start date changed. ` : ""}
                  Use "Save & Push" to automatically adjust all following tasks.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-task-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger data-testid="select-task-phase">
                <SelectValue placeholder="Select a phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="input-task-notes"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-task"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-task"
              >
                Cancel
              </Button>
              {hasCascadeChanges && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCascadeUpdate}
                  className="border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  data-testid="button-cascade-save"
                >
                  Save & Push
                </Button>
              )}
              <Button
                type="submit"
                disabled={!name || saveMutation.isPending}
                data-testid="button-save-task"
              >
                {saveMutation.isPending ? "Saving..." : isEdit ? "Save Only" : "Add Task"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
