// =====================================================================
// js/jsonViewer.js
// Visor JSON: indentado, con colores y bloques expandibles/contraíbles
// (usa <details>, accesible por teclado). Construye el DOM con
// textContent, por lo que nunca interpreta el contenido como HTML.
// =====================================================================

const span = (clase, texto) => {
  const s = document.createElement('span');
  s.className = clase;
  s.textContent = texto;
  return s;
};

/** Construye un fragmento DOM para un valor JSON. "clave" es opcional. */
function construir(valor, nivel, coma, clave) {
  const frag = document.createDocumentFragment();
  const fin = coma ? ',' : '';
  const prefijo = clave === undefined ? [] : [span('j-key', JSON.stringify(clave)), span('j-punc', ': ')];

  if (valor === null || typeof valor !== 'object') {
    let nodo;
    if (valor === null) nodo = span('j-null', 'null');
    else if (typeof valor === 'string') nodo = span('j-str', JSON.stringify(valor));
    else if (typeof valor === 'number') nodo = span('j-num', String(valor));
    else nodo = span('j-bool', String(valor));
    frag.append(...prefijo, nodo, fin);
    return frag;
  }

  const esLista = Array.isArray(valor);
  const entradas = esLista ? valor.map((v, i) => [i, v]) : Object.entries(valor);
  const [abre, cierra] = esLista ? ['[', ']'] : ['{', '}'];

  if (entradas.length === 0) {
    frag.append(...prefijo, span('j-punc', abre + cierra + fin));
    return frag;
  }

  const detalle = document.createElement('details');
  detalle.open = nivel < 2; // raíz y primer nivel abiertos
  const resumen = document.createElement('summary');
  resumen.append(
    ...prefijo,
    span('j-punc', abre),
    span('j-hint', ` … ${entradas.length} ${esLista ? 'elementos' : 'claves'} ${cierra}${fin}`)
  );

  const hijos = document.createElement('div');
  hijos.className = 'j-children';
  entradas.forEach(([k, v], i) => {
    const linea = document.createElement('div');
    linea.className = 'j-line';
    linea.append(construir(v, nivel + 1, i < entradas.length - 1, esLista ? undefined : k));
    hijos.append(linea);
  });

  const cierre = document.createElement('div');
  cierre.className = 'j-close';
  cierre.textContent = cierra + fin;

  detalle.append(resumen, hijos, cierre);
  frag.append(detalle);
  return frag;
}

/** Devuelve el elemento visor listo para insertar en la página. */
export function renderJson(valor) {
  const raiz = document.createElement('div');
  raiz.className = 'j-root';
  raiz.append(construir(valor, 0, false));
  return raiz;
}

/** Abre o cierra todos los bloques de un visor. */
export const expandirTodo = (contenedor, abrir) =>
  contenedor.querySelectorAll('details').forEach((d) => { d.open = abrir; });