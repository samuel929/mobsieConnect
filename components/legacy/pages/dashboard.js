/* Mobsie Connect — Super Admin Executive Dashboard */
window.Pages=window.Pages||{};
(function(){
  const F=DB.fmtN, R=DB.fmtR;

  function render(){
    const t=DB.totals;
    const appTotal=DB.appCounts.reduce((a,b)=>a+b,0);
    const br=App.branchObj();
    const coming=DB.branches.filter(b=>b.status==='Coming Soon').length;
    const hello=br?`Viewing <b>${UI.esc(br.name)}</b> — here's how this campus is doing.`:`Here's what's happening across your ${t.branches} campuses today.`;

    const stats=[
      {icon:'branches',tint:'t-green',label:'Campuses',value:F(t.branches),deltaHtml:`<span class="delta up">${MCIcon('trendUp')}${coming} <span class="vs">opening soon</span></span>`},
      {icon:'learners',tint:'t-purple',label:'Learners',value:F(t.students),deltaHtml:UI.delta(0,'up','this month').replace('0%','42')},
      {icon:'parents',tint:'t-blue',label:'Parents',value:F(t.parents),deltaHtml:UI.delta(0,'up','this month').replace('0%','31')},
      {icon:'teachers',tint:'t-teal',label:'Teachers',value:F(t.teachers),deltaHtml:UI.delta(0,'up','this month').replace('0%','4')},
      {icon:'applications',tint:'t-amber',label:'New Applications',value:F(appTotal),deltaHtml:`<span class="delta up">${MCIcon('trendUp')}${DB.counters.pendingReview} <span class="vs">pending review</span></span>`},
      {icon:'attendance',tint:'t-orange',label:'Avg Attendance',value:'92%',deltaHtml:UI.delta(4.3,'up','vs last month')},
    ];

    const rs=DB.revSeries;
    const overview=UI.card('Platform Overview','', {
      right:`<button class="select" data-menu="period">This Month ${MCIcon('chevDown')}</button>`,
      cls:'ov-card'});
    // build overview body manually for KPI row + chart
    const overviewBody=`
      <div class="kpi-row">
        <div class="kpi"><div class="k-lbl">Fees Collected</div><div class="k-val">${DB.fmtR(t.mrr)}</div>${UI.delta(9.7,'up','vs last month')}</div>
        <div class="kpi"><div class="k-lbl">Outstanding Fees</div><div class="k-val">R84,300</div>${UI.delta(4.2,'down','improving')}</div>
        <div class="kpi"><div class="k-lbl">Collection Rate</div><div class="k-val">91%</div>${UI.delta(2.1,'up','vs last month')}</div>
        <div class="kpi"><div class="k-lbl">Active App Users</div><div class="k-val">812</div>${UI.delta(8.7,'up','vs last month')}</div>
      </div>
      ${UI.legend([{color:'#EA580C',label:'This month (cumulative)',line:true},{color:'#16A34A',label:'Last month',line:true}])}
      <div class="chart-box" style="margin-top:8px">${Charts.line({labels:rs.labels,series:[
        {name:'This month',color:'#EA580C',data:rs.revenue},
        {name:'Last month',color:'#16A34A',data:rs.mrr,area:false},
      ],height:252})}</div>`;

    const appSegs=[
      {label:'Pending Review',value:DB.appCounts[0],color:'#F97316'},
      {label:'Documents Required',value:DB.appCounts[1],color:'#F5C445'},
      {label:'Interview Scheduled',value:DB.appCounts[2],color:'#0D9488'},
      {label:'Approved',value:DB.appCounts[3],color:'#16A34A'},
      {label:'Rejected',value:DB.appCounts[4],color:'#DC2626'},
    ];
    const appBody=`
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <div class="chart-box" style="width:172px;flex-shrink:0">${Charts.donut({segments:appSegs,size:200,thick:32,centre:String(appTotal),centreSub:'Total'})}</div>
        <div class="donut-legend" style="flex:1;min-width:150px">${appSegs.map(s=>{
          const pc=(s.value/appTotal*100).toFixed(1);
          return `<div class="dl-it"><span class="sw" style="background:${s.color}"></span><span>${s.label}<div class="dl-val">${s.value} (${pc}%)</div></span></div>`;
        }).join('')}</div>
      </div>`;

    const attBody=`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
        <div style="width:112px;flex-shrink:0">${Charts.ring({pct:92,size:118,thick:11})}</div>
        <div><div style="font-weight:700;color:var(--ink-900);font-size:14.5px">Average Attendance</div>${UI.delta(4.3,'up','vs last month')}</div>
      </div>
      ${UI.meterRow('Playgroup',93)}${UI.meterRow('Nursery',91)}${UI.meterRow('Grade R',92)}${UI.meterRow('Grade 1',91)}${UI.meterRow('Grade 2',90)}`;

    const activityBody=`<div class="feed">${DB.activity.map(a=>`
      <div class="feed-item"><span class="f-ic ${a.tint}">${MCIcon(a.icon)}</span>
      <div class="f-txt"><div class="f-main">${a.main}</div><div class="f-sub">${a.sub}</div></div></div>`).join('')}</div>`;

    const topBody=`<div class="rank-list">${[...DB.liveBranches()].sort((a,b)=>b.attendance-a.attendance).map((b,i)=>`
      <div class="rank-item"><span class="rk">${i+1}</span>
        <span class="r-txt"><div class="r-nm">${UI.esc(b.name)}</div><div class="r-sub">${UI.esc(b.city)}</div></span>
        <span class="meter" style="flex:1"><i style="width:${b.attendance}%"></i></span>
        <span class="r-val">${b.attendance}%</span></div>`).join('')}</div>`;

    const evBody=`<div>${DB.events.map(e=>`
      <div class="event-item"><span class="ev-date ${e.tint}"><span class="mo">${e.mo}</span><span class="dy">${e.dy}</span></span>
        <span class="e-txt"><div class="e-nm">${UI.esc(e.name)}</div><div class="e-sub">${UI.esc(e.sub)}</div></span>
        ${e.people?UI.avStack(Array.from({length:Math.min(3,e.people)},(_,i)=>DB.FIRST[(i*7+e.dy.length)%DB.FIRST.length]+' '+DB.LAST[(i*5+2)%DB.LAST.length]),2).replace('+1','+'+e.people):''}
        <span class="e-time">${e.time}</span></div>`).join('')}</div>`;

    const health=`
      <div class="health-row"><span class="h-dot ok"></span><span class="h-nm">API Platform</span><span class="h-val">99.98% uptime</span></div>
      <div class="health-row"><span class="h-dot ok"></span><span class="h-nm">Parent Mobile App</span><span class="h-val">99.95% uptime</span></div>
      <div class="health-row"><span class="h-dot ok"></span><span class="h-nm">Payment Gateway</span><span class="h-val">142 ms avg</span></div>
      <div class="health-row"><span class="h-dot warn"></span><span class="h-nm">SMS Delivery</span><span class="h-val">Degraded — 1 carrier</span></div>
      <div class="health-row"><span class="h-dot ok"></span><span class="h-nm">Database Backups</span><span class="h-val">Last: 02:00 · 1m 42s</span></div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('download')}</span><div><div class="ms-val">1,240</div><div class="ms-lbl">App downloads</div></div></div>
        <div class="mini-stat"><span class="ms-ic t-orange">${MCIcon('waiting')}</span><div><div class="ms-val">9</div><div class="ms-lbl">Pending approvals</div></div></div>
      </div>`;

    const gs=DB.growthSeries;
    const growthBody=`
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        ${UI.pills('growthPills',['Campuses','Learners'],0)}
        <span class="muted small" style="margin-left:auto">Last 6 months</span>
      </div>
      <div class="chart-box" id="growthChart">${Charts.bars({labels:gs.labels,series:[{name:'Campuses',color:'#EA580C',data:gs.schools}],height:220,capLabels:true})}</div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('creditUp')}</span><div><div class="ms-val">${DB.fmtRk(t.mrr*12)}</div><div class="ms-lbl">Fees run-rate /yr</div></div></div>
        <div class="mini-stat"><span class="ms-ic t-blue">${MCIcon('heart')}</span><div><div class="ms-val">96.4%</div><div class="ms-lbl">Family retention</div></div></div>
      </div>`;

    const expansion=DB.branches.filter(b=>b.status==='Coming Soon');
    const newest=`<div class="feed">${expansion.map(b=>`
      <div class="feed-item"><span class="school-logo" style="width:36px;height:36px;border-radius:11px;font-size:12px;background:var(--ink-300)">${DB.initials(b.city)}</span>
      <div class="f-txt"><div class="f-main"><b>${UI.esc(b.name)}</b></div><div class="f-sub">${UI.esc(b.city)} · ${UI.esc(b.region)} · ${UI.esc(b.since)}</div></div>
      <span style="margin-left:auto;align-self:center">${UI.badge('Coming Soon','purple')}</span></div>`).join('')||
      `<p class="small muted">No campuses in the pipeline right now.</p>`}
      <div class="divider"></div>
      <p class="small muted">Families in these areas can already join the waiting list — interest routes to the new campus automatically on opening day.</p>`;

    return `
      ${UI.pageHead('Welcome back, Thandi!',hello,`
        <button class="select" data-menu="range">${MCIcon('calendar')} May 12 – May 18, 2026 ${MCIcon('chevDown')}</button>
        <button class="btn btn-purple" data-menu="export">${MCIcon('download')} Export Report ${MCIcon('chevDown')}</button>`,'👋')}
      <div class="grid cards-6" style="margin-bottom:20px">${stats.map(UI.statCard).join('')}</div>
      <div class="grid" style="grid-template-columns:1.85fr 1fr 1fr;margin-bottom:20px" id="dashMid">
        <div class="card">${'<div class="card-head"><div><h3>School Overview</h3></div><span class="spacer"></span><button class="select" data-menu="period">This Month '+MCIcon('chevDown')+'</button></div>'}<div class="card-body">${overviewBody}</div></div>
        ${UI.card('Application Status',appBody,{foot:`<button class="btn btn-ghost btn-block" data-go="applications">View All Applications</button>`})}
        ${UI.card('Attendance Overview',attBody,{right:`<button class="select" data-menu="period">This Month ${MCIcon('chevDown')}</button>`,foot:`<button class="btn btn-outline-purple btn-block" data-go="attendance">View Attendance Report</button>`})}
      </div>
      <div class="grid" style="grid-template-columns:1.15fr 1fr 1fr;margin-bottom:20px" id="dashLow">
        ${UI.card('Recent Activity',activityBody,{foot:`<button class="btn btn-ghost btn-block" data-go="audit">View All Activity</button>`})}
        ${UI.card('Top Performing Campuses',topBody,{right:`<button class="select" data-menu="period">This Month ${MCIcon('chevDown')}</button>`,foot:`<button class="btn btn-ghost btn-block" data-go="schools">View Our School</button>`})}
        ${UI.card('Upcoming Events',evBody,{right:`<button class="btn btn-ghost btn-sm" data-go="calendar">View Calendar</button>`})}
      </div>
      <div class="grid" style="grid-template-columns:1.15fr 1fr 1fr" id="dashFoot">
        ${UI.card('School Growth',growthBody)}
        ${UI.card('System Health',health,{right:UI.badge('All systems go','green')})}
        ${UI.card('Expansion Pipeline',newest,{foot:`<button class="btn btn-ghost btn-block" data-go="schools">View Expansion Plans</button>`})}
      </div>
      <style>
        @media (max-width:1280px){#dashMid,#dashLow,#dashFoot{grid-template-columns:1fr 1fr}}
        @media (max-width:860px){#dashMid,#dashLow,#dashFoot{grid-template-columns:1fr}}
      </style>`;
  }

  function mount(root){
    root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>App.go(b.dataset.go)));
    root.querySelectorAll('[data-menu="period"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,['This Week','This Month','This Quarter','This Year'].map((l,i)=>({label:l,checked:i===1,onClick:()=>UI.toast('Period set to '+l)})),{align:'right'});
    }));
    root.querySelectorAll('[data-menu="range"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,['Today','Last 7 days','May 12 – May 18, 2026','Last 30 days','This term','Custom range…'].map((l,i)=>({label:l,checked:i===2,onClick:()=>UI.toast('Date range: '+l)})),{align:'right'});
    }));
    root.querySelectorAll('[data-menu="export"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,[
        {icon:'file',label:'Export as PDF',onClick:()=>window.print()},
        {icon:'reports',label:'Export as CSV',onClick:()=>UI.downloadCSV('mobsie-executive-summary.csv',
          ['Campus','Learners','Teachers','Attendance %','Fees (R/mo)','Status'],
          DB.branches.map(x=>[x.name,x.students,x.teachers,x.attendance,x.revenue,x.status]))},
        {icon:'copy',label:'Copy share link',onClick:()=>UI.toast('Share link copied to clipboard')},
      ],{align:'right'});
    }));
    const gs=DB.growthSeries;
    UI.bindPills('growthPills',i=>{
      const el=document.getElementById('growthChart');
      el.innerHTML=i===0
        ?Charts.bars({labels:gs.labels,series:[{name:'Campuses',color:'#EA580C',data:gs.schools}],height:220,capLabels:true})
        :Charts.bars({labels:gs.labels,series:[{name:'Learners',color:'#7C3AED',data:gs.students}],height:220,capLabels:true});
    });
  }

  Pages.dashboard={render,mount};
})();
