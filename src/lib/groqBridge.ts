export interface EstadoGroq {
  configurada: boolean;
  modelo: string;
  proveedor: string;
}

export async function estadoGroq(): Promise<EstadoGroq> {
  return window.geosolver.estado();
}

export async function parsearConIA(prompt: string) {
  return window.geosolver.parsear(prompt);
}

export async function explicarConIA(
  mensajes: Array<{ rol: 'usuario' | 'asistente'; contenido: string }>,
  contexto: string,
  onFragmento: (texto: string) => void,
): Promise<void> {
  await window.geosolver.tutoria(mensajes, contexto, onFragmento);
}

export function detenerTutoria(): void {
  window.geosolver.detenerTutoria();
}

export async function transcribirAudio(audio: ArrayBuffer, mime: string): Promise<string> {
  return window.geosolver.transcribir(audio, mime);
}

export async function configurarLlave(llave: string): Promise<{ ok: boolean }> {
  return window.geosolver.configurarLlave(llave);
}

export async function guardarImagen(dataUrl: string): Promise<boolean> {
  return window.geosolver.guardarPng(dataUrl);
}

export async function guardarSesion(contenido: string): Promise<boolean> {
  return window.geosolver.guardarSesion(contenido);
}

export async function abrirSesion(): Promise<string | null> {
  return window.geosolver.abrirSesion();
}

export async function buscarActualizaciones(): Promise<{ estado: string; mensaje: string }> {
  return window.geosolver.buscarActualizaciones();
}
