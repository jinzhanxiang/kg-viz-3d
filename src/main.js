import { Sigma } from 'sigma';
import { loadGraph, IND_COLORS } from './graph.js';
import { updStats, buildLegend, showTooltip, hideTooltip, positionTooltip, showDetail, hideDetail, hideLoading, showError } from './ui.js';

const DATA_URL = 'data/graph.json?' + Date.now();

async function init() {
  const { graph: G, meta, indCnt } = await loadGraph(DATA_URL);
  console.log('[KG] 节点:', G.order, '边:', G.size);

  updStats(G, meta);
  buildLegend(indCnt, IND_COLORS);

  const sigma = new Sigma(G, document.getElementById('sigma-container'), {
    renderLabels: true,
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 8,
    labelDensity: 0.07,
    labelFont: 'sans-serif',
    labelSize: 12,
    labelColor: { color: '#aaa' },
    defaultEdgeColor: 'rgba(180, 180, 200, 0.15)',
    defaultEdgeType: 'line',
    enableEdgeEvents: true,
    minCameraRatio: 0.02,
    maxCameraRatio: 8,
    stagePadding: 60,
    hideLabelsOnMove: false,
    hideEdgesOnMove: false,
  });

  hideLoading();

  // --- State ---
  let hovered = null;
  let focused = null;
  let focusedNbrs = new Set();

  function getFocusEdges(node) {
    const edges = new Set();
    G.forEachEdge(e => {
      const ext = G.extremities(e);
      if (ext[0] === node || ext[1] === node) edges.add(e);
    });
    return edges;
  }

  function getNbrSet(node) {
    const nbrs = new Set(G.neighbors(node));
    nbrs.add(node);
    return nbrs;
  }

  // --- Hover ---
  sigma.on('enterNode', ({ node }) => {
    if (focused) return;
    hovered = node;
    showTooltip(node, G);
    sigma.setSetting('nodeReducer', (n, d) => {
      if (n === node) return { ...d, zIndex: 1, label: d.label, size: d.size * 1.5, color: '#fff' };
      return { ...d, label: '', size: d.size * 0.4 };
    });
  });
  sigma.on('leaveNode', () => {
    if (focused) return;
    hovered = null;
    hideTooltip();
    sigma.setSetting('nodeReducer', null);
  });

  // --- Click focus ---
  sigma.on('clickNode', ({ node }) => {
    if (focused === node) { clearFocus(); return; }
    setFocus(node);
  });
  sigma.on('clickStage', () => { if (focused) clearFocus(); });

  function setFocus(node) {
    focused = node;
    focusedNbrs = getNbrSet(node);
    const focusEdges = getFocusEdges(node);
    showDetail(node, G, clearFocus);
    sigma.setSetting('nodeReducer', (n, d) => {
      if (n === node) return { ...d, zIndex: 2, label: d.label, size: d.size * 2, color: '#fff' };
      if (focusedNbrs.has(n)) return { ...d, zIndex: 1, label: d.label, size: d.size };
      return { ...d, label: '', size: d.size * 0.2, color: `rgba(30,30,40,0.15)` };
    });
    sigma.setSetting('edgeReducer', (e, d) => {
      if (focusEdges.has(e)) return { ...d, size: 1, color: '#888' };
      return { ...d, hidden: true };
    });
    sigma.getCamera().animate({ x: G.getNodeAttribute(node, 'x'), y: G.getNodeAttribute(node, 'y'), ratio: 0.05 }, { duration: 500 });
  }

  function clearFocus() {
    focused = null;
    focusedNbrs = new Set();
    hideDetail();
    sigma.setSetting('nodeReducer', null);
    sigma.setSetting('edgeReducer', null);
  }

  // --- Tooltip ---
  sigma.on('afterRender', () => {
    if (hovered && !focused) positionTooltip(sigma, hovered);
  });

  // --- Search ---
  const searchEl = document.getElementById('search');
  const dropEl = document.getElementById('search-dropdown');

  // Build node index for search
  const nodeIdx = [];
  G.forEachNode((key, a) => {
    nodeIdx.push({ key, label: a.label || key, ind: a.ind || '' });
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { dropEl.classList.remove('visible'); return; }
    const matches = nodeIdx
      .filter(n => n.label.toLowerCase().includes(q))
      .slice(0, 50);
    if (matches.length === 0) { dropEl.classList.remove('visible'); return; }
    let html = '';
    for (const m of matches.slice(0, 30)) {
      html += `<div class="sd-item" data-key="${m.key}"><span class="sd-dot" style="background:${IND_COLORS[m.ind]||'#888'}"></span><span class="sd-name">${m.label}</span><span class="sd-ind">${m.ind}</span></div>`;
    }
    if (matches.length > 30) html += '<div class="sd-more">...还有 ' + (matches.length - 30) + ' 个结果</div>';
    dropEl.innerHTML = html;
    dropEl.classList.add('visible');
  });

  // Click on suggestion
  dropEl.addEventListener('click', (ev) => {
    const item = ev.target.closest('.sd-item');
    if (!item) return;
    const key = item.dataset.key;
    dropEl.classList.remove('visible');
    searchEl.value = G.getNodeAttribute(key, 'label') || key;
    searchEl.blur();
    setFocus(key);
  });

  // Esc to close search dropdown
  searchEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { dropEl.classList.remove('visible'); searchEl.blur(); }
  });

  // Click outside to close dropdown
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#search-wrap')) dropEl.classList.remove('visible');
  });

  window.__sigma = sigma;
  window.__graph = G;
}

init().catch(err => {
  console.error('[KG]', err);
  showError(err.message);
});