import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { Budget, CostItem, Task, WorkerProfile } from "@/types";
import { toBudget, toCostItem, toTask, toWorkerProfile } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  FileUp,
  Camera,
  Loader2,
  HardHat,
  Wrench,
  Users,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  "Building Materials",
  "Subcontractor",
  "Contractor",
  "Skip Hire",
  "Welfare Facilities",
  "Company Labour",
  "Plant & Equipment",
  "Professional Fees",
  "Sundries",
  "Other",
];

const EXTRA_CATEGORIES = [
  "Additional Works",
  "Variation Order",
  "Provisional Sum Adjustment",
  "Daywork",
  "Other",
];

const LABOUR_CATEGORIES = [
  "Site Labourer",
  "Skilled Tradesman",
  "Foreman / Supervisor",
  "Apprentice",
  "Agency Worker",
  "Overtime",
  "Other",
];

const ADHOC_CATEGORIES = [
  "Emergency Repair",
  "Client Request",
  "Site Issue",
  "Weather Delay",
  "Rework",
  "Temporary Works",
  "Travel & Accommodation",
  "Miscellaneous",
  "Other",
];

interface Props {
  projectId: number;
}

export function FinancialTracker({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [costType, setCostType] = useState<"extra" | "expense" | "labour" | "adhoc">("expense");

  const { data: budget, isLoading: loadingBudget } = useQuery<Budget | null>({
    queryKey: ["projects", projectId, "budget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toBudget(data as Record<string, unknown>) : null;
    },
    enabled: !!user,
  });

  const { data: costItems = [], isLoading: loadingCosts } = useQuery<CostItem[]>({
    queryKey: ["projects", projectId, "costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_items")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toCostItem(row as Record<string, unknown>));
    },
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
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
    enabled: !!user,
  });

  const financials = useMemo(() => {
    const originalBudget = budget?.originalValue ?? 0;
    const extras = costItems
      .filter((c) => c.type === "extra")
      .reduce((sum, c) => sum + c.amount, 0);
    const expenseTotal = costItems
      .filter((c) => c.type === "expense")
      .reduce((sum, c) => sum + c.amount, 0);
    const labourTotal = costItems
      .filter((c) => c.type === "labour")
      .reduce((sum, c) => sum + c.amount, 0);
    const adhocTotal = costItems
      .filter((c) => c.type === "adhoc")
      .reduce((sum, c) => sum + c.amount, 0);
    const totalSpent = expenseTotal + labourTotal + adhocTotal;
    const totalBudget = originalBudget + extras;
    const remaining = totalBudget - totalSpent;
    const percentSpent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    return { originalBudget, extras, expenseTotal, labourTotal, adhocTotal, totalSpent, totalBudget, remaining, percentSpent };
  }, [budget, costItems]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    costItems
      .filter((c) => c.type !== "extra")
      .forEach((c) => {
        const label =
          c.type === "labour"
            ? `Labour: ${c.category}`
            : c.type === "adhoc"
              ? `Adhoc: ${c.category}`
              : c.category;
        map.set(label, (map.get(label) ?? 0) + c.amount);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [costItems]);

  const extraItems = costItems.filter((c) => c.type === "extra");
  const expenseItems = costItems.filter((c) => c.type === "expense");
  const labourItems = costItems.filter((c) => c.type === "labour");
  const adhocItems = costItems.filter((c) => c.type === "adhoc");

  function openAddDialog(type: "extra" | "expense" | "labour" | "adhoc") {
    setCostType(type);
    setEditingCost(null);
    setShowCostDialog(true);
  }

  function openEditDialog(item: CostItem) {
    setEditingCost(item);
    setCostType(item.type);
    setShowCostDialog(true);
  }

  return (
    <div className="space-y-6" data-testid="financial-tracker">
      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Original Budget"
          value={financials.originalBudget}
          icon={<Wallet className="h-4 w-4" />}
          accent="text-primary"
          onClick={() => setShowBudgetDialog(true)}
          testId="card-original-budget"
        />
        <SummaryCard
          label="Client Extras"
          value={financials.extras}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="text-emerald-600 dark:text-emerald-400"
          testId="card-extras"
        />
        <SummaryCard
          label="Total Budget"
          value={financials.totalBudget}
          icon={<PoundSterling className="h-4 w-4" />}
          accent="text-primary"
          highlight
          testId="card-total-budget"
        />
        <SummaryCard
          label="Total Spent"
          value={financials.totalSpent}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="text-orange-600 dark:text-orange-400"
          testId="card-total-spent"
        />
        <SummaryCard
          label="Remaining"
          value={financials.remaining}
          icon={<Receipt className="h-4 w-4" />}
          accent={financials.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
          highlight
          testId="card-remaining"
        />
      </div>

      {/* Budget progress bar */}
      {financials.totalBudget > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Budget utilisation</span>
            <span>{financials.percentSpent.toFixed(1)}% spent</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                financials.percentSpent > 90
                  ? "bg-red-500"
                  : financials.percentSpent > 75
                    ? "bg-orange-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(financials.percentSpent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Spend Breakdown Mini Cards ─── */}
      {financials.totalSpent > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-2.5 px-3.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Receipt className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Expenses</p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                £{financials.expenseTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2.5 px-3.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <HardHat className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Labour</p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                £{financials.labourTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2.5 px-3.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Wrench className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Adhoc</p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                £{financials.adhocTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Inner Sub-Tabs ─── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" data-testid="subtab-overview">
            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="labour" data-testid="subtab-labour">
            <HardHat className="h-3.5 w-3.5 mr-1.5" /> Company Labour
            {labourItems.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1.5 py-0">
                {labourItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="adhoc" data-testid="subtab-adhoc">
            <Wrench className="h-3.5 w-3.5 mr-1.5" /> Adhoc
            {adhocItems.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[9px] px-1.5 py-0">
                {adhocItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-4">
          {expensesByCategory.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Expenditure by Category
                </h3>
                <div className="space-y-2">
                  {expensesByCategory.map(([cat, total]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/80">{cat}</span>
                      <span className="font-medium tabular-nums">£{total.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowBudgetDialog(true)} variant="outline" size="sm" data-testid="button-set-budget">
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              {budget ? "Edit Budget" : "Set Budget"}
            </Button>
            <Button onClick={() => openAddDialog("extra")} variant="outline" size="sm" data-testid="button-add-extra">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Add Client Extra
            </Button>
            <Button onClick={() => openAddDialog("expense")} size="sm" data-testid="button-add-expense">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Expense
            </Button>
          </div>

          {extraItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Client Extras / Additional Charges
              </h3>
              <CostTable items={extraItems} onEdit={openEditDialog} />
            </div>
          )}

          {expenseItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                Invoices & Expenses
              </h3>
              <CostTable items={expenseItems} onEdit={openEditDialog} />
            </div>
          )}

          {costItems.filter((c) => c.type === "extra" || c.type === "expense").length === 0 && !loadingCosts && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No expenses or extras recorded yet. Set a budget and start adding entries.
            </div>
          )}
        </TabsContent>

        {/* ─── COMPANY LABOUR TAB ─── */}
        <TabsContent value="labour" className="space-y-4">
          {labourItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Labour Cost</p>
                  <p className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    £{financials.labourTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Entries</p>
                  <p className="text-lg font-bold">{labourItems.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Hours</p>
                  <p className="text-lg font-bold tabular-nums">
                    {labourItems.reduce((s, c) => s + c.hoursWorked, 0).toFixed(1)}h
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Avg Day Rate</p>
                  <p className="text-lg font-bold tabular-nums">
                    £{labourItems.length > 0
                      ? (labourItems.reduce((s, c) => s + c.dayRate, 0) / (labourItems.filter((c) => c.dayRate > 0).length || 1)).toFixed(2)
                      : "0.00"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => openAddDialog("labour")} size="sm" data-testid="button-add-labour">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Labour Entry
            </Button>
          </div>

          {labourItems.length > 0 ? (
            <LabourTable items={labourItems} onEdit={openEditDialog} />
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <HardHat className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No company labour entries yet. Track worker hours, day rates, and labour costs here.
            </div>
          )}
        </TabsContent>

        {/* ─── ADHOC TAB ─── */}
        <TabsContent value="adhoc" className="space-y-4">
          {adhocItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Adhoc Spend</p>
                  <p className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    £{financials.adhocTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2.5 px-3.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Entries</p>
                  <p className="text-lg font-bold">{adhocItems.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => openAddDialog("adhoc")} size="sm" data-testid="button-add-adhoc">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Adhoc Entry
            </Button>
          </div>

          {adhocItems.length > 0 ? (
            <CostTable items={adhocItems} onEdit={openEditDialog} />
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No adhoc entries yet. Log emergency repairs, client requests, rework, or any one-off costs here.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Budget Dialog ─── */}
      <BudgetDialog
        open={showBudgetDialog}
        onOpenChange={setShowBudgetDialog}
        projectId={projectId}
        existing={budget}
      />

      {/* ─── Cost Item Dialog ─── */}
      {showCostDialog && (
        <CostItemDialog
          open={showCostDialog}
          onOpenChange={(open) => {
            setShowCostDialog(open);
            if (!open) setEditingCost(null);
          }}
          projectId={projectId}
          type={costType}
          existing={editingCost}
          projectTasks={tasks}
        />
      )}
    </div>
  );
}

// ─── Summary Card ───
function SummaryCard({
  label,
  value,
  icon,
  accent,
  highlight,
  onClick,
  testId,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  highlight?: boolean;
  onClick?: () => void;
  testId: string;
}) {
  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:shadow-sm" : ""} ${highlight ? "border-primary/30" : ""}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`${accent}`}>{icon}</span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        </div>
        <p className={`text-lg font-bold tabular-nums ${accent}`}>
          £{value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Standard Cost Items Table ───
function CostTable({ items, onEdit }: { items: CostItem[]; onEdit: (item: CostItem) => void }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">Date</th>
              <th className="text-left py-2 px-3 font-medium">Description</th>
              <th className="text-left py-2 px-3 font-medium">Category</th>
              <th className="text-left py-2 px-3 font-medium">Supplier / Ref</th>
              <th className="text-right py-2 px-3 font-medium">Amount</th>
              <th className="py-2 px-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onEdit(item)}
                data-testid={`row-cost-${item.id}`}
              >
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(item.date)}
                </td>
                <td className="py-2 px-3 font-medium">{item.description}</td>
                <td className="py-2 px-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {item.supplier}
                  {item.reference && <span className="ml-1 text-muted-foreground/60">#{item.reference}</span>}
                </td>
                <td className="py-2 px-3 text-right font-medium tabular-nums whitespace-nowrap">
                  £{item.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3">
                  <Pencil className="h-3 w-3 text-muted-foreground/40" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td colSpan={4} className="py-2 px-3 text-xs font-semibold text-muted-foreground">
                Total ({items.length} items)
              </td>
              <td className="py-2 px-3 text-right font-bold tabular-nums">
                £{items.reduce((s, c) => s + c.amount, 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Labour Table ───
function LabourTable({ items, onEdit }: { items: CostItem[]; onEdit: (item: CostItem) => void }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">Date</th>
              <th className="text-left py-2 px-3 font-medium">Worker</th>
              <th className="text-left py-2 px-3 font-medium">Description</th>
              <th className="text-left py-2 px-3 font-medium">Role</th>
              <th className="text-right py-2 px-3 font-medium">Hours</th>
              <th className="text-right py-2 px-3 font-medium">Day Rate</th>
              <th className="text-right py-2 px-3 font-medium">Amount</th>
              <th className="py-2 px-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onEdit(item)}
                data-testid={`row-labour-${item.id}`}
              >
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(item.date)}
                </td>
                <td className="py-2 px-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-muted-foreground/60" />
                    {item.workerName || "—"}
                  </div>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{item.description}</td>
                <td className="py-2 px-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {item.hoursWorked > 0 ? `${item.hoursWorked}h` : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {item.dayRate > 0 ? `£${item.dayRate.toFixed(2)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right font-medium tabular-nums whitespace-nowrap">
                  £{item.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3">
                  <Pencil className="h-3 w-3 text-muted-foreground/40" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td colSpan={4} className="py-2 px-3 text-xs font-semibold text-muted-foreground">
                Total ({items.length} entries)
              </td>
              <td className="py-2 px-3 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                {items.reduce((s, c) => s + c.hoursWorked, 0).toFixed(1)}h
              </td>
              <td className="py-2 px-3"></td>
              <td className="py-2 px-3 text-right font-bold tabular-nums">
                £{items.reduce((s, c) => s + c.amount, 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Budget Dialog ───
function BudgetDialog({
  open,
  onOpenChange,
  projectId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  existing: Budget | null | undefined;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenChange = (o: boolean) => {
    if (o && existing) {
      setValue(existing.originalValue.toString());
      setNotes(existing.notes);
    } else if (o) {
      setValue("");
      setNotes("");
    }
    onOpenChange(o);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: existingBudget } = await supabase
        .from("budgets")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      const payload = {
        project_id: projectId,
        original_value: parseFloat(value) || 0,
        notes,
      };

      if (existingBudget) {
        const { error } = await supabase
          .from("budgets")
          .update(payload)
          .eq("id", existingBudget.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("budgets").insert(payload);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "budget"] });
      toast({ title: "Budget saved" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project Budget</DialogTitle>
          <DialogDescription>
            Set the original contract/project value. Client extras will be added on top.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4 mt-2"
        >
          <div className="space-y-2">
            <Label htmlFor="budget-value">Project Value (£)</Label>
            <Input
              id="budget-value"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 350000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              data-testid="input-budget-value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-notes">Notes</Label>
            <Textarea
              id="budget-notes"
              placeholder="e.g. Contract value agreed 15 Jan 2026"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="input-budget-notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-budget">
              {mutation.isPending ? "Saving..." : "Save Budget"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper: generate weekdays ───
function getCurrentWeekDays(): { label: string; value: string }[] {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const days: { label: string; value: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" });
    days.push({ label, value: iso });
  }
  return days;
}

// ─── Cost Item Dialog ───
function CostItemDialog({
  open,
  onOpenChange,
  projectId,
  type,
  existing,
  projectTasks = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  type: "extra" | "expense" | "labour" | "adhoc";
  existing: CostItem | null;
  projectTasks?: Task[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = !!existing;

  const categories =
    type === "expense" ? EXPENSE_CATEGORIES :
    type === "extra" ? EXTRA_CATEGORIES :
    type === "labour" ? LABOUR_CATEGORIES :
    ADHOC_CATEGORIES;

  const taskNames = projectTasks.map((t) => t.name);
  const initMatchesTask = existing ? taskNames.includes(existing.description) : false;

  const [description, setDescription] = useState(existing?.description ?? "");
  const [manualDescription, setManualDescription] = useState(
    existing && !initMatchesTask ? existing.description : ""
  );
  const [useManualDesc, setUseManualDesc] = useState(
    type === "labour" && !!existing && !initMatchesTask && existing.description !== ""
  );
  const [amount, setAmount] = useState(existing?.amount.toString() ?? "");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().split("T")[0]);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    existing ? [existing.date] : [new Date().toISOString().split("T")[0]]
  );
  const [category, setCategory] = useState(existing?.category ?? categories[0]);
  const [supplier, setSupplier] = useState(existing?.supplier ?? "");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [workerName, setWorkerName] = useState(existing?.workerName ?? "");
  const [hoursWorked, setHoursWorked] = useState(
    existing && existing.hoursWorked > 0 ? existing.hoursWorked.toString() : ""
  );
  const [dayRate, setDayRate] = useState(
    existing && existing.dayRate > 0 ? existing.dayRate.toString() : ""
  );

  const { data: workerProfiles = [] } = useQuery<WorkerProfile[]>({
    queryKey: ["worker_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_profiles").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toWorkerProfile(row as Record<string, unknown>));
    },
    enabled: type === "labour" && !!user,
  });

  const weekDays = useMemo(() => getCurrentWeekDays(), []);

  const toggleDay = useCallback((dayVal: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal]
    );
  }, []);

  const handleWorkerBlur = useCallback(() => {
    if (!workerName.trim() || type !== "labour") return;
    const match = workerProfiles.find(
      (p) => p.name.toLowerCase() === workerName.trim().toLowerCase()
    );
    if (match) {
      if (!dayRate) setDayRate(match.defaultDayRate > 0 ? match.defaultDayRate.toString() : "");
      if (!category || category === categories[0]) {
        if (match.defaultCategory) setCategory(match.defaultCategory);
      }
      if (!supplier && match.defaultSupplier) setSupplier(match.defaultSupplier);
    }
  }, [workerName, workerProfiles, dayRate, category, supplier, type, categories]);

  const computedAmount = useMemo(() => {
    if (type === "labour") {
      const h = parseFloat(hoursWorked) || 0;
      const r = parseFloat(dayRate) || 0;
      if (h > 0 && r > 0) {
        return ((h / 8) * r).toFixed(2);
      }
    }
    return null;
  }, [type, hoursWorked, dayRate]);

  const nameSuggestions = useMemo(() => {
    if (type !== "labour" || !workerName.trim() || isEdit) return [];
    const lower = workerName.trim().toLowerCase();
    return workerProfiles
      .filter((p) => p.name.toLowerCase().includes(lower) && p.name.toLowerCase() !== lower)
      .slice(0, 5);
  }, [workerName, workerProfiles, type, isEdit]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalDescription = type === "labour" && useManualDesc ? manualDescription : description;
      const finalAmount =
        type === "labour"
          ? computedAmount ? parseFloat(computedAmount) : parseFloat(amount) || 0
          : parseFloat(amount) || 0;

      const baseBody = {
        project_id: projectId,
        type,
        description: finalDescription,
        amount: finalAmount,
        category: category || categories[0],
        supplier,
        reference,
        notes,
        worker_name: type === "labour" ? workerName : "",
        hours_worked: type === "labour" ? parseFloat(hoursWorked) || 0 : 0,
        day_rate: type === "labour" ? parseFloat(dayRate) || 0 : 0,
      };

      let createdItem: Record<string, unknown> | null = null;

      if (isEdit) {
        const { data, error } = await supabase
          .from("cost_items")
          .update({ ...baseBody, date })
          .eq("id", existing!.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        createdItem = data as Record<string, unknown>;

        // Sync labour → schedule (update)
        if (type === "labour" && createdItem) {
          const ci = toCostItem(createdItem);
          await supabase
            .from("schedule_entries")
            .update({
              task_description: ci.description,
              workers: ci.workerName,
              date: ci.date,
              project_id: ci.projectId,
            })
            .eq("source_labour_id", existing!.id);
        }
      } else if (type === "labour" && selectedDays.length > 0) {
        for (const d of selectedDays) {
          const { data, error } = await supabase
            .from("cost_items")
            .insert({ ...baseBody, date: d })
            .select()
            .single();
          if (error) throw new Error(error.message);
          createdItem = data as Record<string, unknown>;

          // Sync labour → schedule (create)
          if (createdItem && baseBody.worker_name) {
            await supabase.from("schedule_entries").insert({
              project_id: projectId,
              date: d,
              task_description: finalDescription,
              workers: baseBody.worker_name,
              notes: "",
              color: "#DBEAFE",
              source_labour_id: (createdItem as { id: number }).id,
            });
          }
        }
      } else {
        const { data, error } = await supabase
          .from("cost_items")
          .insert({ ...baseBody, date })
          .select()
          .single();
        if (error) throw new Error(error.message);
        createdItem = data as Record<string, unknown>;

        // Sync labour → schedule (create single)
        if (type === "labour" && createdItem && baseBody.worker_name) {
          await supabase.from("schedule_entries").insert({
            project_id: projectId,
            date,
            task_description: finalDescription,
            workers: baseBody.worker_name,
            notes: "",
            color: "#DBEAFE",
            source_labour_id: (createdItem as { id: number }).id,
          });
        }
      }

      // Auto-save worker profile
      if (type === "labour" && workerName.trim()) {
        const existing_profile = await supabase
          .from("worker_profiles")
          .select("id")
          .eq("user_id", user!.id)
          .ilike("name", workerName.trim())
          .maybeSingle();

        const profileData = {
          user_id: user!.id,
          name: workerName.trim(),
          default_day_rate: parseFloat(dayRate) || 0,
          default_category: category || categories[0],
          default_supplier: supplier,
          updated_at: new Date().toISOString(),
        };

        if (existing_profile.data) {
          await supabase.from("worker_profiles").update(profileData).eq("id", existing_profile.data.id);
        } else {
          await supabase.from("worker_profiles").insert(profileData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "costs"] });
      if (type === "labour") {
        queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
        queryClient.invalidateQueries({ queryKey: ["worker_profiles"] });
      }
      const dayCount = !isEdit && type === "labour" ? selectedDays.length : 1;
      toast({ title: isEdit ? "Updated" : `Added${dayCount > 1 ? ` (${dayCount} days)` : ""}` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete linked schedule entries first (labour sync)
      if (type === "labour") {
        await supabase.from("schedule_entries").delete().eq("source_labour_id", existing!.id);
      }
      const { error } = await supabase.from("cost_items").delete().eq("id", existing!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "costs"] });
      if (type === "labour") {
        queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
      }
      toast({ title: "Deleted" });
      onOpenChange(false);
    },
  });

  const dialogTitle = {
    extra: "Client Extra",
    expense: "Invoice / Expense",
    labour: "Company Labour Entry",
    adhoc: "Adhoc Cost",
  }[type];

  const dialogDesc = {
    extra: "Additional works or variations charged to the client.",
    expense: "Record an invoice, material purchase, subcontractor payment, or project expense.",
    labour: "Log company labour — worker name, hours, day rate. Select one or more days.",
    adhoc: "One-off or miscellaneous costs — emergency repairs, rework, travel, etc.",
  }[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add"} {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4 mt-2"
        >
          {/* Labour-specific: Worker Name */}
          {type === "labour" && (
            <div className="space-y-2 relative">
              <Label>Worker Name</Label>
              <Input
                placeholder="e.g. John Smith"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                onBlur={handleWorkerBlur}
                data-testid="input-worker-name"
              />
              {nameSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md">
                  {nameSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setWorkerName(p.name);
                        if (p.defaultDayRate > 0) setDayRate(p.defaultDayRate.toString());
                        if (p.defaultCategory) setCategory(p.defaultCategory);
                        if (p.defaultSupplier) setSupplier(p.defaultSupplier);
                      }}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.defaultDayRate > 0 && (
                        <span className="text-xs text-muted-foreground">£{p.defaultDayRate}/day</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{type === "labour" ? "Task" : "Description"}</Label>
            {type === "labour" && projectTasks.length > 0 ? (
              <>
                {!useManualDesc ? (
                  <Select
                    value={description}
                    onValueChange={(val) => {
                      if (val === "__other__") {
                        setUseManualDesc(true);
                        setDescription("");
                        setManualDescription("");
                      } else {
                        setDescription(val);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-cost-description">
                      <SelectValue placeholder="Select a task from the project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTasks.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Other (type manually)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type task description"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      required
                      className="flex-1"
                      data-testid="input-cost-description-manual"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => {
                        setUseManualDesc(false);
                        setManualDescription("");
                        setDescription("");
                      }}
                    >
                      Task List
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Input
                placeholder={
                  type === "expense" ? "e.g. Bricks delivery - Travis Perkins" :
                  type === "labour" ? "e.g. Site labouring - ground floor" :
                  type === "adhoc" ? "e.g. Emergency plumber callout" :
                  "e.g. Additional bathroom tiling"
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                data-testid="input-cost-description"
              />
            )}
          </div>

          {/* Labour-specific: Hours & Day Rate */}
          {type === "labour" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hours Worked</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 8"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  data-testid="input-hours-worked"
                />
              </div>
              <div className="space-y-2">
                <Label>Day Rate (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 200"
                  value={dayRate}
                  onChange={(e) => setDayRate(e.target.value)}
                  data-testid="input-day-rate"
                />
              </div>
            </div>
          )}

          {type === "labour" && computedAmount && (
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-300">
                {hoursWorked}h ÷ 8h/day × £{dayRate}/day = <span className="font-bold">£{computedAmount}</span>
              </span>
            </div>
          )}

          {/* Date: multi-day for new labour, single date otherwise */}
          {type === "labour" && !isEdit ? (
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex gap-1.5 flex-wrap">
                {weekDays.map((d) => {
                  const selected = selectedDays.includes(d.value);
                  return (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="text-xs px-2.5 h-8"
                      onClick={() => toggleDay(d.value)}
                      data-testid={`toggle-day-${d.value}`}
                    >
                      {d.label}
                    </Button>
                  );
                })}
              </div>
              {selectedDays.length > 1 && (
                <p className="text-[10px] text-muted-foreground">
                  {selectedDays.length} days selected — one entry per day
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                data-testid="input-cost-date"
              />
            </div>
          )}

          {/* Amount for non-labour types */}
          {type !== "labour" && (
            <div className="space-y-2">
              <Label>Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                data-testid="input-cost-amount"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{type === "labour" ? "Role / Type" : "Category"}</Label>
              <Select value={category || categories[0]} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-cost-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{type === "labour" ? "Agency / Company" : "Supplier"}</Label>
              <Input
                placeholder={type === "labour" ? "e.g. Elliott Construction" : "e.g. Travis Perkins"}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                data-testid="input-cost-supplier"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                placeholder={type === "labour" ? "e.g. Timesheet-W16" : "e.g. INV-2026-0042"}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                data-testid="input-cost-reference"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-cost-notes"
              />
            </div>
          </div>

          {/* File upload hint */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
            <div className="flex gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <Camera className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Drag & drop an invoice or take a photo to auto-fill details (coming soon)
            </p>
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
                  data-testid="button-delete-cost"
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
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-cost">
                {saveMutation.isPending
                  ? "Saving..."
                  : isEdit
                    ? "Update"
                    : type === "labour" && selectedDays.length > 1
                      ? `Add (${selectedDays.length} days)`
                      : "Add"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
