/* Mobsie Connect — Finance: Payments, Invoices, Statements, Discounts */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN, R=DB.fmtR, Rk=DB.fmtRk;

  /* ---------- Payments ---------- */
  Pages.payments={
    render(){
      const rows=App.scoped(DB.payments);
      const completed=rows.filter(p=>String(p.status).toLowerCase()==='complete');
      const pending=rows.filter(p=>['created','pending'].includes(String(p.status).toLowerCase()));
      const failed=rows.filter(p=>['failed','cancelled'].includes(String(p.status).toLowerCase()));
      const now=new Date();
      const thisMonth=completed.filter(p=>{const d=new Date(p.paidAt);return !Number.isNaN(d.getTime())&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
      const collected=thisMonth.reduce((sum,p)=>sum+Number(p.amount||0),0);
      const pendingValue=pending.reduce((sum,p)=>sum+Number(p.amount||0),0);
      const failedValue=failed.reduce((sum,p)=>sum+Number(p.amount||0),0);
      const settled=completed.length+failed.length;
      const successRate=settled?Math.round(completed.length/settled*1000)/10:0;
      const days=Array.from({length:7},(_,index)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-index));return d;});
      const dailyCollections=days.map(day=>completed.filter(p=>{const d=new Date(p.paidAt);return !Number.isNaN(d.getTime())&&d.toDateString()===day.toDateString();}).reduce((sum,p)=>sum+Number(p.amount||0),0));
      const methodTotals=completed.reduce((totals,p)=>{totals[p.method]=(totals[p.method]||0)+Number(p.amount||0);return totals;},{});
      const methodGrandTotal=Object.values(methodTotals).reduce((sum,value)=>sum+Number(value),0);
      const methodColors=['#EA580C','#7C3AED','#16A34A','#2563EB','#0D9488'];
      const methods=Object.entries(methodTotals).sort((a,b)=>b[1]-a[1]).map(([name,value],index)=>[name,methodGrandTotal?Math.round(Number(value)/methodGrandTotal*100):0,methodColors[index%methodColors.length]]);
      const tbl=UI.table({
        pageSize:9, rows,
        onRow:p=>UI.drawer({
          title:'Payment '+p.id,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.status(p.status)} ${UI.badge(p.method,'blue')}</div>
            <div style="font-size:30px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em;margin-bottom:16px">${R(p.amount)}</div>
            ${UI.dl([['Parent',esc(p.parent)],['Email',esc(p.payerEmail||'—')],['Child',esc(p.child||'—')],['Branch',esc(p.branch)],['Application',esc(p.ref)],['Paid',esc(p.date)],['Method',esc(p.method)],['PayFast fee',R(p.fee||0)],['Net settled',R(p.net||0)],['PayFast ID',esc(p.payFastPaymentId||'—')]])}`,
          foot:`<button class="btn btn-ghost" id="payRcpt">${MCIcon('download')} Export transaction</button>`,
          mount(root,close){
            root.querySelector('#payRcpt').addEventListener('click',()=>UI.downloadCSV('receipt-'+p.id+'.csv',
              ['PayFast ID','Merchant reference','Parent','Email','Child','Branch','Application','Gross (R)','Fee (R)','Net (R)','Method','Date','Status'],
              [[p.payFastPaymentId,p.merchantPaymentId,p.parent,p.payerEmail,p.child,p.branch,p.ref,p.amount,p.fee,p.net,p.method,p.date,p.status]]));
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
      return `
        ${UI.pageHead('Payments','Money moving through the platform in real time.',
          `<button class="btn btn-ghost" id="payExp">${MCIcon('download')} Export</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'payments',tint:'t-green',label:'Collected This Month',value:R(collected),deltaHtml:`<span class="delta flat">${F(thisMonth.length)} verified PayFast payments</span>`})}
          ${UI.statCard({icon:'waiting',tint:'t-amber',label:'Awaiting Payment',value:R(pendingValue),deltaHtml:`<span class="delta flat">${F(pending.length)} initiated payments</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-red',label:'Failed / Cancelled',value:R(failedValue),deltaHtml:`<span class="delta flat">${F(failed.length)} transactions</span>`})}
          ${UI.statCard({icon:'creditUp',tint:'t-purple',label:'Success Rate',value:successRate+'%',deltaHtml:`<span class="delta flat">verified outcomes</span>`})}
        </div>
        <div class="grid" style="grid-template-columns:1.7fr 1fr;margin-bottom:20px" id="payMid">
          ${UI.card('Collections this week',`
            ${UI.legend([{color:'#16A34A',label:'Collections',line:true}])}
            <div class="chart-box" style="margin-top:6px">${Charts.line({labels:days.map(d=>d.toLocaleDateString('en-ZA',{weekday:'short'})),series:[{name:'Collections',color:'#16A34A',data:dailyCollections}],height:224})}</div>`)}
          ${UI.card('Payment methods',`
            ${methods.length?methods.map(m=>`<div class="meter-row"><span class="m-lbl">${esc(m[0])}</span><span class="meter"><i style="width:${m[1]}%;background:${m[2]}"></i></span><span class="m-val">${m[1]}%</span></div>`).join(''):'<div class="empty-state">No completed PayFast payments yet.</div>'}
            <div class="divider"></div>
            <div class="small muted">Based only on payment methods reported by verified PayFast transactions.</div>`,{sub:'Share of completed payment value'})}
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
        ['PayFast ID','Merchant reference','Parent','Email','Child','Branch','Application','Gross (R)','Fee (R)','Net (R)','Method','Date','Status'],
        DB.payments.map(p=>[p.payFastPaymentId,p.merchantPaymentId,p.parent,p.payerEmail,p.child,p.branch,p.ref,p.amount,p.fee,p.net,p.method,p.date,p.status])));
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
          `<button class="btn btn-primary" id="invNew">${MCIcon('plus')} New Invoice</button>`)}
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
      const now=new Date();
      const periodKey=now.toISOString().slice(0,7);
      const period=now.toLocaleDateString('en-ZA',{month:'long',year:'numeric'});
      const rows=DB.liveBranches().map((b)=>{
        const same=(row)=>String(row.branch||row.school||'').toLowerCase()===String(b.name).toLowerCase();
        const invoices=(DB.invoices||[]).filter(same);
        const payments=(DB.payments||[]).filter(same).filter(p=>['successful','paid','complete'].includes(String(p.status||'').toLowerCase()));
        const invoiced=invoices.reduce((sum,row)=>sum+Number(row.amount||0),0);
        const collected=payments.reduce((sum,row)=>sum+Number(row.amount||0),0);
        return {branchId:b.id,school:b.name,period,periodKey,invoiced,collected,outstanding:Math.max(0,invoiced-collected),invoiceCount:invoices.length,paymentCount:payments.length};
      });
      const totalInvoiced=rows.reduce((sum,row)=>sum+row.invoiced,0),totalCollected=rows.reduce((sum,row)=>sum+row.collected,0);
      const tbl=UI.table({
        pageSize:8, rows,
        onRow:st=>UI.drawer({
          title:'Statement — '+st.school,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.badge(st.period,'purple')}</div>
            ${UI.dl([['Invoices',F(st.invoiceCount)],['Successful payments',F(st.paymentCount)],['Invoiced',R(st.invoiced)],['Collected',R(st.collected)],['Outstanding',`<b style="color:${st.outstanding?'var(--red-600)':'var(--green-600)'}">${R(st.outstanding)}</b>`]])}
            <div class="divider"></div>
            ${UI.meterRow('Collection rate',st.invoiced?Math.round(st.collected/st.invoiced*100):0)}`,
          foot:`<a class="btn btn-primary" href="/api/statements/pdf?branch=${encodeURIComponent(st.branchId)}&period=${encodeURIComponent(st.periodKey)}">${MCIcon('download')} Download PDF</a>`
        }),
        columns:[
          {key:'school',label:'Campus',render:r=>`<span class="cell-main">${esc(r.school)}</span>`},
          {key:'period',label:'Period'},
          {key:'invoiced',label:'Invoiced',num:true,render:r=>R(r.invoiced)},
          {key:'collected',label:'Collected',num:true,render:r=>R(r.collected)},
          {key:'outstanding',label:'Outstanding',num:true,render:r=>`<b style="color:${r.outstanding?'var(--red-600)':'var(--green-600)'}">${R(r.outstanding)}</b>`},
          {label:'PDF',sortable:false,render:r=>`<a class="icon-btn" href="/api/statements/pdf?branch=${encodeURIComponent(r.branchId)}&period=${encodeURIComponent(r.periodKey)}" title="Download PDF">${MCIcon('download')}</a>`},
        ],
      });
      return `
        ${UI.pageHead('Statements','Monthly campus statements and payout reconciliation.',
          `<span class="select">${MCIcon('calendar')} ${esc(period)}</span>
           <a class="btn btn-primary" href="/api/statements/pdf?period=${encodeURIComponent(periodKey)}">${MCIcon('download')} Download All PDF</a>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'statements',tint:'t-purple',label:'Campus Statements',value:String(rows.length),deltaHtml:`<span class="delta flat">${esc(period)}</span>`})}
          ${UI.statCard({icon:'invoices',tint:'t-blue',label:'Total Invoiced',value:Rk(totalInvoiced),deltaHtml:`<span class="delta flat">${F((DB.invoices||[]).length)} invoices</span>`})}
          ${UI.statCard({icon:'payments',tint:'t-green',label:'Total Collected',value:Rk(totalCollected),deltaHtml:`<span class="delta flat">successful payments</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-amber',label:'Outstanding',value:Rk(Math.max(0,totalInvoiced-totalCollected)),deltaHtml:`<span class="delta flat">current records</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Campus statements — ${esc(period)}</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(){}
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
