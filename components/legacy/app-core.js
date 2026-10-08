/* Mobsie Connect — app core: sidebar, topbar, page host, global search,
   chart tooltips. Booted by React (AppShell) rather than auto-running; routing
   goes through Next.js via window.__mobsieNavigate. */
(function(){
  const $=(s,r)=>(r||document).querySelector(s);
  const esc=s=>window.UI.esc(s);

  const NAV=[
    {items:[{route:'dashboard',label:'Dashboard',icon:'dashboard',accent:true}]},
    {section:'Platform',items:[
      {route:'schools',label:'Our School',icon:'school'},
      {route:'branches',label:'Branches',icon:'branches'}]},
    {section:'Admissions',items:[
      {route:'applications',label:'Applications',icon:'applications',badge:()=>DB.counters.pendingReview},
      {route:'waiting-list',label:'Waiting List',icon:'waiting'}]},
    {section:'Students',items:[
      {route:'learners',label:'Learners',icon:'learners'},
      {route:'parents',label:'Parents',icon:'parents'},
      {route:'teachers',label:'Teachers',icon:'teachers'},
      {route:'daily-activity',label:'Daily Activity',icon:'clock'}]},
    {section:'Academics',items:[
      {route:'attendance',label:'Attendance',icon:'attendance'},
      {route:'homework',label:'Learning',icon:'homework'},
      {route:'reports',label:'Reports',icon:'reports'},
      {route:'calendar',label:'Calendar',icon:'calendar'}]},
    {section:'Finance',items:[
      {route:'payments',label:'Payments',icon:'payments'},
      {route:'invoices',label:'Invoices',icon:'invoices'},
      {route:'statements',label:'Statements',icon:'statements'}]},
    {section:'Communications',items:[
      {route:'messages',label:'Messages',icon:'messages',badge:()=>DB.conversations.reduce((a,c)=>a+c.unread,0)},
      {route:'newsletters',label:'Newsletters',icon:'newsletters'},
      {route:'push',label:'Push Notifications',icon:'push'},
      {route:'feedback',label:'Feedback Centre',icon:'feedback'}]},
    {section:'Media',items:[{route:'gallery',label:'Gallery',icon:'gallery'}]},
    {section:'Shop',items:[
      {route:'products',label:'Products',icon:'products'},
      {route:'orders',label:'Orders',icon:'orders'},
      {route:'inventory',label:'Inventory',icon:'inventory'}]},
    {section:'Documents',items:[{route:'documents',label:'Documents',icon:'documents'}]},
    {section:'Users & Roles',items:[
      {route:'users',label:'Users',icon:'users'},
      {route:'roles',label:'Roles & Permissions',icon:'roles'}]},
    {section:'System',items:[
      {route:'audit',label:'Audit Logs',icon:'audit'},
      {route:'settings',label:'Settings',icon:'settings'}]},
  ];

  const App={
    ctx:{school:null,branch:null},
    route:'dashboard',
    go(r){ if(window.__mobsieNavigate) window.__mobsieNavigate(r); else setRoute(r); },
    school(){ return this.ctx.school?DB.schools.find(s=>s.id===this.ctx.school):null; },
    branchObj(){ return this.ctx.branch?DB.branches.find(b=>b.id===this.ctx.branch):null; },
    scopeLabel(){ const s=this.school(); return s?s.name:(DB.schools.length===1?DB.schools[0].name:'All Schools'); },
    scoped(rows){
      const s=this.school(); if(!s) return rows;
      const b=this.branchObj();
      return rows.filter(r=>{
        const okS=(r.schoolId&&r.schoolId===s.id)||(r.school&&r.school===s.name);
        const okB=!b||!r.branch||r.branch===b.name;
        return okS&&okB;
      });
    },
  };
  window.App=App;

  const ROUTE_EXPORT_MODELS={
    branches:'branches',applications:'applications','waiting-list':'waitingList',
    learners:'learners',parents:'parents',teachers:'teachers',homework:'homeworkList','daily-activity':'dailyActivities',reports:'reportRuns',
    calendar:'events',payments:'payments',invoices:'invoices',
    newsletters:'newsletters',push:'pushLog',feedback:'feedback',
    gallery:'albums',products:'products',orders:'ordersList',inventory:'products',
    documents:'documentsList',users:'adminUsers',audit:'auditLog'
  };
  function serverExport(model){
    const a=document.createElement('a');
    a.href='/api/control-centre/export?model='+encodeURIComponent(model);
    a.download='';document.body.appendChild(a);a.click();a.remove();
  }
  function wireFallbackExports(root){
    const model=ROUTE_EXPORT_MODELS[App.route];
    if(!model)return;
    root.querySelectorAll('button').forEach(button=>{
      const text=button.textContent.trim();
      if(!/(export|download|stock report|pdf)/i.test(text))return;
      if(button.id||Object.keys(button.dataset).length)return;
      button.dataset.exportWired='true';
      button.addEventListener('click',()=>serverExport(model));
    });
  }
  function enforceActionVisibility(root){
    if(window.MobsieSession?.role!=='TEACHER')return;
    root.querySelectorAll('button').forEach(button=>{
      if(/(enrol learner|add parent|add teacher|new application|add campus|record payment|new invoice|add event)/i.test(button.textContent)){
        button.remove();
      }
    });
  }

  /* ---- Sidebar ---- */
  const LOGO=`<img class="brand-logo" src="/mobsie-logo.png" alt="Mobsie Connect">`;
  function renderSidebar(){
    const sb=$('#sidebar'); if(!sb) return;
    const role=window.MobsieSession?.role||'PRINCIPAL';
    const teacherRoutes=new Set(['learners','attendance','daily-activity','homework','reports','calendar']);
    const nav=role==='TEACHER'
      ? NAV.map(g=>({...g,items:g.items.filter(it=>teacherRoutes.has(it.route))})).filter(g=>g.items.length)
      : NAV;
    sb.innerHTML=`
      <div class="side-logo">${LOGO}</div>
      <nav class="side-nav">${nav.map(g=>
        (g.section?`<div class="side-section">${esc(g.section)}</div>`:'')+
        g.items.map(it=>{
          const b=typeof it.badge==='function'?it.badge():it.badge;
          return `
          <a class="side-item ${App.route===it.route?'active':''}" href="/${it.route}" data-route="${it.route}">
            ${MCIcon(it.icon)}<span>${esc(it.label)}</span>
            ${b?`<span class="side-badge">${b}</span>`:(it.accent&&App.route===it.route?MCIcon('chevDown','chev'):'')}
          </a>`;}).join('')
      ).join('')}</nav>
      <div class="side-foot"><div class="help-pill" id="helpPill"><span class="q">?</span> Help Centre</div></div>`;
    // Intercept nav clicks → Next router (no full page reload)
    sb.querySelectorAll('.side-item').forEach(a=>a.addEventListener('click',e=>{
      e.preventDefault(); App.go(a.dataset.route);
    }));
    sb.querySelectorAll('.side-item').forEach(a=>a.addEventListener('mouseenter',()=>{
      if(window.__mobsiePrefetch) window.__mobsiePrefetch(a.dataset.route);
    },{once:true}));
    $('#helpPill').addEventListener('click',()=>UI.toast('Help Centre opens in a new tab in the full build','info'));
  }
  function markActive(){
    document.querySelectorAll('.side-item').forEach(a=>{
      a.classList.toggle('active',a.dataset.route===App.route);
    });
  }

  /* ---- Topbar ---- */
  const NOTIFS=[
    {icon:'applications',tint:'t-orange',t:'Applications awaiting review',s:'Admissions · today',go:'applications'},
    {icon:'alert',tint:'t-red',t:'Payment failed — retry needed',s:'Payments · 32m ago',go:'payments'},
    {icon:'school',tint:'t-green',t:'Atteridgeville campus onboarding',s:'Expansion · 3h ago',go:'schools'},
    {icon:'server',tint:'t-blue',t:'Nightly backup completed in 1m 42s',s:'System · 02:00',go:'audit'},
  ];
  function renderTopbar(){
    const tb=$('#topbar'); if(!tb) return;
    const pageTitle=findNav(App.route)?.label||'Dashboard';
    const br=App.branchObj();
    const user=window.MobsieSession||{name:'User',role:'PRINCIPAL'};
    const roleLabel=user.role==='TEACHER'?'Teacher':'Principal';
    tb.innerHTML=`
      <button class="tb-burger" id="tbBurger" aria-label="Toggle navigation">${MCIcon('menu')}</button>
      <div class="tb-title">${esc(pageTitle)}</div>
      <div class="tb-search" id="tbSearch">${MCIcon('search')}<span>Search for campuses, learners, parents, invoices…</span><span class="hint">⌘K</span></div>
      <div class="tb-right">
        <button class="tb-select" id="selSchool"><span class="ic orange">${MCIcon('school')}</span>${esc(App.scopeLabel())} ${MCIcon('chevDown','chev')}</button>
        <button class="tb-select" id="selBranch"><span class="ic green">${MCIcon('branches')}</span>${esc(br?br.name:'All Branches')} ${MCIcon('chevDown','chev')}</button>
        <button class="tb-icon" id="tbBell">${MCIcon('bell')}<span class="dot">12</span></button>
        <button class="tb-icon" id="tbChat">${MCIcon('chat')}${(u=>u?`<span class="dot orange">${u}</span>`:'')(DB.conversations.reduce((a,c)=>a+c.unread,0))}</button>
        <div class="tb-user" id="tbUser">${UI.avatar(user.name)}
          <div class="who"><div class="nm">${esc(user.name)}</div><div class="rl">${roleLabel}</div></div>${MCIcon('chevDown','chev')}</div>
      </div>`;
    $('#tbBurger').addEventListener('click',()=>$('#app').classList.toggle('side-open'));
    $('#tbSearch').addEventListener('click',openSearch);
    $('#selSchool').addEventListener('click',e=>schoolMenu(e.currentTarget));
    $('#selBranch').addEventListener('click',e=>branchMenu(e.currentTarget));
    $('#tbBell').addEventListener('click',e=>{
      UI.menu(e.currentTarget,NOTIFS.map(n=>({icon:n.icon,label:n.t,onClick:()=>App.go(n.go)})),{head:'Notifications',align:'right'});
    });
    $('#tbChat').addEventListener('click',()=>App.go('messages'));
    $('#tbUser').addEventListener('click',e=>{
      UI.menu(e.currentTarget,[
        {icon:'users',label:'My profile',onClick:()=>UI.toast('Profile coming soon')},
        {icon:'settings',label:'Preferences',onClick:()=>App.go('settings')},
        '-',
        {icon:'logout',label:'Sign out',onClick:async()=>{await fetch('/api/auth/logout',{method:'POST'});location.href='/login';}},
      ],{align:'right'});
    });
  }
  function schoolMenu(anchor){
    const items=DB.schools.map(s=>({label:s.name,icon:'school',checked:true,onClick:()=>{}}))
      .concat([{label:'View school profile',icon:'external',onClick:()=>App.go('schools')}]);
    UI.menu(anchor,items,{head:'Your school',align:'right'});
  }
  function branchMenu(anchor){
    const brs=DB.liveBranches();
    const items=[{label:'All Branches',icon:'grid',checked:!App.ctx.branch,onClick:()=>{App.ctx.branch=null;rerender();}}]
      .concat(brs.map(b=>({label:b.name,icon:'branches',checked:App.ctx.branch===b.id,
        onClick:()=>{App.ctx.school=DB.schools[0].id;App.ctx.branch=b.id;rerender();UI.toast('Now viewing '+b.name);}})));
    UI.menu(anchor,items,{head:DB.SCHOOL_NAME,align:'right',scroll:true});
  }

  function findNav(route){
    for(const g of NAV) for(const it of g.items) if(it.route===route) return it;
    return null;
  }

  /* ---- Render / route ---- */
  function rerender(){
    renderSidebar();
    markActive();
    renderTopbar();
    renderPage();
  }
  App.refresh=function(){
    DB.recount();
    rerender();
    DB.save();
  };
  function renderPage(){
    const page=window.Pages[App.route];
    const c=$('#content'); if(!c||!page) return;
    c.innerHTML=page.render();
    UI.hydrate(c);
    if(page.mount) page.mount(c);
    wireFallbackExports(c);
    enforceActionVisibility(c);
    c.scrollTop=0; window.scrollTo(0,0);
  }
  function setRoute(route){
    App.route=(route&&window.Pages[route])?route:'dashboard';
    const app=$('#app'); if(app) app.classList.remove('side-open');
    rerender();
  }

  /* ---- Global search (⌘K) ---- */
  function searchIndex(){
    const ix=[];
    DB.schools.forEach(s=>ix.push({kind:'School',icon:'school',tint:'t-orange',nm:s.name,sub:s.city,route:'schools'}));
    DB.branches.forEach(b=>ix.push({kind:'Campus',icon:'branches',tint:'t-green',nm:b.name,sub:b.city+' · '+b.status,route:'branches'}));
    DB.teachers.forEach(t=>ix.push({kind:'Teacher',icon:'teachers',tint:'t-purple',nm:t.name,sub:t.school+' · '+t.cls,route:'teachers'}));
    DB.parents.forEach(p=>ix.push({kind:'Parent',icon:'parents',tint:'t-blue',nm:p.name,sub:p.school,route:'parents'}));
    DB.learners.forEach(l=>ix.push({kind:'Learner',icon:'learners',tint:'t-teal',nm:l.name,sub:l.school+' · '+l.grade,route:'learners'}));
    DB.invoices.slice(0,20).forEach(i=>ix.push({kind:'Invoice',icon:'invoices',tint:'t-amber',nm:i.id+' — '+i.parent,sub:i.desc,route:'invoices'}));
    DB.documentsList.forEach(d=>ix.push({kind:'Document',icon:'documents',tint:'t-ink',nm:d.name,sub:d.folder,route:'documents'}));
    return ix;
  }
  let _ix=null,_sel=0;
  function openSearch(){
    _ix=searchIndex();
    const ov=$('#searchOverlay');
    ov.hidden=false;
    ov.innerHTML=`<div class="search-panel">
      <div class="search-input-row">${MCIcon('search')}<input id="gsInput" placeholder="Search campuses, people, invoices, documents…" autocomplete="off"><span class="esc">ESC</span></div>
      <div class="search-results" id="gsResults"></div></div>`;
    const input=$('#gsInput');
    renderResults('');
    input.focus();
    input.addEventListener('input',()=>{_sel=0;renderResults(input.value);});
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) closeSearch(); });
  }
  function renderResults(q){
    const res=$('#gsResults'); if(!res) return;
    q=q.trim().toLowerCase();
    let hits=q?_ix.filter(i=>(i.nm+' '+i.sub+' '+i.kind).toLowerCase().includes(q)).slice(0,12)
             :_ix.slice(0,3).concat(_ix.filter(i=>i.kind==='Teacher').slice(0,2),_ix.filter(i=>i.kind==='Parent').slice(0,2));
    if(!hits.length){ res.innerHTML=`<div class="sr-empty">No results for “${esc(q)}”. Try a campus, parent or invoice number.</div>`; return; }
    let out='',lastKind='';
    hits.forEach((h,i)=>{
      if(h.kind!==lastKind){ out+=`<div class="sr-group">${h.kind}s</div>`; lastKind=h.kind; }
      out+=`<div class="sr-item ${i===_sel?'sel':''}" data-i="${i}">
        <span class="sr-ic ${h.tint}">${MCIcon(h.icon)}</span>
        <span class="sr-txt"><span class="sr-nm">${esc(h.nm)}</span><span class="sr-sub">${esc(h.sub)}</span></span>
        <span class="sr-kind">${h.kind}</span></div>`;
    });
    res.innerHTML=out;
    res.querySelectorAll('.sr-item').forEach(el=>el.addEventListener('click',()=>{
      const h=hits[+el.dataset.i]; closeSearch(); App.go(h.route);
    }));
    res._hits=hits;
  }
  function closeSearch(){ const ov=$('#searchOverlay'); if(ov){ov.hidden=true; ov.innerHTML='';} }
  function refreshSel(res){ res.querySelectorAll('.sr-item').forEach((el,i)=>el.classList.toggle('sel',i===_sel)); }

  /* ---- Global listeners (wired once) ---- */
  let wired=false;
  function wireOnce(){
    if(wired) return; wired=true;

    document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); openSearch(); }
      const ov=$('#searchOverlay');
      if(ov&&!ov.hidden){
        const res=$('#gsResults');
        if(e.key==='Escape') closeSearch();
        else if(e.key==='ArrowDown'){ e.preventDefault(); _sel=Math.min((res._hits||[]).length-1,_sel+1); refreshSel(res); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); _sel=Math.max(0,_sel-1); refreshSel(res); }
        else if(e.key==='Enter'&&res._hits&&res._hits[_sel]){ const h=res._hits[_sel]; closeSearch(); App.go(h.route); }
      } else if(e.key==='Escape'){ UI.closeMenu(); }
    });

    // Chart tooltip delegation
    const tipEl=$('#chartTip');
    document.addEventListener('mouseover',e=>{
      const hit=e.target.closest&&e.target.closest('.ct-hit');
      if(hit&&hit.dataset.tip&&tipEl){
        try{
          const d=JSON.parse(decodeURIComponent(hit.dataset.tip));
          tipEl.innerHTML=`<div class="tt-h">${esc(d.h)}</div>`+
            d.rows.map(r=>`<div class="tt-r"><span class="sw" style="background:${r.c}"></span>${esc(r.l)}<b>${esc(r.v)}</b></div>`).join('');
          tipEl.hidden=false;
        }catch(_){}
      }
    });
    document.addEventListener('mousemove',e=>{
      if(tipEl&&!tipEl.hidden){
        const hit=e.target.closest&&e.target.closest('.ct-hit');
        if(!hit){ tipEl.hidden=true; return; }
        const x=Math.max(90,Math.min(e.clientX,innerWidth-90));
        tipEl.style.left=x+'px'; tipEl.style.top=e.clientY+'px';
      }
    });
    document.addEventListener('mouseout',e=>{
      if(tipEl&&e.target.closest&&e.target.closest('.ct-hit')&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('.ct-hit')))
        tipEl.hidden=true;
    });

    const st=document.createElement('style');
    st.textContent='.ct-hit:hover .xh{opacity:1 !important}';
    document.head.appendChild(st);

    const scrim=$('#sidebarScrim');
    if(scrim) scrim.addEventListener('click',()=>$('#app').classList.remove('side-open'));
  }

  /* ---- Boot entry (called by React) ---- */
  window.MobsieBoot=function(route){
    wireOnce();
    setRoute(route);
  };
})();
