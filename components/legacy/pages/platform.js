/* Mobsie Connect — Platform module: School profile (campuses) + Branch management */
window.Pages=window.Pages||{};
(function(){
  const F=DB.fmtN, Rk=DB.fmtRk, esc=UI.esc;
  const CAMPUS_HUES=['#F97316','#16A34A','#7C3AED','#2563EB','#0D9488','#DB2777','#D97706','#DC2626'];
  const hueOf=b=>CAMPUS_HUES[Math.max(0,DB.branches.indexOf(b))%CAMPUS_HUES.length];

  /* =============== OUR SCHOOL (campus overview) =============== */
  function campusCard(b){
    return `<div class="card school-card" data-campus="${b.id}">
      <div class="sc-top">
        <span class="school-logo" style="background:${hueOf(b)}">${DB.initials(b.name.replace(' Branch',''))}</span>
        <div style="min-width:0;flex:1">
          <div class="sc-nm">${esc(b.name)}</div>
          <div class="sc-owner">${esc(b.city)} · ${esc(b.region)}</div>
        </div>
        <button class="icon-btn" data-campus-menu="${b.id}">${MCIcon('more')}</button>
      </div>
      <div style="display:flex;gap:6px;padding:10px 18px 0;flex-wrap:wrap">
        ${UI.status(b.status)} ${UI.badge('Since '+b.since,'ink')}
      </div>
      <div class="sc-stats">
        <div class="sc-stat"><div class="n">${F(b.students)}</div><div class="l">Learners</div></div>
        <div class="sc-stat"><div class="n">${b.teachers}</div><div class="l">Teachers</div></div>
        <div class="sc-stat"><div class="n">${b.attendance}%</div><div class="l">Attendance</div></div>
        <div class="sc-stat"><div class="n">${Rk(b.revenue)}</div><div class="l">Fees /mo</div></div>
      </div>
      <div style="padding:0 18px 12px;display:flex;align-items:center;gap:10px">
        ${UI.avatar(b.principal,'sm')}<span class="small" style="font-weight:600;color:var(--ink-600)">${esc(b.principal)}</span>
        <span class="small muted" style="margin-left:auto">Principal</span>
      </div>
      <div class="sc-foot">
        <button class="btn btn-soft btn-sm" data-campus-view="${b.id}">${MCIcon('external')} View Dashboard</button>
        <span style="margin-left:auto" class="small muted">${esc(b.phone)}</span>
      </div>
    </div>`;
  }

  function expansionCard(b){
    return `<div class="card" style="border-style:dashed;background:var(--card-soft);padding:18px" data-exp="${b.id}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span class="school-logo" style="background:var(--ink-300)">${DB.initials(b.city)}</span>
        <div style="min-width:0;flex:1">
          <div class="sc-nm">${esc(b.name)}</div>
          <div class="sc-owner">${esc(b.city)} · ${esc(b.region)}</div>
        </div>
        ${UI.badge('Coming Soon','purple')}
      </div>
      <div class="divider" style="margin:14px 0 12px"></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="small muted">${esc(b.since)}</span>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-exp-track="${b.id}">${MCIcon('target')} Track Progress</button>
      </div>
    </div>`;
  }

  function renderSchools(){
    const s=DB.schools[0];
    const live=DB.liveBranches();
    const coming=DB.branches.filter(b=>b.status==='Coming Soon');
    return `
      ${UI.pageHead('Our School',esc(s.name)+' — '+live.length+' campuses across Pretoria and Johannesburg, and growing.',
        `<button class="btn btn-ghost" id="expCampuses">${MCIcon('download')} Export</button>
         <button class="btn btn-primary" id="addCampus">${MCIcon('plus')} Add Campus</button>`)}

      <div class="card" style="margin-bottom:22px"><div class="card-body" style="display:flex;gap:22px;flex-wrap:wrap;align-items:center">
        <span class="school-logo" style="background:${s.color};width:64px;height:64px;border-radius:18px;font-size:22px">${s.initials}</span>
        <div style="min-width:200px">
          <div style="font-size:18px;font-weight:800;color:var(--ink-900);letter-spacing:-.01em">${esc(s.name)}</div>
          <div class="small muted" style="margin-top:2px">${esc(s.owner)} · ${esc(s.ownerEmail)} · ${esc(s.phone)}</div>
          <div style="display:flex;gap:6px;margin-top:8px">${UI.badge(s.plan+' plan','purple')} ${UI.status(s.status)} ${UI.badge('Since '+s.joined,'ink')}</div>
        </div>
        <div style="flex:1"></div>
        <div class="grid" style="grid-template-columns:repeat(5,auto);gap:10px" id="schoolHeroStats">
          <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('branches')}</span><div><div class="ms-val">${live.length}</div><div class="ms-lbl">Campuses</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('learners')}</span><div><div class="ms-val">${F(DB.totals.students)}</div><div class="ms-lbl">Learners</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-blue">${MCIcon('parents')}</span><div><div class="ms-val">${F(DB.totals.parents)}</div><div class="ms-lbl">Parents</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-teal">${MCIcon('teachers')}</span><div><div class="ms-val">${DB.totals.teachers}</div><div class="ms-lbl">Teachers</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-orange">${MCIcon('payments')}</span><div><div class="ms-val">${Rk(DB.totals.mrr)}</div><div class="ms-lbl">Fees /mo</div></div></div>
        </div>
      </div></div>

      <h3 style="font-size:16px;margin-bottom:14px">Campuses <span class="muted" style="font-weight:550">(${live.length})</span></h3>
      <div class="grid cards-3" style="margin-bottom:26px">${live.map(campusCard).join('')}</div>

      <h3 style="font-size:16px;margin-bottom:6px">Expanding to <span class="muted" style="font-weight:550">(${coming.length})</span></h3>
      <p class="small muted" style="margin-bottom:14px">New campuses on the roadmap — Atteridgeville, Soweto and Thembisa.</p>
      <div class="grid cards-3">${coming.map(expansionCard).join('')}</div>
      <style>@media(max-width:1400px){#schoolHeroStats{grid-template-columns:repeat(3,auto)}}</style>`;
  }

  function mountSchools(root){
    bindCampusCards(root);
    root.querySelector('#addCampus').addEventListener('click',()=>addCampusModal());
    root.querySelector('#expCampuses').addEventListener('click',()=>UI.downloadCSV('mobsie-campuses.csv',
      ['Campus','City','Region','Principal','Status','Learners','Teachers','Attendance %','Fees (R/mo)'],
      DB.branches.map(b=>[b.name,b.city,b.region,b.principal,b.status,b.students,b.teachers,b.attendance,b.revenue])));
    root.addEventListener('click',e=>{
      const t=e.target.closest('[data-exp-track]');
      if(t){
        const b=DB.branches.find(x=>x.id===t.dataset.expTrack);
        UI.drawer({
          title:b.name+' — Expansion',
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.badge('Coming Soon','purple')} ${UI.badge(b.region,'ink')}</div>
            <h4 style="margin-bottom:10px">Readiness checklist</h4>
            ${UI.meterRow('Premises secured',b.city==='Atteridgeville'?80:40,'purple')}
            ${UI.meterRow('Registration & compliance',b.city==='Atteridgeville'?65:25,'purple')}
            ${UI.meterRow('Principal recruitment',b.city==='Atteridgeville'?50:10,'purple')}
            ${UI.meterRow('Fit-out & equipment',b.city==='Atteridgeville'?30:5,'purple')}
            ${UI.meterRow('Pre-enrolment interest',70,'orange')}
            <div class="divider"></div>
            <p class="small muted">Families in ${esc(b.city)} can already join the waiting list — interest is routed to this campus automatically when it opens.</p>`,
          foot:`<button class="btn btn-ghost" id="expWl">${MCIcon('waiting')} View Waiting List</button>
                <button class="btn btn-primary" id="expOpen">${MCIcon('check')} Mark as Open</button>`,
          mount(r,close){
            r.querySelector('#expWl').addEventListener('click',()=>{close();App.go('waiting-list');});
            r.querySelector('#expOpen').addEventListener('click',async()=>{
              try{
                await MobsieApi.mutate('/api/branches',{method:'PUT',body:JSON.stringify({id:b.id,status:'ACTIVE'})});
                b.status='Active';b.since='May 2026';
                DB.recount(); DB.save(); DB.log('Opened new campus',b.name,'ok');
                close();UI.toast(b.name+' is now active — congratulations! 🎉');App.refresh();
              }catch(error){UI.toast(error.message||'Could not update this campus','alert');}
            });
          }
        });
      }
    });
  }

  function bindCampusCards(host){
    host.querySelectorAll('[data-campus-view]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      const br=DB.branches.find(x=>x.id===b.dataset.campusView);
      App.ctx.school=DB.schools[0].id; App.ctx.branch=br.id;
      App.go('dashboard'); UI.toast('Now viewing '+br.name);
    }));
    host.querySelectorAll('[data-campus-menu]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      const br=DB.branches.find(x=>x.id===b.dataset.campusMenu);
      UI.menu(b,[
        {icon:'external',label:'View dashboard',onClick:()=>{App.ctx.school=DB.schools[0].id;App.ctx.branch=br.id;App.go('dashboard');}},
        {icon:'edit',label:'Edit campus',onClick:()=>editBranch(br)},
        {icon:'delete',label:'Delete campus',danger:true,onClick:()=>deleteBranch(br)},
        {icon:'attendance',label:'Attendance',onClick:()=>App.go('attendance')},
        {icon:'payments',label:'Finance',onClick:()=>App.go('payments')},
      ],{align:'right'});
    }));
    host.querySelectorAll('.school-card[data-campus]').forEach(c=>c.addEventListener('click',e=>{
      if(e.target.closest('button')) return;
      openBranch(DB.branches.find(x=>x.id===c.dataset.campus));
    }));
  }

  function addCampusModal(){
    UI.modal({
      title:'Add Campus',
      body:`
        <div class="form-row">
          <div class="field"><label>Campus name</label><input type="text" data-f="name" placeholder="e.g. Soweto Branch"></div>
          <div class="field"><label>City / area</label><input type="text" data-f="city" placeholder="e.g. Soweto"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Region</label><select data-f="region"><option>Pretoria</option><option>Johannesburg</option><option>Centurion</option><option>Ekurhuleni</option><option>Other</option></select></div>
          <div class="field"><label>Principal</label><input type="text" data-f="principal" placeholder="Full name or leave blank"></div>
        </div>
        <div class="field"><label>Address</label><input type="text" data-f="address" placeholder="Street address and postal code"></div>
        <div class="form-row">
          <div class="field"><label>Branch phone</label><input type="tel" data-f="phone" placeholder="012 555 0182"></div>
          <div class="field"><label>Branch email</label><input type="email" data-f="email" placeholder="branch@mobsie.co.za"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Principal email</label><input type="email" data-f="principalEmail" placeholder="principal@mobsie.co.za"></div>
          <div class="field"><label>Principal phone</label><input type="tel" data-f="principalPhone" placeholder="082 555 0182"></div>
        </div>
        <div class="field"><label>Branch image</label>
          <label class="file-picker">${MCIcon('upload')}<strong>Choose a branch image</strong><span data-file-name>PNG or JPG, up to 5 MB</span>
            <input type="file" data-f="image" accept="image/png,image/jpeg">
          </label>
        </div>`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Create Campus</button>`,
      mount(r,close){
        const imageInput=r.querySelector('[data-f="image"]');
        imageInput.addEventListener('change',()=>{
          r.querySelector('[data-file-name]').textContent=imageInput.files[0]?.name||'PNG or JPG, up to 5 MB';
        });
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const v=UI.formVals(r);
          const file=imageInput.files[0];
          if(!v.name||!v.city||!v.address||!v.phone||!v.email||!v.principal||!v.principalEmail||!v.principalPhone||!file){
            UI.toast('Complete every campus field and choose a branch image','alert');return;
          }
          if(file.size>5*1024*1024){UI.toast('Branch image must be smaller than 5 MB','alert');return;}
          try{
            const imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
            const created=await MobsieApi.mutate('/api/branches',{method:'POST',body:JSON.stringify({
              name:v.name,city:v.city,region:v.region,address:v.address,phone:v.phone,email:v.email,
              principalName:v.principal,principalEmail:v.principalEmail,principalPhone:v.principalPhone,status:'ACTIVE',imageData
            })});
            const apiBranch=created.data[0];
            DB.branches.push({id:apiBranch.id,schoolId:'sch-1',school:DB.SCHOOL_NAME,name:v.name,
            city:v.city||v.name.replace(/ Branch$/,''),region:v.region,
            principal:v.principal||'To be appointed',students:0,teachers:0,revenue:0,attendance:0,
            phone:v.phone,email:v.email,address:v.address,imageUrl:apiBranch.imageUrl,
            principalEmail:v.principalEmail,principalPhone:v.principalPhone,status:'Active',since:new Date().getFullYear().toString()});
            DB.log('Created campus',v.name,'ok');
            DB.recount(); DB.save();
            close();UI.toast('Campus saved to Neon — onboarding started');App.refresh();
          }catch(error){UI.toast(error.message,'alert');}
        });
      }
    });
  }

  Pages.schools={render:renderSchools,mount:mountSchools};

  /* =============== BRANCHES =============== */
  function editBranch(b){
    const apiStatus=b.status==='Coming Soon'?'COMING_SOON':b.status==='Active'?'ACTIVE':'INACTIVE';
    UI.modal({
      title:'Edit Campus',
      body:`
        <div class="campus-editor">
          <p class="campus-editor__intro">Keep this campus's contact details, leadership and mobile-app image up to date.</p>
          <section class="campus-editor__section">
            <div class="campus-editor__section-title">Campus details</div>
            <div class="campus-editor__grid">
              <div class="field"><label>Campus name</label><input type="text" data-f="name" value="${esc(b.name||'')}"></div>
              <div class="field"><label>City / area</label><input type="text" data-f="city" value="${esc(b.city||'')}"></div>
              <div class="field"><label>Region</label><select data-f="region">${['Pretoria','Johannesburg','Centurion','Ekurhuleni','Other'].map(x=>`<option ${b.region===x?'selected':''}>${x}</option>`).join('')}</select></div>
              <div class="field"><label>Status</label><select data-f="status"><option value="ACTIVE" ${apiStatus==='ACTIVE'?'selected':''}>Active</option><option value="COMING_SOON" ${apiStatus==='COMING_SOON'?'selected':''}>Coming soon</option><option value="INACTIVE" ${apiStatus==='INACTIVE'?'selected':''}>Inactive</option></select></div>
              <div class="field campus-editor__wide"><label>Street address</label><input type="text" data-f="address" value="${esc(b.address||'')}"></div>
              <div class="field"><label>Campus phone</label><input type="tel" data-f="phone" value="${esc(b.phone||'')}"></div>
              <div class="field"><label>Campus email</label><input type="email" data-f="email" value="${esc(b.email||'')}"></div>
            </div>
          </section>
          <section class="campus-editor__section">
            <div class="campus-editor__section-title">Principal contact</div>
            <div class="campus-editor__grid">
              <div class="field"><label>Principal name</label><input type="text" data-f="principal" value="${esc(b.principal||'')}"></div>
              <div class="field"><label>Principal phone</label><input type="tel" data-f="principalPhone" value="${esc(b.principalPhone||'')}"></div>
              <div class="field campus-editor__wide"><label>Principal email</label><input type="email" data-f="principalEmail" value="${esc(b.principalEmail||'')}"></div>
            </div>
          </section>
          <section class="campus-editor__section">
            <div class="campus-editor__section-title">Campus image</div>
            <div class="campus-image-picker">
              <div class="campus-image-preview" data-image-preview>${b.imageUrl?`<img src="${esc(b.imageUrl)}" alt="${esc(b.name)} campus">`:`<span>${MCIcon('upload')}</span>`}</div>
              <label class="campus-file-picker">${MCIcon('upload')}<span><strong>Upload a campus photo</strong><small data-file-name>PNG or JPG · up to 5 MB</small></span><em>Choose file</em><input type="file" data-f="image" accept="image/png,image/jpeg"></label>
            </div>
          </section>
        </div>`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Changes</button>`,
      mount(r,close){
        const imageInput=r.querySelector('[data-f="image"]');
        let previewUrl='';
        const preview=r.querySelector('[data-image-preview]');
        imageInput.addEventListener('change',()=>{
          const file=imageInput.files[0];
          if(previewUrl) URL.revokeObjectURL(previewUrl);
          previewUrl=file?URL.createObjectURL(file):'';
          r.querySelector('[data-file-name]').textContent=file?file.name:'PNG or JPG · up to 5 MB';
          preview.innerHTML=previewUrl?`<img src="${previewUrl}" alt="Selected campus image">`:(b.imageUrl?`<img src="${esc(b.imageUrl)}" alt="${esc(b.name)} campus">`:`<span>${MCIcon('upload')}</span>`);
        });
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const v=UI.formVals(r);
          const file=imageInput.files[0];
          if(file&&file.size>5*1024*1024){UI.toast('Branch image must be smaller than 5 MB','alert');return;}
          if(!v.name||!v.city||!v.region||!v.address||!v.phone||!v.email){UI.toast('Complete the required campus details','alert');return;}
          const button=r.querySelector('[data-s]');
          button.disabled=true;button.textContent='Saving…';
          try{
            const imageData=file?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}):undefined;
            const response=await MobsieApi.mutate('/api/branches',{method:'PUT',body:JSON.stringify({
              id:b.id,name:v.name,city:v.city,region:v.region,address:v.address,phone:v.phone,email:v.email,
              principalName:v.principal||undefined,principalEmail:v.principalEmail||undefined,
              principalPhone:v.principalPhone||undefined,status:v.status,imageData
            })});
            const saved=response.data[0];
            Object.assign(b,{name:saved.name,city:saved.city,region:saved.region,address:saved.address,phone:saved.phone,email:saved.email,
              principal:saved.principalName||'To be appointed',principalEmail:saved.principalEmail||v.principalEmail,
              principalPhone:saved.principalPhone||v.principalPhone,status:saved.status==='COMING_SOON'?'Coming Soon':saved.status==='ACTIVE'?'Active':'Inactive',imageUrl:saved.imageUrl});
            DB.log('Updated campus',b.name,'info');
            DB.recount(); DB.save();
            close();UI.toast('Campus and image saved');App.refresh();
          }catch(error){button.disabled=false;button.textContent='Save Changes';UI.toast(error.message,'alert');}
        });
      }
    });
  }

  function deleteBranch(b){
    UI.modal({
      title:'Delete Campus',
      body:`<p>Delete <b>${esc(b.name)}</b>? This only works when there are no learners or applications assigned to the campus.</p>`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-danger" data-s>Delete Campus</button>`,
      mount(r,close){
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const button=r.querySelector('[data-s]'); button.disabled=true; button.textContent='Deleting…';
          try{
            await MobsieApi.mutate('/api/branches?id='+encodeURIComponent(b.id),{method:'DELETE'});
            DB.branches=DB.branches.filter(branch=>branch.id!==b.id);
            DB.recount(); DB.save(); DB.log('Deleted campus',b.name,'alert');
            close();UI.toast('Campus deleted');App.refresh();
          }catch(error){
            button.disabled=false; button.textContent='Delete Campus';
            UI.toast(error.message||'This campus cannot be deleted','alert');
          }
        });
      }
    });
  }

  function openBranch(b){
    UI.drawer({
      title:b.name,
      headIcon:`<span class="s-ic t-green" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center">${MCIcon('branches')}</span>`,
      body:`
        ${b.imageUrl?`<img src="${esc(b.imageUrl)}" alt="${esc(b.name)}" style="width:100%;height:190px;object-fit:cover;border-radius:16px;margin-bottom:18px">`:''}
        <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">${UI.badge(b.region,'orange')} ${UI.status(b.status)} ${UI.badge('Since '+b.since,'ink')}</div>
        <div class="grid cards-4" style="gap:10px;margin-bottom:20px">
          <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('learners')}</span><div><div class="ms-val">${F(b.students)}</div><div class="ms-lbl">Learners</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-teal">${MCIcon('teachers')}</span><div><div class="ms-val">${b.teachers}</div><div class="ms-lbl">Teachers</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('payments')}</span><div><div class="ms-val">${Rk(b.revenue)}</div><div class="ms-lbl">Fees /mo</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-orange">${MCIcon('attendance')}</span><div><div class="ms-val">${b.attendance}%</div><div class="ms-lbl">Attendance</div></div></div>
        </div>
        <h4 style="margin-bottom:10px">Campus details</h4>
        ${UI.dl([['Principal',esc(b.principal)],['City',esc(b.city)],['Region',esc(b.region)],['Phone',esc(b.phone)]])}
        <div class="divider"></div>
        <h4 style="margin-bottom:6px">This campus includes</h4>
        <div class="tag-row" style="margin-top:8px">${['Gallery','Reports','Calendar','Communications','Attendance','Finance'].map(x=>UI.badge(x,'ink')).join('')}</div>`,
      foot:`<button class="btn btn-ghost" id="brDelete">${MCIcon('delete')} Delete</button>
            <button class="btn btn-ghost" id="brEdit">${MCIcon('edit')} Edit</button>
            <button class="btn btn-green" id="brOpen">${MCIcon('external')} Open Campus View</button>`,
      mount(root,close){
        root.querySelector('#brOpen').addEventListener('click',()=>{
          close(); App.ctx.school=b.schoolId; App.ctx.branch=b.id; App.go('dashboard');
          UI.toast('Now viewing '+b.name);
        });
        root.querySelector('#brEdit').addEventListener('click',()=>{close();editBranch(b);});
        root.querySelector('#brDelete').addEventListener('click',()=>{close();deleteBranch(b);});
      }
    });
  }

  function renderBranches(){
    const rows=DB.branches;
    const live=DB.liveBranches();
    const avgAtt=Math.round(live.reduce((a,b)=>a+b.attendance,0)/(live.length||1));
    const tbl=UI.table({
      pageSize:10,
      rows,
      onRow:openBranch,
      columns:[
        {key:'name',label:'Campus',render:r=>`<div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${esc(r.city)}</div>`},
        {key:'region',label:'Region'},
        {key:'principal',label:'Principal',render:r=>r.principal==='To be appointed'?`<span class="muted">To be appointed</span>`:UI.personCell(r.principal)},
        {key:'students',label:'Learners',num:true,render:r=>r.status==='Coming Soon'?'—':F(r.students)},
        {key:'teachers',label:'Teachers',num:true,render:r=>r.status==='Coming Soon'?'—':String(r.teachers)},
        {key:'revenue',label:'Fees /mo',num:true,render:r=>r.status==='Coming Soon'?'—':Rk(r.revenue)},
        {key:'attendance',label:'Attendance',render:r=>r.status==='Coming Soon'?'<span class="muted">—</span>':`<div style="display:flex;align-items:center;gap:10px;min-width:130px"><span class="meter"><i style="width:${r.attendance}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.attendance}%</b></div>`},
        {key:'status',label:'Status',render:r=>UI.status(r.status)},
      ],
    });
    Pages.branches._tid=UI.lastTableId();
    return `
      ${UI.pageHead('Branches','All '+live.length+' campuses in one view — plus the three on the way.',
        `<button class="btn btn-ghost" id="brExp">${MCIcon('download')} Export</button>
         <button class="btn btn-primary" id="addBranch">${MCIcon('plus')} Add Campus</button>`)}
      <div class="grid cards-4" style="margin-bottom:20px">
        ${UI.statCard({icon:'branches',tint:'t-green',label:'Live Campuses',value:F(live.length),deltaHtml:`<span class="delta flat">+${rows.length-live.length} opening soon</span>`})}
        ${UI.statCard({icon:'learners',tint:'t-purple',label:'Learners Across Campuses',value:F(live.reduce((a,b)=>a+b.students,0))})}
        ${UI.statCard({icon:'attendance',tint:'t-orange',label:'Average Attendance',value:avgAtt+'%',deltaHtml:UI.delta(1.8,'up','vs last month')})}
        ${UI.statCard({icon:'payments',tint:'t-blue',label:'Fees Across Campuses',value:Rk(live.reduce((a,b)=>a+b.revenue,0)),deltaHtml:`<span class="delta flat">per month</span>`})}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>All campuses</h3><div class="sub">Click a campus for its profile, principal and performance</div></div>
          <span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="brQ" placeholder="Search campuses…"></div></div>
        </div>
        <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
      </div>`;
  }

  Pages.branches={
    render:renderBranches,
    mount(root){
      root.querySelector('#brQ').addEventListener('input',e=>UI.tableFilter(Pages.branches._tid,e.target.value));
      root.querySelector('#addBranch').addEventListener('click',()=>addCampusModal());
      root.querySelector('#brExp').addEventListener('click',()=>UI.downloadCSV('mobsie-campuses.csv',
        ['Campus','City','Region','Principal','Status','Learners','Teachers','Attendance %','Fees (R/mo)'],
        DB.branches.map(b=>[b.name,b.city,b.region,b.principal,b.status,b.students,b.teachers,b.attendance,b.revenue])));
    }
  };
})();
