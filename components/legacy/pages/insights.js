/* Mobsie Connect — Analytics + Documents */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN, Rk=DB.fmtRk;

  Pages.analytics={
    render(){
      const gs=DB.growthSeries;
      const months=gs.labels;
      const engagement=[62,64,67,71,74,78];
      const retention=[97.2,96.8,96.9,96.1,96.4,96.4];
      const leaderboard=DB.liveBranches().map((b,i)=>({
        name:b.name,city:b.city,students:b.students,growth:(9-i*1.4).toFixed(1),
        engagement:92-i*3,revenue:b.revenue}));
      const tbl=UI.table({
        pageSize:8, rows:leaderboard,
        columns:[
          {key:'name',label:'Campus',render:r=>`<div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${esc(r.city)}</div>`},
          {key:'students',label:'Learners',num:true,render:r=>F(r.students)},
          {key:'growth',label:'Growth',num:true,render:r=>`<span class="delta up">${MCIcon('trendUp')}${r.growth}%</span>`},
          {key:'engagement',label:'Engagement',render:r=>`<div style="display:flex;align-items:center;gap:10px;min-width:130px"><span class="meter purple"><i style="width:${r.engagement}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.engagement}%</b></div>`},
          {key:'revenue',label:'Fees /mo',num:true,render:r=>Rk(r.revenue)},
        ],
      });
      return `
        ${UI.pageHead('Analytics','School intelligence — growth, engagement, retention and fees.',
          `<button class="select">${MCIcon('calendar')} Last 6 months ${MCIcon('chevDown')}</button>
           <button class="btn btn-purple" id="anExp">${MCIcon('download')} Export Insights</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'trendUp',tint:'t-green',label:'Campus Growth',value:'+2',deltaHtml:`<span class="delta flat">campuses · 18 months</span>`,spark:Charts.spark(gs.schools,'#16A34A')})}
          ${UI.statCard({icon:'zap',tint:'t-purple',label:'Engagement Score',value:'78',deltaHtml:UI.delta(4,'up','vs April'),spark:Charts.spark(engagement,'#7C3AED')})}
          ${UI.statCard({icon:'heart',tint:'t-blue',label:'Family Retention',value:'96.4%',deltaHtml:UI.delta(0.3,'down','churn watch'),spark:Charts.spark(retention,'#2563EB')})}
          ${UI.statCard({icon:'creditUp',tint:'t-orange',label:'Fees Run-rate /yr',value:Rk(DB.totals.mrr*12),deltaHtml:UI.delta(11,'up','vs Q1'),spark:Charts.spark([16,17,18,19,20.5,22.4],'#EA580C')})}
        </div>
        <div class="grid cards-2" style="margin-bottom:20px">
          ${UI.card('Campus growth',`
            ${UI.legend([{color:'#EA580C',label:'Campuses open',line:true}])}
            <div class="chart-box" style="margin-top:6px">${Charts.line({labels:months,series:[{name:'Campuses',color:'#EA580C',data:gs.schools,fmt:v=>F(v)}],height:224,money:false})}</div>`)}
          ${UI.card('Learner growth',`
            ${UI.legend([{color:'#7C3AED',label:'Enrolled learners',line:true}])}
            <div class="chart-box" style="margin-top:6px">${Charts.line({labels:months,series:[{name:'Learners',color:'#7C3AED',data:gs.students,fmt:v=>F(v)}],height:224,money:false})}</div>`)}
        </div>
        <div class="grid cards-2" style="margin-bottom:20px">
          ${UI.card('Monthly fee collections',`<div class="chart-box">${Charts.bars({labels:months,series:[{name:'Collections',color:'#16A34A',data:[1.52e6,1.58e6,1.66e6,1.72e6,1.79e6,1.87e6]}],height:224,money:true})}</div>`,{sub:'Fees processed through Mobsie Pay'})}
          ${UI.card('Parent app engagement',`
            ${UI.meterRow('Daily active parents',68,'purple')}
            ${UI.meterRow('Weekly active parents',91,'purple')}
            ${UI.meterRow('Messages read < 1 hour',84)}
            ${UI.meterRow('Gallery views / album',76,'orange')}
            ${UI.meterRow('Learning acknowledged',78,'blue')}
            <div class="divider"></div>
            <div class="small muted">Engagement is strongest on <b style="color:var(--ink-900)">Fridays</b> when galleries and newsletters land.</div>`)}
        </div>
        <div class="card"><div class="card-head"><div><h3>Campus performance leaderboard</h3><div class="sub">Composite of growth, engagement, attendance and payments</div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#anExp').addEventListener('click',()=>UI.downloadCSV('mobsie-analytics.csv',
        ['Campus','Learners','Growth %','Engagement %','Fees (R/mo)'],
        DB.liveBranches().map((b,i)=>[b.name,b.students,(9-i*1.4).toFixed(1),92-i*3,b.revenue])));
    }
  };

  Pages.documents={
    render(){
      const folderNames=[...new Set(['Policies','Compliance','HR','Finance','Safety','Academics',...(DB.docFolders||[]).map(f=>f.name),...DB.documentsList.map(d=>d.folder)].filter(Boolean))];
      const folders=folderNames.map((name,index)=>({name,count:DB.documentsList.filter(d=>d.folder===name).length,tint:['t-blue','t-purple','t-green','t-orange','t-red','t-teal'][index%6]}));
      DB.docFolders=folders;
      const tbl=UI.table({
        pageSize:8, rows:DB.documentsList,
        onRow:d=>UI.drawer({
          title:d.name,
          body:`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${UI.badge(d.folder,'blue')} ${UI.badge(d.shared||'All campuses','ink')}</div>
            ${UI.dl([['File size',esc(d.size||'—')],['File type',esc(d.mimeType||'Document')],['Uploaded by',esc(d.by||'Unknown')],['Uploaded',esc(d.date||'—')],['Campus',esc(d.branchName||'All campuses')]])}
            ${d.url?`<div class="divider"></div><div style="border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center"><span class="s-ic t-blue" style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;margin:0 auto 10px">${MCIcon('file')}</span><div class="small muted">This document is stored securely in Cloudinary.</div></div>`:''}`,
          foot:d.url?`<a class="btn btn-primary" href="${esc(d.url)}" target="_blank" rel="noopener">${MCIcon('eye')} View document</a><a class="btn btn-ghost" href="${esc(d.url)}" download>${MCIcon('download')} Download</a>`:''
        }),
        columns:[
          {key:'name',label:'Document',render:r=>`<div class="person-cell"><span class="f-ic t-blue" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center">${MCIcon('file')}</span><div class="pc-txt"><div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${r.size}</div></div></div>`},
          {key:'folder',label:'Folder',render:r=>UI.badge(r.folder,'ink')},
          {key:'by',label:'Owner',render:r=>UI.personCell(r.by)},
          {key:'shared',label:'Shared with'},
          {key:'date',label:'Updated'},
          {label:'',sortable:false,render:r=>r.url?`<a class="btn btn-ghost btn-sm" href="${esc(r.url)}" target="_blank" rel="noopener" title="View document">${MCIcon('eye')} View</a>`:''},
        ],
      });
      Pages.documents._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Documents','Central document hub — share policies and packs to any campus or role.',
          `<button class="btn btn-ghost" id="docFolder">${MCIcon('plus')} New Folder</button>
           <button class="btn btn-primary" id="docUp">${MCIcon('upload')} Upload</button>`)}
        <div class="grid cards-6" style="margin-bottom:20px">${folders.map(f=>`
          <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;cursor:pointer">
            <span class="s-ic ${f.tint}" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center">${MCIcon('documents')}</span>
            <div><div style="font-weight:700;color:var(--ink-900)">${f.name}</div>
            <div class="small muted">${f.count} files</div></div>
          </div>`).join('')}</div>
        <div class="card"><div class="card-head"><div><h3>All documents</h3></div><span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="dQ" placeholder="Search documents…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#dQ').addEventListener('input',e=>UI.tableFilter(Pages.documents._tid,e.target.value));
      root.querySelector('#docFolder').addEventListener('click',()=>UI.modal({
        title:'New Folder',
        body:`<div class="field"><label>Folder name</label><input type="text" data-f="name" placeholder="e.g. Menus"></div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Create Folder</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            if(!v.name){UI.toast('Name the folder first','alert');return;}
            if(!DB.docFolders.some(folder=>folder.name.toLowerCase()===v.name.toLowerCase())) DB.docFolders.push({name:v.name,count:0,tint:'t-teal'});
            close();UI.toast('Folder created');App.refresh();
          });
        }
      }));
      root.querySelector('#docUp').addEventListener('click',()=>UI.modal({
        title:'Upload Document',
        body:`<div class="field"><label>Document file</label><label class="file-picker">${MCIcon('upload')}<strong>Choose a document</strong><span data-file-name>PDF, PNG or JPG, up to 8 MB</span><input type="file" data-f="file" accept="application/pdf,image/png,image/jpeg"></label></div>
          <div class="form-row">
            <div class="field"><label>Folder</label><select data-f="folder">${DB.docFolders.map(f=>`<option>${esc(f.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Share with</label><select data-f="shared"><option>All campuses</option><option>Principals</option><option>All teachers</option><option>Head Office</option></select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${MCIcon('upload')} Upload</button>`,
        mount(r,close){
          const fileInput=r.querySelector('[data-f="file"]');
          fileInput.addEventListener('change',()=>{r.querySelector('[data-file-name]').textContent=fileInput.files[0]?.name||'PDF, PNG or JPG, up to 8 MB';});
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            const file=fileInput.files[0];
            if(!file){UI.toast('Choose a document first','alert');return;}
            if(file.size>8*1024*1024){UI.toast('Documents must be smaller than 8 MB','alert');return;}
            try{
              const fileData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
              const response=await MobsieApi.mutate('/api/uploads',{method:'POST',body:JSON.stringify({fileData,originalName:file.name,purpose:'documents'})});
              const saved=await MobsieApi.mutate('/api/documents',{method:'POST',body:JSON.stringify({
                name:file.name,folder:v.folder,sharedWith:v.shared,fileUrl:response.data.url,
                publicId:response.data.publicId,mimeType:file.type,bytes:file.size
              })});
              const document=saved.data?.[0];
              DB.documentsList.unshift({id:document.id,name:document.name,folder:document.folder,size:(Number(document.bytes)/1024/1024).toFixed(1)+' MB',
                bytes:Number(document.bytes),mimeType:document.mimeType,by:document.ownerName,date:new Date(document.createdAt).toLocaleDateString('en-ZA'),shared:document.sharedWith,
                url:document.fileUrl,publicId:document.publicId,branchId:document.branchId||'',branchName:document.branchName||''});
              DB.log('Uploaded document',file.name,'ok');
              close();UI.toast(file.name+' saved to Cloudinary and Neon');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };
})();
