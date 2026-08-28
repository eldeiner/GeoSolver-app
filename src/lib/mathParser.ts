import type { Ecuacion, Operador } from './types';
import { PALETA } from './types';

const OP_RE = /^\s*(.+?)\s*(<=|>=|=)\s*(.+?)\s*$/;

interface Lado {
  coefs: Record<string, number>;
  constante: number;
}

function ladoVacio(): Lado {
  return { coefs: { x: 0, y: 0, z: 0 }, constante: 0 };
}

function parseTermino(term: string, lado: Lado): void {
  const t = term.trim();
  if (!t) return;

  const varMatch = t.match(/^([+-]?)(\d*\.?\d*)\*?([xyz])$/);
  if (varMatch) {
    const signo = varMatch[1] === '-' ? -1 : 1;
    const coef = varMatch[2] === '' || varMatch[2] === '.' ? 1 : parseFloat(varMatch[2]);
    lado.coefs[varMatch[3]] += signo * coef;
    return;
  }

  const constMatch = t.match(/^([+-]?\d*\.?\d+)$/);
  if (constMatch) {
    lado.constante += parseFloat(constMatch[1]);
    return;
  }

  throw new Error(`No pude entender el término "${t}".`);
}

function parseLado(expr: string): Lado {
  const lado = ladoVacio();
  const compacto = expr.replace(/\s+/g, '');
  if (!compacto) return lado;
  const terminos = compacto.match(/[+-]?[^+-]+/g) ?? [compacto];
  for (const term of terminos) {
    parseTermino(term, lado);
  }
  return lado;
}

function esVariableSimple(expr: string): string | null {
  const t = expr.replace(/\s+/g, '');
  return t === 'x' || t === 'y' || t === 'z' ? t : null;
}

export function formatearEcuacion(a: number, b: number, c: number, d: number, op: Operador): string {
  const partes: string[] = [];
  const pushTerm = (coef: number, nombre: string) => {
    if (Math.abs(coef) < 1e-9) return;
    const abs = Math.abs(coef);
    const factor = Math.abs(abs - 1) < 1e-9 ? '' : String(redondear(abs));
    const signo = partes.length === 0 ? (coef < 0 ? '-' : '') : coef < 0 ? ' - ' : ' + ';
    partes.push(`${signo}${factor}${nombre}`);
  };
  pushTerm(a, 'x');
  pushTerm(b, 'y');
  pushTerm(c, 'z');
  if (partes.length === 0) partes.push('0');
  return `${partes.join('')} ${op} ${redondear(d)}`;
}

function redondear(n: number): number {
  return Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6;
}

export function parsearEcuacion(texto: string): {
  a: number;
  b: number;
  c: number;
  d: number;
  operador: Operador;
  es3D: boolean;
} {
  const m = texto.match(OP_RE);
  if (!m) {
    throw new Error('Formato esperado: ax + by + cz = d (ej: 2x + 3y = 6).');
  }
  const [, izq, opRaw, der] = m;
  const operador = opRaw as Operador;

  const varIzq = esVariableSimple(izq);
  const esFuncion = varIzq !== null;

  const ladoIzq = esFuncion ? ladoVacio() : parseLado(izq);
  const ladoDer = parseLado(der);

  let a: number;
  let b: number;
  let c: number;
  let d: number;

  if (esFuncion) {
    const v = varIzq;
    const varsPresentes = new Set(Object.keys(ladoDer.coefs).filter((k) => Math.abs(ladoDer.coefs[k]) > 1e-9));
    if (varsPresentes.size > 1) {
      throw new Error(`La forma "${v} = ..." solo admite una variable en el lado derecho.`);
    }
    a = (v === 'x' ? 1 : 0) - ladoDer.coefs.x;
    b = (v === 'y' ? 1 : 0) - ladoDer.coefs.y;
    c = (v === 'z' ? 1 : 0) - ladoDer.coefs.z;
    d = ladoDer.constante - ladoIzq.constante;
  } else {
    a = ladoIzq.coefs.x - ladoDer.coefs.x;
    b = ladoIzq.coefs.y - ladoDer.coefs.y;
    c = ladoIzq.coefs.z - ladoDer.coefs.z;
    d = ladoDer.constante - ladoIzq.constante;
  }

  const es3D = Math.abs(c) > 1e-9;
  return { a: redondear(a), b: redondear(b), c: es3D ? redondear(c) : 0, d: redondear(d), operador, es3D };
}

let contadorId = 0;
export function crearEcuacionCanonica(
  a: number,
  b: number,
  c: number,
  d: number,
  operador: Operador,
  color?: string,
): Ecuacion {
  const canon = formatearEcuacion(a, b, c, d, operador);
  return {
    id: `eq-${Date.now()}-${contadorId++}`,
    a,
    b,
    c,
    d,
    operador,
    color: color ?? PALETA[contadorId % PALETA.length],
    visible: true,
    texto: canon,
  };
}

export function parsearBloque(texto: string): Array<{ a: number; b: number; c: number; d: number; operador: Operador }> {
  const lineas = texto
    .split(/[;,\n]/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length === 0) throw new Error('No escribiste ninguna ecuación.');
  return lineas.map((l) => {
    const p = parsearEcuacion(l);
    return { a: p.a, b: p.b, c: p.c, d: p.d, operador: p.operador };
  });
}

export function detectarDimension(ecuaciones: Array<{ a: number; b: number; c: number; d: number }>): '2D' | '3D' {
  return ecuaciones.some((e) => Math.abs(e.c) > 1e-9) ? '3D' : '2D';
}
