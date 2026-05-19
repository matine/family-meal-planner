import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-end px-3 py-4">
        <Link
          to="/ingredients"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Ingredients library
        </Link>
      </div>
    </footer>
  );
}
