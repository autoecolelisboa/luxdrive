import { useEffect, useRef } from 'react';

export type SignatureData = { w: number; h: number; s: number[][] };

/** Captures a signature as light vector strokes (a few hundred numbers instead of an image). */
export function SignaturePad({ onChange }: { onChange: (d: SignatureData | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * ratio; c.height = r.height * ratio;
      const ctx = c.getContext('2d')!;
      ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = () => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes.current) {
      ctx.beginPath(); ctx.moveTo(s[0], s[1]);
      for (let i = 2; i < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
      if (s.length === 2) ctx.lineTo(s[0] + 0.5, s[1] + 0.5);
      ctx.stroke();
    }
  };
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
  };
  const emit = () => {
    const r = ref.current!.getBoundingClientRect();
    const total = strokes.current.reduce((n, s) => n + s.length, 0);
    onChange(total >= 8 ? { w: Math.round(r.width), h: Math.round(r.height), s: strokes.current.map(s => [...s]) } : null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        className="sig"
        data-testid="signature"
        onPointerDown={e => { ref.current!.setPointerCapture(e.pointerId); drawing.current = true; strokes.current.push(pos(e)); redraw(); }}
        onPointerMove={e => {
          if (!drawing.current) return;
          const s = strokes.current[strokes.current.length - 1]; const [x, y] = pos(e);
          if (Math.abs(x - s[s.length - 2]) + Math.abs(y - s[s.length - 1]) >= 2) { s.push(x, y); redraw(); }
        }}
        onPointerUp={() => { drawing.current = false; emit(); }}
        onPointerCancel={() => { drawing.current = false; emit(); }}
      />
      <button type="button" className="btn ghost sm" onClick={() => { strokes.current = []; redraw(); onChange(null); }}>✕</button>
    </div>
  );
}

/** Draws a stored signature (for the lesson record) */
export function SignatureView({ data, height = 70 }: { data: SignatureData; height?: number }) {
  const scale = height / data.h;
  return (
    <svg width={data.w * scale} height={height} viewBox={`0 0 ${data.w} ${data.h}`} aria-label="signature">
      {data.s.map((s, i) => <polyline key={i} points={s.join(' ')} fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
