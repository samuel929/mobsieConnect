/* Mobsie Connect — shared UI component library */
(function(){
  const $=(s,r)=>(r||document).querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  /* ---- Atoms ---- */
  const avatar=(name,cls)=>`<span class="avatar ${cls||''}" style="background:${DB.avColor(name)}">${DB.initials(name)}</span>`;
  const avStack=(names,max)=>{
    max=max||3;
    const shown=names.slice(0,max).map(n=>avatar(n,'sm')).join('');
    const extra=names.length>max?`<span class="avatar sm more">+${names.length-max}</span>`:'';
    return `<span class="av-stack">${shown}${extra}</span>`;
  };

  const TONES={green:'t-green',orange:'t-orange',purple:'t-purple',blue:'t-blue',teal:'t-teal',red:'t-red',amber:'t-amber',pink:'t-pink',ink:'t-ink'};
  const STATUS_TONE={
    'Active':'green','Approved':'green','Paid':'green','Successful':'green','Delivered':'green','Resolved':'green',
    'Enrolled':'green','Sent':'green','Completed':'green','Collected':'green','Running':'green','Confirmed':'green','Responded':'green',
    'Trial':'purple','Scheduled':'purple','Virtual':'purple','Reviewed':'purple',
    'Pending Review':'amber','Documents Required':'amber','Due':'amber','Pending':'amber','Processing':'amber',
    'On Leave':'amber','Onboarding':'amber','Waiting on Customer':'amber','Low Stock':'amber','Paused':'amber','Draft':'ink',
    'Interview Scheduled':'teal','Ready for Collection':'teal','In Progress':'blue','Open':'orange','New':'orange','On Hold':'orange',
    'Suspended':'red','Rejected':'red','Overdue':'red','Failed':'red','Out of Stock':'red','Urgent':'red','Expired':'ink',
    'High':'amber','Normal':'blue','Standard':'ink','Sibling':'purple','Staff Child':'teal','In-person':'blue',
    'Offered':'teal','Hidden':'ink','Invited':'purple','Generating':'amber',
  };
  const badge=(text,tone)=>`<span class="badge ${TONES[tone]||'t-ink'}"><span class="bdot"></span>${esc(text)}</span>`;
  const status=s=>badge(s,STATUS_TONE[s]||'ink');
  const delta=(v,dir,vs)=>{
    dir=dir||(v>=0?'up':'down');
    const ic=dir==='up'?MCIcon('trendUp'):dir==='down'?MCIcon('trendDown'):'';
    return `<span class="delta ${dir}">${ic}${esc(Math.abs(v))}%${vs?` <span class="vs">${esc(vs)}</span>`:''}</span>`;
  };

  const pageHead=(title,sub,actions,emoji)=>`
    <div class="page-head">
      <div class="ttl"><h1>${esc(title)}${emoji?' '+emoji:''}</h1>${sub?`<p>${sub}</p>`:''}</div>
      ${actions?`<div class="actions">${actions}</div>`:''}
    </div>`;

  const statCard=o=>`
    <div class="stat">
      <div class="top">
        <span class="s-ic ${o.tint}">${MCIcon(o.icon)}</span>
        <div style="min-width:0"><div class="lbl">${esc(o.label)}</div><div class="val">${esc(o.value)}</div></div>
        ${o.spark?`<div style="margin-left:auto;align-self:center">${o.spark}</div>`:''}
      </div>
      ${o.deltaHtml!==undefined?o.deltaHtml:(o.delta!=null?delta(o.delta,o.dir,o.vs||'this month'):'')}
    </div>`;

  const card=(head,body,opts)=>{
    opts=opts||{};
    const h=head?`<div class="card-head"><div><h3>${esc(head)}</h3>${opts.sub?`<div class="sub">${esc(opts.sub)}</div>`:''}</div><span class="spacer"></span>${opts.right||''}</div>`:'';
    return `<div class="card ${opts.cls||''}" ${opts.attrs||''}>${h}<div class="card-body">${body}</div>${opts.foot?`<div class="card-foot">${opts.foot}</div>`:''}</div>`;
  };

  const legend=items=>`<div class="legend">${items.map(i=>`<span class="lg-it"><span class="sw ${i.line?'line':''}" style="background:${i.color}"></span>${esc(i.label)}</span>`).join('')}</div>`;

  const meterRow=(label,val,tone,suffix)=>`
    <div class="meter-row"><span class="m-lbl">${esc(label)}</span>
    <span class="meter ${tone||''}"><i style="width:${Math.min(100,val)}%"></i></span>
    <span class="m-val">${esc(val)}${suffix===undefined?'%':suffix}</span></div>`;

  const empty=(icon,title,text)=>`
    <div class="empty"><div class="e-ic">${MCIcon(icon)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;

  const personCell=(name,sub)=>`
    <div class="person-cell">${avatar(name)}<div class="pc-txt"><div class="cell-main">${esc(name)}</div>${sub?`<div class="cell-sub">${esc(sub)}</div>`:''}</div></div>`;

  /* ---- Data table (sortable, paginated) ---- */
  const _tables={};
  let _tid=0;
  const ROUTE_MODELS={
    branches:'branches',applications:'applications',interviews:'interviews','waiting-list':'waitingList',
    learners:'learners',parents:'parents',teachers:'teachers',homework:'homeworkList',reports:'reportRuns',
    calendar:'events',payments:'payments',invoices:'invoices',discounts:'discounts',
    newsletters:'newsletters',push:'pushLog',sms:'smsLog',campaigns:'campaigns',feedback:'feedback',
    gallery:'albums',media:'mediaFiles',products:'products',orders:'ordersList',inventory:'products',
    documents:'documentsList',support:'tickets',users:'adminUsers',audit:'auditLog'
  };
  function table(cfg){
    const id='tbl'+(++_tid);
    _tables[id]={cfg,state:{sort:null,dir:1,page:1,query:'',rows:cfg.rows,total:cfg.rows.length,
      remoteModel:cfg.model||ROUTE_MODELS[window.App?.route]}};
    return `<div class="table-host" data-table-id="${id}"></div>`;
  }
  async function fetchRemoteTable(id){
    const t=_tables[id]; if(!t||!t.state.remoteModel||!window.MobsieApi) return;
    const {cfg,state}=t;
    const ps=cfg.pageSize||8;
    const qs=new URLSearchParams({page:String(state.page),limit:String(ps)});
    if(state.query) qs.set('search',state.query);
    if(state.sort){qs.set('sort',state.sort);qs.set('direction',state.dir<0?'desc':'asc');}
    try{
      const result=await window.MobsieApi.request('/api/control-centre/'+encodeURIComponent(state.remoteModel)+'?'+qs);
      state.rows=result.data;state.total=result.meta?.total??result.data.length;
      renderTable(id,true);
    }catch(error){toast('Could not load table: '+error.message,'alert');}
  }
  function renderTable(id,remotePage){
    const t=_tables[id]; if(!t) return;
    const host=$(`[data-table-id="${id}"]`); if(!host) return;
    const {cfg,state}=t;
    let rows=state.rows;
    if(state.query&&!state.remoteModel){
      const q=state.query.toLowerCase();
      rows=rows.filter(r=>cfg.columns.some(c=>{
        const v=c.key?r[c.key]:''; return String(v).toLowerCase().includes(q);
      }));
    }
    if(state.sort){
      const col=cfg.columns.find(c=>c.key===state.sort);
      rows=[...rows].sort((a,b)=>{
        let x=a[state.sort],y=b[state.sort];
        if(typeof x==='string'){x=x.toLowerCase();y=String(y).toLowerCase();}
        return (x<y?-1:x>y?1:0)*state.dir;
      });
    }
    const ps=cfg.pageSize||8;
    const total=state.remoteModel&&remotePage?state.total:rows.length;
    const pages=Math.max(1,Math.ceil(total/ps));
    state.page=Math.min(state.page,pages);
    const slice=state.remoteModel&&remotePage?rows:rows.slice((state.page-1)*ps,state.page*ps);
    const thead=cfg.columns.map(c=>{
      const cls=[c.num?'num':'',c.sortable!==false&&c.key?'sortable':''].join(' ');
      const arr=state.sort===c.key?`<span class="arr">${state.dir>0?'▲':'▼'}</span>`:'';
      return `<th class="${cls}" data-sort="${c.sortable!==false&&c.key?c.key:''}">${esc(c.label)}${arr}</th>`;
    }).join('');
    const tbody=slice.length?slice.map((r,i)=>{
      const tds=cfg.columns.map(c=>`<td class="${c.num?'num':''}">${c.render?c.render(r):esc(r[c.key])}</td>`).join('');
      return `<tr class="${cfg.onRow?'clickable':''}" data-row="${rows.indexOf(r)}">${tds}</tr>`;
    }).join(''):`<tr><td colspan="${cfg.columns.length}">${empty(cfg.emptyIcon||'search','No results','Try adjusting your search or filters.')}</td></tr>`;
    let pgs='';
    if(pages>1){
      const btn=(p,lbl,dis,on)=>`<button class="pg ${on?'on':''}" data-page="${p}" ${dis?'disabled':''}>${lbl}</button>`;
      pgs+=btn(state.page-1,'‹',state.page===1);
      for(let p=1;p<=pages;p++){
        if(pages>7&&p>2&&p<pages-1&&Math.abs(p-state.page)>1){ if(!pgs.endsWith('…</span>')) pgs+='<span class="pg" style="cursor:default">…</span>'; continue; }
        pgs+=btn(p,p,false,p===state.page);
      }
      pgs+=btn(state.page+1,'›',state.page===pages);
    }
    const shownTotal=state.remoteModel&&remotePage?state.total:rows.length;
    host.innerHTML=`<div class="table-wrap"><table class="mc ${cfg.tableCls||''}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</table></div>
      <div class="table-foot"><span>Showing <b>${shownTotal?((state.page-1)*ps+1):0}–${Math.min(shownTotal,(state.page-1)*ps+slice.length)}</b> of <b>${shownTotal.toLocaleString('en-ZA')}</b></span><div class="pages">${pgs}</div></div>`;
    host.querySelectorAll('th.sortable').forEach(th=>th.addEventListener('click',()=>{
      const k=th.dataset.sort; if(!k) return;
      if(state.sort===k) state.dir*=-1; else {state.sort=k;state.dir=1;}
      if(state.remoteModel) fetchRemoteTable(id); else renderTable(id);
    }));
    host.querySelectorAll('.pg[data-page]').forEach(b=>b.addEventListener('click',()=>{
      const p=+b.dataset.page; if(p>=1&&p<=pages){state.page=p;if(state.remoteModel)fetchRemoteTable(id);else renderTable(id);}
    }));
    if(cfg.onRow) host.querySelectorAll('tr.clickable').forEach(tr=>tr.addEventListener('click',e=>{
      if(e.target.closest('button')) return;
      cfg.onRow(rows[+tr.dataset.row]);
    }));
  }
  function hydrate(root){ (root||document).querySelectorAll('[data-table-id]').forEach(h=>renderTable(h.dataset.tableId)); }
  function tableFilter(id,q){ const t=_tables[id]; if(t){t.state.query=q;t.state.page=1;
    if(t.state.remoteModel){clearTimeout(t.state.filterTimer);t.state.filterTimer=setTimeout(()=>fetchRemoteTable(id),220);}
    else renderTable(id);
  } }
  function tableRows(id,rows){ const t=_tables[id]; if(t){t.state.rows=rows;t.state.page=1;renderTable(id);} }
  // find last created table id (for wiring a search box right after declaring a table)
  const lastTableId=()=>'tbl'+_tid;

  /* ---- Drawer ---- */
  function drawer(o){
    const root=$('#drawerRoot');
    root.innerHTML=`<div class="drawer-scrim"></div>
      <div class="drawer" role="dialog" aria-label="${esc(o.title)}">
        <div class="drawer-head">${o.headIcon||''}<h3>${esc(o.title)}</h3>
          <button class="icon-btn x" aria-label="Close">${MCIcon('x')}</button></div>
        <div class="drawer-body">${o.body}</div>
        ${o.foot?`<div class="drawer-foot">${o.foot}</div>`:''}
      </div>`;
    requestAnimationFrame(()=>root.classList.add('open'));
    const close=()=>{root.classList.remove('open');setTimeout(()=>{root.innerHTML='';},250);};
    root.querySelector('.drawer-scrim').addEventListener('click',close);
    root.querySelector('.x').addEventListener('click',close);
    if(o.mount) o.mount(root,close);
    return close;
  }

  /* ---- Modal ---- */
  function modal(o){
    const root=$('#modalRoot');
    root.innerHTML=`<div class="modal-scrim"></div>
      <div class="modal" role="dialog" aria-label="${esc(o.title)}">
        <div class="modal-head"><h3>${esc(o.title)}</h3><button class="icon-btn x" aria-label="Close">${MCIcon('x')}</button></div>
        <div class="modal-body">${o.body}</div>
        ${o.foot?`<div class="modal-foot">${o.foot}</div>`:''}
      </div>`;
    root.classList.add('open');
    const close=()=>{root.classList.remove('open');root.innerHTML='';};
    root.querySelector('.modal-scrim').addEventListener('click',close);
    root.querySelector('.x').addEventListener('click',close);
    if(o.mount) o.mount(root,close);
    return close;
  }

  /* ---- Popover menu ---- */
  let _menuEl=null;
  function closeMenu(){ if(_menuEl){_menuEl.remove();_menuEl=null;document.removeEventListener('click',_onDoc,true);} }
  function _onDoc(e){ if(_menuEl&&!_menuEl.contains(e.target)) closeMenu(); }
  function menu(anchor,items,opts){
    closeMenu();
    opts=opts||{};
    const m=document.createElement('div');
    m.className='menu';
    m.innerHTML=(opts.head?`<div class="menu-head">${esc(opts.head)}</div>`:'')+
      `<div class="${opts.scroll?'menu-scroll':''}">`+
      items.map((it,i)=>it==='-'?'<div class="menu-sep"></div>':
        `<button class="menu-item ${it.danger?'danger':''} ${it.checked?'checked':''}" data-mi="${i}">
          ${it.icon?MCIcon(it.icon):''}<span>${esc(it.label)}</span>${it.checked?`<span class="tick">${MCIcon('check')}</span>`:''}
        </button>`).join('')+`</div>`;
    document.body.appendChild(m);
    const r=anchor.getBoundingClientRect();
    const mw=m.offsetWidth, mh=m.offsetHeight;
    let left=opts.align==='right'?r.right-mw:r.left;
    left=Math.max(8,Math.min(left,innerWidth-mw-8));
    let top=r.bottom+6;
    if(top+mh>innerHeight-8) top=Math.max(8,r.top-mh-6);
    m.style.left=left+'px'; m.style.top=top+window.scrollY+'px'; m.style.position='absolute';
    m.querySelectorAll('[data-mi]').forEach(b=>b.addEventListener('click',()=>{
      const it=items[+b.dataset.mi]; closeMenu(); if(it.onClick) it.onClick();
    }));
    _menuEl=m;
    setTimeout(()=>document.addEventListener('click',_onDoc,true),0);
    return m;
  }

  /* ---- Toast ---- */
  function toast(msg,icon){
    const st=$('#toastStack');
    const t=document.createElement('div');
    t.className='toast';
    t.innerHTML=`${MCIcon(icon||'checkCircle')}<span>${esc(msg)}</span>`;
    st.appendChild(t);
    setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),260);},2800);
  }

  /* ---- Detail list for drawers ---- */
  const dl=pairs=>`<dl class="dl">${pairs.map(p=>`<dt>${esc(p[0])}</dt><dd>${p[1]}</dd>`).join('')}</dl>`;

  /* ---- Read form values out of a modal/drawer: elements marked data-f="key" ---- */
  const formVals=root=>{
    const o={};
    root.querySelectorAll('[data-f]').forEach(el=>o[el.dataset.f]=el.value.trim());
    return o;
  };

  /* ---- Real CSV download ---- */
  function downloadCSV(name,header,rows){
    const cell=v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const csv=[header.map(cell).join(',')].concat(rows.map(r=>r.map(cell).join(','))).join('\n');
    try{
      const url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');
      a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1200);
      toast('Downloaded '+name);
    }catch(e){toast('Downloads are blocked in this preview — works in the full build');}
  }

  /* ---- Pill tab group (returns html; bind with bindPills) ---- */
  function pills(id,options,active){
    return `<div class="pill-tabs" id="${id}">${options.map((o,i)=>`<button class="${i===(active||0)?'on':''}" data-pill="${i}">${esc(o)}</button>`).join('')}</div>`;
  }
  function bindPills(id,onChange){
    const el=document.getElementById(id); if(!el) return;
    el.querySelectorAll('[data-pill]').forEach(b=>b.addEventListener('click',()=>{
      el.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); if(onChange) onChange(+b.dataset.pill);
    }));
  }

  window.UI={esc,avatar,avStack,badge,status,delta,pageHead,statCard,card,legend,meterRow,empty,personCell,
    table,hydrate,tableFilter,tableRows,lastTableId,drawer,modal,menu,closeMenu,toast,dl,pills,bindPills,
    formVals,downloadCSV};
})();
