import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { toProject } from "@/types";

const PROJECT_COLORS = [
  "#01696F", "#006494", "#964219", "#DA7101",
  "#7A39BB", "#437A22", "#A13544", "#5C4033",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const createProject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name,
          address,
          description,
          start_date: startDate,
          color,
          status: "active",
          user_id: user!.id,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toProject(data as Record<string, unknown>);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project created", description: `${project.name} is ready to go.` });
      onOpenChange(false);
      resetForm();
      navigate(`/project/${project.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setAddress("");
    setDescription("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setColor(PROJECT_COLORS[0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createProject.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new construction project to track.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g. 44 Elizabeth Crescent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="input-project-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-address">Address</Label>
            <Input
              id="project-address"
              placeholder="Site address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="input-project-address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Brief description of works"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="input-project-description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-start">Start Date</Label>
            <Input
              id="project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              data-testid="input-project-start"
            />
          </div>
          <div className="space-y-2">
            <Label>Project Color</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-foreground/40"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  data-testid={`button-color-${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-project"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name || createProject.isPending}
              data-testid="button-create-project"
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
