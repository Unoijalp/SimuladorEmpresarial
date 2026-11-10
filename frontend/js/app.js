// =====================================================================
// js/app.js
// Página principal: consulta GET /api/tables y construye una tarjeta por
// cada tabla. Si agregas una tabla en el backend, aparece sola.
// =====================================================================
import { apiUrl, obtenerTablas } from './api.js';
import { esc, fmt } from './utils.js';

const $ = (selector) => document.querySelector(selector);

function estado(tipo, texto) {
  const insignia = $('#api-status');
  insignia.className = `status status--${tipo}`;
  insignia.textContent = texto;
}

function aviso(html) {
  const caja = $('#notice');
  caja.hidden = !html;
  caja.innerHTML = html;
}

/** HTML de una tarjeta. Todo texto dinámico pasa por esc(). */
function tarjeta(t, indice) {
  const registros = t.record_count === null ? '–' : `${t.record_count_exact ? '' : '~'}${fmt(t.record_count)}`;
  const accion = t.available
    ? `<a class="btn" href="explorer.html?table=${encodeURIComponent(t.name)}">Explorar tabla →</a>`
    : '<span class="btn btn--disabled" aria-disabled="true">No disponible</span>';
  return `
    <article class="card" style="--i:${indice}">
      <div class="card__top">
        <h3>${esc(t.name)}</h3>
        <span class="badge ${t.available ? 'badge--ok' : 'badge--warn'}">${t.available ? 'Disponible' : 'No disponible'}</span>
      </div>
      <p class="card__desc">${esc(t.description ?? 'Sin descripción.')}</p>
      <dl class="card__meta">
        <div><dt>Registros</dt><dd>${registros}</dd></div>
        <div><dt>Columnas</dt><dd>${fmt(t.column_count)}</dd></div>
      </dl>
      ${accion}
    </article>`;
}

async function iniciar() {
  $('#api-url').textContent = apiUrl('/api/tables');
  aviso('');
  estado('wait', 'Conectando…');
  $('#cards').innerHTML = Array.from({ length: 6 }, () => '<div class="card skeleton" aria-hidden="true"></div>').join('');

  const inicio = performance.now();
  try {
    const json = await obtenerTablas({
      alEsperar: () => {
        estado('wait', 'Despertando la API…');
        aviso('La API gratuita se suspende por inactividad; la primera consulta puede tardar hasta un minuto.');
      },
    });
    aviso('');
    estado('ok', 'API en línea');

    const tablas = json.tables;
    $('#stat-tables').textContent = fmt(json.count);
    $('#stat-records').textContent = fmt(tablas.reduce((suma, t) => suma + (t.record_count ?? 0), 0));
    $('#stat-api').textContent = `${Math.round(performance.now() - inicio)} ms`;
    $('#cards').innerHTML = tablas.length
      ? tablas.map(tarjeta).join('')
      : '<p class="muted">No hay tablas habilitadas en la API.</p>';
  } catch (error) {
    estado('error', 'Sin conexión');
    $('#cards').innerHTML = '';
    aviso(`<strong>No se pudo cargar el listado.</strong> ${esc(error.message)} <button class="btn" id="reintentar">Reintentar</button>`);
    $('#reintentar').addEventListener('click', iniciar);
  }
}

iniciar();