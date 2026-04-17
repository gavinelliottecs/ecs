import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Project } from "@/types";
import { toProject } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Calendar, ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState } from "react";
import { NewProjectDialog } from "@/components/new-project-dialog";

export default function Dashboard() {
  const { user } = useAuth();
  const [showNewProject, setShowNewProject] = useState(false);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toProject(row as Record<string, unknown>));
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusCounts = {
    active: projects?.filter((p) => p.status === "active").length ?? 0,
    completed: projects?.filter((p) => p.status === "completed").length ?? 0,
    onHold: projects?.filter((p) => p.status === "on-hold").length ?? 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your construction projects and track progress
          </p>
        </div>
        <Button onClick={() => setShowNewProject(true)} data-testid="button-new-project">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-950">
                <Building2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.onHold}</p>
                <p className="text-xs text-muted-foreground">On Hold</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <Link key={project.id} to={`/project/${project.id}`}>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow group"
              data-testid={`card-project-${project.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <CardTitle className="text-base">{project.name}</CardTitle>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent>
                {project.address && (
                  <p className="text-sm text-muted-foreground mb-2">{project.address}</p>
                )}
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(project.startDate)}
                  </div>
                  <Badge
                    variant={
                      project.status === "active"
                        ? "default"
                        : project.status === "completed"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {project.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Empty state / Add card */}
        <Card
          className="cursor-pointer border-dashed hover:border-primary/50 transition-colors flex items-center justify-center min-h-[180px]"
          onClick={() => setShowNewProject(true)}
          data-testid="card-add-project"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FolderOpen className="h-8 w-8" />
            <p className="text-sm font-medium">Add Project</p>
          </div>
        </Card>
      </div>

      <NewProjectDialog open={showNewProject} onOpenChange={setShowNewProject} />
    </div>
  );
}
