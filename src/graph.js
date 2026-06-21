import Graph from 'graphology';

export const IND_COLORS = {
  '新能源电池行业':'#4C78A8','电力设备/储能':'#F58518','医药/医疗':'#E45756',
  '机械设备':'#72B7B2','人工智能':'#54A24B','电力/风电/光伏':'#EECA3B',
  '军工':'#B279A2','汽车零部件':'#FF9DA6','低空经济':'#9D755D',
  '光伏设备':'#BAB0AC','消费/食品饮料':'#9B59B6',
};

export const TYPE_COLORS = {
  'ORG':'#4C78A8','PRODUCT':'#F58518','TECH':'#54A24B',
  'POLICY':'#E45756','INDUSTRY':'#72B7B2','PLACE':'#B279A2','PERSON':'#EECA3B',
};

export async function loadGraph(url) {
  const resp = await fetch(url);
  const raw = await resp.json();
  const G = new Graph({ type: 'mixed', allowSelfLoops: false });

  // Track entity industry for edge calculations
  const nodeIndustry = {};

  // Add entity nodes
  for (const n of raw.nodes) {
    const ind = n.industry || '(未分类)';
    nodeIndustry[n.key] = ind;
    G.addNode(n.key, {
      label: n.label, x: n.x, y: n.y,
      size: n.size || 3, color: n.color || '#888',
      ind: ind, typ: n.type || '',
      desc: (n.desc || '').substring(0, 120),
      deg: n.degree || 0,
      _level: 'entity',  // L2/L3 entity node
    });
  }

  // Add entity edges
  for (const e of raw.edges) {
    if (G.hasNode(e.source) && G.hasNode(e.target)) {
      try { G.addEdge(e.source, e.target, { _level: 'entity' }); } catch (_) {}
    }
  }

  // --- Build L1 industry aggregate nodes ---
  // Group nodes by industry
  const indMembers = {};
  for (const n of raw.nodes) {
    const ind = n.industry || '(未分类)';
    if (!indMembers[ind]) indMembers[ind] = [];
    indMembers[ind].push(n);
  }

  const indCnt = {};
  const industryNodes = [];

  for (const [ind, members] of Object.entries(indMembers)) {
    indCnt[ind] = members.length;
    // Centroid position
    const avgX = members.reduce((s, n) => s + n.x, 0) / members.length;
    const avgY = members.reduce((s, n) => s + n.y, 0) / members.length;
    const color = IND_COLORS[ind] || '#888';
    const key = 'IND__' + ind;

    industryNodes.push({
      key, label: ind,
      x: avgX, y: avgY,
      size: Math.sqrt(members.length) * 2.5,
      color, _level: 'industry', _count: members.length,
      ind: ind, typ: 'INDUSTRY',
    });
  }

  // --- Build L1 industry edges (cross-industry connections) ---
  const crossEdges = new Map(); // 'indA||indB' -> weight

  for (const e of raw.edges) {
    const si = nodeIndustry[e.source];
    const ti = nodeIndustry[e.target];
    if (si && ti && si !== ti) {
      const key = [si, ti].sort().join('||');
      crossEdges.set(key, (crossEdges.get(key) || 0) + 1);
    }
  }

  // Add industry nodes and edges to graph
  for (const iNode of industryNodes) {
    G.addNode(iNode.key, {
      label: iNode.label, x: iNode.x, y: iNode.y,
      size: iNode.size, color: iNode.color,
      ind: iNode.ind, typ: iNode.typ,
      _level: 'industry', _count: iNode._count,
    });
  }

  for (const [key, weight] of crossEdges) {
    const [src, tgt] = key.split('||');
    const sKey = 'IND__' + src;
    const tKey = 'IND__' + tgt;
    if (G.hasNode(sKey) && G.hasNode(tKey)) {
      try {
        G.addEdge(sKey, tKey, { _level: 'industry', weight, size: Math.min(weight / 5, 3) });
      } catch (_) {}
    }
  }

  const meta = {
    ...raw.meta,
    industries: Object.keys(indCnt),
    industryCounts: indCnt,
    totalIndustryEdges: crossEdges.size,
  };

  return { graph: G, meta, indCnt };
}