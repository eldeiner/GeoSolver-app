import { contextBridge, ipcRenderer } from 'electron';

export interface ResultadoParseo {
  dimension: '2D' | '3D';
  ecuaciones: Array<{ a: number; b: number; c: number; d: number; operador: '=' | '<=' | '>=' }>;
}

export interface EstadoGroq {
  configurada: boolean;
  modelo: string;
  proveedor: string;
  voz: string;
}

contextBridge.exposeInMainWorld('geosolver', {
  estado: (): Promise<EstadoGroq> => ipcRenderer.invoke('groq:status'),
  parsear: (prompt: string): Promise<ResultadoParseo> => ipcRenderer.invoke('groq:parse', prompt),
  tutoria: (
    mensajes: Array<{ rol: 'usuario' | 'asistente'; contenido: string }>,
    contexto: string,
    onFragmento: (texto: string) => void,
  ): Promise<string> => {
    const escucha = (_e: unknown, texto: string) => onFragmento(texto);
    ipcRenderer.on('groq:tutor:chunk', escucha);
    return ipcRenderer.invoke('groq:tutor:start', { mensajes, contexto }).finally(() => {
      ipcRenderer.removeListener('groq:tutor:chunk', escucha);
    });
  },
  detenerTutoria: (): void => {
    ipcRenderer.send('groq:tutor:detener');
  },
  transcribir: (audio: ArrayBuffer, mime: string): Promise<string> =>
    ipcRenderer.invoke('groq:transcribir', new Uint8Array(audio), mime),
  configurarLlave: (llave: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('groq:configurar', llave),
  guardarPng: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke('archivo:guardarPng', dataUrl),
  guardarSesion: (contenido: string): Promise<boolean> => ipcRenderer.invoke('archivo:guardarSesion', contenido),
  abrirSesion: (): Promise<string | null> => ipcRenderer.invoke('archivo:abrirSesion'),
  buscarActualizaciones: (): Promise<{ estado: string; mensaje: string }> =>
    ipcRenderer.invoke('actualizaciones:buscar'),
});
