import { createElement, useEffect, useRef, useState } from 'react';
import 'mathlive';
import 'mathlive/fonts.css';
import { transcribirAudio } from '../lib/groqBridge';
import MathKeyboard from './MathKeyboard';

interface MathfieldLike extends HTMLElement {
  getValue: (formato?: string) => string;
  setValue: (valor: string) => void;
  insert: (s: string) => void;
  executeCommand: (cmd: string, ...args: unknown[]) => boolean;
}

function normalizarLatex(latex: string): string {
  return latex
    .replace(/\\leq\b/g, '<=')
    .replace(/\\le\b/g, '<=')
    .replace(/\\geq\b/g, '>=')
    .replace(/\\ge\b/g, '>=')
    .replace(/\\cdot\b/g, '*')
    .replace(/\\times\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\left\b/g, '')
    .replace(/\\right\b/g, '')
    .replace(/\\,/g, '')
    .replace(/\\;/g, '')
    .replace(/\\ /g, ' ')
    .replace(/[{}]/g, '')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function textoALaTeX(plano: string): string {
  return plano
    .replace(/<=/g, '\\le ')
    .replace(/>=/g, '\\ge ')
    .replace(/×/g, '\\cdot ')
    .replace(/\*/g, '\\cdot ')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

function comandoPara(tecla: string): string {
  switch (tecla) {
    case '≤':
      return '\\le';
    case '≥':
      return '\\ge';
    case '−':
      return '-';
    case '÷':
      return '\\div';
    case '≠':
      return '\\ne';
    case '*':
      return '\\cdot';
    case '√':
    case 'raiz':
      return '\\sqrt{}';
    case 'raizN':
      return '\\sqrt[]{}';
    case 'cuadrado':
      return '^{2}';
    case 'cubo':
      return '^{3}';
    case 'potencia':
      return '^{}';
    case 'fraccion':
      return '\\frac{}{}';
    case 'valorAbs':
      return '\\left|\\right|';
    case 'π':
      return '\\pi';
    case 'x^{2}':
      return 'x^{2}';
    case 'x^{3}':
      return 'x^{3}';
    case 'sen':
      return '\\sin';
    case 'cos':
      return '\\cos';
    case 'tan':
      return '\\tan';
    case 'arcsin':
      return '\\arcsin';
    case 'arccos':
      return '\\arccos';
    case 'arctan':
      return '\\arctan';
    case 'log':
      return '\\log';
    case 'ln':
      return '\\ln';
    case 'exp':
      return '\\exp';
    case 'Ans':
      return 'Ans';
    case ' ':
      return '\\ ';
    default:
      return tecla;
  }
}

function MathFieldInput(props: Record<string, unknown>) {
  return createElement('math-field', props);
}

interface Props {
  ocupado: boolean;
  iaDisponible: boolean;
  onGraficar: (texto: string) => void;
  onAnalizarConIA: (texto: string) => void;
}

const EJEMPLOS = [
  { etiqueta: 'Sistema 2D básico', valor: 'x + y = 6, 2x - y = 3' },
  { etiqueta: 'Sistema 2D con fracciones', valor: '0.5x + 1.5y = 4, y = 2x - 1' },
  { etiqueta: 'Inecuaciones (regiones)', valor: 'y >= 2x - 1, y <= -x + 5' },
  { etiqueta: 'Sistema 3D (planos)', valor: 'x + y + z = 6, x - y + z = 2, 2x + y - z = 1' },
  { etiqueta: 'Lenguaje natural (IA)', valor: 'La suma de dos números es 10 y su diferencia es 4' },
  { etiqueta: 'Lenguaje natural 3D (IA)', valor: 'En 3D grafica los planos x+y+z=6, x-y+z=2 y 2x+y-z=1' },
];

export default function InputBar({ ocupado, iaDisponible, onGraficar, onAnalizarConIA }: Props) {
  const [latex, setLatex] = useState('');
  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [teclado, setTeclado] = useState(false);
  const mfRef = useRef<MathfieldLike | null>(null);
  const textoRef = useRef(texto);
  textoRef.current = texto;
  const reconocimientoRef = useRef<{ stop: () => void } | null>(null);
  const temporizadorRef = useRef<number | null>(null);

  // Sincronizar el campo cuando el contenido cambia desde fuera (voz, ejemplos, IA)
  useEffect(() => {
    const mf = mfRef.current;
    if (mf) {
      if (mf.getValue('latex') !== latex) mf.setValue(latex);
      // Desactivar el teclado virtual propio de MathLive
      (mf as unknown as { virtualKeyboardMode?: string }).virtualKeyboardMode = 'off';
      (mf as unknown as { menuMode?: string }).menuMode = 'off';
    }
  }, [latex]);

  const sincronizarDesdeMathField = () => {
    const mf = mfRef.current;
    if (!mf) return;
    const l = mf.getValue('latex');
    setLatex(l);
    setTexto(normalizarLatex(l));
  };

  const insertarEnMathField = (fragmento: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.insert(comandoPara(fragmento));
    mf.focus();
    // MathLive puede emitir `input` antes de que React reciba el foco de vuelta.
    // Leer el valor en el siguiente frame evita que una tecla quede solo visualmente insertada.
    requestAnimationFrame(sincronizarDesdeMathField);
  };

  const borrarCaracter = () => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.executeCommand('deletePreviousChar');
    requestAnimationFrame(sincronizarDesdeMathField);
  };

  const moverCursor = (direccion: 'izquierda' | 'derecha') => {
    mfRef.current?.executeCommand(direccion === 'izquierda' ? 'moveToPreviousChar' : 'moveToNextChar');
    mfRef.current?.focus();
  };

  const limpiarTodo = () => {
    mfRef.current?.setValue('');
    setLatex('');
    setTexto('');
  };

  const aplicarTexto = (plano: string) => {
    setTexto(plano);
    setLatex(textoALaTeX(plano));
  };

  const grabarConGroq = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const trozos: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        const blob = new Blob(trozos, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000) return;
        try {
          const buffer = await blob.arrayBuffer();
          const frase = await transcribirAudio(buffer, blob.type);
          const nuevo = textoRef.current ? `${textoRef.current}, ${frase}` : frase;
          aplicarTexto(nuevo);
        } catch (err) {
          alert(`No se pudo transcribir el audio: ${(err as Error).message}`);
        }
      };
      recorder.start();
      reconocimientoRef.current = { stop: () => recorder.stop() };
      temporizadorRef.current = window.setTimeout(() => recorder.stop(), 10000);
      setGrabando(true);
    } catch {
      alert('No se pudo acceder al micrófono.');
    }
  };

  const iniciarVoz = () => {
    if (iaDisponible) {
      void grabarConGroq();
      return;
    }
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const Reconocimiento = w.webkitSpeechRecognition;
    if (!Reconocimiento) {
      alert('Tu navegador no soporta entrada por voz (prueba Chrome o Edge).');
      return;
    }
    const r = new Reconocimiento();
    r.lang = 'es-ES';
    r.interimResults = false;
    r.onresult = (e) => {
      const frase = e.results[0]?.[0]?.transcript ?? '';
      aplicarTexto(textoRef.current ? `${textoRef.current}, ${frase}` : frase);
    };
    r.onend = () => setGrabando(false);
    r.onerror = () => setGrabando(false);
    r.start();
    reconocimientoRef.current = r;
    setGrabando(true);
  };

  return (
    <div className="barra-entrada">
      <div className="fila-entrada">
        <div className="entrada-envoltura">
          {latex === '' && (
            <span className="entrada-placeholder">
              Escribe un sistema: "x + y = 6, 2x - y = 3" o describe el problema con IA…
            </span>
          )}
          <MathFieldInput
            ref={mfRef}
            className="entrada-texto entrada-math"
            virtual-keyboard-mode="off"
            menu-mode="off"
            onInput={sincronizarDesdeMathField}
            onFocus={() => setTeclado(true)}
            onBlur={() => setTeclado(false)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onGraficar(textoRef.current);
              } else if (e.key === 'Escape') {
                setTeclado(false);
                mfRef.current?.blur();
              }
            }}
          />
        </div>
        <button
          className={`btn-icono ${grabando ? 'activo' : ''}`}
          onClick={iniciarVoz}
          title={grabando ? 'Escuchando…' : iaDisponible ? 'Entrada por voz (Groq Whisper)' : 'Entrada por voz'}
          aria-label="Entrada por voz"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0014 0M12 17v4m-3 0h6" />
          </svg>
        </button>
      </div>
      <div className="fila-acciones">
        <button
          className="btn-accion primario"
          onClick={() => onGraficar(textoRef.current)}
          disabled={ocupado || !textoRef.current.trim()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-6 3 4 3-8" />
          </svg>
          Graficar
        </button>
        <button
          className="btn-accion"
          onClick={() => onAnalizarConIA(textoRef.current)}
          disabled={ocupado || !textoRef.current.trim() || !iaDisponible}
          title={iaDisponible ? 'Groq interpreta el texto y detecta 2D/3D' : 'Se requiere una llave de Groq configurada'}
        >
          {ocupado ? <span className="spinner" /> : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
            </svg>
          )}
          Analizar con IA
        </button>
        <select
          className="select-ejemplos"
          value=""
          onChange={(e) => {
            if (e.target.value) aplicarTexto(e.target.value);
          }}
          aria-label="Ejemplos"
        >
          <option value="">Ejemplos rápidos…</option>
          {EJEMPLOS.map((ej) => (
            <option key={ej.etiqueta} value={ej.valor}>
              {ej.etiqueta}
            </option>
          ))}
        </select>
      </div>
      {teclado && (
        <MathKeyboard
          onInsertar={insertarEnMathField}
          onBorrar={borrarCaracter}
          onLimpiar={limpiarTodo}
          onMover={moverCursor}
          onEnter={() => onGraficar(textoRef.current)}
        />
      )}
    </div>
  );
}
