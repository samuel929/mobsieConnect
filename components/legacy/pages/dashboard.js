/* Mobsie Connect — Super Admin Executive Dashboard */
window.Pages=window.Pages||{};
(function(){
  const F=DB.fmtN, R=DB.fmtR;
  const asDate=value=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date:null;};
  const sameMonth=(date,offset=0)=>date&&date.getFullYear()===new Date(new Date().getFullYear(),new Date().getMonth()+offset,1).getFullYear()&&date.getMonth()===new Date(new Date().getFullYear(),new Date().getMonth()+offset,1).getMonth();
  const ago=value=>{const date=asDate(value);if(!date)return 'Date unavailable';const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));if(minutes<1)return 'Just now';if(minutes<60)return minutes+' min ago';const hours=Math.floor(minutes/60);if(hours<24)return hours+' hr'+(hours===1?'':'s')+' ago';const days=Math.floor(hours/24);return days+' day'+(days===1?'':'s')+' ago';};

  function render(){
    const t=DB.totals;
    const appTotal=DB.appCounts.reduce((a,b)=>a+b,0);
    const br=App.branchObj();
    const coming=DB.branches.filter(b=>b.status==='Coming Soon').length;
    const attendance=DB.safeNumber(DB.attendanceStats?.overall?.percentage);
    const learnerAdded=DB.safeNumber(DB.learnerStats?.addedThisMonth);
    const parentAdded=DB.safeNumber(DB.parentStats?.newThisMonth);
    const staffAdded=DB.safeNumber(DB.teamStats?.newThisMonth);
    const applicationsThisMonth=(DB.applications||[]).filter(application=>sameMonth(asDate(application.createdAt))).length;
    const hello=br?`Viewing <b>${UI.esc(br.name)}</b> — here's how this campus is doing.`:`Here's what's happening across your ${t.branches} campuses today.`;

    const stats=[
      {icon:'branches',tint:'t-green',label:'Campuses',value:F(t.branches),deltaHtml:`<span class="delta up">${MCIcon('trendUp')}${coming} <span class="vs">opening soon</span></span>`},
      {icon:'learners',tint:'t-purple',label:'Learners',value:F(t.students),deltaHtml:`<span class="delta ${learnerAdded?'up':'flat'}">${learnerAdded?MCIcon('trendUp'):''}${F(learnerAdded)} <span class="vs">added this month</span></span>`},
      {icon:'parents',tint:'t-blue',label:'Parents',value:F(t.parents),deltaHtml:`<span class="delta ${parentAdded?'up':'flat'}">${parentAdded?MCIcon('trendUp'):''}${F(parentAdded)} <span class="vs">joined this month</span></span>`},
      {icon:'teachers',tint:'t-teal',label:'Teachers',value:F(t.teachers),deltaHtml:`<span class="delta ${staffAdded?'up':'flat'}">${staffAdded?MCIcon('trendUp'):''}${F(staffAdded)} <span class="vs">added this month</span></span>`},
      {icon:'applications',tint:'t-amber',label:'New Applications',value:F(applicationsThisMonth),deltaHtml:`<span class="delta ${DB.counters.pendingReview?'up':'flat'}">${DB.counters.pendingReview?MCIcon('trendUp'):''}${DB.counters.pendingReview} <span class="vs">pending review</span></span>`},
      {icon:'attendance',tint:'t-orange',label:'Avg Attendance',value:attendance.toFixed(attendance%1?1:0)+'%',deltaHtml:`<span class="delta flat">${F(DB.attendanceStats?.overall?.entries)} <span class="vs">register entries this month</span></span>`},
    ];

    const completedPayments=(DB.payments||[]).filter(payment=>String(payment.status).toLowerCase()==='complete');
    const collectedThisMonth=completedPayments.filter(payment=>sameMonth(asDate(payment.paidAt||payment.createdAt))).reduce((sum,payment)=>sum+DB.safeNumber(payment.grossCents?payment.grossCents/100:payment.amount),0);
    const outstanding=(DB.invoices||[]).filter(invoice=>!['Paid','Cancelled'].includes(invoice.status)).reduce((sum,invoice)=>sum+DB.safeNumber(invoice.amount),0);
    const invoiced=(DB.invoices||[]).filter(invoice=>invoice.status!=='Cancelled').reduce((sum,invoice)=>sum+DB.safeNumber(invoice.amount),0);
    const paidInvoices=(DB.invoices||[]).filter(invoice=>invoice.status==='Paid').reduce((sum,invoice)=>sum+DB.safeNumber(invoice.amount),0);
    const collectionRate=invoiced?Math.round(paidInvoices/invoiced*100):0;
    const daySeries=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-index));return date;});
    const paymentForDay=date=>completedPayments.filter(payment=>{const paid=asDate(payment.paidAt||payment.createdAt);return paid&&paid.toDateString()===date.toDateString();}).reduce((sum,payment)=>sum+DB.safeNumber(payment.amount),0);
    const revenueValues=daySeries.map(paymentForDay);
    const cumulative=revenueValues.reduce((values,value,index)=>values.concat(value+(values[index-1]||0)),[]);
    const overview=UI.card('Platform Overview','', {
      right:`<button class="select" data-menu="period">This Month ${MCIcon('chevDown')}</button>`,
      cls:'ov-card'});
    // build overview body manually for KPI row + chart
    const overviewBody=`
      <div class="kpi-row">
        <div class="kpi"><div class="k-lbl">Payments Collected</div><div class="k-val">${R(collectedThisMonth)}</div><span class="delta flat">completed this month</span></div>
        <div class="kpi"><div class="k-lbl">Outstanding Invoices</div><div class="k-val">${R(outstanding)}</div><span class="delta flat">${F((DB.invoices||[]).filter(invoice=>!['Paid','Cancelled'].includes(invoice.status)).length)} open</span></div>
        <div class="kpi"><div class="k-lbl">Invoice Collection Rate</div><div class="k-val">${collectionRate}%</div><span class="delta flat">based on issued invoices</span></div>
        <div class="kpi"><div class="k-lbl">Registered Parents</div><div class="k-val">${F(t.parents)}</div><span class="delta flat">${DB.safeNumber(DB.parentStats?.appAdoptionPercent)}% with app notifications</span></div>
      </div>
      ${UI.legend([{color:'#EA580C',label:'Completed payments — last 7 days (cumulative)',line:true}])}
      <div class="chart-box" style="margin-top:8px">${Charts.line({labels:daySeries.map(date=>date.toLocaleDateString('en-ZA',{day:'numeric',month:'short'})),series:[
        {name:'Payments',color:'#EA580C',data:cumulative},
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
          const pc=(appTotal?DB.safeNumber(s.value)/appTotal*100:0).toFixed(1);
          return `<div class="dl-it"><span class="sw" style="background:${s.color}"></span><span>${s.label}<div class="dl-val">${s.value} (${pc}%)</div></span></div>`;
        }).join('')}</div>
      </div>`;

    const gradeAttendance=Array.isArray(DB.attendanceStats?.grades)?DB.attendanceStats.grades:[];
    const attBody=`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
        <div style="width:112px;flex-shrink:0">${Charts.ring({pct:attendance,size:118,thick:11})}</div>
        <div><div style="font-weight:700;color:var(--ink-900);font-size:14.5px">Average Attendance</div><span class="small muted">${F(DB.attendanceStats?.overall?.present)} present from ${F(DB.attendanceStats?.overall?.entries)} entries</span></div>
      </div>
      ${gradeAttendance.length?gradeAttendance.map(row=>UI.meterRow(row.grade,DB.safeNumber(row.percentage))).join(''):'<p class="small muted">No attendance registers have been captured this month.</p>'}`;

    const liveActivity=[];
    (DB.applications||[]).forEach(item=>liveActivity.push({at:item.submittedAt||item.createdAt,icon:'applications',tint:'t-orange',main:`New application received from <b>${UI.esc(item.parent||'Parent')}</b>`,sub:`${UI.esc(item.child||'Learner')} · ${UI.esc(item.branch||'Not assigned')}`}));
    completedPayments.forEach(item=>liveActivity.push({at:item.paidAt||item.createdAt,icon:'payments',tint:'t-green',main:`Payment received from <b>${UI.esc(item.parent||'Parent')}</b>`,sub:`${UI.esc(item.description||'Payment')} · ${R(item.amount)}`}));
    (DB.newsletters||[]).filter(item=>item.publishedAt).forEach(item=>liveActivity.push({at:item.publishedAt,icon:'newsletters',tint:'t-purple',main:`Newsletter <b>${UI.esc(item.title)}</b> sent`,sub:UI.esc(item.audience||'All campuses')}));
    (DB.dailyActivities||[]).forEach(item=>liveActivity.push({at:item.createdAt,icon:'homework',tint:'t-blue',main:`Daily activity <b>${UI.esc(item.title||'Activity')}</b> added`,sub:UI.esc(item.branchName||item.branch||'All campuses')}));
    liveActivity.sort((left,right)=>(asDate(right.at)?.getTime()||0)-(asDate(left.at)?.getTime()||0));
    const activityBody=liveActivity.length?`<div class="feed">${liveActivity.slice(0,5).map(a=>`
      <div class="feed-item"><span class="f-ic ${a.tint}">${MCIcon(a.icon)}</span>
      <div class="f-txt"><div class="f-main">${a.main}</div><div class="f-sub">${a.sub} · ${ago(a.at)}</div></div></div>`).join('')}</div>`:'<p class="small muted">No recent database activity found.</p>';

    const topCampuses=(typeof DB.liveBranches==='function'&&Array.isArray(DB.liveBranches())?DB.liveBranches():[]).map(branch=>{
      const rawAttendance=Number(branch?.attendance);
      return {...branch,attendance:Number.isFinite(rawAttendance)?Math.max(0,Math.min(100,rawAttendance)):0};
    }).sort((a,b)=>b.attendance-a.attendance);
    const topBody=`<div class="rank-list top-campus-list">${topCampuses.map((b,i)=>`
      <div class="rank-item top-campus-item"><span class="rk">${i+1}</span>
        <span class="r-txt"><div class="r-nm">${UI.esc(b.name)}</div><div class="r-sub">${UI.esc(b.city)}</div></span>
        <span class="meter"><i style="width:${b.attendance}%"></i></span>
        <span class="r-val">${Number.isInteger(b.attendance)?b.attendance:b.attendance.toFixed(1)}%</span></div>`).join('')}</div>`;

    const upcomingEvents=(DB.apiEvents||[]).filter(event=>{const date=asDate(event.startsAt);return date&&date>=new Date(new Date().setHours(0,0,0,0));}).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).slice(0,8).map(event=>{const date=new Date(event.startsAt);return {mo:date.toLocaleString('en',{month:'short'}).toUpperCase(),dy:String(date.getDate()),name:event.title,sub:event.branchName||event.audience||'All campuses',time:event.allDay?'All day':date.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}),tint:'t-orange'};});
    const evBody=upcomingEvents.length?`<div>${upcomingEvents.map(e=>`
      <div class="event-item"><span class="ev-date ${e.tint}"><span class="mo">${e.mo}</span><span class="dy">${e.dy}</span></span>
        <span class="e-txt"><div class="e-nm">${UI.esc(e.name)}</div><div class="e-sub">${UI.esc(e.sub)}</div></span>
        <span class="e-time">${e.time}</span></div>`).join('')}</div>`:'<p class="small muted">No upcoming calendar events.</p>';

    const apiHealth=DB.apiHealth||{};
    const health=`
      <div class="health-row"><span class="h-dot ${apiHealth.core?'ok':'warn'}"></span><span class="h-nm">Core dashboard APIs</span><span class="h-val">${apiHealth.core?'Connected':'Unavailable'}</span></div>
      <div class="health-row"><span class="h-dot ${apiHealth.attendance?'ok':'warn'}"></span><span class="h-nm">Attendance data</span><span class="h-val">${apiHealth.attendance?'Connected':'Unavailable'}</span></div>
      <div class="health-row"><span class="h-dot ${apiHealth.payments?'ok':'warn'}"></span><span class="h-nm">Payment records</span><span class="h-val">${apiHealth.payments?'Connected':'Unavailable'}</span></div>
      <div class="health-row"><span class="h-dot ${apiHealth.events?'ok':'warn'}"></span><span class="h-nm">Calendar events</span><span class="h-val">${apiHealth.events?'Connected':'Unavailable'}</span></div>
      <div class="health-row"><span class="h-dot ${apiHealth.successful===apiHealth.total?'ok':'warn'}"></span><span class="h-nm">Latest data sync</span><span class="h-val">${F(apiHealth.successful)} of ${F(apiHealth.total)} sources</span></div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('parents')}</span><div><div class="ms-val">${F(DB.parentStats?.appAdoptionPercent)}%</div><div class="ms-lbl">Parents with push tokens</div></div></div>
        <div class="mini-stat"><span class="ms-ic t-orange">${MCIcon('waiting')}</span><div><div class="ms-val">${F(DB.counters.pendingReview)}</div><div class="ms-lbl">Pending applications</div></div></div>
      </div>`;

    const learnerMonthly=Array.isArray(DB.learnerStats?.monthly)?DB.learnerStats.monthly:[];
    const growthLabels=learnerMonthly.map(item=>item.label);
    const learnerGrowth=learnerMonthly.map(item=>DB.safeNumber(item.total));
    const campusGrowth=growthLabels.map((label,index)=>{
      const cutoff=new Date();cutoff.setDate(1);cutoff.setHours(23,59,59,999);cutoff.setMonth(cutoff.getMonth()-(growthLabels.length-1-index)+1);cutoff.setDate(0);
      return DB.branches.filter(branch=>{const created=asDate(branch.createdAt);return created&&created<=cutoff;}).length;
    });
    const growthBody=`
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        ${UI.pills('growthPills',['Campuses','Learners'],0)}
        <span class="muted small" style="margin-left:auto">Last 6 months</span>
      </div>
      <div class="chart-box" id="growthChart">${growthLabels.length?Charts.bars({labels:growthLabels,series:[{name:'Campuses',color:'#EA580C',data:campusGrowth}],height:220,capLabels:true}):'<p class="small muted">No growth history is available yet.</p>'}</div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('payments')}</span><div><div class="ms-val">${R(collectedThisMonth)}</div><div class="ms-lbl">Collected this month</div></div></div>
        <div class="mini-stat"><span class="ms-ic t-blue">${MCIcon('learners')}</span><div><div class="ms-val">${F(learnerAdded)}</div><div class="ms-lbl">Learners added this month</div></div></div>
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
      ${UI.pageHead('Welcome back, '+UI.esc(window.MobsieSession?.name||'User')+'!',hello,`
        <button class="select" data-menu="range">${MCIcon('calendar')} ${new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})} ${MCIcon('chevDown')}</button>
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
        ${UI.card('System Health',health,{right:UI.badge(apiHealth.successful===apiHealth.total?'All data connected':'Partial data',apiHealth.successful===apiHealth.total?'green':'amber')})}
        ${UI.card('Expansion Pipeline',newest,{foot:`<button class="btn btn-ghost btn-block" data-go="schools">View Expansion Plans</button>`})}
      </div>
      <style>
        .top-campus-item{display:grid;grid-template-columns:30px minmax(135px,1fr) minmax(90px,1.15fr) 48px;align-items:center;column-gap:12px}
        .top-campus-item .r-txt{min-width:0;flex:none}
        .top-campus-item .meter{width:100%;min-width:0}
        .top-campus-item .r-val{width:auto;min-width:48px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        @media (max-width:1280px){#dashMid,#dashLow,#dashFoot{grid-template-columns:1fr 1fr}}
        @media (max-width:860px){#dashMid,#dashLow,#dashFoot{grid-template-columns:1fr}}
        @media (max-width:520px){.top-campus-item{grid-template-columns:30px minmax(110px,1fr) 48px}.top-campus-item .meter{display:none}}
      </style>`;
  }

  function mount(root){
    root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>App.go(b.dataset.go)));
    root.querySelectorAll('[data-menu="period"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,['This Week','This Month','This Quarter','This Year'].map((l,i)=>({label:l,checked:i===1,onClick:()=>UI.toast('Period set to '+l)})),{align:'right'});
    }));
    root.querySelectorAll('[data-menu="range"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,['Today','Last 7 days','This month','Last 30 days','This term','Custom range…'].map((l,i)=>({label:l,checked:i===2,onClick:()=>UI.toast('Date range: '+l)})),{align:'right'});
    }));
    root.querySelectorAll('[data-menu="export"]').forEach(b=>b.addEventListener('click',e=>{
      UI.menu(e.currentTarget,[
        {icon:'file',label:'Export as PDF',onClick:()=>window.print()},
        {icon:'reports',label:'Export as CSV',onClick:()=>UI.downloadCSV('mobsie-executive-summary.csv',
          ['Campus','Learners','Teachers','Applications','Attendance %','Status'],
          DB.branches.map(x=>[x.name,x.students,x.teachers,x.applications,x.attendance,x.status]))},
        {icon:'copy',label:'Copy share link',onClick:()=>UI.toast('Share link copied to clipboard')},
      ],{align:'right'});
    }));
    UI.bindPills('growthPills',i=>{
      const el=document.getElementById('growthChart');
      const monthly=Array.isArray(DB.learnerStats?.monthly)?DB.learnerStats.monthly:[];
      const labels=monthly.map(item=>item.label);
      const learners=monthly.map(item=>DB.safeNumber(item.total));
      const campuses=labels.map((label,index)=>{const cutoff=new Date();cutoff.setDate(1);cutoff.setHours(23,59,59,999);cutoff.setMonth(cutoff.getMonth()-(labels.length-1-index)+1);cutoff.setDate(0);return DB.branches.filter(branch=>{const date=asDate(branch.createdAt);return date&&date<=cutoff;}).length;});
      el.innerHTML=labels.length?(i===0
        ?Charts.bars({labels,series:[{name:'Campuses',color:'#EA580C',data:campuses}],height:220,capLabels:true})
        :Charts.bars({labels,series:[{name:'Learners',color:'#7C3AED',data:learners}],height:220,capLabels:true})):'<p class="small muted">No growth history is available yet.</p>';
    });
  }

  Pages.dashboard={render,mount};
})();
