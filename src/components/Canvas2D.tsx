import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Coordenadas, Ecuacion } from '../lib/types';

export interface ControlLienzo2D {
  zoomIn: () => void;
  zoomOut: () => void;
  centrar: () => void;
  exportar: () => string | null;
}

interface Props {
  ecuaciones: Ecuacion[];
  intersecciones: Array<{ x: number; y: number; etiqueta: string }>;
  onCoordenadas?: (c: Coordenadas | null) => void;
}

const EPS = 1e-9;

function pasoAgradable(escala: number): number {
  const unidades = 70 / escala;
  const exp = Math.floor(Math.log10(unidades));
  const frac = unidades / 10 ** exp;
  let paso: number;
  if (frac < 1.5) paso = 1;
  else if (frac < 3.5) paso = 2;
  else if (frac < 7.5) paso = 5;
  else paso = 10;
  return paso * 10 ** exp;
}

function recortarSemiplano(
  rect: Array<{ x: number; y: number }>,
  a: number,
  b: number,
  d: number,
  op: '<=' | '>=',
): Array<{ x: number; y: number }> {
  const dentro = (x: number, y: number) => {
    const v = a * x + b * y - d;
    return op === '<=' ? v <= EPS : v >= -EPS;
  };
  const salida: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < rect.length; i++) {
    const p1 = rect[i];
    const p2 = rect[(i + 1) % rect.length];
    const d1 = dentro(p1.x, p1.y);
    const d2 = dentro(p2.x, p2.y);
    if (d1) salida.push(p1);
    if (d1 !== d2) {
      const f1 = a * p1.x + b * p1.y - d;
      const f2 = a * p2.x + b * p2.y - d;
      const t = f1 / (f1 - f2);
      salida.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    }
  }
  return salida;
}

function formatoNumero(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function hexConAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const Canvas2D = forwardRef<ControlLienzo2D, Props>(function Canvas2D(
  { ecuaciones, intersecciones, onCoordenadas },
  ref,
) {
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const [centro, setCentro] = useState({ x: 0, y: 0 });
  const [escala, setEscala] = useState(70);
  const [revision, setRevision] = useState(0);
  const arrastrando = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const aparicionesRef = useRef<Map<string, number>>(new Map());
  const estado = useRef({ centro, escala });
  estado.current = { centro, escala };
  const onCoordenadasRef = useRef(onCoordenadas);
  onCoordenadasRef.current = onCoordenadas;

  useImperativeHandle(ref, () => ({
    zoomIn: () => setEscala((e) => Math.min(e * 1.3, 600)),
    zoomOut: () => setEscala((e) => Math.max(e / 1.3, 4)),
    centrar: () => setCentro({ x: 0, y: 0 }),
    exportar: () => lienzoRef.current?.toDataURL('image/png') ?? null,
  }));

  // Redibujar al redimensionar la ventana
  useEffect(() => {
    const canvas = lienzoRef.current;
    if (!canvas) return;
    const observador = new ResizeObserver(() => setRevision((r) => r + 1));
    observador.observe(canvas);
    return () => observador.disconnect();
  }, []);

  // Animación de aparición de nuevas rectas
  useEffect(() => {
    const actuales = new Set(ecuaciones.map((e) => e.id));
    let cambio = false;
    for (const id of actuales) {
      if (!aparicionesRef.current.has(id)) {
        aparicionesRef.current.set(id, performance.now());
        cambio = true;
      }
    }
    for (const id of [...aparicionesRef.current.keys()]) {
      if (!actuales.has(id)) {
        aparicionesRef.current.delete(id);
        cambio = true;
      }
    }
    if (!cambio) return;
    let raf = 0;
    const paso = () => {
      setRevision((r) => r + 1);
      const ahora = performance.now();
      let pendientes = 0;
      for (const t of aparicionesRef.current.values()) {
        if (ahora - t < 700) pendientes++;
      }
      if (pendientes > 0) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [ecuaciones]);

  useEffect(() => {
    const canvas = lienzoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);

    const { x: cx, y: cy } = centro;
    const sx = (wx: number) => ancho / 2 + (wx - cx) * escala;
    const sy = (wy: number) => alto / 2 - (wy - cy) * escala;
    const xMin = cx - ancho / 2 / escala;
    const xMax = cx + ancho / 2 / escala;
    const yMin = cy - alto / 2 / escala;
    const yMax = cy + alto / 2 / escala;

    const paso = pasoAgradable(escala);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#eaf3fd';
    ctx.beginPath();
    for (let x = Math.ceil(xMin / paso) * paso; x <= xMax; x += paso) {
      ctx.moveTo(sx(x), 0);
      ctx.lineTo(sx(x), alto);
    }
    for (let y = Math.ceil(yMin / paso) * paso; y <= yMax; y += paso) {
      ctx.moveTo(0, sy(y));
      ctx.lineTo(ancho, sy(y));
    }
    ctx.stroke();

    const rect = [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ];
    const ahora = performance.now();
    for (const ec of ecuaciones) {
      if (!ec.visible || ec.operador === '=') continue;
      if (Math.abs(ec.a) + Math.abs(ec.b) < EPS) continue;
      const poligono = recortarSemiplano(rect, ec.a, ec.b, ec.d, ec.operador);
      if (poligono.length < 3) continue;
      const inicioRegion = aparicionesRef.current.get(ec.id);
      const progresoRegion = inicioRegion === undefined ? 1 : Math.min(1, (ahora - inicioRegion) / 700);
      ctx.beginPath();
      poligono.forEach((p, i) => {
        if (i === 0) ctx.moveTo(sx(p.x), sy(p.y));
        else ctx.lineTo(sx(p.x), sy(p.y));
      });
      ctx.closePath();
      ctx.fillStyle = hexConAlpha(ec.color, 0.13 * progresoRegion);
      ctx.fill();
    }

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#9db6d9';
    ctx.beginPath();
    if (sy(0) >= 0 && sy(0) <= alto) {
      ctx.moveTo(0, sy(0));
      ctx.lineTo(ancho, sy(0));
    }
    if (sx(0) >= 0 && sx(0) <= ancho) {
      ctx.moveTo(sx(0), 0);
      ctx.lineTo(sx(0), alto);
    }
    ctx.stroke();

    ctx.fillStyle = '#9db6d9';
    const dibujarFlecha = (fromX: number, fromY: number, toX: number, toY: number) => {
      const ang = Math.atan2(toY - fromY, toX - fromX);
      const tam = 7;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - tam * Math.cos(ang - 0.35), toY - tam * Math.sin(ang - 0.35));
      ctx.lineTo(toX - tam * Math.cos(ang + 0.35), toY - tam * Math.sin(ang + 0.35));
      ctx.closePath();
      ctx.fill();
    };
    if (sy(0) >= 0 && sy(0) <= alto) dibujarFlecha(ancho - 14, sy(0), ancho - 1, sy(0));
    if (sx(0) >= 0 && sx(0) <= ancho) dibujarFlecha(sx(0), 14, sx(0), 1);

    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#6b87ad';
    if (sy(0) >= 0 && sy(0) <= alto) ctx.fillText('x', ancho - 16, sy(0) - 6);
    if (sx(0) >= 0 && sx(0) <= ancho) ctx.fillText('y', sx(0) + 7, 14);

    ctx.font = '10.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#8ba8cc';
    for (let x = Math.ceil(xMin / paso) * paso; x <= xMax; x += paso) {
      if (Math.abs(x) < EPS) continue;
      const px = sx(x);
      if (px < 20 || px > ancho - 20) continue;
      if (sy(0) >= 0 && sy(0) <= alto) {
        ctx.fillText(formatoNumero(x), px - 7, sy(0) + 15);
      } else {
        ctx.fillText(formatoNumero(x), px - 7, alto - 6);
      }
    }
    for (let y = Math.ceil(yMin / paso) * paso; y <= yMax; y += paso) {
      if (Math.abs(y) < EPS) continue;
      const py = sy(y);
      if (py < 20 || py > alto - 10) continue;
      if (sx(0) >= 0 && sx(0) <= ancho) {
        ctx.fillText(formatoNumero(y), sx(0) + 6, py + 3);
      } else {
        ctx.fillText(formatoNumero(y), 8, py + 3);
      }
    }

    for (const ec of ecuaciones) {
      if (!ec.visible) continue;
      if (Math.abs(ec.a) + Math.abs(ec.b) < EPS) continue;
      const inicioLinea = aparicionesRef.current.get(ec.id);
      const progreso = inicioLinea === undefined ? 1 : Math.min(1, (ahora - inicioLinea) / 700);
      ctx.globalAlpha = progreso;
      ctx.lineWidth = 1 + 1.2 * progreso;
      ctx.strokeStyle = ec.color;
      ctx.beginPath();
      if (Math.abs(ec.b) > EPS) {
        const yIzq = (ec.d - ec.a * xMin) / ec.b;
        const yDer = (ec.d - ec.a * xMax) / ec.b;
        const p1x = cx + (xMin - cx) * progreso;
        const p1y = cy + (yIzq - cy) * progreso;
        const p2x = cx + (xMax - cx) * progreso;
        const p2y = cy + (yDer - cy) * progreso;
        ctx.moveTo(sx(p1x), sy(p1y));
        ctx.lineTo(sx(p2x), sy(p2y));
      } else {
        const x = ec.d / ec.a;
        const p1y = cy + (yMin - cy) * progreso;
        const p2y = cy + (yMax - cy) * progreso;
        ctx.moveTo(sx(x), sy(p1y));
        ctx.lineTo(sx(x), sy(p2y));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    for (const p of intersecciones) {
      const px = sx(p.x);
      const py = sy(p.y);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(p.etiqueta, px + 8, py - 7);
      ctx.textAlign = 'start';
    }
  }, [ecuaciones, intersecciones, centro, escala, revision]);

  useEffect(() => {
    const canvas = lienzoRef.current;
    if (!canvas) return;
    const manejarRueda = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setEscala((prev) => Math.min(Math.max(prev * factor, 4), 600));
    };
    canvas.addEventListener('wheel', manejarRueda, { passive: false });
    return () => canvas.removeEventListener('wheel', manejarRueda);
  }, []);

  const manejarBaja = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    arrastrando.current = { x: e.clientX, y: e.clientY, cx: estado.current.centro.x, cy: estado.current.centro.y };
  };
  const manejarMueve = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const lienzo = e.target as HTMLCanvasElement;
    const rect = lienzo.getBoundingClientRect();
    const wx = estado.current.centro.x + (e.clientX - rect.left - rect.width / 2) / estado.current.escala;
    const wy = estado.current.centro.y - (e.clientY - rect.top - rect.height / 2) / estado.current.escala;
    onCoordenadasRef.current?.({ x: wx, y: wy });
    if (!arrastrando.current) return;
    const dx = (e.clientX - arrastrando.current.x) / estado.current.escala;
    const dy = (e.clientY - arrastrando.current.y) / estado.current.escala;
    setCentro({ x: arrastrando.current.cx - dx, y: arrastrando.current.cy + dy });
  };
  const manejarSube = () => {
    arrastrando.current = null;
    onCoordenadasRef.current?.(null);
  };

  return (
    <canvas
      ref={lienzoRef}
      className="lienzo-2d"
      onPointerDown={manejarBaja}
      onPointerMove={manejarMueve}
      onPointerUp={manejarSube}
      onPointerLeave={() => {
        arrastrando.current = null;
        onCoordenadasRef.current?.(null);
      }}
    />
  );
});

export default Canvas2D;
