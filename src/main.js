import { Sigma } from 'sigma';
import { loadGraph, IND_COLORS, TYPE_COLORS } from './graph.js';
import { updStats, buildLegend, showTooltip, hideTooltip, positionTooltip, showDetail, hideDetail, showLevelInd, hideLoading, showError } from './ui.js';

const DATA_URL = 'data/graph.json?' + Date.now();

async function init() {
  const { graph: G, meta, indCnt } = await loadGraph(DATA_URL);
  console.log('[KG] 节点:', G.order, '边:', G.size);
  console.log('[KG] 行业:', Object.keys(indCnt).length, ', 行业边:', meta.totalIndustryEdges);

  updStats(G, meta);
  buildLegend(indCnt, IND_COLORS);

  const sigma = new Sigma(G, document.getElementById('sigma-container'), {
    renderLabels: true, renderEdgeLabels: false,
    labelRenderedSizeThreshold: 8, labelDensity: 0.07,
    labelFont: 'sans-serif', labelSize: 12,
    labelColor: { color: '#aaa' },
    defaultEdgeColor: 'rgba(180, 180, 200, 0.15)',
    defaultEdgeType: 'line', enableEdgeEvents: true,
    minCameraRatio: 0.02, maxCameraRatio: 8,
    stagePadding: 60, hideLabelsOnMove: false, hideEdgesOnMove: false,
  });

  hideLoading();

  // ========================================
  // LEVEL STATE MACHINE
  // ========================================
  let level = 'l1';       // 'l1' | 'l2' | 'l3'
  let activeIndustry = null; // current L2 industry
  let focused = null;     // current L3 focused node
  let focusedNbrs = new Set();
  let hovered = null;

  function getNbrSet(node) {
    const nbrs = new Set(G.neighbors(node));
    nbrs.add(node);
    return nbrs;
  }

  function getFocusEdges(node) {
    const edges = new Set();
    G.forEachEdge(e => {
      const ext = G.extremities(e);
      if (ext[0] === node || ext[1] === node) edges.add(e);
    });
    return edges;
  }

  // ----- L1: Industry layer -----
  function enterL1() {
    level = 'l1';
    activeIndustry = null;
    focused = null;
    hideDetail();
    showLevelInd('l1', null);

    sigma.setSetting('nodeReducer', (n, d) => {
      if (d._level === 'industry') return d;
      return { ...d, hidden: true, label: '', size: 0 };
    });
    sigma.setSetting('edgeReducer', (e, d) => {
      // Only show industry-level edges
      if (d._level === 'industry') return { ...d, size: Math.min(d.weight || 1, 3), color: 'rgba(255,255,255,0.08)' };
      return { ...d, hidden: true };
    });
    sigma.getCamera().animatedReset({ duration: 500 });
  }

  // ----- L2: Industry detail -----
  function enterL2(industry) {
    level = 'l2';
    activeIndustry = industry;
    focused = null;
    hideDetail();
    showLevelInd('l2', industry);

    sigma.setSetting('nodeReducer', (n, d) => {
      // Show industry nodes but dimmed, highlight active industry
      if (d._level === 'industry') {
        if (d.ind === industry) return { ...d, size: d.size * 1.2, color: '#fff', zIndex: 2 };
        return { ...d, hidden: true };
      }
      // Show entities in this industry
      if (d.ind === industry) return d;
      return { ...d, hidden: true, label: '', size: 0 };
    });
    sigma.setSetting('edgeReducer', null);

    // Camera to industry center
    const indKey = 'IND__' + industry;
    if (G.hasNode(indKey)) {
      const x = G.getNodeAttribute(indKey, 'x');
      const y = G.getNodeAttribute(indKey, 'y');
      sigma.getCamera().animate({ x, y, ratio: 0.1 }, { duration: 500 });
    }
  }

  // ----- L3: Entity focus (from existing feature) -----
  function setFocus(node) {
    if (G.getNodeAttribute(node, '_level') === 'industry') {
      // Clicking an industry node: enter L2
      const ind = G.getNodeAttribute(node, 'ind');
      if (ind) { enterL2(ind); return; }
    }
    level = 'l3';
    focused = node;
    focusedNbrs = getNbrSet(node);
    const focusEdges = getFocusEdges(node);
    showDetail(node, G, () => {
      // On close: return to L2
      if (activeIndustry) enterL2(activeIndustry);
      else enterL1();
    });
    showLevelInd('l3', activeIndustry);

    sigma.setSetting('nodeReducer', (n, d) => {
      // In L3, only show focused node + its neighbors within active industry
      const reducerLevel = { l1: 0, l2: 0 }[level]; // keep comp visible
      if (n === node) return { ...d, zIndex: 2, label: d.label, size: d.size * 2, color: '#fff' };
      if (focusedNbrs.has(n)) return { ...d, zIndex: 1, label: d.label, size: d.size };
      if (d._level === 'entity' && activeIndustry && d.ind === activeIndustry) {
        return { ...d, label: '', size: d.size * 0.15, color: `rgba(30,30,40,0.1)` };
      }
      return { ...d, hidden: true, label: '', size: 0 };
    });
    sigma.setSetting('edgeReducer', (e, d) => {
      if (focusEdges.has(e)) return { ...d, size: 1, color: '#888' };
      return { ...d, hidden: true };
    });
    sigma.getCamera().animate({
      x: G.getNodeAttribute(node, 'x'),
      y: G.getNodeAttribute(node, 'y'),
      ratio: 0.05,
    }, { duration: 500 });
  }

  function clearFocus() {
    focusStack = [];
    focused = null;
    focusedNbrs = new Set();
    hideDetail();
    sigma.setSetting('nodeReducer', null);
    sigma.setSetting('edgeReducer', null);
  }

  // Navigation stack for back button
  let focusStack = [];

  // ----- Events -----
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

  sigma.on('clickNode', ({ node }) => {
    // In all levels, clicking calls setFocus which routes correctly
    setFocus(node);
  });

  sigma.on('clickStage', () => {
    if (level === 'l3' && activeIndustry) {
      // Back to L2
      enterL2(activeIndustry);
    } else if (level === 'l2') {
      // Back to L1
      enterL1();
    }
    // L1: do nothing on stage click
  });

  // ----- Search (filtered by current level) -----
  const searchEl = document.getElementById('search');
  const dropEl = document.getElementById('search-dropdown');

  const nodeIdx = [];
  G.forEachNode((key, a) => {
    if (a._level === 'entity') {
      nodeIdx.push({ key, label: a.label || key, ind: a.ind || '' });
    }
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { dropEl.classList.remove('visible'); return; }

    let candidates = nodeIdx;
    // In L2, only show nodes from active industry
    if (level === 'l2' && activeIndustry) {
      candidates = candidates.filter(n => n.ind === activeIndustry);
    } else if (level === 'l1') {
      // In L1, search industry names too
      const indCandidates = [];
      G.forEachNode((key, a) => {
        if (a._level === 'industry' && a.label.toLowerCase().includes(q)) {
          indCandidates.push({ key, label: a.label, ind: a.ind, _isIndustry: true });
        }
      });
      candidates = indCandidates.concat(candidates);
    }

    const matches = candidates
      .filter(n => n.label.toLowerCase().includes(q))
      .slice(0, 50);
    if (matches.length === 0) { dropEl.classList.remove('visible'); return; }

    let html = '';
    for (const m of matches.slice(0, 30)) {
      const color = m._isIndustry ? (IND_COLORS[m.ind]||'#888') : (IND_COLORS[m.ind]||'#888');
      const indLabel = m._isIndustry ? '🏭 ' + m.ind : m.ind;
      html += `<div class="sd-item" data-key="${m.key}"><span class="sd-dot" style="background:${color}"></span><span class="sd-name">${m.label}</span><span class="sd-ind">${indLabel}</span></div>`;
    }
    if (matches.length > 30) html += '<div class="sd-more">...还有 ' + (matches.length - 30) + ' 个结果</div>';
    dropEl.innerHTML = html;
    dropEl.classList.add('visible');
  });

  dropEl.addEventListener('click', (ev) => {
    const item = ev.target.closest('.sd-item');
    if (!item) return;
    const key = item.dataset.key;
    dropEl.classList.remove('visible');
    searchEl.value = G.getNodeAttribute(key, 'label') || key;
    searchEl.blur();
    setFocus(key);
  });

  searchEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { dropEl.classList.remove('visible'); searchEl.blur(); }
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#search-wrap')) dropEl.classList.remove('visible');
  });

  // ----- Back button -----
  document.getElementById('back-btn').addEventListener('click', () => {
    if (level === 'l3' && activeIndustry) enterL2(activeIndustry);
    else if (level === 'l2') enterL1();
  });

  // ----- Init: start at L1 -----
  enterL1();

  window.__sigma = sigma;
  window.__graph = G;
}

init().catch(err => {
  console.error('[KG]', err);
  showError(err.message);
});