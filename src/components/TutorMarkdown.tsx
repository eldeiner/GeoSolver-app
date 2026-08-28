import { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderizarMatematicas(texto: string): string {
  const piezas: string[] = [];
  const marcar = (html: string) => {
    const marcador = `\u0000KATEX${piezas.length}\u0000`;
    piezas.push(html);
    return marcador;
  };

  // Bloques $$...$$ y \[...\]
  let t = texto.replace(/\$\$([\s\S]+?)\$\$/g, (_m, exp: string) => {
    try {
      return marcar(katex.renderToString(exp.trim(), { displayMode: true, throwOnError: false }));
    } catch {
      return `$$${exp}$$`;
    }
  });
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_m, exp: string) => {
    try {
      return marcar(katex.renderToString(exp.trim(), { displayMode: true, throwOnError: false }));
    } catch {
      return `\\[${exp}\\]`;
    }
  });

  // En línea $...$ y \(...\)
  t = t.replace(/(\$[^$\n]+?\$)/g, (m) => {
    const exp = m.slice(1, -1).trim();
    if (!exp) return m;
    try {
      return marcar(katex.renderToString(exp, { displayMode: false, throwOnError: false }));
    } catch {
      return m;
    }
  });
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (m, exp: string) => {
    const limpia = exp.trim();
    if (!limpia) return m;
    try {
      return marcar(katex.renderToString(limpia, { displayMode: false, throwOnError: false }));
    } catch {
      return m;
    }
  });

  // Escapar HTML que el modelo pudiera escribir (seguridad)
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Markdown
  const html = marked.parse(t, { breaks: true, gfm: true }) as string;

  // Restaurar las fórmulas ya renderizadas
  return html.replace(/\u0000KATEX(\d+)\u0000/g, (_m, i: string) => piezas[Number(i)] ?? '');
}

export default function TutorMarkdown({ contenido }: { contenido: string }) {
  const html = useMemo(() => renderizarMatematicas(contenido), [contenido]);
  return <div className="tutor-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
