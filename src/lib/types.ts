export type Operador = '=' | '<=' | '>=';
export type Dimension = '2D' | '3D';

export interface Ecuacion {
  id: string;
  a: number;
  b: number;
  c: number;
  d: number;
  operador: Operador;
  color: string;
  visible: boolean;
  texto: string;
  error?: boolean;
}

export interface SistemaResultado {
  tipo: 'unica' | 'infinita' | 'inconsistente';
  punto?: number[];
  detalle: string;
  pasos?: string[];
}

export const PALETA = [
  '#3b82f6',
  '#22c55e',
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

export interface ChatMensaje {
  rol: 'usuario' | 'asistente';
  texto: string;
}

export interface Coordenadas {
  x: number;
  y: number;
  z?: number;
}
