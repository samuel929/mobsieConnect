/* Mobsie Connect — SVG chart engine (no dependencies)
   Marks: 2px lines · >=8px markers with 2px surface ring · area wash 10%
   hairline solid gridlines · rounded data-ends · tooltips via .ct-hit[data-tip] */
(function(){
  const SURF='#FFFFFF', GRID='#EEF1F6', TICK='#94A3B8';
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const tip=o=>esc(encodeURIComponent(JSON.stringify(o)));

  function niceMax(v){
    const p=Math.pow(10,Math.floor(Math.log10(v||1)));
    for(const m of [1,1.5,2,2.5,3,4,5,6,8,10]) if(m*p>=v) return m*p;
    return 10*p;
  }
  const fmtTick=v=>v>=1e6?'R'+(v/1e6).toFixed(v%1e6?1:0)+'M':v>=1e3?(v/1e3)+'K':String(v);

  /* ---- Multi-series line chart with area wash + hover columns ---- */
  function line(opts){
    const {labels,series,height=250,money=true,ticks=4}=opts;
    const W=680,H=height,padL=52,padR=18,padT=14,padB=30;
    const iw=W-padL-padR, ih=H-padT-padB;
    const max=niceMax(Math.max(...series.flatMap(s=>s.data)));
    const X=i=>padL+(labels.length===1?iw/2:i*(iw/(labels.length-1)));
    const Y=v=>padT+ih-(v/max)*ih;
    let g='';
    for(let t=0;t<=ticks;t++){
      const v=max*t/ticks, y=Y(v);
      g+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
      g+=`<text x="${padL-8}" y="${y+3.5}" text-anchor="end" font-size="10.5" fill="${TICK}">${money?fmtTick(v):(v>=1000?(v/1000)+'K':v)}</text>`;
    }
    labels.forEach((l,i)=>{ g+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="${TICK}">${esc(l)}</text>`; });
    let paths='',dots='';
    series.forEach(s=>{
      const pts=s.data.map((v,i)=>[X(i),Y(v)]);
      const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
      if(s.area!==false){
        paths+=`<path d="${d} L${pts[pts.length-1][0]},${padT+ih} L${pts[0][0]},${padT+ih} Z" fill="${s.color}" opacity="0.08"/>`;
      }
      paths+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach(p=>{ dots+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}" stroke="${SURF}" stroke-width="2"/>`; });
    });
    // hover columns
    let hits='';
    const bw=labels.length>1?iw/(labels.length-1):iw;
    labels.forEach((l,i)=>{
      const rows=series.map(s=>({c:s.color,l:s.name,v:s.fmt?s.fmt(s.data[i]):(money?'R'+s.data[i].toLocaleString('en-ZA'):s.data[i].toLocaleString('en-ZA'))}));
      const x0=Math.max(padL,X(i)-bw/2), x1=Math.min(W-padR,X(i)+bw/2);
      hits+=`<g class="ct-hit" data-tip="${tip({h:l,rows})}">`+
        `<line x1="${X(i)}" y1="${padT}" x2="${X(i)}" y2="${padT+ih}" stroke="#CBD5E1" stroke-width="1" opacity="0" class="xh"/>`+
        `<rect x="${x0}" y="${padT}" width="${x1-x0}" height="${ih}" fill="transparent"/></g>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}${paths}${hits}${dots}</svg>`;
  }

  /* ---- Donut with gapped segments + centre figure ---- */
  function donut(opts){
    const {segments,size=210,thick=30,centre,centreSub}=opts;
    const R=(size-thick)/2-2, C=size/2;
    const total=segments.reduce((a,s)=>a+s.value,0)||1;
    const padDeg=2.6;
    let a=-90, arcs='';
    segments.forEach(s=>{
      const sweep=s.value/total*360;
      const a0=a+padDeg/2, a1=a+sweep-padDeg/2; a+=sweep;
      if(a1<=a0) return;
      const r0=(a0*Math.PI)/180, r1=(a1*Math.PI)/180;
      const x0=C+R*Math.cos(r0), y0=C+R*Math.sin(r0);
      const x1=C+R*Math.cos(r1), y1=C+R*Math.sin(r1);
      const lg=(a1-a0)>180?1:0;
      const pc=Math.round(s.value/total*1000)/10;
      arcs+=`<path class="ct-hit" data-tip="${tip({h:s.label,rows:[{c:s.color,l:'Count',v:String(s.value)},{c:s.color,l:'Share',v:pc+'%'}]})}" d="M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${lg} 1 ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-linecap="butt"/>`;
    });
    const c1=centre!=null?`<text x="${C}" y="${C-2}" text-anchor="middle" font-size="26" font-weight="800" fill="#0F172A">${esc(centre)}</text>`:'';
    const c2=centreSub?`<text x="${C}" y="${C+18}" text-anchor="middle" font-size="11.5" fill="${TICK}">${esc(centreSub)}</text>`:'';
    return `<svg viewBox="0 0 ${size} ${size}" role="img">${arcs}${c1}${c2}</svg>`;
  }

  /* ---- Radial progress ring ---- */
  function ring(opts){
    const {pct,size=120,thick=11,color='#16A34A',track='#DCFCE7',label}=opts;
    const R=(size-thick)/2, C=size/2, circ=2*Math.PI*R;
    const off=circ*(1-pct/100);
    return `<svg viewBox="0 0 ${size} ${size}" role="img">
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${track}" stroke-width="${thick}"/>
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${color}" stroke-width="${thick}"
        stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 ${C} ${C})"/>
      <text x="${C}" y="${C+7}" text-anchor="middle" font-size="${size/4.6}" font-weight="800" fill="#0F172A">${esc(label!=null?label:pct+'%')}</text>
    </svg>`;
  }

  /* ---- Column chart (1-2 series, rounded caps, 2px gaps) ---- */
  function bars(opts){
    const {labels,series,height=240,money=false,ticks=4,capLabels=false}=opts;
    const W=680,H=height,padL=money?52:40,padR=14,padT=capLabels?22:12,padB=30;
    const iw=W-padL-padR, ih=H-padT-padB;
    const max=niceMax(Math.max(...series.flatMap(s=>s.data)));
    const Y=v=>padT+ih-(v/max)*ih;
    let g='';
    for(let t=0;t<=ticks;t++){
      const v=max*t/ticks, y=Y(v);
      g+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
      g+=`<text x="${padL-8}" y="${y+3.5}" text-anchor="end" font-size="10.5" fill="${TICK}">${money?fmtTick(v):(v>=1000?(v/1000)+'K':v)}</text>`;
    }
    const slot=iw/labels.length;
    const bw=Math.min(24,(slot-8)/series.length-2);
    let bar='';
    labels.forEach((l,i)=>{
      const groupW=series.length*bw+(series.length-1)*2;
      let x=padL+i*slot+(slot-groupW)/2;
      const rows=series.map(s=>({c:s.color,l:s.name,v:money?'R'+s.data[i].toLocaleString('en-ZA'):s.data[i].toLocaleString('en-ZA')}));
      bar+=`<g class="ct-hit" data-tip="${tip({h:l,rows})}"><rect x="${padL+i*slot}" y="${padT}" width="${slot}" height="${ih}" fill="transparent"/>`;
      series.forEach(s=>{
        const v=s.data[i], y=Y(v), h=padT+ih-y, r=Math.min(4,h/2,bw/2);
        bar+=`<path d="M${x},${padT+ih} L${x},${y+r} Q${x},${y} ${x+r},${y} L${x+bw-r},${y} Q${x+bw},${y} ${x+bw},${y+r} L${x+bw},${padT+ih} Z" fill="${s.color}"/>`;
        if(capLabels&&series.length===1){
          bar+=`<text x="${x+bw/2}" y="${y-6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#64748B">${money?fmtTick(v):v.toLocaleString('en-ZA')}</text>`;
        }
        x+=bw+2;
      });
      bar+=`</g>`;
      g+=`<text x="${padL+i*slot+slot/2}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="${TICK}">${esc(l)}</text>`;
    });
    g+=`<line x1="${padL}" y1="${padT+ih}" x2="${W-padR}" y2="${padT+ih}" stroke="#E6EAF0" stroke-width="1"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}${bar}</svg>`;
  }

  /* ---- Sparkline (stat tiles) ---- */
  function spark(data,color,w,h){
    w=w||120;h=h||34;
    const max=Math.max(...data), min=Math.min(...data), span=max-min||1;
    const X=i=>4+i*((w-8)/(data.length-1));
    const Y=v=>h-5-((v-min)/span)*(h-10);
    const d=data.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
    const lx=X(data.length-1), ly=Y(data[data.length-1]);
    return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px">
      <path d="${d} L${lx},${h-2} L4,${h-2} Z" fill="${color}" opacity="0.09"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="3.4" fill="${color}" stroke="${SURF}" stroke-width="2"/></svg>`;
  }

  /* ---- Ordinal funnel (single hue, monotone lightness) ---- */
  function funnel(opts){
    const {stages,ramp=['#7C2D12','#C2410C','#EA580C','#F97316','#FB923C']}=opts;
    const max=stages[0].value||1;
    let rows='';
    stages.forEach((s,i)=>{
      const w=Math.max(8,Math.round(s.value/max*100));
      const col=ramp[Math.min(i,ramp.length-1)];
      rows+=`<div class="fn-row ct-hit" data-tip="${tip({h:s.label,rows:[{c:col,l:'Count',v:s.value.toLocaleString('en-ZA')},{c:col,l:'Conversion',v:Math.round(s.value/max*100)+'%'}]})}" style="display:flex;align-items:center;gap:12px;padding:5px 0">
        <div style="width:128px;font-size:12.5px;font-weight:600;color:#475569;flex-shrink:0">${esc(s.label)}</div>
        <div style="flex:1;height:26px;border-radius:8px;background:#F1F5F9;overflow:hidden">
          <div style="width:${w}%;height:100%;border-radius:8px;background:${col}"></div></div>
        <div style="width:56px;text-align:right;font-size:13px;font-weight:700;color:#0F172A;font-variant-numeric:tabular-nums;flex-shrink:0">${s.value.toLocaleString('en-ZA')}</div></div>`;
    });
    return `<div>${rows}</div>`;
  }

  /* ---- Attendance heatmap (sequential green, light→dark) ---- */
  function heatmap(opts){
    const {rows,cols,data}=opts; // data[r][c] = 0..100 or null
    const ramp=v=>v==null?'#F1F5F9':v>=96?'#15803D':v>=92?'#22C55E':v>=88?'#4ADE80':v>=84?'#86EFAC':'#DCFCE7';
    const cell=38,gap=6,padL=94,padT=26;
    const W=padL+cols.length*(cell+gap), H=padT+rows.length*(cell+gap)+4;
    let g='';
    cols.forEach((c,j)=>{ g+=`<text x="${padL+j*(cell+gap)+cell/2}" y="14" text-anchor="middle" font-size="10.5" fill="${TICK}">${esc(c)}</text>`; });
    rows.forEach((r,i)=>{
      g+=`<text x="${padL-10}" y="${padT+i*(cell+gap)+cell/2+3.5}" text-anchor="end" font-size="11" font-weight="600" fill="#475569">${esc(r)}</text>`;
      cols.forEach((c,j)=>{
        const v=data[i][j];
        const dark=v!=null&&v>=92;
        g+=`<g class="ct-hit" data-tip="${tip({h:r+' · '+c,rows:[{c:ramp(v),l:'Attendance',v:v==null?'—':v+'%'}]})}">`+
          `<rect x="${padL+j*(cell+gap)}" y="${padT+i*(cell+gap)}" width="${cell}" height="${cell}" rx="9" fill="${ramp(v)}"/>`+
          (v!=null?`<text x="${padL+j*(cell+gap)+cell/2}" y="${padT+i*(cell+gap)+cell/2+3.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${dark?'#fff':'#166534'}">${v}</text>`:'')+`</g>`;
      });
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" style="max-width:${W}px">${g}</svg>`;
  }

  window.Charts={line,donut,ring,bars,spark,funnel,heatmap};
})();
