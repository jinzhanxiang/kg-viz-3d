export function getEl(id) {
  return document.getElementById(id);
}

export function updStats(graph, meta) {
  getEl('s-nodes').textContent = graph.order;
  getEl('s-edges').textContent = graph.size;
  getEl('s-industries').textContent = (meta.industries || []).length;
}

export function buildLegend(indCnt, indColors) {
  const sorted = Object.entries(indCnt).sort((a, b) => b[1] - a[1]);
  let html = '';
  for (const [ind, cnt] of sorted) {
    const c = indColors[ind] || '#888';
    html += `<div class="lg-item" data-ind="${ind}"><span class="lg-dot" style="background:${c}"></span>${ind}<span class="lg-count">${cnt}</span></div>`;
  }
  getEl('legend').innerHTML = html;
}

// -- Level Indicator --
export function showLevelInd(lvl, industry) {
  const el = getEl('level-ind');
  if (lvl === 'l1') {
    el.innerHTML = '🏭 行业总览';
  } else if (lvl === 'l2') {
    el.innerHTML = `🏭 行业总览 › <strong>${industry}</strong>`;
  } else if (lvl === 'l3') {
    el.innerHTML = `🏭 行业总览 › ${industry || '...'} › <strong>实体详情</strong>`;
  }
}

// -- Tooltip (hover) --
export function showTooltip(nodeKey, graph) {
  const a = graph.getNodeAttributes(nodeKey);
  const tip = getEl('tooltip');
  let html = `<div class="tt-name">${a.label || nodeKey}</div>`;
  if (a._level === 'industry') {
    html += `<div class="tt-industry">🏭 ${a.ind || ''} · ${a._count || 0}个实体</div>`;
    html += `<div class="tt-hint">点击展开</div>`;
  } else {
    if (a.ind || a.typ) html += `<div class="tt-industry">${a.ind || ''}${a.ind && a.typ ? ' · ' : ''}${a.typ || ''}</div>`;
    if (a.desc) html += `<div class="tt-desc">${a.desc}</div>`;
    html += `<div class="tt-degree">连接数: ${a.deg}</div>`;
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
}

export function hideTooltip() {
  getEl('tooltip').style.display = 'none';
}

export function positionTooltip(sigma, nodeKey) {
  const pos = sigma.getNodeDisplayData(nodeKey);
  if (!pos) return;
  const r = getEl('sigma-container').getBoundingClientRect();
  const sc = sigma.graphToViewport(pos);
  const tip = getEl('tooltip');
  tip.style.left = (sc.x + r.left + 15) + 'px';
  tip.style.top = (sc.y + r.top - 10) + 'px';
}

// -- Detail panel (click focus L3) --
export function showDetail(nodeKey, graph, onClose) {
  const a = graph.getNodeAttributes(nodeKey);
  const panel = getEl('detail-panel');

  // For industry nodes in L1, drill in rather than show detail
  if (a._level === 'industry') {
    hideDetail();
    if (onClose) onClose(); // This is actually setFocus, which handles industry clicks
    return;
  }

  const neighbors = graph.neighbors(nodeKey);
  const neighborLabels = neighbors.slice(0, 30).map(nk => {
    const na = graph.getNodeAttributes(nk);
    return `<div class="dp-nb-item"><span class="dp-nb-dot" style="background:${na.color || '#888'}"></span>${na.label || nk}</div>`;
  });
  const hasMore = neighbors.length > 30;
  const indLabel = a.ind || '';

  panel.innerHTML = `
    <button id="dp-close" class="dp-close">✕</button>
    <div class="dp-header">
      <div class="dp-name">${a.label || nodeKey}</div>
      <div class="dp-meta">${indLabel}${indLabel && a.typ ? ' · ' : ''}${a.typ || 'ENTITY'}</div>
    </div>
    <div class="dp-body">
      ${a.desc ? `<div class="dp-desc">${a.desc}</div>` : ''}
      <div class="dp-section-title">关联节点（${neighbors.length}）</div>
      <div class="dp-neighbors">${neighborLabels.join('')}${hasMore ? `<div class="dp-more">...还有 ${neighbors.length - 30} 个</div>` : ''}</div>
    </div>
  `;
  panel.classList.add('visible');
  panel.classList.remove('hidden');

  getEl('dp-close').addEventListener('click', () => {
    hideDetail(panel);
    if (onClose) onClose();
  });
}

export function hideDetail(panel) {
  if (!panel) panel = getEl('detail-panel');
  panel.classList.remove('visible');
  panel.classList.add('hidden');
}

export function hideLoading() {
  getEl('loading').classList.add('hidden');
}

export function showError(msg) {
  getEl('loading').innerHTML = `<p style="color:#E45756">❌ 加载失败: ${msg}</p>`;
}