import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import AlgebraPanel from './components/AlgebraPanel';
import InputBar from './components/InputBar';
import Canvas2D, { type ControlLienzo2D } from './components/Canvas2D';
import Scene3D, { type ControlEscena3D } from './components/Scene3D';
import TutorBox from './components/TutorBox';
import KeySetupModal from './components/KeySetupModal';
import { crearEcuacionCanonica, detectarDimension, formatearEcuacion, parsearBloque } from './lib/mathParser';
import { formatearPunto, intersecciones2D, resolverSistema } from './lib/solver';
import {
  abrirSesion,
  buscarActualizaciones,
  detenerTutoria,
  estadoGroq,
  explicarConIA,
  guardarImagen,
  guardarSesion,
  parsearConIA,
  type EstadoGroq,
} from './lib/groqBridge';
import { PALETA, type ChatMensaje, type Coordenadas, type Dimension, type Ecuacion, type Operador } from './lib/types';

const CLAVE_SESION = 'geosolver_sesion_v1';

interface SesionGuardada {
  modo?: Dimension;
  ecuaciones?: Array<{
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    operador?: string;
    color?: string;
    visible?: boolean;
    texto?: string;
  }>;
}

function sesionValida(datos: SesionGuardada): boolean {
  return (
    Array.isArray(datos.ecuaciones) &&
    datos.ecuaciones.every(
      (e) =>
        e &&
        typeof e.a === 'number' &&
        typeof e.b === 'number' &&
        typeof e.c === 'number' &&
        typeof e.d === 'number',
    )
  );
}

function construirSesion(datos: SesionGuardada): { modo: Dimension; ecuaciones: Ecuacion[] } {
  const operadorValido = (op?: string): Operador => (op === '<=' || op === '>=' ? op : '=');
  return {
    modo: datos.modo === '3D' ? '3D' : '2D',
    ecuaciones: (datos.ecuaciones ?? []).map((e, i) =>
      crearEcuacionCanonica(
        Number(e.a),
        Number(e.b),
        Number(e.c),
        Number(e.d),
        operadorValido(e.operador),
        e.color && e.color.startsWith('#') ? e.color : PALETA[i % PALETA.length],
      ),
    ),
  };
}

function cargarSesionLocal(): { modo: Dimension; ecuaciones: Ecuacion[] } | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as SesionGuardada;
    if (!sesionValida(datos)) return null;
    return construirSesion(datos);
  } catch {
    return null;
  }
}

function estadoInicial(): { modo: Dimension; ecuaciones: Ecuacion[] } {
  return cargarSesionLocal() ?? {
    modo: '2D',
    ecuaciones: [
      crearEcuacionCanonica(1, 1, 0, 6, '=', PALETA[0]),
      crearEcuacionCanonica(2, -1, 0, 3, '=', PALETA[1]),
    ],
  };
}

function redondear(v: number): number {
  return Math.round(v * 100) / 100;
}

export default function App() {
  const inicial = useRef(estadoInicial());
  const [modo, setModo] = useState<Dimension>(inicial.current.modo);
  const [ecuaciones, setEcuaciones] = useState<Ecuacion[]>(inicial.current.ecuaciones);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [tutorAbierto, setTutorAbierto] = useState(false);
  const [chat, setChat] = useState<ChatMensaje[]>([]);
  const [chatGenerando, setChatGenerando] = useState(false);
  const [estado, setEstado] = useState<EstadoGroq | null>(null);
  const [senalCentrar3D, setSenalCentrar3D] = useState(0);
  const [configAbierta, setConfigAbierta] = useState(false);
  const [animacion, setAnimacion] = useState<{ ecId: string; parametro: 'a' | 'b' | 'c' | 'd' } | null>(null);
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);

  const lienzo2DRef = useRef<ControlLienzo2D | null>(null);
  const escena3DRef = useRef<ControlEscena3D | null>(null);
  const animacionRef = useRef(animacion);
  animacionRef.current = animacion;

  const iaDisponible = Boolean(estado?.configurada);

  const refrescarEstado = useCallback(() => {
    estadoGroq()
      .then(setEstado)
      .catch(() => setEstado(null));
  }, []);

  useEffect(() => {
    refrescarEstado();
  }, [refrescarEstado]);

  useEffect(() => {
    if (estado && !estado.configurada) setConfigAbierta(true);
  }, [estado]);

  // Guardar sesión automáticamente
  useEffect(() => {
    try {
      const datos: SesionGuardada = {
        modo,
        ecuaciones: ecuaciones.map((e) => ({
          a: e.a,
          b: e.b,
          c: e.c,
          d: e.d,
          operador: e.operador,
          color: e.color,
          visible: e.visible,
          texto: e.texto,
        })),
      };
      window.localStorage.setItem(CLAVE_SESION, JSON.stringify(datos));
    } catch {
      // sin almacenamiento disponible
    }
  }, [modo, ecuaciones]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 7000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const resultado = useMemo(() => resolverSistema(ecuaciones), [ecuaciones]);
  const intersecciones = useMemo(() => intersecciones2D(ecuaciones), [ecuaciones]);
  const punto3D = useMemo(
    () => (resultado.tipo === 'unica' && resultado.punto ? resultado.punto : null),
    [resultado],
  );

  const contextoChat = useMemo(() => {
    const sistema = ecuaciones.filter((e) => e.visible).map((e) => e.texto).join(' ; ') || 'sin ecuaciones';
    return `Sistema en pantalla: ${sistema}\nClasificación local: ${resultado.detalle}`;
  }, [ecuaciones, resultado.detalle]);

  // ---------- Animación de parámetros ----------
  useEffect(() => {
    if (!animacion) return;
    let id = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      const actual = animacionRef.current;
      if (!actual) return;
      const seg = (t - inicio) / 1000;
      const rango = actual.parametro === 'd' ? { min: -20, max: 20 } : { min: -10, max: 10 };
      const centro = (rango.min + rango.max) / 2;
      const amplitud = (rango.max - rango.min) / 2 - 1;
      const valor = redondear(centro + amplitud * Math.sin(seg * 1.7));
      setEcuaciones((prev) =>
        prev.map((e) => {
          if (e.id !== actual.ecId) return e;
          const valores = { ...e, [actual.parametro]: valor } as Ecuacion;
          return {
            ...e,
            [actual.parametro]: valor,
            texto: formatearEcuacion(valores.a, valores.b, valores.c, valores.d, e.operador),
            error: false,
          };
        }),
      );
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [animacion]);

  const alternarAnimacion = useCallback((ecId: string, parametro: 'a' | 'b' | 'c' | 'd') => {
    setAnimacion((prev) => (prev && prev.ecId === ecId && prev.parametro === parametro ? null : { ecId, parametro }));
  }, []);

  // Detener la animación al cambiar de modo (evita que "c/Z" siga moviéndose sin control)
  useEffect(() => {
    setAnimacion(null);
  }, [modo]);

  // Detener la animación si la ecuación animada se elimina
  useEffect(() => {
    if (animacion && !ecuaciones.some((e) => e.id === animacion.ecId)) setAnimacion(null);
  }, [ecuaciones, animacion]);

  // ---------- Acciones ----------
  const agregarSistema = useCallback(
    (lista: Array<{ a: number; b: number; c: number; d: number; operador: Operador }>, dimension: Dimension) => {
      setEcuaciones((prev) => {
        const base = prev.length;
        return [
          ...prev,
          ...lista.map((c, i) =>
            crearEcuacionCanonica(c.a, c.b, c.c, c.d, c.operador, PALETA[(base + i) % PALETA.length]),
          ),
        ];
      });
      setModo(dimension);
    },
    [],
  );

  const graficarTexto = useCallback(
    (texto: string) => {
      setMensaje(null);
      try {
        const lista = parsearBloque(texto);
        const dimension = detectarDimension(lista);
        agregarSistema(lista, dimension);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : 'Texto no reconocido.';
        setMensaje(`${detalle} Puedes intentar con "Analizar con IA".`);
      }
    },
    [agregarSistema],
  );

  const analizarConIA = useCallback(
    async (texto: string) => {
      setMensaje(null);
      setAnalizando(true);
      try {
        const datos = await parsearConIA(texto);
        if (!datos.ecuaciones || datos.ecuaciones.length === 0) {
          setMensaje('Groq no encontró ecuaciones en el texto.');
          return;
        }
        agregarSistema(datos.ecuaciones, datos.dimension);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : 'Error desconocido.';
        setMensaje(detalle);
      } finally {
        setAnalizando(false);
      }
    },
    [agregarSistema],
  );

  const actualizarEcuacion = useCallback((id: string, parcial: Partial<Ecuacion>) => {
    setEcuaciones((prev) => prev.map((e) => (e.id === id ? { ...e, ...parcial } : e)));
  }, []);

  const eliminarEcuacion = useCallback((id: string) => {
    setEcuaciones((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const alternarVisible = useCallback((id: string) => {
    setEcuaciones((prev) => prev.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)));
  }, []);

  const limpiarLienzo = useCallback(() => {
    setEcuaciones([]);
    setAnimacion(null);
    setChat([]);
  }, []);

  const centrarVista = useCallback(() => {
    if (modo === '2D') lienzo2DRef.current?.centrar();
    else setSenalCentrar3D((n) => n + 1);
  }, [modo]);

  const zoomMas = useCallback(() => {
    if (modo === '2D') lienzo2DRef.current?.zoomIn();
    else escena3DRef.current?.zoomIn();
  }, [modo]);

  const zoomMenos = useCallback(() => {
    if (modo === '2D') lienzo2DRef.current?.zoomOut();
    else escena3DRef.current?.zoomOut();
  }, [modo]);

  // ---------- Chat del tutor ----------
  const enviarChat = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || chatGenerando) return;
      const historial: ChatMensaje[] = [...chat, { rol: 'usuario', texto: limpio }];
      setChat([...historial, { rol: 'asistente', texto: '' }]);
      setChatGenerando(true);
      try {
        await explicarConIA(
          historial.map((m) => ({ rol: m.rol, contenido: m.texto })),
          contextoChat,
          (fragmento) => {
            setChat((prev) => {
              const nuevos = [...prev];
              const ultimo = nuevos[nuevos.length - 1];
              nuevos[nuevos.length - 1] = { ...ultimo, texto: ultimo.texto + fragmento };
              return nuevos;
            });
          },
        );
      } catch (err) {
        if ((err as Error).message !== 'Cancelado') {
          setChat((prev) => {
            const nuevos = [...prev];
            const ultimo = nuevos[nuevos.length - 1];
            nuevos[nuevos.length - 1] = {
              ...ultimo,
              texto: `${ultimo.texto}\n\n[No se pudo conectar con el tutor: ${(err as Error).message}]`,
            };
            return nuevos;
          });
        }
      } finally {
        setChatGenerando(false);
      }
    },
    [chat, chatGenerando, contextoChat],
  );

  const explicarSistema = useCallback(() => {
    void enviarChat('Explica el sistema actual paso a paso (método de resolución y significado visual) y verifica la solución.');
  }, [enviarChat]);

  const detenerChat = useCallback(() => {
    detenerTutoria();
    setChatGenerando(false);
  }, []);

  const limpiarChat = useCallback(() => {
    detenerTutoria();
    setChatGenerando(false);
    setChat([]);
  }, []);

  // ---------- Archivo y actualizaciones ----------
  const exportarImagen = useCallback(() => {
    const dataUrl = modo === '2D' ? lienzo2DRef.current?.exportar() : escena3DRef.current?.exportar();
    if (!dataUrl) {
      setMensaje('No se pudo generar la imagen.');
      return;
    }
    void guardarImagen(dataUrl).then((ok) => {
      if (ok) setMensaje('Imagen guardada.');
    });
  }, [modo]);

  const guardarSesionActual = useCallback(async () => {
    const contenido = JSON.stringify(
      {
        version: 1,
        modo,
        ecuaciones: ecuaciones.map(({ a, b, c, d, operador, color, visible, texto }) => ({
          a,
          b,
          c,
          d,
          operador,
          color,
          visible,
          texto,
        })),
      },
      null,
      2,
    );
    const ok = await guardarSesion(contenido);
    if (ok) setMensaje('Sesión guardada.');
  }, [modo, ecuaciones]);

  const abrirSesionActual = useCallback(async () => {
    const crudo = await abrirSesion();
    if (!crudo) return;
    try {
      const datos = JSON.parse(crudo) as SesionGuardada;
      if (!sesionValida(datos)) {
        setMensaje('El archivo no es una sesión válida de GeoSolver.');
        return;
      }
      const sesion = construirSesion(datos);
      setModo(sesion.modo);
      setEcuaciones(sesion.ecuaciones);
      setMensaje('Sesión abierta.');
    } catch {
      setMensaje('El archivo no es una sesión válida de GeoSolver.');
    }
  }, []);

  const buscarActualizacionesAhora = useCallback(async () => {
    try {
      const r = await buscarActualizaciones();
      setMensaje(r.mensaje);
    } catch (err) {
      setMensaje(`No se pudo consultar actualizaciones: ${(err as Error).message}`);
    }
  }, []);

  const falloWebGL = useCallback((detalle: string) => {
    setMensaje(detalle);
    setModo('2D');
  }, []);

  // ---------- Atajos ----------
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && (objetivo.tagName === 'INPUT' || objetivo.tagName === 'TEXTAREA' || objetivo.tagName === 'SELECT')) return;
      if (e.key === '2') setModo('2D');
      else if (e.key === '3') setModo('3D');
      else if (e.key === '+' || e.key === '=') zoomMas();
      else if (e.key === '-') zoomMenos();
      else if (e.key === 'Escape') {
        setTutorAbierto(false);
        detenerTutoria();
        setChatGenerando(false);
      } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        limpiarLienzo();
      }
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [zoomMas, zoomMenos, limpiarLienzo]);

  const formatearCoord = (v: number) => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 100) / 100));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        modo={modo}
        onCambiarModo={setModo}
        onZoomIn={zoomMas}
        onZoomOut={zoomMenos}
        onCentrar={centrarVista}
        onLimpiar={limpiarLienzo}
        onExportar={exportarImagen}
        onGuardarSesion={guardarSesionActual}
        onAbrirSesion={abrirSesionActual}
        onBuscarActualizaciones={buscarActualizacionesAhora}
        hayEcuaciones={ecuaciones.length > 0}
      />

      <div className="contenedor">
        <AlgebraPanel
          ecuaciones={ecuaciones}
          resultado={resultado}
          modo={modo}
          animacion={animacion}
          onDetenerAnimacion={() => setAnimacion(null)}
          onActualizar={actualizarEcuacion}
          onAnimar={alternarAnimacion}
          onEliminar={eliminarEcuacion}
          onAlternarVisible={alternarVisible}
        />

        <main className="zona-grafico">
          {modo === '2D' ? (
            <Canvas2D
              ref={lienzo2DRef}
              ecuaciones={ecuaciones}
              intersecciones={intersecciones}
              onCoordenadas={setCoordenadas}
            />
          ) : (
            <Scene3D
              ref={escena3DRef}
              ecuaciones={ecuaciones}
              punto={punto3D}
              senalCentrar={senalCentrar3D}
              onError={falloWebGL}
              onCoordenadas={setCoordenadas}
            />
          )}

          <div className="barra-coordenadas">
            <span>x: {coordenadas ? formatearCoord(coordenadas.x) : '—'}</span>
            <span>y: {coordenadas ? formatearCoord(coordenadas.y) : '—'}</span>
            {coordenadas?.z !== undefined && <span>z: {formatearCoord(coordenadas.z)}</span>}
          </div>

          {modo === '3D' && <div className="hint-barra">Arrastra para rotar · rueda para zoom · clic derecho para desplazar</div>}

          {!mensaje && resultado.tipo === 'unica' && (
            <div className="superposicion-centro">
              <div className="insignia-solucion">
                <span className="punto-rojo" />
                Punto de intersección: P({formatearPunto(resultado.punto!)})
              </div>
            </div>
          )}

          {mensaje && (
            <div className="aviso-error" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: '62%', margin: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {mensaje}
            </div>
          )}

          <InputBar
            ocupado={analizando}
            iaDisponible={iaDisponible}
            onGraficar={graficarTexto}
            onAnalizarConIA={analizarConIA}
          />

          <TutorBox
            abierto={tutorAbierto}
            mensajes={chat}
            generando={chatGenerando}
            hayEcuaciones={ecuaciones.length > 0}
            iaDisponible={iaDisponible}
            onEnviar={(texto) => void enviarChat(texto)}
            onExplicarSistema={explicarSistema}
            onDetener={detenerChat}
            onConfigurar={() => setConfigAbierta(true)}
            onAlternar={() => setTutorAbierto((v) => !v)}
            onCerrar={() => {
              detenerTutoria();
              setTutorAbierto(false);
              setChatGenerando(false);
            }}
            onLimpiar={limpiarChat}
          />
        </main>
      </div>

      <KeySetupModal
        abierto={configAbierta}
        onCerrar={() => setConfigAbierta(false)}
        onGuardada={() => {
          setConfigAbierta(false);
          refrescarEstado();
        }}
      />
    </div>
  );
}
