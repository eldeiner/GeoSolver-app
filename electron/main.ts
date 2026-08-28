import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import fs from 'node:fs';
import Groq from 'groq-sdk';

const MODELO_DEFECTO = 'openai/gpt-oss-120b';
const MODELO_WHISPER = 'whisper-large-v3';
const MAX_PROMPT = 4000;
const ES_DEV = process.argv.includes('--dev');

// ---------- Llave de Groq ----------

function rutasLlave(): string[] {
  const rutas = [
    path.join(app.getPath('userData'), 'groq.env'),
    path.join(app.getAppPath(), 'groq.env'),
    path.join(path.dirname(process.execPath), 'groq.env'),
    path.join(app.getPath('home'), '.geosolver', 'groq.env'),
  ];
  try {
    const appData = app.getPath('appData');
    const carpetas = fs.readdirSync(appData, { withFileTypes: true });
    for (const carpeta of carpetas) {
      if (carpeta.isDirectory() && /^geosolver/i.test(carpeta.name)) {
        rutas.push(path.join(appData, carpeta.name, 'groq.env'));
      }
    }
  } catch {
    // sin acceso a la carpeta de datos
  }
  return rutas;
}

function leerLlave(): string | null {
  const deEntorno = process.env.GROQ_API_KEY?.trim();
  if (deEntorno) {
    try {
      const ruta = path.join(app.getPath('userData'), 'groq.env');
      fs.mkdirSync(path.dirname(ruta), { recursive: true });
      if (!fs.existsSync(ruta)) {
        fs.writeFileSync(ruta, `GROQ_API_KEY=${deEntorno}\n`, 'utf-8');
      }
    } catch {
      // sin permiso de escritura: la variable de entorno sigue funcionando
    }
    return deEntorno;
  }

  for (const ruta of rutasLlave()) {
    try {
      if (!fs.existsSync(ruta)) continue;
      const contenido = fs.readFileSync(ruta, 'utf-8');
      const m = contenido.match(/^GROQ_API_KEY=(\S+)/m);
      if (m && m[1]) return m[1].trim();
    } catch {
      // seguir con el siguiente candidato
    }
  }
  return null;
}

function obtenerGroq(): Groq | null {
  const llave = leerLlave();
  if (!llave) return null;
  return new Groq({ apiKey: llave });
}

function escribirDiagnostico(extra: Record<string, unknown> = {}): void {
  try {
    const ruta = path.join(app.getPath('userData'), 'diagnostico.log');
    const fila = JSON.stringify({
      hora: new Date().toISOString(),
      userData: app.getPath('userData'),
      execPath: process.execPath,
      llaveEncontrada: Boolean(leerLlave()),
      ...extra,
    });
    fs.appendFileSync(ruta, fila + '\n', 'utf-8');
  } catch {
    // el registro es solo informativo
  }
}

// ---------- Actualizaciones ----------

function leerUrlActualizaciones(): string | null {
  const deEntorno = process.env.GEOSOLVER_UPDATE_URL?.trim();
  if (deEntorno) return deEntorno;
  try {
    const ruta = path.join(app.getPath('userData'), 'update.json');
    if (!fs.existsSync(ruta)) return null;
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf-8')) as { url?: string };
    if (typeof datos.url === 'string' && datos.url.trim()) return datos.url.trim();
  } catch {
    // configuración inválida
  }
  return null;
}

function configurarActualizador(): void {
  const url = leerUrlActualizaciones();
  if (url) {
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url });
    } catch {
      // URL inválida: se reportará al buscar
    }
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => {
    const ventana = BrowserWindow.getAllWindows()[0];
    if (!ventana) return;
    void dialog
      .showMessageBox(ventana, {
        type: 'info',
        title: 'Actualización lista',
        message: 'La nueva versión de GeoSolver está lista para instalarse.',
        detail: '¿Quieres reiniciar ahora para aplicarla?',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on('error', (err) => {
    escribirDiagnostico({ actualizacion: 'error', detalle: String(err?.message ?? err) });
  });
}

// ---------- Ventana ----------

function crearVentana(mostrar = true): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'GeoSolver',
    backgroundColor: '#f2f8ff',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  ventana.once('ready-to-show', () => {
    if (mostrar) ventana.show();
  });

  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  ventana.webContents.on('will-navigate', (evento, url) => {
    let permitido = url.startsWith('file:');
    if (ES_DEV) {
      try {
        const origen = new URL(url);
        permitido = permitido || (origen.protocol === 'http:' && origen.hostname === 'localhost' && origen.port === '5173');
      } catch {
        permitido = false;
      }
    }
    if (!permitido) evento.preventDefault();
  });

  if (ES_DEV) {
    void ventana.loadURL('http://localhost:5173');
    ventana.webContents.openDevTools({ mode: 'detach' });
  } else {
    void ventana.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }
  return ventana;
}

// ---------- Prompts de Groq ----------

const PROMPT_SISTEMA_PARSEO = `Eres un motor matemático experto. Analiza el texto proporcionado y determina si el sistema es en 2D (x, y) o 3D (x, y, z).
Retorna un JSON estructurado con el formato:
{
  "dimension": "2D" | "3D",
  "ecuaciones": [
    {"a": numero, "b": numero, "c": numero, "d": numero, "operador": "=" | "<=" | ">="}
  ]
}
Nota: En 2D, el parámetro 'c' será 0 y 'd' corresponderá al término independiente. En 3D, 'd' es el término independiente.
Escribe SOLO el JSON, sin texto adicional. Si el texto no describe un sistema lineal, retorna {"error": "mensaje claro en español"}.`;

const PROMPT_SISTEMA_TUTOR = `Eres un tutor de álgebra lineal, claro y amable, que explica en español para estudiantes.
Explica en lenguaje sencillo los pasos matemáticos del sistema de ecuaciones dado y el significado visual de su intersección
(en 2D: rectas y punto de corte; en 3D: planos translúcidos y el punto o recta donde se cruzan).

Reglas de formato (MUY importantes, respétalas siempre):
- Usa LaTeX para TODA expresión matemática: $...$ o \\(...\\) para fórmulas en línea, y $$...$$ o \\[...\\] para bloques grandes.
- Los sistemas van en \\begin{cases} ... \\end{cases} y las matrices en \\begin{pmatrix} ... \\end{pmatrix}.
- Escribe las coordenadas como P(1, 2, 3): con comas simples, nunca P(1,,2,,3).
- Usa \\Rightarrow para implicaciones, \\cdot para multiplicación y \\frac{}{} para fracciones.
- No uses paréntesis dobles tipo (x+y+z) para resaltar matemática; eso va dentro de las fórmulas.
- Evita \\qquad, \\Longrightarrow, los ";;" y los "\\;" sueltos; mantén las ecuaciones cortas y legibles.
- Termina verificando la solución sustituyendo en las ecuaciones originales.
- Usa Markdown simple: títulos breves (##), viñetas con "-" y párrafos cortos. Máximo 220 palabras por respuesta.
- En una conversación, responde SOLO a la última pregunta del usuario, con continuidad de lo que ya explicaste.`;

function validarPrompt(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new Error('Escribe un enunciado para analizar.');
  }
  const texto = valor.trim();
  if (texto.length > MAX_PROMPT) {
    throw new Error(`El texto es demasiado largo (máximo ${MAX_PROMPT} caracteres).`);
  }
  return texto;
}

async function parsearConGroq(prompt: string): Promise<unknown> {
  const groq = obtenerGroq();
  if (!groq) throw new Error('No hay llave de Groq configurada.');
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: PROMPT_SISTEMA_PARSEO },
      { role: 'user', content: prompt },
    ],
    model: process.env.GROQ_MODEL?.trim() || MODELO_DEFECTO,
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  const contenido = completion.choices[0]?.message?.content ?? '';
  return JSON.parse(contenido);
}

// ---------- IPC ----------

const tutoresActivos = new Map<number, AbortController>();

function registrarIPC(): void {
  ipcMain.handle('groq:status', () => ({
    configurada: Boolean(leerLlave()),
    modelo: process.env.GROQ_MODEL?.trim() || MODELO_DEFECTO,
    proveedor: 'Groq',
    voz: MODELO_WHISPER,
  }));

  ipcMain.handle('groq:parse', async (_evento, prompt: unknown) => {
    const texto = validarPrompt(prompt);
    const groq = obtenerGroq();
    if (!groq) throw new Error('No hay llave de Groq configurada.');
    const parseado = (await parsearConGroq(texto)) as {
      dimension?: string;
      ecuaciones?: Array<{ a?: number; b?: number; c?: number; d?: number; operador?: string }>;
      error?: string;
    };
    if (parseado.error) throw new Error(parseado.error);
    if (!parseado.ecuaciones || parseado.ecuaciones.length === 0) {
      throw new Error('Groq no devolvió ecuaciones válidas.');
    }
    const dimension = parseado.dimension === '3D' ? '3D' : '2D';
    return {
      dimension,
      ecuaciones: parseado.ecuaciones.map((e) => {
        const a = Number(e.a ?? 0);
        const b = Number(e.b ?? 0);
        const c = dimension === '3D' ? Number(e.c ?? 0) : 0;
        const d = Number(e.d ?? 0);
        const operador = e.operador === '<=' || e.operador === '>=' ? e.operador : '=';
        return { a, b, c, d, operador };
      }),
    };
  });

  ipcMain.handle(
    'groq:tutor:start',
    async (
      evento,
      cuerpo: { mensajes?: Array<{ rol?: string; contenido?: string }>; contexto?: string },
    ) => {
      const mensajes = Array.isArray(cuerpo?.mensajes) ? cuerpo.mensajes.slice(0, 20) : [];
      if (mensajes.length === 0) throw new Error('No hay mensajes para el tutor.');
      for (const m of mensajes) {
        if (m.rol !== 'usuario' && m.rol !== 'asistente') throw new Error('Rol de mensaje no válido.');
        if (typeof m.contenido !== 'string' || !m.contenido.trim()) throw new Error('Mensaje vacío.');
        if (m.contenido.length > MAX_PROMPT) {
          throw new Error(`El texto es demasiado largo (máximo ${MAX_PROMPT} caracteres).`);
        }
      }
      const contexto =
        typeof cuerpo?.contexto === 'string' && cuerpo.contexto.trim()
          ? `\n\nContexto actual de la app (lo que hay en pantalla):\n${cuerpo.contexto.trim()}`
          : '';
      const groq = obtenerGroq();
      if (!groq) throw new Error('No hay llave de Groq configurada.');
      const control = new AbortController();
      tutoresActivos.set(evento.sender.id, control);
      try {
        const mensajesGroq: Array<{ role: 'user' | 'assistant'; content: string }> = mensajes.map((m) => ({
          role: m.rol === 'usuario' ? 'user' : 'assistant',
          content: m.contenido as string,
        }));
        const respuesta = await groq.chat.completions.create(
          {
            messages: [
              { role: 'system', content: PROMPT_SISTEMA_TUTOR + contexto },
              ...mensajesGroq,
            ],
            model: process.env.GROQ_MODEL?.trim() || MODELO_DEFECTO,
            temperature: 0.3,
            stream: true,
          },
          { signal: control.signal },
        );
        let textoFinal = '';
        for await (const fragmento of respuesta) {
          const contenido = fragmento.choices[0]?.delta?.content ?? '';
          if (contenido) {
            textoFinal += contenido;
            evento.sender.send('groq:tutor:chunk', contenido);
          }
        }
        return textoFinal;
      } catch (err) {
        if (control.signal.aborted) throw new Error('Cancelado');
        throw err;
      } finally {
        tutoresActivos.delete(evento.sender.id);
      }
    },
  );

  ipcMain.on('groq:tutor:detener', (evento) => {
    tutoresActivos.get(evento.sender.id)?.abort();
    tutoresActivos.delete(evento.sender.id);
  });

  ipcMain.handle('groq:transcribir', async (_evento, audio: Uint8Array, mime: string) => {
    const groq = obtenerGroq();
    if (!groq) throw new Error('No hay llave de Groq configurada.');
    if (!audio || audio.length === 0) throw new Error('No se recibió audio.');
    const buffer = Buffer.from(audio);
    const tipo = typeof mime === 'string' ? mime : '';
    const nombre =
      tipo.includes('ogg') ? 'audio.ogg'
      : tipo.includes('mp4') || tipo.includes('m4a') ? 'audio.m4a'
      : 'audio.webm';
    const archivo = new File([buffer], nombre, { type: tipo || 'audio/webm' });
    const respuesta = await groq.audio.transcriptions.create({
      file: archivo,
      model: MODELO_WHISPER,
      language: 'es',
      response_format: 'json',
    });
    return respuesta.text;
  });

  ipcMain.handle('groq:configurar', async (_evento, llave: unknown) => {
    if (typeof llave !== 'string' || !/^gsk_[A-Za-z0-9_-]{10,}$/.test(llave.trim())) {
      throw new Error('La llave de Groq no tiene el formato esperado (debe empezar con gsk_).');
    }
    const llaveLimpia = llave.trim();
    const groq = new Groq({ apiKey: llaveLimpia });
    try {
      await groq.models.list();
    } catch {
      throw new Error('La llave no es válida o no tiene acceso a Groq.');
    }
    const ruta = path.join(app.getPath('userData'), 'groq.env');
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, `GROQ_API_KEY=${llaveLimpia}\n`, 'utf-8');
    escribirDiagnostico({ configuracion: 'guardada' });
    return { ok: true };
  });

  ipcMain.handle('archivo:guardarPng', async (_evento, dataUrl: string) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Imagen no válida.');
    }
    const resultado = await dialog.showSaveDialog({
      title: 'Guardar gráfico',
      defaultPath: `GeoSolver-${new Date().toISOString().slice(0, 10)}.png`,
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }],
    });
    if (resultado.canceled || !resultado.filePath) return false;
    fs.writeFileSync(resultado.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return true;
  });

  ipcMain.handle('archivo:guardarSesion', async (_evento, contenido: string) => {
    if (typeof contenido !== 'string' || !contenido.trim()) throw new Error('Sesión vacía.');
    const resultado = await dialog.showSaveDialog({
      title: 'Guardar sesión',
      defaultPath: `GeoSolver-${new Date().toISOString().slice(0, 10)}.geosolver.json`,
      filters: [{ name: 'Sesión GeoSolver', extensions: ['json'] }],
    });
    if (resultado.canceled || !resultado.filePath) return false;
    fs.writeFileSync(resultado.filePath, contenido, 'utf-8');
    return true;
  });

  ipcMain.handle('archivo:abrirSesion', async () => {
    const resultado = await dialog.showOpenDialog({
      title: 'Abrir sesión',
      filters: [{ name: 'Sesión GeoSolver', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (resultado.canceled || resultado.filePaths.length === 0) return null;
    return fs.readFileSync(resultado.filePaths[0], 'utf-8');
  });

  ipcMain.handle('actualizaciones:buscar', async () => {
    if (!app.isPackaged) {
      return { estado: 'desarrollo', mensaje: 'Las actualizaciones se revisan solo en la versión instalada.' };
    }
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      return {
        estado: 'portable',
        mensaje: 'La versión portátil no se actualiza sola; descarga la nueva versión cuando esté disponible.',
      };
    }
    const url = leerUrlActualizaciones();
    if (!url) {
      return {
        estado: 'sin-configurar',
        mensaje:
          'No hay servidor de actualizaciones configurado. Usa la variable GEOSOLVER_UPDATE_URL o el archivo %APPDATA%\\GeoSolver\\update.json.',
      };
    }
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url });
      const disponible = await new Promise<boolean>((resolver) => {
        const temporizador = setTimeout(() => resolver(false), 20000);
        autoUpdater.once('update-available', () => {
          clearTimeout(temporizador);
          resolver(true);
        });
        autoUpdater.once('update-not-available', () => {
          clearTimeout(temporizador);
          resolver(false);
        });
        autoUpdater.once('error', () => {
          clearTimeout(temporizador);
          resolver(false);
        });
        void autoUpdater.checkForUpdates().catch(() => resolver(false));
      });
      return disponible
        ? { estado: 'disponible', mensaje: 'Hay una nueva versión. Se está descargando…' }
        : { estado: 'actualizado', mensaje: `Estás al día (versión ${app.getVersion()}).` };
    } catch (err) {
      return { estado: 'error', mensaje: `No se pudo consultar actualizaciones: ${(err as Error).message}` };
    }
  });
}

// ---------- Prueba interna ----------

async function pruebaHumo(): Promise<void> {
  const salida: Record<string, unknown> = { ok: true, hora: new Date().toISOString(), etapa: 'inicio' };
  const temporizador = setTimeout(() => {
    salida.ok = false;
    salida.etapa = 'tiempo-agotado';
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'smoke.json'), JSON.stringify(salida, null, 2), 'utf-8');
    } catch {
      // sin acceso a escritura
    }
    app.exit(1);
  }, 90000);
  try {
    const ventana = crearVentana(false);
    salida.etapa = 'cargando-ventana';
    await new Promise<void>((resolver) => ventana.webContents.once('did-finish-load', () => resolver()));
    salida.etapa = 'ventana-cargada';
    await new Promise((r) => setTimeout(r, 1500));
    salida.etapa = 'revisando-dom';
    salida.dom = await ventana.webContents.executeJavaScript(`({
      titulo: document.title,
      toolbar: !!document.querySelector('.toolbar'),
      lienzo: !!document.querySelector('.lienzo-2d'),
      tarjetas: document.querySelectorAll('.tarjeta-ecuacion').length,
      tieneBridge: typeof window.geosolver === 'object'
    })`);
    salida.sliders = await ventana.webContents.executeJavaScript(`(async () => {
      const tarjeta = document.querySelector('.tarjeta-ecuacion');
      if (!tarjeta) return { error: 'sin tarjeta' };
      const boton = tarjeta.querySelector('.btn-sliders');
      if (!boton) return { error: 'sin boton' };
      boton.click();
      await new Promise((r) => setTimeout(r, 150));
      const slider = tarjeta.querySelector('input[type=range]');
      if (!slider) return { error: 'sin slider' };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(slider, '3');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      return {
        boton: true,
        slider: true,
        entrada: tarjeta.querySelector('.entrada-ecuacion').value,
        solucion: (document.querySelector('.insignia-solucion') || {}).textContent || ''
      };
    })()`);
    salida.coordenadas = await ventana.webContents.executeJavaScript(`(async () => {
      const lienzo = document.querySelector('.lienzo-2d');
      if (!lienzo) return { error: 'sin lienzo' };
      const rect = lienzo.getBoundingClientRect();
      lienzo.dispatchEvent(new PointerEvent('pointermove', {
        clientX: rect.left + rect.width / 2 + 70,
        clientY: rect.top + rect.height / 2 - 30,
        bubbles: true
      }));
      await new Promise((r) => setTimeout(r, 250));
      return { texto: (document.querySelector('.barra-coordenadas') || {}).textContent || '' };
    })()`);
    salida.teclado = await ventana.webContents.executeJavaScript(`(async () => {
      const entrada = document.querySelector('.entrada-texto');
      if (!entrada) return { error: 'sin entrada' };
      entrada.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 180));
      const visible = !!document.querySelector('.teclado-matematico');
      const clickYLeer = async (valor) => {
        const t = document.querySelector('.tecla[data-valor="' + valor + '"]');
        if (!t) return { valor, error: 'sin-tecla' };
        t.click();
        await new Promise((r) => setTimeout(r, 120));
        return { valor, latex: entrada.value };
      };
      const sen = await clickYLeer('sen');
      const pot2 = await clickYLeer('x^{2}');
      const caret = await clickYLeer('^');
      const ne = await clickYLeer('≠');
      const ans = await clickYLeer('Ans');
      const igual = await clickYLeer('=');
      const teclas = [...document.querySelectorAll('.tecla')].map((t) => t.getAttribute('data-valor')).join(',');
      const iguales = [...document.querySelectorAll('.tecla.ancha2')].map((t) => t.textContent).join(',');
      entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 180));
      const cerrado = !document.querySelector('.teclado-matematico');
      return {
        visible,
        sen,
        pot2,
        caret,
        ne,
        ans,
        igual,
        teclas,
        iguales,
        cerrado,
        sinCabecera: !document.querySelector('.teclado-cabecera'),
      };
    })()`);
    salida.animacion = await ventana.webContents.executeJavaScript(`(async () => {
      const tarjeta = document.querySelector('.tarjeta-ecuacion');
      const boton = tarjeta.querySelector('.btn-animar');
      if (!boton) return { error: 'sin boton animar' };
      const antes = tarjeta.querySelector('.entrada-ecuacion').value;
      boton.click();
      await new Promise((r) => setTimeout(r, 900));
      const despues = tarjeta.querySelector('.entrada-ecuacion').value;
      const boton2 = tarjeta.querySelector('.btn-animar');
      boton2.click();
      await new Promise((r) => setTimeout(r, 600));
      const v1 = tarjeta.querySelector('.entrada-ecuacion').value;
      await new Promise((r) => setTimeout(r, 500));
      const v2 = tarjeta.querySelector('.entrada-ecuacion').value;
      return { antes, despues, cambio: antes !== despues, parado: v1 === v2, v1, v2 };
    })()`);
    salida.animacion3D = await ventana.webContents.executeJavaScript(`(async () => {
      const modo3D = document.querySelector('button[title="Modo 3D"]');
      if (!modo3D) return { error: 'sin modo 3D' };
      modo3D.click();
      await new Promise((r) => setTimeout(r, 900));
      const tarjeta = document.querySelector('.tarjeta-ecuacion');
      const botonC = tarjeta.querySelectorAll('.btn-animar')[2];
      if (!botonC) return { error: 'sin boton c' };
      botonC.click();
      await new Promise((r) => setTimeout(r, 900));
      const conZ = tarjeta.querySelector('.entrada-ecuacion').value;
      // Cambiar a 2D SIN pulsar parar: la animación debe detenerse sola
      document.querySelector('button[title="Modo 2D"]').click();
      await new Promise((r) => setTimeout(r, 700));
      const v1 = tarjeta.querySelector('.entrada-ecuacion').value;
      await new Promise((r) => setTimeout(r, 500));
      const v2 = tarjeta.querySelector('.entrada-ecuacion').value;
      return {
        conZ,
        seDetuvoAlCambiarModo: v1 === v2,
        sliderZVisible: tarjeta.querySelectorAll('.slider-etiqueta').length >= 3,
      };
    })()`);
    salida.chat = await ventana.webContents.executeJavaScript(`(async () => {
      const botonTutor = document.querySelector('.boton-flotante-tutor');
      if (!botonTutor) return { error: 'sin boton tutor' };
      botonTutor.click();
      await new Promise((r) => setTimeout(r, 150));
      const entrada = document.querySelector('.entrada-chat');
      if (!entrada) return { error: 'sin entrada chat' };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(entrada, '¿Qué significa que los planos sean paralelos?');
      entrada.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
      const enviar = document.querySelector('.btn-enviar-chat');
      if (!enviar) return { error: 'sin boton enviar' };
      enviar.click();
      await new Promise((r) => setTimeout(r, 16000));
      return {
        mensajes: document.querySelectorAll('.mensaje-chat').length,
        ultimoLargo: (() => {
          const msgs = document.querySelectorAll('.mensaje-chat');
          const ultimo = msgs[msgs.length - 1];
          return ultimo ? ultimo.textContent.length : 0;
        })()
      };
    })()`);
    const llavePrueba = process.env.GEOSOLVER_TEST_KEY;
    if (!leerLlave() && llavePrueba) {
      salida.sinLlaveInicial = true;
      salida.modalConfiguracionVisible = await ventana.webContents.executeJavaScript(
        '!!document.querySelector(".modal-configuracion")',
      );
      salida.guardado = await ventana.webContents.executeJavaScript(
        `window.geosolver.configurarLlave(${JSON.stringify(llavePrueba)})`,
      );
      salida.estadoFinal = await ventana.webContents.executeJavaScript('window.geosolver.estado()');
    }
    salida.estado = await ventana.webContents.executeJavaScript('window.geosolver.estado()');
    salida.parseo = await parsearConGroq('x + y = 6, 2x - y = 3').catch((err) => ({ error: String(err) }));
    salida.tutor = await ventana.webContents.executeJavaScript(`(async () => {
      const t = await window.geosolver.tutoria(
        [{ rol: 'usuario', contenido: 'Sistema: x + y + z = 6 ; x - y + z = 2 ; 2x + y - z = 1. Clasificación: solucion unica P(1, 2, 3). Explica el metodo y que se ve en el grafico.' }],
        'Sistema en pantalla: x + y + z = 6 ; x - y + z = 2 ; 2x + y - z = 1',
        () => {}
      );
      return { largo: t.length, dobleComa: t.includes(',,'), qquad: t.includes('\\\\qquad'), usaLatex: t.includes('$') || t.includes('\\\\(') || t.includes('\\\\['), verificacion: t.includes('1 + 2 + 3') || t.includes('1+2+3') };
    })()`);
    salida.etapa = 'limpiando';
    await ventana.webContents.executeJavaScript('window.localStorage.clear()');
    salida.etapa = 'listo';
  } catch (err) {
    salida.ok = false;
    salida.etapa = 'error';
    salida.error = String(err);
  } finally {
    clearTimeout(temporizador);
    const ruta = path.join(app.getPath('userData'), 'smoke.json');
    fs.writeFileSync(ruta, JSON.stringify(salida, null, 2), 'utf-8');
    app.quit();
  }
}

// ---------- Ciclo de vida ----------

const esUnico = app.requestSingleInstanceLock();
if (!esUnico) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [ventana] = BrowserWindow.getAllWindows();
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  app.whenReady().then(() => {
    if (!ES_DEV) Menu.setApplicationMenu(null);
    configurarActualizador();
    registrarIPC();
    escribirDiagnostico();
    if (process.env.GEOSOLVER_AUTOQUIT === '1') {
      crearVentana(false);
      setTimeout(() => app.quit(), 4000);
      return;
    }
    if (process.argv.includes('--smoke')) {
      void pruebaHumo();
      return;
    }
    crearVentana();
    // Comprobación automática de actualizaciones al iniciar (solo versión
    // instalada; el ejecutable portátil no se autoactualiza).
    if (!ES_DEV && !process.env.PORTABLE_EXECUTABLE_FILE) {
      autoUpdater.checkForUpdates().catch(() => {
        // sin conexión o feed no configurado: se ignora y se continúa con normalidad
      });
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
