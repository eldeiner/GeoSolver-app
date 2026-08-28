import { useState } from 'react';

interface Props {
  onInsertar: (texto: string) => void;
  onBorrar: () => void;
  onLimpiar: () => void;
  onMover: (direccion: 'izquierda' | 'derecha') => void;
  onEnter: () => void;
}

type Categoria = 'numeros' | 'funciones' | 'letras' | 'simbolos';
type Accion = 'borrar' | 'izquierda' | 'derecha' | 'enter';

interface Tecla {
  v: string;
  etiqueta?: string;
  clase?: string;
  accion?: Accion;
}

const TECLAS: Record<Categoria, Tecla[][]> = {
  numeros: [
    [{ v: 'x', clase: 'variable' }, { v: 'y', clase: 'variable' }, { v: 'z', clase: 'variable' }, { v: 'π', clase: 'constante' }, { v: '7' }, { v: '8' }, { v: '9' }, { v: '*', etiqueta: '×' }, { v: '÷' }],
    [{ v: 'cuadrado', etiqueta: '□²', clase: 'plantilla' }, { v: 'cubo', etiqueta: '□³', clase: 'plantilla' }, { v: 'raiz', etiqueta: '√□', clase: 'plantilla' }, { v: 'e', clase: 'constante' }, { v: '4' }, { v: '5' }, { v: '6' }, { v: '+' }, { v: '−' }],
    [{ v: '≤', clase: 'relacion' }, { v: '≥', clase: 'relacion' }, { v: 'fraccion', etiqueta: '□/□', clase: 'plantilla' }, { v: 'potencia', etiqueta: '□ⁿ', clase: 'plantilla' }, { v: '1' }, { v: '2' }, { v: '3' }, { v: '=', clase: 'igual' }, { v: 'borrar', etiqueta: '⌫', accion: 'borrar', clase: 'accion' }],
    [{ v: '(' }, { v: ')' }, { v: 'valorAbs', etiqueta: '|□|', clase: 'plantilla' }, { v: ',' }, { v: '0' }, { v: '.' }, { v: 'izquierda', etiqueta: '‹', accion: 'izquierda', clase: 'accion' }, { v: 'derecha', etiqueta: '›', accion: 'derecha', clase: 'accion' }, { v: 'enter', etiqueta: '↵', accion: 'enter', clase: 'accion' }],
  ],
  funciones: [
    [{ v: 'sen', clase: 'funcion' }, { v: 'cos', clase: 'funcion' }, { v: 'tan', clase: 'funcion' }, { v: 'arcsin', etiqueta: 'sen⁻¹', clase: 'funcion' }, { v: 'arccos', etiqueta: 'cos⁻¹', clase: 'funcion' }, { v: 'arctan', etiqueta: 'tan⁻¹', clase: 'funcion' }, { v: 'log', clase: 'funcion' }, { v: 'ln', clase: 'funcion' }, { v: 'exp', clase: 'funcion' }],
    [{ v: 'raiz', etiqueta: '√□', clase: 'plantilla' }, { v: 'raizN', etiqueta: 'ⁿ√□', clase: 'plantilla' }, { v: 'fraccion', etiqueta: '□/□', clase: 'plantilla' }, { v: 'potencia', etiqueta: '□ⁿ', clase: 'plantilla' }, { v: 'cuadrado', etiqueta: '□²', clase: 'plantilla' }, { v: 'π', clase: 'constante' }, { v: 'e', clase: 'constante' }, { v: '(' }, { v: ')' }],
  ],
  letras: [
    [{ v: 'x', clase: 'variable' }, { v: 'y', clase: 'variable' }, { v: 'z', clase: 'variable' }, { v: 'a', clase: 'variable' }, { v: 'b', clase: 'variable' }, { v: 'c', clase: 'variable' }, { v: 'd', clase: 'variable' }, { v: 't', clase: 'variable' }, { v: 'n', clase: 'variable' }],
    [{ v: 'α', clase: 'variable' }, { v: 'β', clase: 'variable' }, { v: 'γ', clase: 'variable' }, { v: 'θ', clase: 'variable' }, { v: 'λ', clase: 'variable' }, { v: 'μ', clase: 'variable' }, { v: 'Δ', clase: 'variable' }, { v: '∞', clase: 'constante' }, { v: 'π', clase: 'constante' }],
  ],
  simbolos: [
    [{ v: '=', clase: 'igual' }, { v: '≤', clase: 'relacion' }, { v: '≥', clase: 'relacion' }, { v: '≠', clase: 'relacion' }, { v: '<', clase: 'relacion' }, { v: '>', clase: 'relacion' }, { v: '±', clase: 'relacion' }, { v: '→', clase: 'relacion' }, { v: '∞', clase: 'constante' }],
    [{ v: 'fraccion', etiqueta: '□/□', clase: 'plantilla' }, { v: 'potencia', etiqueta: '□ⁿ', clase: 'plantilla' }, { v: 'raiz', etiqueta: '√□', clase: 'plantilla' }, { v: 'valorAbs', etiqueta: '|□|', clase: 'plantilla' }, { v: '(' }, { v: ')' }, { v: '[' }, { v: ']' }, { v: '{' }],
  ],
};

const PESTANAS: Array<{ id: Categoria; etiqueta: string }> = [
  { id: 'numeros', etiqueta: '123' },
  { id: 'funciones', etiqueta: 'f(x)' },
  { id: 'letras', etiqueta: 'ABC' },
  { id: 'simbolos', etiqueta: '#&¬' },
];

export default function MathKeyboard({ onInsertar, onBorrar, onLimpiar, onMover, onEnter }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('numeros');
  const ejecutar = (tecla: Tecla) => {
    if (tecla.accion === 'borrar') return onBorrar();
    if (tecla.accion === 'izquierda') return onMover('izquierda');
    if (tecla.accion === 'derecha') return onMover('derecha');
    if (tecla.accion === 'enter') return onEnter();
    onInsertar(tecla.v);
  };

  return (
    <div className="teclado-matematico" aria-label="Teclado matemático">
      <div className="teclado-pestanas" role="tablist" aria-label="Categorías del teclado">
        {PESTANAS.map((pestana) => (
          <button key={pestana.id} className={`teclado-pestana ${categoria === pestana.id ? 'activa' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setCategoria(pestana.id)} role="tab" aria-selected={categoria === pestana.id}>
            {pestana.etiqueta}
          </button>
        ))}
        <button className="teclado-limpiar" onMouseDown={(e) => e.preventDefault()} onClick={onLimpiar} title="Limpiar todo">Limpiar</button>
      </div>
      {TECLAS[categoria].map((fila, i) => (
        <div className="teclado-fila" key={i}>
          {fila.map((tecla, j) => (
            <button key={`${tecla.v}-${j}`} className={`tecla ${tecla.clase ?? ''}`.trim()} data-valor={tecla.v} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(tecla)} title={`Insertar ${tecla.etiqueta ?? tecla.v}`}>
              {tecla.etiqueta ?? tecla.v}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
