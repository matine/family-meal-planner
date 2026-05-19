import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old URL — home is now the shopping list. */
export const Route = createFileRoute("/shopping")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
