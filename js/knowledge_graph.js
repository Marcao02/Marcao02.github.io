/* Dynamic Knowledge Graph Module */
(function(global){
  function initKnowledgeGraph(opts){
    const cfg = Object.assign({ svgSelector:'#kgSvg', json:'data/knowledge_graph.json', legend:true, observe:false }, opts||{});
    const svg = d3.select(cfg.svgSelector);
    if(!svg.node()) return;
    const width = +svg.attr('viewBox').split(' ')[2] || 600;
    const height = +svg.attr('viewBox').split(' ')[3] || 260;
    // Accessible, vibrant palette (no white/black nodes). Adjust / extend groups as needed.
  const colorMap = { KR:'#2c5aa0', AI:'#ff8c00', eHealth:'#1f9d55', Skills:'#b83280', Data:'#6f42c1', Methods:'#e83e8c' };
    const color = d3.scaleOrdinal().domain(Object.keys(colorMap)).range(Object.values(colorMap));

    function loadJSON(path){
      return fetch(path).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
    }
    function inlineGraphData(){
      try {
        const el = document.getElementById('kgData');
        if(el){ return JSON.parse(el.textContent.trim()); }
      } catch(e){ console.warn('Inline knowledge graph JSON parse failed', e); }
      return null;
    }
    const load = () => Promise.all([
        loadJSON(cfg.json).catch(err=>{ console.warn('Graph fetch failed, trying inline fallback:', err.message); return inlineGraphData()||{nodes:[],links:[]}; }),
        loadJSON('data/publications_keywords.json').catch(()=>({ publications:[] }))
      ]).then(([graphData, pubData]) => enrichWithFrequencies(graphData, pubData));

    function enrichWithFrequencies(graphData, pubData){
      const freq = {};
      (pubData.publications||[]).forEach(p=> (p.keywords||[]).forEach(k=>{ freq[k] = (freq[k]||0)+1; }));
      graphData.nodes.forEach(n=>{
        if(freq[n.id]){
          // Increase size scaled by frequency (cap to avoid huge nodes)
            n.size = Math.min(n.size + freq[n.id]*2, 40);
            n.freq = freq[n.id];
        }
      });
      build(graphData);
    }

    function build(data){
      svg.selectAll('*').remove();
  const gLinks = svg.append('g').attr('stroke','#bcd2ec').attr('stroke-width',1.2);
      const gNodes = svg.append('g');

      // Glow filter
      const defs = svg.append('defs');
      const filter = defs.append('filter').attr('id','nodeGlow');
      filter.append('feGaussianBlur').attr('stdDeviation','3').attr('result','coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in','coloredBlur');
      feMerge.append('feMergeNode').attr('in','SourceGraphic');

      if(!data.nodes || !data.nodes.length){
        svg.append('text').attr('x', width/2).attr('y', height/2).attr('text-anchor','middle').attr('fill','var(--text-muted)').attr('font-size','14px')
          .text('No graph data loaded');
        return;
      }
      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d=>d.id).distance(90).strength(.6))
        .force('charge', d3.forceManyBody().strength(-180))
        .force('center', d3.forceCenter(width/2, height/2))
        .force('collision', d3.forceCollide().radius(d=>d.size+12));

      const link = gLinks.selectAll('line').data(data.links).enter().append('line').attr('opacity',.7);

      const node = gNodes.selectAll('g').data(data.nodes).enter().append('g')
        .attr('tabindex',0)
        .on('focus mouseenter', (e,d)=> highlight(d))
        .on('blur mouseleave', clearHighlight)
        .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

      node.append('circle')
        .attr('r', d=>d.size)
        .attr('fill', d=>color(d.group))
        .attr('stroke', '#fff').attr('stroke-width',1.5)
        .style('filter','url(#nodeGlow)');

      node.append('title').text(d=>d.id);

      node.append('text')
        .text(d=>d.id)
        .attr('font-size','11px')
        .attr('text-anchor','middle')
        .attr('dy', d=>d.size+14)
        .attr('paint-order','stroke')
        .attr('stroke','#f8f9fa')
        .attr('stroke-width',3)
        .attr('stroke-linejoin','round')
        .attr('fill','#212529');

      simulation.on('tick', () => {
        link.attr('x1', d=>d.source.x).attr('y1', d=>d.source.y)
            .attr('x2', d=>d.target.x).attr('y2', d=>d.target.y);
        node.attr('transform', d=>`translate(${d.x},${d.y})`);
      });

      function dragstarted(event, d){ if(!event.active) simulation.alphaTarget(.3).restart(); d.fx=d.x; d.fy=d.y; }
      function dragged(event, d){ d.fx=event.x; d.fy=event.y; }
      function dragended(event, d){ if(!event.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; }

      function highlight(d){
        link.attr('stroke', l => (l.source.id===d.id || l.target.id===d.id)? '#2c5aa0':'#d9e4f2')
            .attr('stroke-width', l => (l.source.id===d.id || l.target.id===d.id)? 2.4:1.1)
            .attr('opacity', l => (l.source.id===d.id || l.target.id===d.id)? 1:0.35);
        node.selectAll('circle').attr('opacity', n => n.id===d.id?1:0.45)
             .attr('stroke-width', n=> n.id===d.id?2:1.5);
      }
      function clearHighlight(){
        link.attr('stroke','#bcd2ec').attr('stroke-width',1.2).attr('opacity',.7);
        node.selectAll('circle').attr('opacity',1).attr('stroke-width',1.5);
      }

  if(cfg.legend){
        const legend = svg.append('g').attr('class','kg-legend').attr('transform','translate(8,8)');
        const entries = Object.keys(colorMap);
        legend.selectAll('g').data(entries).enter().append('g')
          .attr('transform', (d,i)=>`translate(0,${i*18})`)
          .each(function(d){
            d3.select(this).append('circle').attr('r',6).attr('cx',6).attr('cy',6).attr('fill',colorMap[d]);
    d3.select(this).append('text').text(d).attr('x',18).attr('y',10).attr('font-size','11px').attr('fill','var(--text-muted)');
          });
    // Frequency legend hint
    legend.append('text').text('Size ~ keyword frequency').attr('x',0).attr('y', entries.length*18 + 14).attr('font-size','10px').attr('fill','var(--text-muted)');
      }
    }

    if(cfg.observe && 'IntersectionObserver' in window){
      const placeholder = document.querySelector(cfg.svgSelector);
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if(en.isIntersecting){ load(); io.disconnect(); } });
      }, { threshold: 0.15 });
      io.observe(placeholder);
    } else {
      load();
    }
  }
  global.initKnowledgeGraph = initKnowledgeGraph;
})(window);
