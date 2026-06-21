(async function(){
  try {
    console.log('1 - starting');
    var resp = await fetch('data/graph.json?' + Date.now());
    console.log('2 - fetched');
    var raw = await resp.json();
    console.log('3 - parsed, nodes:', raw.nodes.length);
    
    var G = new graphology({type:'mixed', allowSelfLoops:false});
    for(var i = 0; i < raw.nodes.length; i++){
      var n = raw.nodes[i];
      G.addNode(n.key, {label:n.label, x:n.x, y:n.y, size:n.size||3, color:n.color||'#888', industry:n.industry||'', type:n.type||'', is_core:n.is_core||false, degree:n.degree||0, desc:n.desc||''});
    }
    console.log('4 - added nodes:', G.order);
    
    for(var i = 0; i < raw.edges.length; i++){
      var e = raw.edges[i];
      if(G.hasNode(e.source) && G.hasNode(e.target)){
        try{G.addEdge(e.source, e.target, {label:e.label||'', color:'rgba(180,180,200,0.15)', size:0.3});}catch(ex){}
      }
    }
    console.log('5 - added edges:', G.size);
    
    document.getElementById('s-nodes').textContent = G.order;
    document.getElementById('s-edges').textContent = G.size;
    document.getElementById('s-industries').textContent = raw.meta.industries.length;
    console.log('6 - stats updated');
    
    var sigma = new Sigma(G, document.getElementById('sigma-container'), {
      renderEdgeLabels: false,
      enableEdgeEvents: true,
      labelRenderedSizeThreshold: 10,
      defaultEdgeColor: 'rgba(180,180,200,0.12)',
      minCameraRatio: 0.02,
      maxCameraRatio: 8,
      stagePadding: 60,
    });
    console.log('7 - Sigma created');
    document.getElementById('loading').classList.add('hidden');
    console.log('8 - loading hidden');
  } catch(e) {
    console.error('ERROR:', e.message, e.stack);
    document.getElementById('loading').innerHTML = '<p style="color:#E45756">加载失败: ' + e.message + '</p>';
  }
})();