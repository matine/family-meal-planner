import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, Carrot, LogOut, ShoppingBasket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Shopping", icon: ShoppingBasket },
  { to: "/pantry", label: "Pantry", icon: Carrot },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/planner", label: "Planner", icon: CalendarCheck },
] as const;

export function AppNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const displayName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "Account";

  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-2 px-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="font-semibold tracking-tight leading-4">Meal planner</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden max-w-[10rem] truncate text-xs text-muted-foreground md:inline">
            {displayName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              void signOut().then(() => navigate({ href: "/login" }));
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
