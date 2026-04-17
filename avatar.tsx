import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { Project, Phase, Task } from "@/types";
import { toProject, toPhase, toTask } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Loader2,
  BarChart3,
  List,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  PoundSterling,
} from "lucide-react";
import { formatDate, addWeeks, STATUS_COLORS } from "@/lib/utils";
import { GanttChart } from "@/components/gantt-chart";
import { TaskForm } from "@/components/task-form";
import { FinancialTracker } from "@/components/financial-tracker";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { toast } = useToast();

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { data: project, isLoading: loadingProject } = useQuery<Project>({
    queryKey: ["projects", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Project not found");
      return toProject(data as Record<string, unknown>);
    },
    enabled: !!projectId,
  });

  const { data: phases = [], isLoading: loadingPhases } = useQuery<Phase[]>({
    queryKey: ["projects", projectId, "phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toPhase(row as Record<string, unknown>));
    },
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toTask(row as Record<string, unknown>));
    },
    enabled: !!projectId,
  });

  // Client-side cascade: update task + push subsequent tasks
  const cascadeMutation = useMutation({
    mutationFn: async ({
      taskId,
      durationWeeks,
      startDate,
    }: {
      taskId: number;
      durationWeeks?: number;
      startDate?: string;
    }) => {
      // Get the current task
      const { data: taskRow, error: taskErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      if (taskErr || !taskRow) throw new Error("Task not found");
      const currentTask = toTask(taskRow as Record<string, unknown>);

      const oldEndDate = addWeeks(currentTask.startDate, currentTask.durationWeeks);

      // Apply updates to this task
      const updates: Record<string, unknown> = {};
      if (durationWeeks !== undefined) updates.duration_weeks = durationWeeks;
      if (startDate !== undefined) updates.start_date = startDate;

      const { error: updateErr } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);
      if (updateErr) throw new Error(updateErr.message);

      // Fetch the updated task
      const { data: updatedRow } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      const updatedTask = updatedRow
        ? toTask(updatedRow as Record<string, unknown>)
        : { ...currentTask, durationWeeks: durationWeeks ?? currentTask.durationWeeks, startDate: startDate ?? currentTask.startDate };

      const newEndDate = addWeeks(updatedTask.startDate, updatedTask.durationWeeks);

      // Calculate shift in days
      const oldEnd = new Date(oldEndDate);
      const newEnd = new Date(newEndDate);
      const shiftDays = Math.round((newEnd.getTime() - oldEnd.getTime()) / (24 * 60 * 60 * 1000));

      if (shiftDays !== 0) {
        // Get all tasks in the project with higher sort_order
        const { data: allTaskRows } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projectId)
          .neq("id", taskId)
          .order("sort_order");

        const allTasks = (allTaskRows ?? []).map((r) => toTask(r as Record<string, unknown>));
        const tasksToShift = allTasks.filter((t) => t.sortOrder > currentTask.sortOrder);

        for (const t of tasksToShift) {
          const tStart = new Date(t.startDate);
          tStart.setDate(tStart.getDate() + shiftDays);
          await supabase
            .from("tasks")
            .update({ start_date: tStart.toISOString().split("T")[0] })
            .eq("id", t.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({ title: "Schedule updated", description: "Subsequent tasks have been adjusted automatically." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const active = tasks.filter((t) => t.status === "active").length;
    const upcoming = tasks.filter((t) => t.status === "upcoming").length;
    const total = tasks.length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, active, upcoming, total, progress };
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    const phaseOrder = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: { phase: Phase; tasks: Task[] }[] = [];
    for (const phase of phaseOrder) {
      const pTasks = tasks
        .filter((t) => t.phaseId === phase.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (pTasks.length > 0) {
        groups.push({ phase, tasks: pTasks });
      }
    }
    return groups;
  }, [tasks, phases]);

  function handleTaskClick(task: Task) {
    setEditingTask(task);
    setShowTaskForm(true);
  }

  if (loadingProject || loadingPhases || loadingTasks) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "active": return <Clock className="h-3.5 w-3.5 text-orange-500" />;
      default: return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-xl font-bold tracking-tight truncate" data-testid="text-project-name">
                {project.name}
              </h1>
              <Badge
                variant={project.status === "active" ? "default" : "secondary"}
                className="shrink-0"
              >
                {project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingTask(null);
            setShowTaskForm(true);
          }}
          data-testid="button-add-task"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Task
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-lg font-bold">{stats.progress}%</p>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Done</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.done}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-lg font-bold text-orange-500">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="text-lg font-bold">{stats.upcoming}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Gantt / List / Financial */}
      <Tabs defaultValue="gantt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gantt" data-testid="tab-gantt">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Gantt
          </TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">
            <List className="h-4 w-4 mr-1.5" /> Task List
          </TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">
            <PoundSterling className="h-4 w-4 mr-1.5" /> Financial Tracker
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gantt">
          <GanttChart
            tasks={tasks}
            phases={phases}
            onTaskClick={handleTaskClick}
            onCascadeUpdate={(taskId, durationWeeks) =>
              cascadeMutation.mutate({ taskId, durationWeeks })
            }
          />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          {groupedTasks.map((group) => (
            <div key={group.phase.id} className="space-y-1">
              <div className="flex items-center gap-2 px-1 py-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: group.phase.color }}
                />
                <h3 className="text-sm font-semibold">{group.phase.name}</h3>
                <span className="text-xs text-muted-foreground">
                  ({group.tasks.length} tasks)
                </span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                {group.tasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors ${
                      i > 0 ? "border-t" : ""
                    }`}
                    onClick={() => handleTaskClick(task)}
                    data-testid={`row-task-${task.id}`}
                  >
                    {statusIcon(task.status)}
                    <span
                      className={`text-sm flex-1 min-w-0 truncate ${
                        task.status === "done" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {task.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(task.startDate)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {task.durationWeeks}w
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 ${STATUS_COLORS[task.status] ?? ""}`}
                    >
                      {task.status}
                    </Badge>
                    <Pencil className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="financial">
          <FinancialTracker projectId={projectId} />
        </TabsContent>
      </Tabs>

      <TaskForm
        open={showTaskForm}
        onOpenChange={(open) => {
          setShowTaskForm(open);
          if (!open) setEditingTask(null);
        }}
        projectId={projectId}
        phases={phases}
        task={editingTask}
        onCascadeUpdate={(taskId, updates) =>
          cascadeMutation.mutate({ taskId, ...updates })
        }
      />
    </div>
  );
}
