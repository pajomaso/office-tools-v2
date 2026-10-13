// Renders a guide's text. A line that is only a link becomes:
// - a video player for YouTube, Vimeo or Loom links,
// - a picture for image links (.jpg, .png, .webp, .gif) and photos uploaded in Settings,
// - a plain link otherwise. Everything else stays as text.
const IMAGE = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;

function videoEmbed(u: URL): string | null {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
  if (host === "youtube.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "vimeo.com") { const id = u.pathname.match(/^\/(\d+)/)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
  if (host === "loom.com") { const id = u.pathname.match(/^\/share\/([\w-]+)/)?.[1]; return id ? `https://www.loom.com/embed/${id}` : null; }
  return null;
}

function asUrl(line: string): URL | null {
  const t = line.trim();
  if (t.startsWith("/api/portal/guide-photos/")) return new URL(t, window.location.origin);
  if (!/^https:\/\/\S+$/.test(t)) return null;
  try { return new URL(t); } catch { return null; }
}

export default function GuideBody({ text, title }: { text: string; title: string }) {
  const blocks: { kind: "text" | "video" | "image" | "link"; value: string }[] = [];
  for (const line of text.split("\n")) {
    const u = asUrl(line);
    const kind = !u ? "text" : videoEmbed(u) ? "video" : IMAGE.test(u.pathname) || u.pathname.startsWith("/api/portal/guide-photos/") ? "image" : "link";
    const value = kind === "video" ? videoEmbed(u!)! : kind === "text" ? line : u!.href;
    const last = blocks[blocks.length - 1];
    if (kind === "text" && last?.kind === "text") last.value += "\n" + line; else blocks.push({ kind, value });
  }
  return (
    <div className="mt-2 flex flex-col gap-3 text-sm text-[var(--ink-soft)]">
      {blocks.map((b, i) =>
        b.kind === "text" ? (b.value.trim() ? <p key={i} className="whitespace-pre-line">{b.value.replace(/^\n+|\n+$/g, "")}</p> : null)
        : b.kind === "video" ? <iframe key={i} src={b.value} title={`${title}: video`} className="aspect-video w-full rounded-md border border-[var(--line)]" allow="fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
        : b.kind === "image" ? <img key={i} src={b.value} alt={`${title}: photo`} loading="lazy" referrerPolicy="no-referrer" className="max-h-96 w-full rounded-md border border-[var(--line)] object-contain bg-[var(--surface-2)]" />
        : <a key={i} href={b.value} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--brand)] hover:underline">{b.value}</a>,
      )}
    </div>
  );
}
