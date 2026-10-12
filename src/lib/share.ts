/**
 * Share helpers — building and copying ABSOLUTE public URLs.
 *
 * Every share affordance (public audition page Share, setup / auditions
 * "Copy link") must hand out a URL that works for the recipient:
 *   - `NEXT_PUBLIC_SITE_URL` wins when set (canonical base, same var seo.ts
 *     uses — set in prod/staging so Vercel preview hosts don't leak into
 *     shared links);
 *   - otherwise the current origin (correct in local dev AND in mock mode,
 *     where no env exists at all).
 */

export function publicShareUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

/**
 * Copy text to the clipboard with a legacy fallback (execCommand via a
 * hidden textarea) for browsers/contexts where the async Clipboard API is
 * unavailable or blocked. Returns true when the copy succeeded — callers
 * show the "Link copied!" / error toast.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
