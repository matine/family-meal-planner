import { toast } from "sonner";
import { isOnline } from "@/lib/offline/online";

export function requireOnline(message = "You're offline — connect to the internet for this."): boolean {
  if (isOnline()) return true;
  toast.error(message);
  return false;
}
