import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export type Tool = "rect" | "arrow" | "pen" | "blur";
type Point = { x: number; y: number };
type Shape =
  | { tool: "rect" | "arrow" | "blur"; color: string; from: Point; to: Point }
  | { tool: "pen"; color: string; points: Point[] };

export type AnnotatorApi = { toBlob: () => Promise<Blob>; toDataUrl: () => string };

export const COLORS = ["#f87171", "#fbbf24", "#5eead4"];

type Labels = { tools: Record<Tool, string>; undo: string; clearMarks: string; screenshot: string };

function normalize(from: Point, to: Point) {
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) };
}

function draw(ctx: CanvasRenderingContext2D, image: HTMLImageElement, shapes: Shape[]) {
  const { width, height } = ctx.canvas;
  const stroke = Math.max(3, Math.round(width / 400));
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);

  for (const s of shapes) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.tool === "blur") {
      // Pixelado irreversible: se reduce la zona y se vuelve a ampliar sin suavizado.
      const r = normalize(s.from, s.to);
      if (r.w < 2 || r.h < 2) continue;
      const block = Math.max(8, Math.round(width / 120));
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(r.w / block));
      small.height = Math.max(1, Math.round(r.h / block));
      small.getContext("2d")!.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, small.width, small.height, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    } else if (s.tool === "rect") {
      const r = normalize(s.from, s.to);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (s.tool === "arrow") {
      const { from, to } = s;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = stroke * 5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x - Math.cos(angle) * head * 0.6, to.y - Math.sin(angle) * head * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 7), to.y - head * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 7), to.y - head * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
    } else if (s.tool === "pen" && s.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }
}

const ICONS: Record<Tool, string> = {
  rect: "M4 6h16v12H4z",
  arrow: "M5 19L19 5M19 5h-8M19 5v8",
  pen: "M4 20l4-1 11-11-3-3L5 16l-1 4z",
  blur: "M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z",
};

export function Annotator({ src, labels, ref }: { src: string; labels: Labels; ref?: Ref<AnnotatorApi> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    draw(canvas.getContext("2d")!, image, draft ? [...shapes, draft] : shapes);
  }, [image, shapes, draft]);

  useImperativeHandle(ref, () => ({
    toDataUrl: () => canvasRef.current!.toDataURL("image/png"),
    toBlob: () => new Promise((resolve) => canvasRef.current!.toBlob((b) => resolve(b!), "image/png")),
  }));

  const point = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = e.currentTarget.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  }, []);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    setDraft(tool === "pen" ? { tool, color, points: [p] } : { tool, color, from: p, to: p });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const p = point(e);
    setDraft(draft.tool === "pen" ? { ...draft, points: [...draft.points, p] } : { ...draft, to: p });
  };

  const onUp = () => {
    if (!draft) return;
    const tiny = draft.tool === "pen" ? draft.points.length < 2 : Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) < 4;
    if (!tiny) setShapes((s) => [...s, draft]);
    setDraft(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShapes((s) => s.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label={labels.screenshot}>
          {(Object.keys(ICONS) as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tool === t}
              onClick={() => setTool(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${tool === t ? "bg-accent text-bg" : "text-zinc-300 hover:bg-panel"}`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <path d={ICONS[t]} />
              </svg>
              {labels.tools[t]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "border-zinc-100" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setShapes((s) => s.slice(0, -1))} disabled={!shapes.length} className="rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-panel disabled:opacity-40">
            ↶ {labels.undo}
          </button>
          <button type="button" onClick={() => setShapes([])} disabled={!shapes.length} className="rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-panel disabled:opacity-40">
            {labels.clearMarks}
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        data-testid="annotator"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="block h-auto w-full cursor-crosshair touch-none rounded-lg border border-line"
      />
    </div>
  );
}
