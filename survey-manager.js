(() => {
  const iframe = document.getElementById('encuestaFrame');
  const estado = document.getElementById('estado');
  const contador = document.getElementById('contadorRegistros');
  const guardar = document.getElementById('guardarRegistroBtn');
  const nueva = document.getElementById('nuevaEncuestaBtn');
  const exportar = document.getElementById('exportarCsvBtn');
  const ver = document.getElementById('verRegistrosBtn');
  const modal = document.getElementById('registrosModal');
  const lista = document.getElementById('listaRegistros');
  const cerrarModal = document.getElementById('cerrarModalBtn');

  const DB_NAME = 'encuesta_lme_db';
  const STORE = 'encuestas';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function addRecord(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add({
        fecha_guardado: new Date().toISOString(),
        datos: data
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllRecords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function getForm() {
    return iframe.contentDocument?.getElementById('cuestionarioForm') || null;
  }

  function collectCurrentForm() {
    const form = getForm();
    if (!form) throw new Error('Formulario no disponible');
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function hasAnyAnswer(data) {
    return Object.values(data).some(v => Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '');
  }

  async function updateCount() {
    const records = await getAllRecords();
    contador.textContent = `${records.length} encuesta${records.length === 1 ? '' : 's'} guardada${records.length === 1 ? '' : 's'}`;
  }

  async function saveCurrentRecord() {
    const data = collectCurrentForm();
    if (!hasAnyAnswer(data)) {
      alert('La encuesta está vacía. Complete al menos una respuesta antes de guardarla.');
      return false;
    }
    const id = await addRecord(data);
    estado.textContent = `✅ Encuesta ${String(id).padStart(3, '0')} guardada en este dispositivo`;
    await updateCount();
    return true;
  }

  function clearCurrentForm() {
    try {
      iframe.contentWindow.localStorage.removeItem('cuestionario_lme_v2');
    } catch (_) {}
    iframe.src = `./index.html?fresh=${Date.now()}`;
    estado.textContent = navigator.onLine ? '🟢 Nueva encuesta lista' : '📴 Nueva encuesta lista sin conexión';
  }

  function csvEscape(value) {
    const str = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  }

  async function exportCSV() {
    const records = await getAllRecords();
    if (!records.length) {
      alert('Todavía no hay encuestas guardadas.');
      return;
    }
    const keys = new Set();
    records.forEach(r => Object.keys(r.datos || {}).forEach(k => keys.add(k)));
    const headers = ['encuesta_id', 'fecha_guardado', ...keys];
    const rows = [headers.map(csvEscape).join(',')];
    records.forEach(r => {
      const row = [String(r.id).padStart(3, '0'), r.fecha_guardado, ...[...keys].map(k => r.datos?.[k] ?? '')];
      rows.push(row.map(csvEscape).join(','));
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Encuestas_LME_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function showRecords() {
    const records = await getAllRecords();
    lista.innerHTML = '';
    if (!records.length) {
      lista.innerHTML = '<p>No hay encuestas guardadas todavía.</p>';
    } else {
      [...records].reverse().forEach(r => {
        const item = document.createElement('div');
        item.className = 'registro-item';
        const fecha = new Date(r.fecha_guardado).toLocaleString();
        const respondidas = Object.values(r.datos || {}).filter(v => String(v ?? '').trim() !== '').length;
        item.innerHTML = `<strong>Encuesta ${String(r.id).padStart(3, '0')}</strong><br><span>${fecha} · ${respondidas} campos guardados</span>`;
        lista.appendChild(item);
      });
    }
    modal.hidden = false;
  }

  guardar.addEventListener('click', () => saveCurrentRecord().catch(err => {
    console.error(err);
    alert('No se pudo guardar la encuesta.');
  }));

  nueva.addEventListener('click', async () => {
    const data = collectCurrentForm();
    if (hasAnyAnswer(data)) {
      const ok = confirm('¿Desea guardar esta encuesta antes de comenzar una nueva?');
      if (ok) {
        const saved = await saveCurrentRecord();
        if (!saved) return;
      }
    }
    clearCurrentForm();
  });

  exportar.addEventListener('click', () => exportCSV().catch(err => {
    console.error(err);
    alert('No se pudo exportar el archivo CSV.');
  }));
  ver.addEventListener('click', () => showRecords().catch(console.error));
  cerrarModal.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  window.addEventListener('load', () => updateCount().catch(console.error));
})();
