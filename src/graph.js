import Graph from 'graphology';

export const IND_COLORS = {
  '新能源电池行业':'#4C78A8','电力设备/储能':'#F58518','医药/医疗':'#E45756',
  '机械设备':'#72B7B2','人工智能':'#54A24B','电力/风电/光伏':'#EECA3B',
  '军工':'#B279A2','汽车零部件':'#FF9DA6','低空经济':'#9D755D',
  '光伏设备':'#BAB0AC','消费/食品饮料':'#9B59B6',
};

export async function loadGraph(url) {
  const resp = await fetch(url);
  const raw = await resp.json();
  const G = new Graph({ type: 'mixed', allowSelfLoops: false });
  for (const n of raw.nodes) {
    G.addNode(n.key, {
      label: n.label, x: n.x, y: n.y,
      size: n.size || 3, color: n.color || '#888',
      ind: n.industry || '', typ: n.type || '',
      desc: (n.desc || '').substring(0, 120),
      deg: n.degree || 0,
    });
  }
  for (const e of raw.edges) {
    if (G.hasNode(e.source) && G.hasNode(e.target)) {
      try { G.addEdge(e.source, e.target, {}); } catch (_) {}
    }
  }
  // Legend data: industry -> count
  const indCnt = {};
  for (const n of raw.nodes) {
    const ind = n.industry || '(??)';
    indCnt[ind] = (indCnt[ind] || 0) + 1;
  }
  return { graph: G, meta: raw.meta, indCnt };
}