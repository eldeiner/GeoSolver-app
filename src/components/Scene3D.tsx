import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Coordenadas, Ecuacion } from '../lib/types';

export interface ControlEscena3D {
  zoomIn: () => void;
  zoomOut: () => void;
  exportar: () => string | null;
}

interface Props {
  ecuaciones: Ecuacion[];
  punto: number[] | null;
  senalCentrar?: number;
  onError?: (mensaje: string) => void;
  onCoordenadas?: (c: Coordenadas | null) => void;
}

const EPS = 1e-9;

interface PlanoDatos {
  grupo: THREE.Group;
  malla: THREE.Mesh;
  reticulado: THREE.Mesh;
  caja?: THREE.Mesh;
}

function crearEtiquetaSprite(texto: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 64px "Segoe UI", system-ui, sans-serif';
  const medidas = ctx.measureText(texto);
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 14;
  ctx.strokeText(texto, 256 - medidas.width / 2, 128);
  ctx.fillStyle = color;
  ctx.fillText(texto, 256 - medidas.width / 2, 128);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: textura,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 1.6, 1);
  return sprite;
}

function actualizarEtiquetaSprite(sprite: THREE.Sprite, texto: string, color: string): void {
  const vieja = sprite.material.map;
  const nueva = crearEtiquetaSprite(texto, color).material.map!;
  sprite.material.map = nueva;
  sprite.material.needsUpdate = true;
  if (vieja) vieja.dispose();
}

function disposicionObjeto(obj: THREE.Object3D): void {
  obj.traverse((hijo) => {
    const malla = hijo as THREE.Mesh;
    if (malla.geometry) malla.geometry.dispose();
    const material = malla.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}

const Scene3D = forwardRef<ControlEscena3D, Props>(function Scene3D(
  { ecuaciones, punto, senalCentrar = 0, onError, onCoordenadas },
  ref,
) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const grupoPlanosRef = useRef<THREE.Group | null>(null);
  const esferaRef = useRef<THREE.Mesh | null>(null);
  const etiquetaPuntoRef = useRef<THREE.Sprite | null>(null);
  const camaraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlesRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const planosRef = useRef<Map<string, PlanoDatos>>(new Map());
  const aparicionesRef = useRef<Map<string, number>>(new Map());
  const onCoordenadasRef = useRef(onCoordenadas);
  onCoordenadasRef.current = onCoordenadas;

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const camara = camaraRef.current;
      const controles = controlesRef.current;
      if (!camara || !controles) return;
      const distancia = camara.position.length();
      if (distancia < 1.5) return;
      camara.position.multiplyScalar(1 / 1.25);
      controles.update();
    },
    zoomOut: () => {
      const camara = camaraRef.current;
      const controles = controlesRef.current;
      if (!camara || !controles) return;
      const distancia = camara.position.length();
      if (distancia > 60) return;
      camara.position.multiplyScalar(1.25);
      controles.update();
    },
    exportar: () => rendererRef.current?.domElement.toDataURL('image/png') ?? null,
  }));

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0xf2f8ff);
    escenaRef.current = escena;

    const camara = new THREE.PerspectiveCamera(50, contenedor.clientWidth / contenedor.clientHeight, 0.1, 1000);
    camara.position.set(11, 9, 13);
    camaraRef.current = camara;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    } catch (err) {
      onError?.('No se pudo iniciar WebGL en este equipo. Se mostrará el modo 2D.');
      return;
    }
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(contenedor.clientWidth, contenedor.clientHeight);
    contenedor.appendChild(renderer.domElement);

    const controles = new OrbitControls(camara, renderer.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.target.set(0, 0, 0);
    controlesRef.current = controles;

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.85);
    escena.add(luzAmbiente);
    const luzDireccional = new THREE.DirectionalLight(0xffffff, 1.2);
    luzDireccional.position.set(8, 12, 6);
    escena.add(luzDireccional);

    const cuadricula = new THREE.GridHelper(16, 16, 0xc6daf3, 0xe2eefb);
    escena.add(cuadricula);

    const ejes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xef4444, nombre: 'X' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x22c55e, nombre: 'Y' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3b82f6, nombre: 'Z' },
    ];
    for (const eje of ejes) {
      const flecha = new THREE.ArrowHelper(eje.dir, new THREE.Vector3(0, 0, 0), 8, eje.color, 0.45, 0.28);
      escena.add(flecha);
      const etiqueta = crearEtiquetaSprite(eje.nombre, `#${eje.color.toString(16).padStart(6, '0')}`);
      etiqueta.position.copy(eje.dir.clone().multiplyScalar(9));
      escena.add(etiqueta);
    }

    const grupoPlanos = new THREE.Group();
    escena.add(grupoPlanos);
    grupoPlanosRef.current = grupoPlanos;

    const geometriaEsfera = new THREE.SphereGeometry(0.28, 32, 32);
    const materialEsfera = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const esfera = new THREE.Mesh(geometriaEsfera, materialEsfera);
    esfera.visible = false;
    escena.add(esfera);
    esferaRef.current = esfera;

    const etiquetaPunto = crearEtiquetaSprite('P', '#0f172a');
    etiquetaPunto.visible = false;
    escena.add(etiquetaPunto);
    etiquetaPuntoRef.current = etiquetaPunto;

    let id: number;
    const animar = () => {
      const ahora = performance.now();
      planosRef.current.forEach((datos, idPlano) => {
        const inicio = aparicionesRef.current.get(idPlano);
        if (inicio === undefined) return;
        const progreso = Math.min(1, (ahora - inicio) / 600);
        (datos.malla.material as THREE.MeshBasicMaterial).opacity = 0.42 * progreso;
        (datos.reticulado.material as THREE.MeshBasicMaterial).opacity = 0.22 * progreso;
        if (datos.caja) (datos.caja.material as THREE.MeshBasicMaterial).opacity = 0.1 * progreso;
        if (progreso >= 1) aparicionesRef.current.delete(idPlano);
      });
      controles.update();
      renderer.render(escena, camara);
      id = requestAnimationFrame(animar);
    };
    animar();

    const observador = new ResizeObserver(() => {
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (w === 0 || h === 0) return;
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    observador.observe(contenedor);

    // Coordenadas bajo el cursor (proyección sobre el plano y = 0)
    const raycaster = new THREE.Raycaster();
    const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const manejarMovimiento = (e: PointerEvent) => {
      const dom = renderer.domElement;
      const nx = (e.clientX / dom.clientWidth) * 2 - 1;
      const ny = -(e.clientY / dom.clientHeight) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camara);
      const punto = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(planoSuelo, punto)) {
        onCoordenadasRef.current?.({ x: punto.x, y: 0, z: punto.z });
      } else {
        onCoordenadasRef.current?.(null);
      }
    };
    const manejarSalida = () => onCoordenadasRef.current?.(null);
    renderer.domElement.addEventListener('pointermove', manejarMovimiento);
    renderer.domElement.addEventListener('pointerleave', manejarSalida);

    return () => {
      cancelAnimationFrame(id);
      observador.disconnect();
      renderer.domElement.removeEventListener('pointermove', manejarMovimiento);
      renderer.domElement.removeEventListener('pointerleave', manejarSalida);
      controles.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === contenedor) contenedor.removeChild(renderer.domElement);
      disposicionObjeto(escena);
      escenaRef.current = null;
      grupoPlanosRef.current = null;
      esferaRef.current = null;
      etiquetaPuntoRef.current = null;
      camaraRef.current = null;
      controlesRef.current = null;
      rendererRef.current = null;
      planosRef.current.clear();
      aparicionesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (senalCentrar === 0) return;
    const camara = camaraRef.current;
    const controles = controlesRef.current;
    if (!camara || !controles) return;
    camara.position.set(11, 9, 13);
    controles.target.set(0, 0, 0);
    controles.update();
  }, [senalCentrar]);

  useEffect(() => {
    const grupo = grupoPlanosRef.current;
    if (!grupo) return;

    const presentes = new Set<string>();
    for (const ec of ecuaciones) {
      const normal = new THREE.Vector3(ec.a, ec.b, ec.c);
      if (!ec.visible || normal.lengthSq() < EPS) continue;
      presentes.add(ec.id);
      normal.normalize();

      const distancia = ec.d / Math.hypot(ec.a, ec.b, ec.c);
      const posicion = normal.clone().multiplyScalar(distancia);
      const quaternion = new THREE.Quaternion();
      if (Math.abs(normal.x) < EPS && Math.abs(normal.y) < EPS && normal.z < 0) {
        quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      } else {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      }

      const datos = planosRef.current.get(ec.id);
      if (datos) {
        // Actualización en el lugar: mantiene 60 FPS al arrastrar los sliders
        datos.malla.quaternion.copy(quaternion);
        datos.malla.position.copy(posicion);
        datos.reticulado.quaternion.copy(quaternion);
        datos.reticulado.position.copy(posicion);
        if (datos.caja) {
          const signo = ec.operador === '>=' ? 1 : -1;
          datos.caja.quaternion.copy(quaternion);
          datos.caja.position.copy(normal.clone().multiplyScalar(distancia + signo * 13));
        }
      } else {
        const grupoPlano = new THREE.Group();
        const geometria = new THREE.PlaneGeometry(13, 13, 24, 24);
        const malla = new THREE.Mesh(
          geometria,
          new THREE.MeshBasicMaterial({
            color: ec.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.42,
          }),
        );
        malla.quaternion.copy(quaternion);
        malla.position.copy(posicion);
        grupoPlano.add(malla);

        const reticulado = new THREE.Mesh(
          geometria.clone(),
          new THREE.MeshBasicMaterial({ color: ec.color, wireframe: true, transparent: true, opacity: 0.22 }),
        );
        reticulado.quaternion.copy(quaternion);
        reticulado.position.copy(posicion);
        grupoPlano.add(reticulado);

        let caja: THREE.Mesh | undefined;
        if (ec.operador !== '=') {
          caja = new THREE.Mesh(
            new THREE.BoxGeometry(26, 26, 26),
            new THREE.MeshBasicMaterial({
              color: ec.color,
              transparent: true,
              opacity: 0.1,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          const signo = ec.operador === '>=' ? 1 : -1;
          caja.quaternion.copy(quaternion);
          caja.position.copy(normal.clone().multiplyScalar(distancia + signo * 13));
          grupoPlano.add(caja);
        }

        grupo.add(grupoPlano);
        planosRef.current.set(ec.id, { grupo: grupoPlano, malla, reticulado, caja });
        aparicionesRef.current.set(ec.id, performance.now());
      }
    }

    // Quitar planos que ya no existen o quedaron ocultos
    for (const [id, datos] of planosRef.current) {
      if (!presentes.has(id)) {
        grupo.remove(datos.grupo);
        disposicionObjeto(datos.grupo);
        planosRef.current.delete(id);
        aparicionesRef.current.delete(id);
      }
    }
  }, [ecuaciones]);

  useEffect(() => {
    const esfera = esferaRef.current;
    const etiqueta = etiquetaPuntoRef.current;
    if (!esfera || !etiqueta) return;
    if (!punto) {
      esfera.visible = false;
      etiqueta.visible = false;
      return;
    }
    const [px, py, pz = 0] = punto;
    esfera.visible = true;
    esfera.position.set(px, py, pz);
    etiqueta.visible = true;
    etiqueta.position.set(px + 0.9, py + 0.9, pz + 0.9);
    const redondeado = (n: number) => (Math.abs(n) < EPS ? '0' : String(Math.round(n * 100) / 100));
    actualizarEtiquetaSprite(etiqueta, `P(${redondeado(px)}, ${redondeado(py)}, ${redondeado(pz)})`, '#0f172a');
  }, [punto]);

  return <div ref={contenedorRef} className="contenedor-3d" />;
});

export default Scene3D;
