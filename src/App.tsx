import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ProjectDetail from "@/pages/ProjectDetail";
import WeeklySchedule from "@/pages/WeeklySchedule";
import NotFound from "@/pages/NotFound";
import { Building2, Sun, Moon, LayoutDashboard, CalendarDays, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="button-theme-toggle"
      className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-40 h-12 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-4">
      {/* Logo */}
      <Link to="/">
        <div className="flex items-center gap-2 cursor-pointer" data-testid="nav-logo">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
            BuildTracker
          </span>
        </div>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-2">
        <Link to="/">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              location.pathname === "/" || location.pathname === ""
                ? "bg-white/15 text-sidebar-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10"
            }`}
            data-testid="nav-dashboard"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </div>
        </Link>
        <Link to="/schedule">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              location.pathname === "/schedule"
                ? "bg-white/15 text-sidebar-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10"
            }`}
            data-testid="nav-schedule"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Schedule
          </div>
        </Link>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <ThemeToggle />
      {user && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          aria-label="Sign out"
          data-testid="button-sign-out"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      )}
    </header>
  );
}

function AppLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  return (
    <div className="flex flex-col min-h-screen">
      {!isAuthPage && <TopNav />}
      <main className={isAuthPage ? "" : "flex-1 p-4 lg:p-6 max-w-[1400px] mx-auto w-full"}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <WeeklySchedule />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppLayout />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
