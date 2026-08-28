import { useEffect, useRef, useState } from 'react';
import TutorMarkdown from './TutorMarkdown';
import type { ChatMensaje } from '../lib/types';

interface Props {
  abierto: boolean;
  mensajes: ChatMensaje[];
  generando: boolean;
  hayEcuaciones: boolean;
  iaDisponible: boolean;
  onEnviar: (texto: string) => void;
  onExplicarSistema: () => void;
  onDetener: () => void;
  onConfigurar: () => void;
  onAlternar: () => void;
  onCerrar: () => void;
  onLimpiar: () => void;
}

export default function TutorBox({
  abierto,
  mensajes,
  generando,
  hayEcuaciones,
  iaDisponible,
  onEnviar,
  onExplicarSistema,
  onDetener,
  onConfigurar,
  onAlternar,
  onCerrar,
  onLimpiar,
}: Props) {
  const [entrada, setEntrada] = useState('');
  const contenidoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const contenedor = contenidoRef.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  }, [mensajes, generando]);

  if (!abierto) {
    return (
      <button className="boton-flotante-tutor" onClick={onAlternar} title="Abrir tutoría IA" aria-label="Abrir tutoría IA">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </button>
    );
  }

  const enviar = () => {
    if (!entrada.trim() || generando) return;
    onEnviar(entrada);
    setEntrada('');
  };

  return (
    <div className="caja-tutoria">
      <div className="caja-tutoria-cabecera">
        <div className="icono">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
          </svg>
        </div>
        <div className="titulo">Tutoría GeoSolver</div>
        <button className="btn-icono" onClick={onLimpiar} title="Limpiar conversación" aria-label="Limpiar conversación">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M10 7V5h4v2m-8 0l1 13h6l1-13" />
          </svg>
        </button>
        <button className="btn-icono" onClick={onCerrar} title="Cerrar tutoría" aria-label="Cerrar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="caja-tutoria-contenido" ref={contenidoRef}>
        {mensajes.length === 0 && (
          <div className="chat-vacio">
            Hola, soy el tutor de GeoSolver. Pregúntame sobre el sistema en pantalla, por ejemplo:
            «¿qué pasa si los planos son paralelos?» o pulsa «Explicar sistema».
          </div>
        )}
        {mensajes.map((m, i) =>
          m.rol === 'usuario' ? (
            <div key={i} className="mensaje-chat usuario">
              {m.texto}
            </div>
          ) : (
            <div key={i} className="mensaje-chat asistente">
              {m.texto ? (
                <TutorMarkdown contenido={m.texto} />
              ) : (
                <span className="spinner" style={{ display: 'inline-block' }} />
              )}
            </div>
          ),
        )}
      </div>

      <div className="caja-tutoria-entrada">
        <input
          className="entrada-chat"
          placeholder="Escribe tu pregunta…"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              enviar();
            }
          }}
        />
        {generando ? (
          <button className="btn-icono btn-detener-chat" onClick={onDetener} title="Detener respuesta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            className="btn-enviar-chat"
            onClick={enviar}
            disabled={!entrada.trim() || !iaDisponible}
            title={iaDisponible ? 'Enviar' : 'Se requiere una llave de Groq'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        )}
      </div>

      <div className="caja-tutoria-pie">
        <button className="btn-accion" onClick={onExplicarSistema} disabled={generando || !hayEcuaciones}>
          Explicar sistema
        </button>
        {!iaDisponible && (
          <button className="btn-accion" onClick={onConfigurar} title="Configurar la llave de Groq">
            Configurar llave
          </button>
        )}
      </div>
    </div>
  );
}
