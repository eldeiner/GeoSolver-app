export {};

declare global {
  interface Window {
    geosolver: {
      estado: () => Promise<{ configurada: boolean; modelo: string; proveedor: string }>;
      parsear: (prompt: string) => Promise<{
        dimension: '2D' | '3D';
        ecuaciones: Array<{ a: number; b: number; c: number; d: number; operador: '=' | '<=' | '>=' }>;
      }>;
      tutoria: (
        mensajes: Array<{ rol: 'usuario' | 'asistente'; contenido: string }>,
        contexto: string,
        onFragmento: (texto: string) => void,
      ) => Promise<string>;
      detenerTutoria: () => void;
      transcribir: (audio: ArrayBuffer, mime: string) => Promise<string>;
      configurarLlave: (llave: string) => Promise<{ ok: boolean }>;
      guardarPng: (dataUrl: string) => Promise<boolean>;
      guardarSesion: (contenido: string) => Promise<boolean>;
      abrirSesion: () => Promise<string | null>;
      buscarActualizaciones: () => Promise<{ estado: string; mensaje: string }>;
    };
  }
}
