import { useMemo, useRef, useEffect } from "react";
import type { Task, Phase } from "@/types";
import { addWeeks, formatShortDate, getWeekStart } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DAY_WIDTH = 4;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 56;
const LABEL_WIDTH = 220;

interface GanttChartProps {
  tasks: Task[];
  phases: Phase[];
  onTaskClick?: (task: Task) => void;
  onCascadeUpdate?: (taskId: number, durationWeeks: number) => void;
}

export function GanttChart({ tasks, phases, onTaskClick, onCascadeUpdate }: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { timelineStart, timelineEnd, totalDays, months, weeks } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const start = getWeekStart(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 180);
      return { timelineStart: start, timelineEnd: end, totalDays: 180, months: [], weeks: [] };
    }

    let earliest = new Date(tasks[0].startDate);
    let latest = new Date(tasks[0].startDate);

    for (const t of tasks) {
      const s = new Date(t.startDate);
      const e = new Date(t.startDate);
      e.setDate(e.getDate() + t.durationWeeks * 7);
      if (s < earliest) earliest = s;
      if (e > latest) latest = e;
    }

    const start = getWeekStart(earliest);
    start.setDate(start.getDate() - 14);
    const end = new Date(latest);
    end.setDate(end.getDate() + 14);

    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    const monthSpans: { label: string; startDay: number; width: number }[] = [];
    const cur = new Date(start);
    while (cur < end) {
      const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const spanStart = Math.max(0, Math.floor((mStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
      const spanEnd = Math.min(days, Math.ceil((mEnd.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const label = cur.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      monthSpans.push({ label, startDay: spanStart, width: (spanEnd - spanStart) * DAY_WIDTH });
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }

    const weekLines: { day: number; label: string; weekNum: number }[] = [];
    const wCur = getWeekStart(new Date(start));
    const projectWeekStart = getWeekStart(earliest);
    while (wCur <= end) {
      const dayOffset = Math.floor((wCur.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (dayOffset >= 0 && dayOffset < days) {
        const label = wCur.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
        const weeksSinceProject = Math.round((wCur.getTime() - projectWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
        weekLines.push({ day: dayOffset, label, weekNum: weeksSinceProject > 0 ? weeksSinceProject : 0 });
      }
      wCur.setDate(wCur.getDate() + 7);
    }

    return { timelineStart: start, timelineEnd: end, totalDays: days, months: monthSpans, weeks: weekLines };
  }, [tasks]);

  useEffect(() => {
    if (scrollRef.current && totalDays > 0) {
      const now = new Date();
      const dayOffset = Math.floor((now.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000));
      const scrollX = Math.max(0, dayOffset * DAY_WIDTH - 300);
      scrollRef.current.scrollLeft = scrollX;
    }
  }, [timelineStart, totalDays]);

  const rows = useMemo(() => {
    const grouped: { phase: Phase | null; tasks: Task[] }[] = [];
    const phaseOrder = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const phase of phaseOrder) {
      const pTasks = tasks.filter((t) => t.phaseId === phase.id).sort((a, b) => a.sortOrder - b.sortOrder);
      if (pTasks.length > 0) {
        grouped.push({ phase, tasks: pTasks });
      }
    }

    const unphased = tasks.filter((t) => !t.phaseId).sort((a, b) => a.sortOrder - b.sortOrder);
    if (unphased.length > 0) {
      grouped.push({ phase: null, tasks: unphased });
    }

    return grouped;
  }, [tasks, phases]);

  const flatRows = useMemo(() => {
    const result: { type: "phase" | "task"; phase?: Phase | null; task?: Task; index: number }[] = [];
    let idx = 0;
    for (const group of rows) {
      result.push({ type: "phase", phase: group.phase, index: idx });
      idx++;
      for (const t of group.tasks) {
        result.push({ type: "task", task: t, phase: group.phase, index: idx });
        idx++;
      }
    }
    return result;
  }, [rows]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    return Math.floor((now.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000));
  }, [timelineStart]);

  const chartWidth = totalDays * DAY_WIDTH;
  const chartHeight = flatRows.length * ROW_HEIGHT;

  function getBarStyle(task: Task) {
    const start = new Date(task.startDate);
    const dayOffset = Math.floor((start.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000));
    const widthDays = task.durationWeeks * 7;
    return {
      left: dayOffset * DAY_WIDTH,
      width: Math.max(widthDays * DAY_WIDTH, 8),
    };
  }

  function getBarColor(task: Task, phase: Phase | null | undefined) {
    if (task.status === "done") return "hsl(var(--muted-foreground) / 0.35)";
    if (task.status === "active") return "#DA7101";
    return phase?.color ?? "hsl(var(--primary))";
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm" data-testid="gantt-empty">
        No tasks yet. Add tasks to see the Gantt chart.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card" data-testid="gantt-chart">
      <div className="flex">
        {/* Fixed left labels */}
        <div className="shrink-0 border-r bg-card z-10" style={{ width: LABEL_WIDTH }}>
          <div className="border-b" style={{ height: HEADER_HEIGHT }}>
            <div className="h-7 border-b px-3 flex items-center">
              <span className="text-xs font-medium text-muted-foreground">Timeline</span>
            </div>
            <div className="h-7 px-3 flex items-center">
              <span className="text-xs text-muted-foreground">Week</span>
            </div>
          </div>
          <div>
            {flatRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center px-3 border-b ${
                  row.type === "phase"
                    ? "bg-muted/50 font-medium"
                    : "hover:bg-muted/30 cursor-pointer"
                }`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => row.type === "task" && row.task && onTaskClick?.(row.task)}
              >
                {row.type === "phase" ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: row.phase?.color ?? "hsl(var(--primary))" }}
                    />
                    <span className="text-xs truncate">{row.phase?.name ?? "Unphased"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pl-4 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        row.task!.status === "done"
                          ? "bg-muted-foreground/40"
                          : row.task!.status === "active"
                            ? "bg-orange-500"
                            : "bg-primary"
                      }`}
                    />
                    <span className="text-xs truncate text-foreground/80">{row.task!.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable chart area */}
        <div className="flex-1 overflow-x-auto gantt-scroll" ref={scrollRef}>
          <div style={{ width: chartWidth, position: "relative" }}>
            {/* Month headers */}
            <div className="border-b sticky top-0 bg-card z-10" style={{ height: HEADER_HEIGHT }}>
              <div className="relative h-7 border-b" style={{ width: chartWidth }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center px-2 border-r border-border/50"
                    style={{ left: m.startDay * DAY_WIDTH, width: m.width }}
                  >
                    <span className="text-xs font-medium text-foreground/70 whitespace-nowrap">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative h-7" style={{ width: chartWidth }}>
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col items-center justify-center"
                    style={{ left: w.day * DAY_WIDTH, width: 7 * DAY_WIDTH }}
                  >
                    {w.weekNum > 0 && (
                      <span className="text-[9px] text-muted-foreground/60 leading-none">
                        W{w.weekNum}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground/50 leading-none">
                      {w.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart body */}
            <div className="relative" style={{ height: chartHeight }}>
              {weeks.map((w, i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 bottom-0 border-l border-border/30"
                  style={{ left: w.day * DAY_WIDTH }}
                />
              ))}

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-20"
                  style={{ left: todayOffset * DAY_WIDTH }}
                >
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[8px] px-1 rounded-b font-medium">
                    TODAY
                  </div>
                </div>
              )}

              {/* Row backgrounds + bars */}
              {flatRows.map((row, i) => (
                <div
                  key={`row-${i}`}
                  className={`absolute w-full border-b ${
                    row.type === "phase" ? "bg-muted/30" : ""
                  }`}
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  {row.type === "task" && row.task && (() => {
                    const bar = getBarStyle(row.task);
                    const barColor = getBarColor(row.task, row.phase);
                    const endDate = addWeeks(row.task.startDate, row.task.durationWeeks);
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-1.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                            style={{
                              left: bar.left,
                              width: bar.width,
                              height: ROW_HEIGHT - 12,
                              backgroundColor: barColor,
                            }}
                            onClick={() => onTaskClick?.(row.task!)}
                            data-testid={`gantt-bar-${row.task.id}`}
                          >
                            {bar.width > 60 && (
                              <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate">
                                {row.task.name}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-medium">{row.task.name}</div>
                          <div className="text-muted-foreground">
                            {formatShortDate(row.task.startDate)} — {formatShortDate(endDate)}
                            {" · "}
                            {row.task.durationWeeks}w
                          </div>
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {row.task.status}
                          </Badge>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
