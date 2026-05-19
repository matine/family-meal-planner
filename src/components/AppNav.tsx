import { Link, useLocation } from "@tanstack/react-router";
import { Carrot, BookOpen, CalendarCheck, ShoppingBasket } from "lucide-react";

const links = [
  { to: "/", label: "Shopping", icon: ShoppingBasket },
  { to: "/pantry", label: "Pantry", icon: Carrot },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/planner", label: "Planner", icon: CalendarCheck },
] as const;

export function AppNav() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-semibold tracking-tight leading-4">Bowbrier Kitchen</span>
        </Link>
        <nav className="flex items-center gap-1">
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
      </div>
    </header>
  );
}
