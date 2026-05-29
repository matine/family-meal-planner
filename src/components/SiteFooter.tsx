import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const footerLinkClass =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

export function SiteFooter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const ingredientsActive =
    pathname === "/ingredients" || pathname.startsWith("/ingredients/");

  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-5xl px-3 py-3 sm:py-4">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Link
            to="/ingredients"
            className={cn(
              footerLinkClass,
              ingredientsActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <Sprout className="h-4 w-4 shrink-0" aria-hidden />
            Ingredients library
          </Link>

          <div className="flex w-full justify-start border-t border-border/50 pt-2 sm:w-auto sm:border-0 sm:pt-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                footerLinkClass,
                "h-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              )}
              onClick={() => {
                void signOut().then(() => navigate({ href: "/login" }));
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
