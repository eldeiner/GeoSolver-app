# GeoSolver (Escritorio)

Versión de escritorio de **GeoSolver**: suite de álgebra lineal con interfaz tipo GeoGebra, graficación 2D (canvas) y 3D (Three.js/WebGL dentro de Electron), resolución de sistemas e IA Groq.

## Funciones

- Modo 2D y 3D con zoom, arrastre y centrado.
- Inecuaciones con regiones sombreadas (2D y 3D).
- Sliders de parámetros (estilo GeoGebra): ajusta `a`, `b`, `c` y `d` en tiempo real y observa cómo se mueven la recta o el plano y su punto de intersección.
- Pasos de Gauss-Jordan en el panel algebraico y soluciones con fracciones exactas.
- IA Groq: interpreta lenguaje natural, tutoría en streaming (se puede detener) y voz con Whisper.
- Sesión guardada automáticamente; guardar/abrir sesiones en archivo y exportar el gráfico como PNG.
- Editor matemático MathLive: escribe con renderizado LaTeX en vivo y teclado matemático propio (se abre al tocar el campo de entrada).
- Atajos: `2`/`3` modo, `+`/`-` zoom, `Ctrl+L` limpiar, `Esc` cerrar tutoría.

## Desarrollar

```bash
npm install
npm run dev
```

## Compilar el .exe

```bash
npm run dist
```

Genera en `release/`:
- `GeoSolver-portable-1.0.0.exe` — ejecutable portátil (no requiere instalación).
- `GeoSolver-Setup-1.0.0.exe` — instalador con acceso directo en el escritorio.

## Llave de Groq

El proceso principal de Electron la lee en este orden:
1. Variable de entorno `GROQ_API_KEY`.
2. Archivo `groq.env` en la carpeta de datos de la app (`%APPDATA%\GeoSolver\groq.env`).
3. Archivo `groq.env` junto al ejecutable.
4. Archivo `groq.env` en `~/.geosolver/`.

Si la llave viene de la variable de entorno, la app la guarda automáticamente en `%APPDATA%\GeoSolver\groq.env` para futuras sesiones.

La llave nunca viaja al código de la interfaz; el renderer la usa solo a través de IPC.
