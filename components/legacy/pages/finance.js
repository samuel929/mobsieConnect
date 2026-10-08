/* Mobsie Connect — Finance: Payments, Invoices, Statements, Discounts */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN, R=DB.fmtR, Rk=DB.fmtRk;

  /* ---------- Payments ---------- */
  Pages.payments={
    render(){
      const rows=App.scoped(DB.payments);
      const rs=DB.revSeries;
      const tbl=UI.table({
        pageSize:9, rows,
        onRow:p=>UI.drawer({
          title:'Payment '+p.id,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.status(p.status)} ${UI.badge(p.method,'blue')}</div>
            <div style="font-size:30px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em;margin-bottom:16px">${R(p.amount)}</div>
            ${UI.dl([['Parent',esc(p.parent)],['School',esc(p.school)],['Branch',esc(p.branch)],['Invoice',esc(p.ref)],['Date',esc(p.date)],['Method',esc(p.method)],['Gateway fee',R(Math.round(p.amount*0.029))]])}`,
          foot:`<button class="btn btn-ghost" id="payRcpt">${MCIcon('printer')} Receipt</button>${p.status==='Failed'?`<button class="btn btn-primary" id="payRetry">${MCIcon('refresh')} Retry Payment</button>`:''}`,
          mount(root,close){
            root.querySelector('#payRcpt').addEventListener('click',()=>UI.downloadCSV('receipt-'+p.id+'.csv',
              ['Reference','Parent','School','Amount (R)','Method','Date','Status'],
              [[p.id,p.parent,p.school,p.amount,p.method,p.date,p.status]]));
            const rt=root.querySelector('#payRetry');
            if(rt) rt.addEventListener('click',()=>{
              p.status='Successful';
              DB.log('Retried payment',p.id+' — '+R(p.amount),'ok');
              close();UI.toast('Payment retried successfully — '+R(p.amount)+' collected');App.refresh();
            });
          }
        }),
        columns:[
          {key:'id',label:'Reference'},
          {key:'parent',label:'Parent',render:r=>UI.personCell(r.parent,r.school)},
          {key:'amount',label:'Amount',num:true,render:r=>`<b>${R(r.amount)}</b>`},
          {key:'method',label:'Method'},
          {key:'date',label:'Date'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      Pages.payments._tid=UI.lastTableId();
      const methods=[['Card',46,'#EA580C'],['Debit Order',28,'#7C3AED'],['EFT',18,'#16A34A'],['Cash / other',8,'#2563EB']];
      return `
        ${UI.pageHead('Payments','Money moving through the platform in real time.',
          `<button class="btn btn-ghost" id="payExp">${MCIcon('download')} Export</button>
           <button class="btn btn-green" id="payNew">${MCIcon('plus')} Record Payment</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'payments',tint:'t-green',label:'Collected This Month',value:DB.fmtR(DB.totals.mrr),deltaHtml:UI.delta(9.7,'up','vs last month')})}
          ${UI.statCard({icon:'waiting',tint:'t-amber',label:'Pending Settlement',value:'R41,200',deltaHtml:`<span class="delta flat">clears in 1–2 days</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-red',label:'Failed Payments',value:'R9,850',deltaHtml:UI.delta(1.8,'down','improving')})}
          ${UI.statCard({icon:'creditUp',tint:'t-purple',label:'Success Rate',value:'96.8%',deltaHtml:UI.delta(0.4,'up','vs last month')})}
        </div>
        <div class="grid" style="grid-template-columns:1.7fr 1fr;margin-bottom:20px" id="payMid">
          ${UI.card('Collections this week',`
            ${UI.legend([{color:'#16A34A',label:'Collections',line:true}])}
            <div class="chart-box" style="margin-top:6px">${Charts.line({labels:rs.labels,series:[{name:'Collections',color:'#16A34A',data:rs.revenue.map(v=>Math.round(v/7))}],height:224})}</div>`)}
          ${UI.card('Payment methods',`
            ${methods.map(m=>`<div class="meter-row"><span class="m-lbl">${m[0]}</span><span class="meter"><i style="width:${m[1]}%;background:${m[2]}"></i></span><span class="m-val">${m[1]}%</span></div>`).join('')}
            <div class="divider"></div>
            <div class="small muted">Debit orders keep growing — <b style="color:var(--ink-900)">+6% this quarter</b>. Failed card retries recover <b style="color:var(--ink-900)">62%</b> automatically.</div>`,{sub:'Share of value · this month'})}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Recent payments</h3></div><span class="spacer"></span>
            <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="payQ" placeholder="Search payments…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
        </div>
        <style>@media(max-width:1100px){#payMid{grid-template-columns:1fr}}</style>`;
    },
    mount(root){
      root.querySelector('#payQ').addEventListener('input',e=>UI.tableFilter(Pages.payments._tid,e.target.value));
      root.querySelector('#payExp').addEventListener('click',()=>UI.downloadCSV('mobsie-payments.csv',
        ['Reference','Parent','School','Amount (R)','Method','Date','Status'],
        DB.payments.map(p=>[p.id,p.parent,p.school,p.amount,p.method,p.date,p.status])));
      root.querySelector('#payNew').addEventListener('click',()=>UI.modal({
        title:'Record Payment',
        body:`<div class="field"><label>Parent</label><select data-f="parent">${DB.parents.slice(0,20).map(p=>`<option>${esc(p.name)}</option>`).join('')}</select></div>
          <div class="form-row">
            <div class="field"><label>Amount (R)</label><input type="number" data-f="amount" placeholder="0.00"></div>
            <div class="field"><label>Method</label><select data-f="method"><option>Cash</option><option>EFT</option><option>Card</option><option>SnapScan</option></select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-green" data-s>Record Payment</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            const amt=Math.round(+v.amount||0);
            if(!amt){UI.toast('Enter an amount first','alert');return;}
            const par=DB.parents.find(p=>p.name===v.parent)||DB.parents[0];
            DB.payments.unshift({id:'PAY-'+(9033+DB.payments.length),parent:par.name,school:par.school,
              branch:par.branch,amount:amt,method:v.method,date:'May 18, 2026',status:'Successful',
              ref:'Manual capture'});
            if(par.balance) par.balance=Math.max(0,par.balance-amt);
            DB.log('Recorded payment',par.name+' — '+R(amt),'ok');
            close();UI.toast(R(amt)+' recorded against '+par.name);App.refresh();
          });
        }
      }));
    }
  };

  /* ---------- Invoices ---------- */
  Pages.invoices={
    render(){
      const rows=App.scoped(DB.invoices);
      const now=new Date();
      const validDate=(value)=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date;};
      const issuedThisMonth=rows.filter(invoice=>{
        const issued=validDate(invoice.issued);
        return issued&&issued.getFullYear()===now.getFullYear()&&issued.getMonth()===now.getMonth();
      });
      const paid=rows.filter(invoice=>String(invoice.status).toLowerCase()==='paid');
      const dueRows=rows.filter(invoice=>String(invoice.status).toLowerCase()==='due');
      const overdueRows=rows.filter(invoice=>String(invoice.status).toLowerCase()==='overdue');
      const paidRate=rows.length?Math.round((paid.length/rows.length)*100):0;
      const dueValue=dueRows.reduce((total,invoice)=>total+Number(invoice.amount||0),0);
      const overdueValue=overdueRows.reduce((total,invoice)=>total+Number(invoice.amount||0),0);
      const latestIssue=rows.map(invoice=>validDate(invoice.issued)).filter(Boolean).sort((a,b)=>b-a)[0];
      const tbl=UI.table({
        pageSize:9, rows,
        onRow:inv=>UI.drawer({
          title:inv.id,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.status(inv.status)}</div>
            <div style="font-size:30px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em;margin-bottom:16px">${R(inv.amount)}</div>
            ${UI.dl([['Billed to',esc(inv.parent)],['School',esc(inv.school)],['Description',esc(inv.desc)],['Issued',esc(inv.issued)],['Due',esc(inv.due)]])}
            <div class="divider"></div>
            <h4 style="margin-bottom:10px">Line items</h4>
            <table class="mc" style="min-width:0"><tbody>
              <tr><td>${esc(inv.desc)}</td><td class="num"><b>${R(inv.amount-120)}</b></td></tr>
              <tr><td>Mobsie app service fee</td><td class="num"><b>R120</b></td></tr>
              <tr><td class="cell-main">Total</td><td class="num cell-main">${R(inv.amount)}</td></tr>
            </tbody></table>`,
          foot:`<button class="btn btn-ghost" id="invPdf">${MCIcon('download')} PDF</button>
                <button class="btn btn-ghost" id="invResend">${MCIcon('campaigns')} Resend</button>
                ${inv.status!=='Paid'?`<button class="btn btn-green" id="invPaid">${MCIcon('check')} Mark Paid</button>`:''}`,
          mount(root,close){
            root.querySelector('#invPdf').addEventListener('click',()=>UI.downloadCSV(inv.id+'.csv',
              ['Invoice','Billed to','School','Description','Amount (R)','Issued','Due','Status'],
              [[inv.id,inv.parent,inv.school,inv.desc,inv.amount,inv.issued,inv.due,inv.status]]));
            root.querySelector('#invResend').addEventListener('click',()=>UI.toast('Invoice resent to '+inv.parent));
            const mp=root.querySelector('#invPaid');
            if(mp) mp.addEventListener('click',()=>{
              inv.status='Paid';
              DB.payments.unshift({id:'PAY-'+(9033+DB.payments.length),parent:inv.parent,school:inv.school,
                branch:inv.branch,amount:inv.amount,method:'EFT',date:'May 18, 2026',status:'Successful',ref:inv.id});
              DB.log('Marked invoice paid',inv.id+' — '+R(inv.amount),'ok');
              close();UI.toast(inv.id+' marked paid — receipt sent');App.refresh();
            });
          }
        }),
        columns:[
          {key:'id',label:'Invoice'},
          {key:'parent',label:'Billed to',render:r=>UI.personCell(r.parent,r.school)},
          {key:'desc',label:'Description'},
          {key:'amount',label:'Amount',num:true,render:r=>`<b>${R(r.amount)}</b>`},
          {key:'due',label:'Due date'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      Pages.invoices._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Invoices','Automated invoicing for every family, every month.',
          `<button class="btn btn-ghost" id="invRules">${MCIcon('settings')} Invoice Rules</button>
           <button class="btn btn-primary" id="invNew">${MCIcon('plus')} New Invoice</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'invoices',tint:'t-blue',label:'Issued This Month',value:F(issuedThisMonth.length),deltaHtml:`<span class="delta flat">${latestIssue?'last issued '+latestIssue.toLocaleDateString('en-ZA'):'no invoices issued'}</span>`})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Paid',value:paidRate+'%',deltaHtml:`<span class="delta flat">${F(paid.length)} of ${F(rows.length)} invoices</span>`})}
          ${UI.statCard({icon:'waiting',tint:'t-amber',label:'Due',value:F(dueRows.length),deltaHtml:`<span class="delta flat">value ${R(dueValue)}</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-red',label:'Overdue',value:F(overdueRows.length),deltaHtml:`<span class="delta flat">value ${R(overdueValue)}</span>`})}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>All invoices</h3></div><span class="spacer"></span>
            <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="invQ" placeholder="Search invoices…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
        </div>`;
    },
    mount(root){
      root.querySelector('#invQ').addEventListener('input',e=>UI.tableFilter(Pages.invoices._tid,e.target.value));
      root.querySelector('#invRules').addEventListener('click',()=>App.go('settings'));
      root.querySelector('#invNew').addEventListener('click',()=>UI.modal({
        title:'New Invoice',
        body:`<div class="field"><label>Bill to</label><select data-f="parent">${DB.parents.slice(0,20).map(p=>`<option>${esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Description</label><input type="text" data-f="desc" placeholder="e.g. Aftercare — June"></div>
          <div class="form-row">
            <div class="field"><label>Amount (R)</label><input type="number" data-f="amount" placeholder="0.00"></div>
            <div class="field"><label>Due date</label><input type="date" data-f="due" value="${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}"></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Issue Invoice</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            const amt=Math.round(+v.amount||0);
            if(!amt||!v.desc){UI.toast('Description and amount are required','alert');return;}
            const par=DB.parents.find(p=>p.name===v.parent)||DB.parents[0];
            const today=new Date();
            const dueDate=v.due?new Date(`${v.due}T12:00:00`):new Date(Date.now()+30*86400000);
            DB.invoices.unshift({id:'INV-'+String(Date.now()).slice(-8),parent:par.name,
              school:par.school,branch:par.branch,desc:v.desc,amount:amt,
              issued:today.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}),
              due:dueDate.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}),status:'Due'});
            DB.log('Issued invoice',par.name+' — '+R(amt),'info');
            close();UI.toast('Invoice issued and delivered to '+par.name+"'s app");App.refresh();
          });
        }
      }));
    }
  };

  /* ---------- Statements ---------- */
  Pages.statements={
    render(){
      const rows=DB.liveBranches().map((b,i)=>({
        school:b.name, period:'May 2026', invoiced:b.revenue, collected:Math.round(b.revenue*(0.86+(i%5)*0.015)),
        fees:Math.round(b.revenue*0.029), payout:0, status:i<2?'Paid':(i<3?'Processing':'Scheduled'),
      })).map(r=>({...r,payout:r.collected-r.fees}));
      const tbl=UI.table({
        pageSize:8, rows,
        onRow:st=>UI.drawer({
          title:'Statement — '+st.school,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.badge(st.period,'purple')} ${UI.status(st.status)}</div>
            ${UI.dl([['Invoiced',R(st.invoiced)],['Collected',R(st.collected)],['Platform & gateway fees','−'+R(st.fees)],['Net payout',`<b style="color:var(--green-600)">${R(st.payout)}</b>`],['Payout account','FNB ····8821'],['Payout date','1 Jun 2026']])}
            <div class="divider"></div>
            ${UI.meterRow('Collection rate',Math.round(st.collected/st.invoiced*100))}`,
          foot:`<button class="btn btn-ghost">${MCIcon('download')} Download PDF</button><button class="btn btn-primary">${MCIcon('campaigns')} Email to Owner</button>`
        }),
        columns:[
          {key:'school',label:'Campus',render:r=>`<span class="cell-main">${esc(r.school)}</span>`},
          {key:'period',label:'Period'},
          {key:'invoiced',label:'Invoiced',num:true,render:r=>R(r.invoiced)},
          {key:'collected',label:'Collected',num:true,render:r=>R(r.collected)},
          {key:'fees',label:'Fees',num:true,render:r=>'−'+R(r.fees)},
          {key:'payout',label:'Net payout',num:true,render:r=>`<b style="color:var(--green-600)">${R(r.payout)}</b>`},
          {key:'status',label:'Payout',render:r=>UI.status(r.status)},
        ],
      });
      return `
        ${UI.pageHead('Statements','Monthly campus statements and payout reconciliation.',
          `<button class="select">${MCIcon('calendar')} May 2026 ${MCIcon('chevDown')}</button>
           <button class="btn btn-primary" id="stDlAll">${MCIcon('download')} Download All</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'statements',tint:'t-purple',label:'Statements Generated',value:String(DB.liveBranches().length),deltaHtml:`<span class="delta flat">1 per campus · May</span>`})}
          ${UI.statCard({icon:'payments',tint:'t-green',label:'Total Collected',value:Rk(DB.totals.mrr*0.87),deltaHtml:UI.delta(9.1,'up','vs April')})}
          ${UI.statCard({icon:'wallet',tint:'t-blue',label:'Payouts Scheduled',value:Rk(DB.totals.mrr*0.84),deltaHtml:`<span class="delta flat">runs 1 Jun</span>`})}
          ${UI.statCard({icon:'discounts',tint:'t-amber',label:'Platform Fees',value:Rk(DB.totals.mrr*0.029),deltaHtml:`<span class="delta flat">2.9% blended</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Campus statements — May 2026</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#stDlAll').addEventListener('click',()=>UI.downloadCSV('mobsie-statements-may-2026.csv',
        ['Campus','Period','Invoiced (R)','Collected (R)','Fees (R)','Net payout (R)','Status'],
        DB.liveBranches().map((b,i)=>{
          const col=Math.round(b.revenue*(0.86+(i%5)*0.015)), fee=Math.round(b.revenue*0.029);
          return [b.name,'May 2026',b.revenue,col,fee,col-fee,i<2?'Paid':(i<3?'Processing':'Scheduled')];
        })));
    }
  };

  /* ---------- Discounts ---------- */
  Pages.discounts={
    render(){
      const tbl=UI.table({
        pageSize:8, rows:DB.discounts,
        columns:[
          {key:'code',label:'Code',render:r=>`<span class="badge t-orange" style="font-family:ui-monospace,monospace;font-weight:700">${r.code}</span>`},
          {key:'desc',label:'Description',render:r=>`<div class="cell-main">${esc(r.desc)}</div><div class="cell-sub">${esc(r.schools)}</div>`},
          {key:'type',label:'Benefit'},
          {key:'uses',label:'Uses',num:true,render:r=>`${F(r.uses)}<span class="muted"> / ${r.limit}</span>`},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
          {label:'',sortable:false,render:r=>`<button class="icon-btn" data-dmenu="${r.code}">${MCIcon('more')}</button>`},
        ],
      });
      return `
        ${UI.pageHead('Discounts','Sibling, staff and promotional discounts across the platform.',
          `<button class="btn btn-primary" id="newDisc">${MCIcon('plus')} Create Discount</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'discounts',tint:'t-orange',label:'Active Discounts',value:String(DB.discounts.filter(d=>d.status==='Active').length),deltaHtml:`<span class="delta flat">across all campuses</span>`})}
          ${UI.statCard({icon:'parents',tint:'t-purple',label:'Families Benefiting',value:F(DB.discounts.reduce((a,d)=>a+d.uses,0)),deltaHtml:UI.delta(6,'up','this term')})}
          ${UI.statCard({icon:'wallet',tint:'t-amber',label:'Value This Month',value:'R38,400',deltaHtml:`<span class="delta flat">2.1% of revenue</span>`})}
          ${UI.statCard({icon:'creditUp',tint:'t-green',label:'Retention Impact',value:'+3.8%',deltaHtml:`<span class="delta flat">discounted vs not</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Discount codes</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-dmenu]');
        if(!b) return;
        const d=DB.discounts.find(x=>x.code===b.dataset.dmenu);
        if(!d) return;
        UI.menu(b,[
          {icon:'copy',label:'Duplicate',onClick:()=>{
            DB.discounts.unshift({...d,code:d.code+'2',uses:0,status:'Scheduled'});
            DB.log('Duplicated discount',d.code,'info');
            UI.toast('Duplicated as '+d.code+'2');App.refresh();
          }},
          {icon:'pause',label:d.status==='Active'?'Pause':'Activate',onClick:()=>{
            d.status=d.status==='Active'?'Scheduled':'Active';
            UI.toast(d.code+(d.status==='Active'?' activated':' paused'));App.refresh();
          }},
          '-',
          {icon:'trash',label:'Delete',danger:true,onClick:()=>{
            DB.discounts.splice(DB.discounts.indexOf(d),1);
            DB.log('Deleted discount',d.code,'warn');
            UI.toast('Deleted '+d.code);App.refresh();
          }},
        ],{align:'right'});
      });
      root.querySelector('#newDisc').addEventListener('click',()=>UI.modal({
        title:'Create Discount',
        body:`<div class="form-row">
            <div class="field"><label>Code</label><input type="text" data-f="code" placeholder="e.g. SPRING10"></div>
            <div class="field"><label>Benefit</label><input type="text" data-f="type" placeholder="e.g. 10% off fees"></div>
          </div>
          <div class="field"><label>Description</label><input type="text" data-f="desc" placeholder="What is this discount for?"></div>
          <div class="form-row">
            <div class="field"><label>Applies to</label><select data-f="schools"><option>All schools</option><option>Selected schools</option><option>One school</option></select></div>
            <div class="field"><label>Usage limit</label><input type="text" data-f="limit" placeholder="Unlimited"></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Create Discount</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            if(!v.code){UI.toast('Give the discount a code first','alert');return;}
            DB.discounts.unshift({code:v.code.toUpperCase(),desc:v.desc||'Custom discount',
              type:v.type||'Custom benefit',uses:0,limit:v.limit||'Unlimited',status:'Active',schools:v.schools});
            DB.log('Created discount',v.code.toUpperCase(),'ok');
            close();UI.toast('Discount '+v.code.toUpperCase()+' created and live');App.refresh();
          });
        }
      }));
    }
  };
})();
