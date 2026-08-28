"""Genera el icono de GeoSolver (512x512 PNG) sin dependencias externas."""

import math
import os
import struct
import zlib

S = 512
SS = 4
W = S * SS


def dist_punto_segmento(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    t = (wx * vx + wy * vy) / (vx * vx + vy * vy + 1e-12)
    t = max(0.0, min(1.0, t))
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return math.hypot(dx, dy)


def dentro_rect_redondeado(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ox = max(qx, 0.0)
    oy = max(qy, 0.0)
    return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - r <= 0


def hex_a_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


AZUL = hex_a_rgb('#3b82f6')
VIOLETA = hex_a_rgb('#8b5cf6')
BLANCO = (255, 255, 255)
ROJO = hex_a_rgb('#ef4444')

cx = cy = S / 2
hw = hh = S / 2 - 14
radio = 112

# Segmentos (en coordenadas finales 512)
linea_a = (112, 298, 402, 182)
linea_b = (112, 192, 402, 332)
# Intersección calculada de las dos rectas
px_int = 228
py_int = 251

buf = bytearray(W * W * 4)

for y in range(W):
    fy = y / SS
    t_y = fy / S
    for x in range(W):
        fx = x / SS
        i = (y * W + x) * 4
        if not dentro_rect_redondeado(fx, fy, cx, cy, hw, hh, radio):
            buf[i + 3] = 0
            continue

        # Degradado azul -> violeta
        t = (fx + fy) / (2 * S)
        r = AZUL[0] + (VIOLETA[0] - AZUL[0]) * t
        g = AZUL[1] + (VIOLETA[1] - AZUL[1]) * t
        b = AZUL[2] + (VIOLETA[2] - AZUL[2]) * t

        cobertura = 0.0

        # Ejes finos
        d_eje_x = dist_punto_segmento(fx, fy, 96, 300, 424, 300)
        d_eje_y = dist_punto_segmento(fx, fy, 200, 70, 200, 420)
        if min(d_eje_x, d_eje_y) <= 5.0:
            cobertura = 0.85

        # Las dos rectas del gráfico
        d_a = dist_punto_segmento(fx, fy, *linea_a)
        d_b = dist_punto_segmento(fx, fy, *linea_b)
        if min(d_a, d_b) <= 11.0:
            cobertura = 1.0

        if cobertura > 0:
            r = r + (BLANCO[0] - r) * cobertura
            g = g + (BLANCO[1] - g) * cobertura
            b = b + (BLANCO[2] - b) * cobertura

        # Punto de intersección rojo con anillo blanco
        d_punto = math.hypot(fx - px_int, fy - py_int)
        if d_punto <= 34:
            r, g, b = ROJO
        elif d_punto <= 46:
            r, g, b = BLANCO

        buf[i] = int(r)
        buf[i + 1] = int(g)
        buf[i + 2] = int(b)
        buf[i + 3] = 255


# Reducir resolución con promedio (supersampling 4x)
salida = bytearray(S * S * 4)
for y in range(S):
    for x in range(S):
        acc = [0, 0, 0, 0]
        for sy in range(SS):
            for sx in range(SS):
                i = ((y * SS + sy) * W + (x * SS + sx)) * 4
                acc[0] += buf[i]
                acc[1] += buf[i + 1]
                acc[2] += buf[i + 2]
                acc[3] += buf[i + 3]
        n = SS * SS
        j = (y * S + x) * 4
        salida[j] = acc[0] // n
        salida[j + 1] = acc[1] // n
        salida[j + 2] = acc[2] // n
        salida[j + 3] = acc[3] // n


def chunk(tipo, datos):
    return (
        struct.pack('>I', len(datos))
        + tipo
        + datos
        + struct.pack('>I', zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    )


def png_bruta(ancho, alto, rgba):
    filas = b''
    for y in range(alto):
        fila = rgba[y * ancho * 4:(y + 1) * ancho * 4]
        filas += b'\x00' + fila
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(filas, 9))
        + chunk(b'IEND', b'')
    )


ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.png')
with open(ruta, 'wb') as f:
    f.write(png_bruta(S, S, salida))
print('Icono generado:', ruta)
