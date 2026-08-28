import type { Ecuacion, SistemaResultado } from './types';

const EPS = 1e-9;

function filaTexto(m: number[][], i: number): string {
  return `[${m[i].slice(0, -1).map((v) => red(v)).join(', ')} | ${red(m[i][m[i].length - 1])}]`;
}

export function gaussJordanConPasos(
  ab: number[][],
): { tipo: 'unica' | 'infinita' | 'inconsistente'; valores?: number[]; pasos: string[] } {
  const filas = ab.length;
  if (filas === 0) return { tipo: 'infinita', pasos: [] };
  const cols = ab[0].length - 1;
  const m = ab.map((f) => [...f]);
  const pasos: string[] = [`Matriz ampliada: ${m.map((_, i) => filaTexto(m, i)).join(', ')}`];
  let pivoteFila = 0;

  for (let col = 0; col < cols && pivoteFila < filas; col++) {
    let maxFila = pivoteFila;
    for (let i = pivoteFila + 1; i < filas; i++) {
      if (Math.abs(m[i][col]) > Math.abs(m[maxFila][col])) maxFila = i;
    }
    if (Math.abs(m[maxFila][col]) < EPS) continue;
    if (maxFila !== pivoteFila) {
      [m[pivoteFila], m[maxFila]] = [m[maxFila], m[pivoteFila]];
      pasos.push(`Intercambiar fila ${maxFila + 1} con fila ${pivoteFila + 1}`);
    }

    const pivote = m[pivoteFila][col];
    if (Math.abs(pivote - 1) > EPS) {
      for (let j = col; j <= cols; j++) m[pivoteFila][j] /= pivote;
      pasos.push(`Dividir fila ${pivoteFila + 1} entre ${red(pivote)} → ${filaTexto(m, pivoteFila)}`);
    }

    for (let i = 0; i < filas; i++) {
      if (i === pivoteFila) continue;
      const factor = m[i][col];
      if (Math.abs(factor) < EPS) continue;
      for (let j = col; j <= cols; j++) m[i][j] -= factor * m[pivoteFila][j];
      pasos.push(`Fila ${i + 1} − (${red(factor)})·fila ${pivoteFila + 1} → ${filaTexto(m, i)}`);
    }
    pivoteFila++;
  }

  for (let i = 0; i < filas; i++) {
    const esCero = m[i].slice(0, cols).every((v) => Math.abs(v) < EPS);
    if (esCero && Math.abs(m[i][cols]) > EPS) {
      pasos.push(`Fila ${i + 1} quedó como 0 = ${red(m[i][cols])} → sistema inconsistente`);
      return { tipo: 'inconsistente', pasos };
    }
  }

  const rango = pivoteFila;
  if (rango < cols) {
    pasos.push(`Hay ${cols - rango} variable(s) libre(s) → infinitas soluciones`);
    return { tipo: 'infinita', pasos };
  }

  const valores: number[] = [];
  for (let i = 0; i < cols; i++) {
    let v = 0;
    for (let f = 0; f < filas; f++) {
      if (Math.abs(m[f][i]) > EPS) {
        v = m[f][cols];
        break;
      }
    }
    valores.push(Math.abs(v) < EPS ? 0 : v);
  }
  pasos.push(`Solución: ${valores.map((v) => red(v)).join(', ')}`);
  return { tipo: 'unica', valores, pasos };
}

export function gaussJordan(
  ab: number[][],
): { tipo: 'unica' | 'infinita' | 'inconsistente'; valores?: number[] } {
  const { tipo, valores } = gaussJordanConPasos(ab);
  return { tipo, valores };
}

export function resolverSistema(ecs: Ecuacion[]): SistemaResultado {
  const filtradas = ecs.filter((e) => e.visible);
  if (filtradas.length === 0) {
    return { tipo: 'infinita', detalle: 'Añade ecuaciones para resolver el sistema.' };
  }
  // La dimensión debe determinarse SOLO con las ecuaciones visibles, para que
  // el mensaje de resultado (2D vs 3D) coincida con lo que se resuelve.
  const dimension = filtradas.some((e) => Math.abs(e.c) > EPS) ? 3 : 2;

  const ab =
    dimension === 3
      ? filtradas.map((e) => [e.a, e.b, e.c, e.d])
      : filtradas.map((e) => [e.a, e.b, e.d]);
  const r = gaussJordanConPasos(ab);

  if (r.tipo === 'inconsistente') {
    return {
      tipo: 'inconsistente',
      detalle:
        dimension === 3
          ? 'Sin solución: los planos son paralelos o forman un prisma sin cruzarse los tres en un mismo punto.'
          : 'Sin solución: las rectas son paralelas y distintas, nunca se cruzan.',
      pasos: r.pasos,
    };
  }
  if (r.tipo === 'infinita') {
    return {
      tipo: 'infinita',
      detalle:
        dimension === 3
          ? 'Infinitas soluciones: los planos se cruzan en una recta común o son el mismo plano.'
          : 'Infinitas soluciones: las rectas son coincidentes (misma recta).',
      pasos: r.pasos,
    };
  }
  return {
    tipo: 'unica',
    punto: r.valores,
    detalle:
      dimension === 3
        ? `Los 3 planos se cortan exactamente en el punto P(${r.valores!.map((v) => red(v)).join(', ')}) (esfera roja).`
        : `Las rectas se cortan en el punto P(${r.valores!.map((v) => red(v)).join(', ')}) (punto rojo).`,
    pasos: r.pasos,
  };
}

function red(n: number): string {
  return String(Math.round(n * 1e4) / 1e4);
}

export function aFraccion(n: number, maxDen = 20): { num: number; den: number } | null {
  if (!Number.isFinite(n)) return null;
  const signo = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  if (Math.abs(abs - Math.round(abs)) < 1e-9) return { num: signo * Math.round(abs), den: 1 };
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(abs * den);
    if (Math.abs(abs - num / den) < 1e-6) return { num: signo * num, den };
  }
  return null;
}

export function formatearValor(n: number): string {
  const f = aFraccion(n);
  if (!f) return red(n);
  if (f.den === 1) return String(f.num);
  return `${f.num}/${f.den}`;
}

export function formatearPunto(vals: number[]): string {
  return vals.map((v) => formatearValor(v)).join(', ');
}

export function intersecciones2D(ecs: Ecuacion[]): Array<{ x: number; y: number; etiqueta: string }> {
  const rectas = ecs.filter((e) => e.visible && e.operador === '=' && Math.abs(e.a) + Math.abs(e.b) > EPS);
  const puntos: Array<{ x: number; y: number; etiqueta: string }> = [];
  for (let i = 0; i < rectas.length; i++) {
    for (let j = i + 1; j < rectas.length; j++) {
      const e1 = rectas[i];
      const e2 = rectas[j];
      const det = e1.a * e2.b - e2.a * e1.b;
      if (Math.abs(det) < EPS) continue;
      const x = (e1.d * e2.b - e2.d * e1.b) / det;
      const y = (e1.a * e2.d - e2.a * e1.d) / det;
      puntos.push({ x, y, etiqueta: `P${puntos.length + 1}` });
    }
  }
  return puntos;
}
