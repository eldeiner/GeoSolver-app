import { useEffect, useRef, useState } from 'react';
import type { Dimension } from '../lib/types';

interface Props {
  modo: Dimension;
  onCambiarModo: (modo: Dimension) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCentrar: () => void;
  onLimpiar: () => void;
  onExportar: () => void;
  onGuardarSesion: () => void;
  onAbrirSesion: () => void;
  onBuscarActualizaciones: () => void;
  hayEcuaciones: boolean;
}

export default function Toolbar({
  modo,
  onCambiarModo,
  onZoomIn,
  onZoomOut,
  onCentrar,
  onLimpiar,
  onExportar,
  onGuardarSesion,
  onAbrirSesion,
  onBuscarActualizaciones,
  hayEcuaciones,
}: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [menuAbierto]);

  const accion = (fn: () => void) => {
    setMenuAbierto(false);
    fn();
  };

  return (
    <header className="toolbar">
      <div className="toolbar-logo">
        <div>
          <div className="titulo">GeoSolver</div>
          <div className="subtitulo">Álgebra lineal · Método gráfico 2D/3D</div>
        </div>
      </div>

      <div className="grupo" role="tablist" aria-label="Modo de graficación">
        <button
          className={`btn-herramienta ${modo === '2D' ? 'activo' : ''}`}
          onClick={() => onCambiarModo('2D')}
          title="Modo 2D"
          aria-label="Modo 2D"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12h18M12 3v18" />
            <circle cx="7" cy="7" r="2.4" fill="currentColor" stroke="none" />
            <circle cx="17" cy="15" r="2.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          className={`btn-herramienta ${modo === '3D' ? 'activo' : ''}`}
          onClick={() => onCambiarModo('3D')}
          title="Modo 3D"
          aria-label="Modo 3D"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            <path d="M12 3v9m0 0l8-4.5M12 12L4 7.5" />
          </svg>
        </button>
      </div>

      <div className="grupo" aria-label="Zoom">
        <button className="btn-herramienta" onClick={onZoomIn} title="Zoom +" aria-label="Acercar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M11 8v6M8 11h6M21 21l-4.3-4.3" />
          </svg>
        </button>
        <button className="btn-herramienta" onClick={onZoomOut} title="Zoom −" aria-label="Alejar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M8 11h6M21 21l-4.3-4.3" />
          </svg>
        </button>
        <button className="btn-herramienta" onClick={onCentrar} title="Centrar vista" aria-label="Centrar vista">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="menu-relativo" ref={menuRef}>
        <button className="btn-accion" onClick={() => setMenuAbierto((v) => !v)} title="Archivo">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
          Archivo
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {menuAbierto && (
          <div className="menu-desplegable">
            <button onClick={() => accion(onGuardarSesion)}>
              Guardar sesión…
            </button>
            <button onClick={() => accion(onAbrirSesion)}>
              Abrir sesión…
            </button>
            <button onClick={() => accion(onExportar)} disabled={!hayEcuaciones}>
              Exportar imagen PNG
            </button>
            <button onClick={() => accion(onBuscarActualizaciones)}>
              Buscar actualizaciones…
            </button>
          </div>
        )}
      </div>

      <button className="btn-accion" onClick={onLimpiar} disabled={!hayEcuaciones} title="Limpiar lienzo">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M10 7V5h4v2m-8 0l1 13h6l1-13" />
        </svg>
        Limpiar lienzo
      </button>
    </header>
  );
}
