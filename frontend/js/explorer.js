// =====================================================================
// js/explorer.js
// Vista de una tabla (explorer.html?table=NOMBRE). Cada pestaña hace SU
// propia solicitud y solo cuando se abre por primera vez:
//   Metadatos -> GET /api/tables/:table/metadata  (sin registros)
//   Datos     -> GET /api/tables/:table/data      (sin metadatos)
// =====================================================================
import { apiUrl, obtenerMetadatos, obtenerDatos } from './api.js';
import { esc, fmt, copiar, parametrosUrl } from './utils.js';
import { renderJson, expandirTodo } from './jsonViewer.js';
import { pythonMetadatos, pythonDatos } from './pythonSnippets.js';

const tabla = parametrosUrl().get('table');
const $ = (selector) => document.querySelector(selector);
const cargadas = { metadata: false, data: false };
const consulta = { page: 1, limit: 100, sort: '', order: 'ASC' };

// ---------- Estado y avisos ------------------------------------------
function estado(tipo, texto) {
  const insignia = $('#api-status');
  insignia.className = `status status--${tipo}`;
  insignia.textContent = texto;
}
function aviso(texto) {
  const caja = $('#notice');
  caja.hidden = !texto;
  caja.textContent = texto;
}
const esperando = () => {
  estado('wait', 'Despertando la API…');
  aviso('La API gratuita se suspende por inactividad; la primera consulta puede tardar hasta un minuto.');
};
const enLinea = () => { estado('ok', 'API en línea'); aviso(''); };
const cargando = () => '<div class="loading"><span class="spinner"></span> Consultando la API…</div>';

function errorEn(contenedor, error, reintentar) {
  estado('error', 'Sin conexión');
  aviso('');
  contenedor.innerHTML = `<div class="notice notice--error"><p>${esc(error.message)}</p><button class="btn" id="reintentar">Reintentar</button></div>`;
  contenedor.querySelector('#reintentar').addEventListener('click', reintentar);
}

// ---------- Bloque común: endpoint + visor JSON + Python --------------
function montarBloque(contenedor, { url, json, python }) {
  contenedor.innerHTML = `
    <div class="endpoint">
      <span class="method">GET</span><code>${esc(url)}</code>
      <button class="btn btn--ghost" data-a="url">Copiar URL</button>
    </div>
    <div class="toolbar">
      <h3>Respuesta JSON</h3>
      <div class="toolbar__btns">
        <button class="btn btn--ghost" data-a="expand">Expandir todo</button>
        <button class="btn btn--ghost" data-a="collapse">Contraer todo</button>
        <button class="btn btn--ghost" data-a="json">Copiar JSON</button>
      </div>
    </div>
    <div class="json" data-slot="json"></div>
    <div class="toolbar">
      <h3>Código Python</h3>
      <button class="btn btn--ghost" data-a="py">Copiar Python</button>
    </div>
    <pre class="code"><code>${esc(python)}</code></pre>`;

  const visor = contenedor.querySelector('[data-slot="json"]');
  visor.append(renderJson(json));

  contenedor.onclick = (evento) => {
    const accion = evento.target.closest('[data-a]')?.dataset.a;
    const acciones = {
      url: () => copiar(url, 'URL copiada'),
      json: () => copiar(JSON.stringify(json, null, 2), 'JSON copiado'),
      py: () => copiar(python, 'Código Python copiado'),
      expand: () => expandirTodo(visor, true),
      collapse: () => expandirTodo(visor, false),
    };
    acciones[accion]?.();
  };
}

const mini = (titulo, valor) => `<div class="mini"><span>${esc(titulo)}</span><strong>${valor}</strong></div>`;

// ---------- Pestaña Metadatos ----------------------------------------
const tipoCompleto = (c) =>
  c.max_length ? `${c.type}(${c.max_length})`
    : c.numeric_precision ? `${c.type}(${c.numeric_precision},${c.numeric_scale})`
    : c.type;

function etiquetas(c) {
  const lista = [
    c.primary_key && ['PK', 'pk'],
    c.foreign_key && [`FK → ${c.references.table}.${c.references.column}`, 'fk'],
    c.unique && ['UNIQUE', 'uq'],
    c.identity && ['IDENTITY', 'id'],
  ].filter(Boolean);
  return lista.map(([texto, clase]) => `<span class="tag tag--${clase}">${esc(texto)}</span>`).join(' ') || '–';
}

async function cargarMetadatos() {
  const panel = $('#panel-metadata');
  panel.innerHTML = cargando();
  try {
    const json = await obtenerMetadatos(tabla, { alEsperar: esperando });
    enLinea();
    const m = json.metadata;

    $('#table-desc').textContent = m.description ?? '';
    $('#table-badges').innerHTML = [`${m.column_count} columnas`, `Esquema ${m.schema}`]
      .map((t) => `<span class="badge">${esc(t)}</span>`).join('');

    const filas = m.columns.map((c) => `
      <tr>
        <td>${c.position}</td><td><strong>${esc(c.name)}</strong></td>
        <td><code>${esc(tipoCompleto(c))}</code></td>
        <td>${c.nullable ? 'Sí' : 'No'}</td>
        <td>${etiquetas(c)}</td>
        <td>${c.default ? `<code>${esc(c.default)}</code>` : '–'}</td>
      </tr>`).join('');

    const enlace = (t) => `<a href="explorer.html?table=${encodeURIComponent(t)}">${esc(t)}</a>`;
    const referencias = m.relations.references.map((r) =>
      `<li><code>${esc(r.columns.join(', '))}</code> → ${enlace(r.referenced_table)}(${esc(r.referenced_columns.join(', '))}) <small>ON DELETE ${esc(r.on_delete)} · ON UPDATE ${esc(r.on_update)}</small></li>`).join('');
    const referenciada = m.relations.referenced_by.map((r) =>
      `<li>${enlace(r.table)}(<code>${esc(r.columns.join(', '))}</code>)</li>`).join('');
    const unicas = m.constraints.unique.map((u) =>
      `<li><strong>${esc(u.name)}</strong> <code>${esc(u.columns.join(', '))}</code></li>`).join('');
    const checks = m.constraints.check.map((c) =>
      `<li><strong>${esc(c.name)}</strong><code>${esc(c.definition)}</code></li>`).join('');
    const lista = (items) => (items ? `<ul class="plain">${items}</ul>` : '<p class="muted">Ninguna</p>');

    panel.innerHTML = `
      <div class="stats-row">
        ${mini('Columnas', fmt(m.column_count))}
        ${mini('Registros', `${m.record_count_exact ? '' : '~'}${fmt(m.record_count)}`)}
        ${mini('Clave primaria', esc(m.primary_key.join(', ') || '–'))}
      </div>
      <h2>Estructura de campos</h2>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>#</th><th>Campo</th><th>Tipo</th><th>Admite nulos</th><th>Restricciones</th><th>Valor por defecto</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
      <h2>Relaciones y restricciones</h2>
      <div class="two-col">
        <div class="panel"><h3>Referencia a</h3>${lista(referencias)}</div>
        <div class="panel"><h3>Referenciada por</h3>${lista(referenciada)}</div>
        <div class="panel"><h3>Valores únicos</h3>${lista(unicas)}</div>
        <div class="panel"><h3>Reglas de validación (CHECK)</h3>${lista(checks)}</div>
      </div>
      <h2>Consulta de metadatos</h2>
      <div id="bloque-metadata"></div>`;

    const url = apiUrl(`/api/tables/${encodeURIComponent(tabla)}/metadata`);
    montarBloque(panel.querySelector('#bloque-metadata'), { url, json, python: pythonMetadatos(url) });
  } catch (error) {
    errorEn(panel, error, cargarMetadatos);
  }
}

// ---------- Pestaña Datos --------------------------------------------
function prepararPanelDatos() {
  $('#panel-data').innerHTML = `
    <div class="controls">
      <label>Filas por página
        <select id="ctl-limit">${[25, 50, 100, 500].map((n) => `<option ${n === consulta.limit ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label>Ordenar por <select id="ctl-sort"><option value="">Clave primaria</option></select></label>
      <label>Orden <select id="ctl-order"><option>ASC</option><option>DESC</option></select></label>
    </div>
    <div id="data-result"></div>`;

  $('#ctl-limit').addEventListener('change', (e) => { consulta.limit = Number(e.target.value); consulta.page = 1; cargarDatos(); });
  $('#ctl-sort').addEventListener('change', (e) => { consulta.sort = e.target.value; consulta.page = 1; cargarDatos(); });
  $('#ctl-order').addEventListener('change', (e) => { consulta.order = e.target.value; consulta.page = 1; cargarDatos(); });
}

const celda = (v) => (v === null ? '<span class="null">NULL</span>' : esc(typeof v === 'object' ? JSON.stringify(v) : v));

async function cargarDatos() {
  const contenedor = $('#data-result');
  contenedor.innerHTML = cargando();
  try {
    const json = await obtenerDatos(tabla, consulta, { alEsperar: esperando });
    enLinea();
    pintarDatos(contenedor, json);
  } catch (error) {
    errorEn(contenedor, error, cargarDatos);
  }
}

function pintarDatos(contenedor, json) {
  const p = json.pagination;
  const columnas = json.data[0] ? Object.keys(json.data[0]) : [];

  // Rellena el selector de orden la primera vez, con las columnas recibidas.
  const selector = $('#ctl-sort');
  if (columnas.length && selector.options.length === 1) {
    selector.insertAdjacentHTML('beforeend', columnas.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join(''));
  }
  selector.value = consulta.sort;
  $('#ctl-order').value = consulta.order;

  const flecha = (c) => (json.query.sort === c ? (json.query.order === 'ASC' ? ' ▲' : ' ▼') : '');
  const cabecera = columnas.map((c) => `<th><button class="th-sort" data-col="${esc(c)}">${esc(c)}${flecha(c)}</button></th>`).join('');
  const filas = json.data.map((fila) => `<tr>${columnas.map((c) => `<td>${celda(fila[c])}</td>`).join('')}</tr>`).join('');

  contenedor.innerHTML = `
    <div class="stats-row">
      ${mini('Registros disponibles', `${p.total_records_exact ? '' : '~'}${fmt(p.total_records)}`)}
      ${mini('Mostrando', fmt(json.data.length))}
      ${mini('Página', `${p.page} de ${p.total_pages || 1}`)}
    </div>
    <div class="table-wrap">
      ${columnas.length
        ? `<table class="data-table"><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`
        : '<p class="muted pad">No hay registros en esta página.</p>'}
    </div>
    <div class="pager">
      <button class="btn btn--ghost" id="prev" ${p.has_previous ? '' : 'disabled'}>← Anterior</button>
      <span>Página ${p.page} de ${p.total_pages || 1}</span>
      <button class="btn btn--ghost" id="next" ${p.has_next ? '' : 'disabled'}>Siguiente →</button>
    </div>
    <h2>Consulta de datos</h2>
    <div id="bloque-data"></div>`;

  contenedor.querySelector('#prev').addEventListener('click', () => { consulta.page -= 1; cargarDatos(); });
  contenedor.querySelector('#next').addEventListener('click', () => { consulta.page += 1; cargarDatos(); });
  contenedor.querySelectorAll('.th-sort').forEach((boton) => boton.addEventListener('click', () => {
    const col = boton.dataset.col;
    consulta.order = json.query.sort === col && json.query.order === 'ASC' ? 'DESC' : 'ASC';
    consulta.sort = col;
    consulta.page = 1;
    cargarDatos();
  }));

  const base = apiUrl(`/api/tables/${encodeURIComponent(tabla)}/data`);
  montarBloque(contenedor.querySelector('#bloque-data'), {
    url: apiUrl(`/api/tables/${encodeURIComponent(tabla)}/data`, consulta),
    json,
    python: pythonDatos(base, consulta),
  });
}

// ---------- Pestañas --------------------------------------------------
function activar(nombre) {
  document.querySelectorAll('.tab').forEach((boton) => {
    const activa = boton.dataset.tab === nombre;
    boton.setAttribute('aria-selected', String(activa));
    $(`#panel-${boton.dataset.tab}`).hidden = !activa;
  });
  if (cargadas[nombre]) return; // ya se consultó: no se repite la solicitud
  cargadas[nombre] = true;
  if (nombre === 'metadata') cargarMetadatos();
  else { prepararPanelDatos(); cargarDatos(); }
}

if (!tabla) {
  $('#table-title').textContent = 'Tabla no indicada';
  aviso('Falta el parámetro ?table= en la URL. Vuelve al inicio y elige una tabla.');
  estado('error', 'Sin tabla');
} else {
  $('#table-title').textContent = tabla;
  document.title = `${tabla} | Julio & Asociados S.A.`;
  document.querySelectorAll('.tab').forEach((boton) => boton.addEventListener('click', () => activar(boton.dataset.tab)));
  activar('metadata');
}