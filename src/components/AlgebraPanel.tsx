import { useEffect, useState } from 'react';
import type { Dimension, Ecuacion, SistemaResultado } from '../lib/types';
import { formatearEcuacion, parsearEcuacion } from '../lib/mathParser';

interface Props {
  ecuaciones: Ecuacion[];
  resultado: SistemaResultado;
  modo: Dimension;
  animacion: { ecId: string; parametro: 'a' | 'b' | 'c' | 'd' } | null;
  onDetenerAnimacion: () => void;
  onActualizar: (id: string, parcial: Partial<Ecuacion>) => void;
  onAnimar: (ecId: string, parametro: 'a' | 'b' | 'c' | 'd') => void;
  onEliminar: (id: string) => void;
  onAlternarVisible: (id: string) => void;
}

function Tarjeta({
  ec,
  mostrarC,
  animacion,
  onActualizar,
  onAnimar,
  onEliminar,
  onAlternarVisible,
}: {
  ec: Ecuacion;
  mostrarC: boolean;
  animacion: { ecId: string; parametro: 'a' | 'b' | 'c' | 'd' } | null;
  onActualizar: Props['onActualizar'];
  onAnimar: Props['onAnimar'];
  onEliminar: Props['onEliminar'];
  onAlternarVisible: Props['onAlternarVisible'];
}) {
  const [texto, setTexto] = useState(ec.texto);
  const [sliders, setSliders] = useState(false);

  useEffect(() => {
    if (!ec.error) setTexto(ec.texto);
  }, [ec.texto, ec.error]);

  const manejarCambio = (valor: string) => {
    setTexto(valor);
    try {
      const p = parsearEcuacion(valor);
      const canon = formatearEcuacion(p.a, p.b, p.c, p.d, p.operador);
      onActualizar(ec.id, {
        a: p.a,
        b: p.b,
        c: p.c,
        d: p.d,
        operador: p.operador,
        texto: canon,
        error: false,
      });
    } catch {
      onActualizar(ec.id, { texto: valor, error: true });
    }
  };

  const redondear = (v: number) => Math.round(v * 100) / 100;

  const cambiarDesdeSlider = (parcial: Partial<Ecuacion>) => {
    const valores = { a: ec.a, b: ec.b, c: ec.c, d: ec.d, ...parcial };
    const canon = formatearEcuacion(valores.a, valores.b, valores.c, valores.d, ec.operador);
    onActualizar(ec.id, { ...valores, texto: canon, error: false });
  };

  const SliderValor = ({
    etiqueta,
    valor,
    min,
    max,
    paso,
    color,
    animar,
    animando,
  }: {
    etiqueta: string;
    valor: number;
    min: number;
    max: number;
    paso: number;
    color: string;
    animar: () => void;
    animando: boolean;
  }) => (
    <div className="slider-fila">
      <span className="slider-etiqueta" style={{ color }}>{etiqueta}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => {
          const v = redondear(Number(e.target.value));
          cambiarDesdeSlider({ [etiqueta]: v } as Partial<Ecuacion>);
        }}
        aria-label={`Parámetro ${etiqueta}`}
      />
      <span className="slider-valor">{redondear(valor)}</span>
      <button
        className={`btn-icono btn-animar ${animando ? 'activo' : ''}`}
        onClick={animar}
        title={animando ? 'Detener animación' : `Animar ${etiqueta}`}
        aria-label={animando ? 'Detener animación' : `Animar ${etiqueta}`}
      >
        {animando ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4v16l13-8-13-8z" />
          </svg>
        )}
      </button>
    </div>
  );

  return (
    <div className={`tarjeta-ecuacion ${ec.error ? 'error' : ''}`}>
      <div className="tarjeta-fila">
        <span className="punto-color" style={{ background: ec.color }} />
        <input
          className="entrada-ecuacion"
          value={texto}
          onChange={(e) => manejarCambio(e.target.value)}
          spellCheck={false}
          aria-label="Ecuación"
        />
        <button
          className={`btn-icono ${ec.visible ? '' : 'off'}`}
          onClick={() => onAlternarVisible(ec.id)}
          title={ec.visible ? 'Ocultar en el gráfico' : 'Mostrar en el gráfico'}
          aria-label={ec.visible ? 'Ocultar' : 'Mostrar'}
        >
          {ec.visible ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l18 18M10.6 5.1C11.1 5 11.5 5 12 5c6.5 0 10 7 10 7a17.5 17.5 0 01-3.1 4M6.1 6.1A16.4 16.4 0 002 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" />
            </svg>
          )}
        </button>
        <button
          className={`btn-icono btn-sliders ${sliders ? 'activo' : ''}`}
          onClick={() => setSliders((v) => !v)}
          title="Ajustar parámetros (a, b, c, d)"
          aria-label="Ajustar parámetros"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
            <path d="M1 14h6M9 8h6M17 16h6" />
          </svg>
        </button>
        <button className="btn-icono" onClick={() => onEliminar(ec.id)} title="Eliminar" aria-label="Eliminar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <span className={`etiqueta-dim ${Math.abs(ec.c) > 1e-9 ? 'd3' : ''}`}>
        {Math.abs(ec.c) > 1e-9 ? '3D · plano' : '2D · recta'}
      </span>
      {sliders && (
        <div className="seccion-sliders">
          <SliderValor
            etiqueta="a"
            valor={ec.a}
            min={-10}
            max={10}
            paso={0.1}
            color={ec.color}
            animar={() => onAnimar(ec.id, 'a')}
            animando={animacion?.ecId === ec.id && animacion.parametro === 'a'}
          />
          <SliderValor
            etiqueta="b"
            valor={ec.b}
            min={-10}
            max={10}
            paso={0.1}
            color={ec.color}
            animar={() => onAnimar(ec.id, 'b')}
            animando={animacion?.ecId === ec.id && animacion.parametro === 'b'}
          />
          {mostrarC && (
            <SliderValor
              etiqueta="c"
              valor={ec.c}
              min={-10}
              max={10}
              paso={0.1}
              color={ec.color}
              animar={() => onAnimar(ec.id, 'c')}
              animando={animacion?.ecId === ec.id && animacion.parametro === 'c'}
            />
          )}
          <SliderValor
            etiqueta="d"
            valor={ec.d}
            min={-20}
            max={20}
            paso={0.1}
            color={ec.color}
            animar={() => onAnimar(ec.id, 'd')}
            animando={animacion?.ecId === ec.id && animacion.parametro === 'd'}
          />
        </div>
      )}
    </div>
  );
}

export default function AlgebraPanel({
  ecuaciones,
  resultado,
  modo,
  animacion,
  onDetenerAnimacion,
  onActualizar,
  onAnimar,
  onEliminar,
  onAlternarVisible,
}: Props) {
  return (
    <aside className="panel-algebraico">
      <div className="panel-cabecera">
        <h2>Panel algebraico</h2>
        <div className={`resumen-solucion ${resultado.tipo}`}>
          {resultado.tipo === 'unica' && (
            <>
              <strong>Solución única</strong> · {resultado.detalle}
            </>
          )}
          {resultado.tipo === 'infinita' && <>{resultado.detalle}</>}
          {resultado.tipo === 'inconsistente' && <>{resultado.detalle}</>}
        </div>
        {resultado.pasos && resultado.pasos.length > 1 && (
          <details className="pasos-detalle">
            <summary>Ver pasos (Gauss-Jordan)</summary>
            <ol>
              {resultado.pasos.map((paso, i) => (
                <li key={i}>{paso}</li>
              ))}
            </ol>
          </details>
        )}
        {animacion && (
          <button className="btn-accion detener-animacion" onClick={onDetenerAnimacion} title="Detener animación">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Detener animación
          </button>
        )}
      </div>
      <div className="lista-ecuaciones">
        {ecuaciones.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, padding: '4px 6px', lineHeight: 1.5 }}>
            No hay ecuaciones todavía. Escribe un sistema abajo o usa un ejemplo, por ejemplo{' '}
            <code style={{ background: 'var(--panel-alt)', padding: '2px 6px', borderRadius: 5 }}>x + y = 6</code>.
          </p>
        )}
        {ecuaciones.map((ec) => (
          <Tarjeta
            key={ec.id}
            ec={ec}
            mostrarC={modo === '3D' || Math.abs(ec.c) > 1e-9}
            animacion={animacion}
            onActualizar={onActualizar}
            onAnimar={onAnimar}
            onEliminar={onEliminar}
            onAlternarVisible={onAlternarVisible}
          />
        ))}
      </div>
    </aside>
  );
}
