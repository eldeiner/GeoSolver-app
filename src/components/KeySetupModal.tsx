import { useState } from 'react';
import { configurarLlave } from '../lib/groqBridge';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardada: () => void;
}

export default function KeySetupModal({ abierto, onCerrar, onGuardada }: Props) {
  const [llave, setLlave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  const guardar = async () => {
    if (!llave.trim() || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await configurarLlave(llave);
      setLlave('');
      onGuardada();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal modal-configuracion" role="dialog" aria-modal="true" aria-label="Configurar llave de Groq">
        <h3>Configura la llave de Groq</h3>
        <p>
          Para que la IA funcione, pega aquí tu llave de Groq (empieza con <code>gsk_</code>). La app la
          verificará y la guardará en la carpeta de datos de GeoSolver; nunca sale del equipo ni viaja dentro
          del ejecutable.
        </p>
        <input
          type="password"
          placeholder="gsk_…"
          value={llave}
          onChange={(e) => setLlave(e.target.value)}
          autoComplete="off"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void guardar();
          }}
        />
        {error && <p className="error-modal">{error}</p>}
        <div className="fila-modal">
          <button className="btn-accion" onClick={onCerrar}>
            Omitir por ahora
          </button>
          <button className="btn-accion primario" onClick={() => void guardar()} disabled={guardando || !llave.trim()}>
            {guardando ? 'Verificando…' : 'Verificar y guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
