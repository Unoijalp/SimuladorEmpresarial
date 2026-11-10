// =====================================================================
// js/utils.js
// Utilidades compartidas por las dos páginas.
// =====================================================================

/** Escapa texto para insertarlo de forma segura dentro de HTML. */
export const esc = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/** Formatea un número con separador de miles; "–" si no hay valor. */
export const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-CO') : '–');

/** Parámetros de la URL actual (?table=...). */
export const parametrosUrl = () => new URLSearchParams(window.location.search);

let temporizador;
/** Muestra un aviso breve en la parte inferior de la pantalla. */
export function avisar(mensaje) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = mensaje;
  el.classList.add('show');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove('show'), 2200);
}

/** Copia texto al portapapeles (con alternativa para navegadores antiguos). */
export async function copiar(texto, mensaje = 'Copiado al portapapeles') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  avisar(mensaje);
}