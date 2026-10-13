import "server-only";
import { revalidatePath } from "next/cache";

// Several actions take the page the button sits on as `path` so they can
// refresh just that page. It comes from the browser, so only a plain
// same-site path of reasonable length is accepted; anything else is
// ignored (the action itself still succeeds, the page just isn't refreshed).
export function revalidateClientPath(path: unknown) {
  if (typeof path !== "string" || path.length > 300) return;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return;
  if (/[\u0000-\u001f\u007f]/.test(path)) return;
  revalidatePath(path);
}
