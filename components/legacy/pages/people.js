/* Mobsie Connect — People: Learners, Parents, Teachers */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN, R=DB.fmtR;

  /* ---------- Learners ---------- */
  function openLearner(l){
    const profile=l.onboardingProfile||{};
    UI.drawer({
      title:'Learner Profile',
      body:`<div class="learner-profile">
        <div class="learner-profile__hero">${UI.avatar(l.name,'xl')}
          <div class="learner-profile__identity"><h3>${esc(l.name)}</h3><p>${esc(l.grade)} ${esc(l.cls)} · ${esc(l.branch||l.school)}</p></div>
          <span class="learner-profile__status">${UI.status(l.status)}</span></div>
        <div class="learner-profile__stats">
          <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('attendance')}</span><div><div class="ms-val">${l.attendance}%</div><div class="ms-lbl">Attendance</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('school')}</span><div><div class="ms-val">${esc(l.grade)}</div><div class="ms-lbl">Stage / grade</div></div></div>
          <div class="mini-stat"><span class="ms-ic ${l.fees==='Paid'?'t-green':'t-red'}">${MCIcon('payments')}</span><div><div class="ms-val">${l.fees}</div><div class="ms-lbl">Fees status</div></div></div>
        </div>
        <section class="learner-profile__section"><h4>School placement</h4>${UI.dl([['Age',l.age+' years'],['Parent / guardian',esc(l.parent)],['School',esc(l.school)],['Campus',esc(l.branch)],['Class',esc(l.grade)+' '+esc(l.cls)]])}</section>
        ${Object.keys(profile).length?`<section class="learner-profile__section"><h4>Onboarding information</h4>${UI.dl([
          ['Date of birth',esc(l.dateOfBirth||'—')],['Gender',esc(profile.childGender||'—')],['Guardian email',esc(profile.parentEmail||'—')],['Guardian phone',esc(profile.parentPhone||'—')],
          ['Relationship',esc(profile.relationship||'—')],['Preferred start',esc(profile.preferredStartDate||'—')],['Enrollment',esc(String(profile.enrollmentType||'—').replace('_',' '))],
          ['Aftercare',profile.aftercareRequested?'Requested':'No'],['Disability disclosed',profile.childHasDisability?'Yes':'No'],['Disability details',esc(profile.disabilityDetails||'—')],
          ['Allergies / medical',esc(profile.allergies||'None disclosed')],['Emergency contact',esc(`${profile.emergencyContactName||'—'} · ${profile.emergencyContactPhone||'—'}`)]
        ])}</section>`:''}
      </div>`,
      foot:`<button class="btn btn-ghost" data-edit>${MCIcon('edit')} Edit</button>
            <button class="btn btn-ghost" data-delete>${MCIcon('delete')} Delete</button>
            <button class="btn btn-primary" data-go="reports">${MCIcon('reports')} View Full Report</button>`,
      mount(root,close){
        root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{close();App.go(b.dataset.go);}));
        root.querySelector('[data-edit]').addEventListener('click',()=>{close();editLearner(l);});
        root.querySelector('[data-delete]').addEventListener('click',()=>{close();deleteLearner(l);});
      }
    });
  }

  function editLearner(l){
    UI.modal({title:'Edit Learner',body:`<div class="people-edit-form">
        <p class="people-edit-form__intro">Keep the learner's school placement and guardian details current.</p>
        <div class="people-edit-form__section">
          <div class="people-edit-form__section-title">Learner profile</div>
          <div class="people-edit-form__grid">
            <div class="field people-edit-form__wide"><label>Child's full name</label><input class="people-edit-control" data-f="name" autocomplete="name" value="${esc(l.name)}"></div>
            <div class="field"><label>Campus</label><select class="people-edit-control" data-f="branch">${DB.liveBranches().map(b=>`<option ${b.name===l.branch?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Stage / class</label><input class="people-edit-control" data-f="grade" value="${esc(l.grade)}"></div>
            <div class="field"><label>Class section</label><input class="people-edit-control" data-f="cls" value="${esc(l.cls||'A')}"></div>
            <div class="field"><label>Parent / guardian</label><input class="people-edit-control" data-f="parent" autocomplete="name" value="${esc(l.parent)}"></div>
          </div>
        </div>
      </div>`,
      foot:`<div class="people-edit-actions"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Changes</button></div>`,mount(r,close){
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const v=UI.formVals(r),branch=DB.branches.find(b=>b.name===v.branch);
          if(!v.name||!branch?.id||!v.grade||!v.parent){UI.toast('Complete the learner details','alert');return;}
          try{await MobsieApi.mutate('/api/students',{method:'PUT',body:JSON.stringify({id:l.id,branchId:branch.id,name:v.name,grade:v.grade,className:v.cls||'A',parentName:v.parent,attendanceRate:Number(l.attendance)||0,enrollmentStatus:'ENROLLED'})});
            Object.assign(l,{name:v.name,branch:v.branch,grade:v.grade,cls:v.cls||'A',parent:v.parent});DB.recount();DB.save();close();UI.toast('Learner changes saved to Neon.');App.refresh();
          }catch(error){UI.toast(error.message||'Could not update learner','alert');}
        });
      }});
  }
  async function deleteLearner(l){
    if(!confirm(`Delete ${l.name}? This cannot be undone.`))return;
    try{await MobsieApi.mutate('/api/students?id='+encodeURIComponent(l.id),{method:'DELETE'});DB.learners=DB.learners.filter(item=>item.id!==l.id);const branch=DB.branches.find(item=>item.name===l.branch);if(branch)branch.students=Math.max(0,(branch.students||1)-1);DB.recount();DB.save();UI.toast('Learner deleted.');App.refresh();}catch(error){UI.toast(error.message||'Could not delete learner','alert');}
  }

  Pages.learners={
    render(){
      const rows=App.scoped(DB.learners);
      const stats=DB.learnerStats||{totalLearners:rows.length,activeLearners:rows.filter(l=>['Enrolled','Active'].includes(l.status)).length,addedThisMonth:0,activePercentage:0};
      const attendance=DB.attendanceStats?.overall||{entries:0,present:0,percentage:0};
      const parentNames=new Set(rows.map(learner=>String(learner.parent||'').trim().toLowerCase()).filter(Boolean));
      const linkedInvoices=(DB.invoices||[]).filter(invoice=>parentNames.has(String(invoice.parent||'').trim().toLowerCase()));
      const paidInvoices=linkedInvoices.filter(invoice=>String(invoice.status).toLowerCase()==='paid');
      const feeRate=linkedInvoices.length?Math.round(100*paidInvoices.length/linkedInvoices.length):null;
      const feeStatus=(learner)=>{
        const invoices=(DB.invoices||[]).filter(invoice=>String(invoice.parent||'').trim().toLowerCase()===String(learner.parent||'').trim().toLowerCase());
        if(!invoices.length)return 'Not available';
        if(invoices.some(invoice=>String(invoice.status).toLowerCase()==='overdue'))return 'Overdue';
        if(invoices.some(invoice=>String(invoice.status).toLowerCase()==='due'))return 'Due';
        return 'Paid';
      };
      const tbl=UI.table({
        pageSize:10, rows, onRow:openLearner,
        columns:[
          {key:'name',label:'Learner',render:r=>UI.personCell(r.name,r.age+' yrs')},
          {key:'branch',label:'Campus'},
          {key:'grade',label:'Class',render:r=>`${esc(r.grade)} ${esc(r.cls)}`},
          {key:'parent',label:'Parent'},
          {key:'attendance',label:'Attendance',render:r=>`<div style="display:flex;align-items:center;gap:10px;min-width:120px"><span class="meter"><i style="width:${r.attendance}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.attendance}%</b></div>`},
          {key:'fees',label:'Fees',render:r=>{const status=feeStatus(r);return status==='Not available'?UI.badge(status,'ink'):UI.status(status);}},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      Pages.learners._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Learners','Every enrolled child across your campuses — profiles, attendance and fees at a glance.',
          `<button class="btn btn-ghost" id="lImport">${MCIcon('upload')} Bulk Import</button>
           <button class="btn btn-primary" id="lEnrol">${MCIcon('plus')} Enrol Learner</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'learners',tint:'t-purple',label:'Total Learners',value:F(Number(stats.totalLearners||0)),deltaHtml:`<span class="delta flat">${F(Number(stats.addedThisMonth||0))} added this month</span>`})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Enrolled & Active',value:Number(stats.activePercentage||0).toFixed(1).replace('.0','')+'%',deltaHtml:`<span class="delta flat">${F(Number(stats.activeLearners||0))} active learners</span>`})}
          ${UI.statCard({icon:'attendance',tint:'t-orange',label:'Avg Attendance',value:attendance.entries?Number(attendance.percentage||0).toFixed(1).replace('.0','')+'%':'—',deltaHtml:`<span class="delta flat">${attendance.entries?F(Number(attendance.entries))+' entries this month':'no attendance captured'}</span>`})}
          ${UI.statCard({icon:'payments',tint:'t-blue',label:'Fees Collected',value:feeRate===null?'—':feeRate+'%',deltaHtml:`<span class="delta flat">${linkedInvoices.length?F(paidInvoices.length)+' of '+F(linkedInvoices.length)+' invoices paid':'no linked invoices'}</span>`})}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Learner directory</h3><div class="sub">Click a learner to open their full profile</div></div>
            <span class="spacer"></span>
            <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="lQ" placeholder="Search learners…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
        </div>`;
    },
    mount(root){
      root.querySelector('#lQ').addEventListener('input',e=>UI.tableFilter(Pages.learners._tid,e.target.value));
      root.querySelector('#lImport').addEventListener('click',()=>{
        UI.downloadCSV('mobsie-learner-import-template.csv',
          ['Child name','Age','Campus','Class','Parent / guardian','Parent email','Parent phone'],
          []);
        UI.toast('Learner import template downloaded');
      });
      root.querySelector('#lEnrol').addEventListener('click',()=>UI.modal({
        title:'Enrol Learner',
        body:`<div class="people-edit-form learner-enrol-form">
          <p class="people-edit-form__intro">Add a learner using the same complete information collected during mobile onboarding.</p>
          <div class="people-edit-form__section"><div class="people-edit-form__section-title">Learner details</div>
          <div class="form-row"><div class="field"><label>Child's full name</label><input data-f="name" placeholder="Full name"></div><div class="field"><label>Date of birth</label><input type="date" data-f="dateOfBirth"></div></div>
          <div class="form-row"><div class="field"><label>Gender</label><select data-f="childGender"><option value="BOY">Boy</option><option value="GIRL">Girl</option><option value="OTHER">Other</option></select></div><div class="field"><label>Disability to disclose?</label><select data-f="childHasDisability"><option value="false">No</option><option value="true">Yes</option></select></div></div>
          <div class="field"><label>Disability details</label><textarea data-f="disabilityDetails" placeholder="Optional details and support requirements"></textarea></div></div>
          <div class="people-edit-form__section"><div class="people-edit-form__section-title">School placement</div>
          <div class="form-row"><div class="field"><label>Campus</label><select data-f="branch">${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div><div class="field"><label>Stage / grade</label><select data-f="grade">${DB.GRADES.map(g=>`<option>${g}</option>`).join('')}</select></div></div>
          <div class="form-row"><div class="field"><label>Class</label><input data-f="className" value="A"></div><div class="field"><label>Preferred start date</label><input type="date" data-f="preferredStartDate"></div></div>
          <div class="form-row"><div class="field"><label>Enrollment</label><select data-f="enrollmentType"><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option></select></div><div class="field"><label>Aftercare</label><select data-f="aftercareRequested"><option value="false">Not requested</option><option value="true">Requested</option></select></div></div>
          <div class="form-row"><div class="field"><label>Previous school</label><input data-f="previousSchool"></div><div class="field"><label>Previous school phone</label><input type="tel" data-f="previousSchoolPhone"></div></div>
          <div class="form-row"><div class="field"><label>Attended preschool?</label><select data-f="attendedPreschool"><option value="true">Yes</option><option value="false">No</option></select></div><div class="field"><label>How did they hear about us?</label><select data-f="referralSource"><option value="SOCIAL_MEDIA">Social media</option><option value="WORD_OF_MOUTH">Word of mouth</option><option value="RADIO">Radio</option><option value="OTHER">Other</option></select></div></div>
          <div class="field"><label>Allergies / medical notes</label><textarea data-f="allergies" placeholder="Enter allergies or leave blank"></textarea></div></div>
          <div class="people-edit-form__section"><div class="people-edit-form__section-title">Parent / guardian</div>
          <div class="form-row"><div class="field"><label>Full name</label><input data-f="parentName"></div><div class="field"><label>Relationship</label><select data-f="relationship"><option>Mother</option><option>Father</option><option>Guardian</option><option>Other</option></select></div></div>
          <div class="form-row"><div class="field"><label>Email</label><input type="email" data-f="parentEmail"></div><div class="field"><label>Mobile number</label><input type="tel" data-f="parentPhone"></div></div></div>
          <div class="people-edit-form__section"><div class="people-edit-form__section-title">Emergency contact and fee payer</div>
          <div class="form-row"><div class="field"><label>Emergency contact</label><input data-f="emergencyContactName"></div><div class="field"><label>Emergency phone</label><input type="tel" data-f="emergencyContactPhone"></div></div>
          <div class="form-row"><div class="field"><label>Fee payer first name</label><input data-f="feePayerFirstName"></div><div class="field"><label>Fee payer last name</label><input data-f="feePayerLastName"></div></div></div>
        </div>`,
        foot:`<div class="people-edit-actions"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Enrol Learner</button></div>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.name||!v.dateOfBirth||!v.parentName||!v.parentEmail||!v.parentPhone||!v.preferredStartDate||!v.emergencyContactName||!v.emergencyContactPhone||!v.feePayerFirstName||!v.feePayerLastName){UI.toast('Complete all required learner and guardian fields','alert');return;}
            const branch=DB.branches.find(x=>x.name===v.branch);
            if(!branch?.id){UI.toast('Select a valid campus first','alert');return;}
            const age=Math.max(0,Math.floor((Date.now()-new Date(v.dateOfBirth).getTime())/31557600000));
            const button=r.querySelector('[data-s]'); button.disabled=true;
            button.textContent='Enrolling…';
            try{
              const created=await MobsieApi.mutate('/api/students',{method:'POST',body:JSON.stringify({
                branchId:branch.id,name:v.name,dateOfBirth:v.dateOfBirth,grade:v.grade,
                className:v.className||'A',parentName:v.parentName,attendanceRate:0,enrollmentStatus:'ENROLLED',
                onboardingProfile:{childGender:v.childGender,childHasDisability:v.childHasDisability==='true',disabilityDetails:v.disabilityDetails,
                  parentEmail:v.parentEmail,parentPhone:v.parentPhone,relationship:v.relationship,preferredStartDate:v.preferredStartDate,
                  enrollmentType:v.enrollmentType,aftercareRequested:v.aftercareRequested==='true',previousSchool:v.previousSchool,
                  previousSchoolPhone:v.previousSchoolPhone,referralSource:v.referralSource,attendedPreschool:v.attendedPreschool==='true',
                  allergies:v.allergies,emergencyContactName:v.emergencyContactName,emergencyContactPhone:v.emergencyContactPhone,
                  feePayerFirstName:v.feePayerFirstName,feePayerLastName:v.feePayerLastName}
              })});
              const learner=created.data?.[0];
              DB.learners.unshift({id:learner?.id||'l-'+Date.now(),name:v.name,school:DB.SCHOOL_NAME,schoolId:'sch-1',
                branch:v.branch,grade:v.grade,cls:v.className||'A',parent:v.parentName,dateOfBirth:v.dateOfBirth,age,attendance:0,fees:'Not available',status:'Enrolled',onboardingProfile:learner?.onboardingProfile||{}});
              branch.students=(branch.students||0)+1;
              DB.recount(); DB.save();
              DB.log('Enrolled learner',v.name+' — '+v.branch,'ok');
              close();UI.toast(v.name+' enrolled at '+v.branch+' 🎉');App.refresh();
            }catch(error){
              button.disabled=false; button.textContent='Enrol Learner';
              UI.toast(error.message||'Could not enrol learner','alert');
            }
          });
        }
      }));
    }
  };

  /* ---------- Parents ---------- */
  function openParent(p){
    const kids=DB.learners.filter(l=>l.parent===p.name);
    UI.drawer({
      title:'Parent Profile',
      body:`
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">${UI.avatar(p.name,'xl')}
          <div><div style="font-size:17px;font-weight:800;color:var(--ink-900)">${esc(p.name)}</div>
          <div class="muted small">${esc(p.school)} · ${esc(p.branch)}</div></div>
          <span style="margin-left:auto">${UI.status(p.status)}</span></div>
        ${UI.dl([['Email',esc(p.email)],['Phone',esc(p.phone)],['Children',String(p.children)],['Joined',esc(p.joined)],
          ['Balance',p.balance?`<b style="color:var(--red-600)">${R(p.balance)} outstanding</b>`:'<b style="color:var(--green-600)">Fully paid</b>']])}
        <div class="divider"></div>
        <h4 style="margin-bottom:10px">Children${kids.length?` (${kids.length} on record)`:''}</h4>
        ${kids.length?`<div class="feed">${kids.map(k=>`
          <div class="feed-item">${UI.avatar(k.name)}<div class="f-txt"><div class="f-main"><b>${esc(k.name)}</b></div>
          <div class="f-sub">${esc(k.grade)} ${esc(k.cls)} · ${k.attendance}% attendance</div></div></div>`).join('')}</div>`
        :`<p class="small muted">Linked child records appear here.</p>`}
        <div class="divider"></div>
        <h4 style="margin-bottom:10px">Engagement</h4>
        ${UI.meterRow('App opens',86,'purple')}
        ${UI.meterRow('Messages read',94)}
        ${UI.meterRow('Payments on time',p.balance?58:98,p.balance?'amber':'')}`,
      foot:`<button class="btn btn-ghost" data-edit>${MCIcon('edit')} Edit</button>
            <button class="btn btn-ghost" data-delete>${MCIcon('delete')} Delete</button>
            <button class="btn btn-primary" data-go="messages">${MCIcon('messages')} Send Message</button>`,
      mount(root,close){
        root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{close();App.go(b.dataset.go);}));
        root.querySelector('[data-edit]').addEventListener('click',()=>{close();editParent(p);});
        root.querySelector('[data-delete]').addEventListener('click',()=>{close();deleteParent(p);});
      }
    });
  }
  function editParent(p){
    UI.modal({title:'Edit Parent',body:`<div class="people-edit-form">
        <p class="people-edit-form__intro">Update parent contact details and the campus linked to this family.</p>
        <div class="people-edit-form__section">
          <div class="people-edit-form__section-title">Parent profile</div>
          <div class="people-edit-form__grid">
            <div class="field people-edit-form__wide"><label>Full name</label><input class="people-edit-control" data-f="name" autocomplete="name" value="${esc(p.name)}"></div>
            <div class="field"><label>Email address</label><input class="people-edit-control" type="email" data-f="email" autocomplete="email" value="${esc(p.email)}"></div>
            <div class="field"><label>Phone number</label><input class="people-edit-control" type="tel" data-f="phone" autocomplete="tel" value="${esc(p.phone)}"></div>
            <div class="field people-edit-form__wide"><label>Campus</label><select class="people-edit-control" data-f="branchId">${DB.liveBranches().map(b=>`<option value="${esc(b.id)}" ${String(b.id)===String(p.branchId||DB.liveBranches().find(item=>item.name===p.branch)?.id||'')?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>`,foot:`<div class="people-edit-actions"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Changes</button></div>`,mount(r,close){r.querySelector('[data-x]').addEventListener('click',close);r.querySelector('[data-s]').addEventListener('click',async()=>{const v=UI.formVals(r);if(!v.name||!v.email||!v.phone||!v.branchId){UI.toast('Complete all parent details','alert');return;}const button=r.querySelector('[data-s]');button.disabled=true;try{await window.MobsieApi.mutate(`/api/parents/${encodeURIComponent(p.id)}`,{method:'PUT',body:JSON.stringify({name:v.name,email:v.email,phone:v.phone,branchId:v.branchId})});close();await window.MobsieApi.load();UI.toast('Parent changes saved to Neon.');App.refresh();}catch(error){button.disabled=false;UI.toast(error.message||'Could not update parent','alert');}});}});
  }
  async function deleteParent(p){if(!confirm(`Delete ${p.name}?`))return;try{await window.MobsieApi.mutate(`/api/parents/${encodeURIComponent(p.id)}`,{method:'DELETE'});await window.MobsieApi.load();UI.toast('Parent deleted from Neon.');App.refresh();}catch(error){UI.toast(error.message||'Could not delete parent','alert');}}

  Pages.parents={
    render(){
      const rows=App.scoped(DB.parents);
      const owing=rows.filter(p=>p.balance>0);
      const stats=DB.parentStats||{};
      const totalParents=Number(stats.totalParents??rows.length);
      const newThisMonth=Number(stats.newThisMonth??0);
      const adoption=Number(stats.appAdoptionPercent??0);
      const arrears=Number(stats.accountsInArrears??owing.length);
      const ratingCount=Number(stats.ratingCount??0);
      const rating=stats.averageRating==null?'—':Number(stats.averageRating).toFixed(1)+'/5';
      const tbl=UI.table({
        pageSize:10, rows, onRow:openParent,
        columns:[
          {key:'name',label:'Parent',render:r=>UI.personCell(r.name,r.email)},
          {key:'branch',label:'Campus'},
          {key:'children',label:'Children',num:true},
          {key:'phone',label:'Phone'},
          {key:'balance',label:'Balance',num:true,render:r=>r.balance?`<b style="color:var(--red-600)">${R(r.balance)}</b>`:`<span style="color:var(--green-600);font-weight:650">R0</span>`},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
          {label:'',sortable:false,render:()=>`<button class="icon-btn">${MCIcon('chevRight')}</button>`},
        ],
      });
      Pages.parents._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Parents','Families using the Mobsie Connect app — accounts, balances and engagement.',
          `<button class="btn btn-ghost" id="pEmailAll">${MCIcon('campaigns')} Email All</button>
           <button class="btn btn-primary" id="pAdd">${MCIcon('plus')} Add Parent</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'parents',tint:'t-blue',label:'Total Parents',value:F(totalParents),deltaHtml:`<span class="delta flat">${F(newThisMonth)} joined this month</span>`})}
          ${UI.statCard({icon:'push',tint:'t-purple',label:'App Adoption',value:adoption+'%',deltaHtml:`<span class="delta flat">parents with a registered device</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-red',label:'Accounts in Arrears',value:F(arrears),deltaHtml:`<span class="delta flat">${arrears?'requires attention':'no arrears data recorded'}</span>`})}
          ${UI.statCard({icon:'heart',tint:'t-green',label:'Satisfaction (CSAT)',value:rating,deltaHtml:`<span class="delta flat">from ${F(ratingCount)} rating${ratingCount===1?'':'s'}</span>`})}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Parent directory</h3></div><span class="spacer"></span>
            <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="pQ" placeholder="Search parents…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
        </div>`;
    },
    mount(root){
      root.querySelector('#pQ').addEventListener('input',e=>UI.tableFilter(Pages.parents._tid,e.target.value));
      root.querySelector('#pEmailAll').addEventListener('click',()=>UI.modal({
        title:'Email Parents',
        body:`<p class="small muted" style="margin-bottom:16px">Send one private email to every active parent. Recipient addresses are hidden from one another.</p>
          <div class="field"><label>Audience</label><select data-f="branchId"><option value="">All active parents</option>${DB.liveBranches().map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Subject</label><input type="text" data-f="subject" maxlength="180" placeholder="Email subject"></div>
          <div class="field"><label>Message</label><textarea data-f="body" rows="8" placeholder="Write your message to parents"></textarea></div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${MCIcon('campaigns')} Send Email</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);if(!v.subject||!v.body){UI.toast('Add a subject and message','alert');return;}
            const button=r.querySelector('[data-s]');button.disabled=true;button.textContent='Sending…';
            try{
              const response=await MobsieApi.mutate('/api/parents/email-all',{method:'POST',body:JSON.stringify({subject:v.subject,body:v.body,branchId:v.branchId||null})});
              close();UI.toast(`Email sent to ${response.data.sent} parent${response.data.sent===1?'':'s'}.`);
            }catch(error){button.disabled=false;button.textContent='Send Email';UI.toast(error.message||'Could not send the parent email','alert');}
          });
        }
      }));
      root.querySelector('#pAdd').addEventListener('click',()=>UI.modal({
        title:'Add Parent',
        body:`<div class="field"><label>Full name</label><input type="text" data-f="name" placeholder="Full name"></div>
          <div class="form-row">
            <div class="field"><label>Email</label><input type="email" data-f="email" placeholder="name@email.com"></div>
            <div class="field"><label>Phone</label><input type="text" data-f="phone" placeholder="0xx xxx xxxx"></div>
          </div>
          <div class="field"><label>Campus</label><select data-f="branchId">${DB.liveBranches().map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Add & Send App Invite</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.name||!v.email||!v.phone||!v.branchId){UI.toast('Complete all parent details','alert');return;}
            const button=r.querySelector('[data-s]');button.disabled=true;
            try{
              await window.MobsieApi.mutate('/api/parents',{method:'POST',body:JSON.stringify({name:v.name,email:v.email,phone:v.phone,branchId:v.branchId})});
              close();await window.MobsieApi.load();UI.toast('Parent added to Neon — Mobsie app invite sent');App.refresh();
            }catch(error){button.disabled=false;UI.toast(error.message||'Could not add parent','alert');}
          });
        }
      }));
    }
  };

  /* ---------- Teachers ---------- */
  function teacherAvatar(t,size=46){
    return t.imageUrl
      ? `<img src="${esc(t.imageUrl)}" alt="${esc(t.name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--card);box-shadow:0 0 0 1px var(--line)">`
      : UI.avatar(t.name,size>50?'xl':'md');
  }
  function openTeacher(t){
    UI.drawer({
      title:'Teacher Profile',
      body:`
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">${teacherAvatar(t,64)}
          <div><div style="font-size:17px;font-weight:800;color:var(--ink-900)">${esc(t.name)}</div>
          <div class="muted small">${esc(t.cls)} · ${esc(t.school)}</div></div>
          <span style="margin-left:auto">${UI.status(t.status)}</span></div>
        <div class="grid cards-3" style="gap:10px;margin-bottom:18px">
          <div class="mini-stat"><span class="ms-ic t-purple">${MCIcon('learners')}</span><div><div class="ms-val">${t.students}</div><div class="ms-lbl">Learners</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-amber">${MCIcon('star')}</span><div><div class="ms-val">${t.rating}</div><div class="ms-lbl">Parent rating</div></div></div>
          <div class="mini-stat"><span class="ms-ic t-blue">${MCIcon('briefcase')}</span><div><div class="ms-val">${t.years} yrs</div><div class="ms-lbl">Experience</div></div></div>
        </div>
        ${UI.dl([['Email',esc(t.email)],['Phone',esc(t.phone)],['School',esc(t.school)],['Branch',esc(t.branch)],['Class',esc(t.cls)]])}
        <div class="divider"></div>
        <h4 style="margin-bottom:10px">This week</h4>
        <div class="feed">
          <div class="feed-item"><span class="f-ic t-green">${MCIcon('attendance')}</span><div class="f-txt"><div class="f-main">Attendance captured 5 of 5 days</div><div class="f-sub">Class average 93%</div></div></div>
          <div class="feed-item"><span class="f-ic t-blue">${MCIcon('homework')}</span><div class="f-txt"><div class="f-main">3 learning activities posted</div><div class="f-sub">Numbers, shapes & story time</div></div></div>
          <div class="feed-item"><span class="f-ic t-amber">${MCIcon('gallery')}</span><div class="f-txt"><div class="f-main">18 photos shared to class gallery</div><div class="f-sub">Approved by principal</div></div></div>
        </div>`,
      foot:`<button class="btn btn-ghost" data-edit>${MCIcon('edit')} Edit</button>
            <button class="btn btn-ghost" data-delete>${MCIcon('delete')} Delete</button>
            <button class="btn btn-primary" data-go="attendance">${MCIcon('external')} Open Classroom</button>`,
      mount(root,close){
        root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{close();App.go(b.dataset.go);}));
        root.querySelector('[data-edit]').addEventListener('click',()=>{close();editTeacher(t);});
        root.querySelector('[data-delete]').addEventListener('click',()=>{close();deleteTeacher(t);});
      }
    });
  }
  function editTeacher(t){
    UI.modal({title:'Edit Teacher',body:`<div class="people-edit-form">
        <p class="people-edit-form__intro">Manage the staff member's placement, contact information and experience.</p>
        <div class="people-edit-form__section">
          <div class="people-edit-form__section-title">Teacher profile</div>
          <div class="people-edit-form__grid">
            <div class="field people-edit-form__wide"><label>Full name</label><input class="people-edit-control" data-f="name" autocomplete="name" value="${esc(t.name)}"></div>
            <div class="field"><label>Campus</label><select class="people-edit-control" data-f="branch">${DB.liveBranches().map(b=>`<option ${b.name===t.branch?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Class / role</label><input class="people-edit-control" data-f="grade" value="${esc(t.grade||t.cls||'Nursery')}"></div>
            <div class="field"><label>Email address</label><input class="people-edit-control" type="email" data-f="email" autocomplete="email" value="${esc(t.email)}"></div>
            <div class="field"><label>Phone number</label><input class="people-edit-control" type="tel" data-f="phone" autocomplete="tel" value="${esc(t.phone||'')}"></div>
            <div class="field people-edit-form__wide"><label>Experience</label><div class="people-edit-form__suffix"><input class="people-edit-control" type="number" min="0" max="80" data-f="years" value="${esc(t.years||0)}"><span>years</span></div></div>
          </div>
        </div>
      </div>`,foot:`<div class="people-edit-actions"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Changes</button></div>`,mount(r,close){r.querySelector('[data-x]').addEventListener('click',close);r.querySelector('[data-s]').addEventListener('click',async()=>{const v=UI.formVals(r),branch=DB.branches.find(b=>b.name===v.branch);if(!v.name||!branch?.id||!v.email){UI.toast('Complete the teacher details','alert');return;}try{const response=await MobsieApi.mutate('/api/team/'+encodeURIComponent(t.id),{method:'PUT',body:JSON.stringify({name:v.name,branchId:branch.id,title:v.grade,yearsExperience:Number(v.years)||0,contactEmail:v.email,contactPhone:v.phone||''})});const saved=response.data;Object.assign(t,{name:saved.name,branch:v.branch,grade:saved.title,cls:saved.title+' A',email:saved.contactEmail||v.email,phone:saved.contactPhone||v.phone,years:saved.yearsExperience});DB.recount();DB.save();close();UI.toast('Teacher changes saved to Neon.');App.refresh();}catch(error){UI.toast(error.message||'Could not update teacher','alert');}});}});
  }
  async function deleteTeacher(t){if(!confirm(`Delete ${t.name}?`))return;try{await MobsieApi.mutate('/api/team/'+encodeURIComponent(t.id),{method:'DELETE'});DB.teachers=DB.teachers.filter(item=>item.id!==t.id);const branch=DB.branches.find(item=>item.name===t.branch);if(branch)branch.teachers=Math.max(0,(branch.teachers||1)-1);DB.recount();DB.save();UI.toast('Teacher deleted.');App.refresh();}catch(error){UI.toast(error.message||'Could not delete teacher','alert');}}

  Pages.teachers={
    render(){
      const rows=App.scoped(DB.teachers);
      const stats=DB.teamStats||{};
      const totalStaff=Number(stats.totalStaff??rows.length);
      const newThisMonth=Number(stats.newThisMonth??0);
      const learnersPerStaff=Number(stats.learnersPerStaff??0);
      const averageExperience=Number(stats.averageExperienceYears??0);
      const attendanceEntries=Number(stats.attendanceEntriesThisMonth??0);
      const tbl=UI.table({
        pageSize:10, rows, onRow:openTeacher,
        columns:[
          {key:'name',label:'Teacher',render:r=>`<div class="person-cell">${teacherAvatar(r,38)}<div class="pc-txt"><div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${esc(r.email)}</div></div></div>`},
          {key:'branch',label:'Campus'},
          {key:'cls',label:'Class'},
          {key:'students',label:'Campus learners',num:true},
          {key:'years',label:'Experience',num:true,render:r=>r.years+' yrs'},
          {key:'rating',label:'Rating',render:r=>r.rating&&r.rating!=='—'?`<span style="display:inline-flex;align-items:center;gap:5px;font-weight:700;color:var(--ink-900)"><span style="color:var(--amber-500)">${MCIcon('star')}</span>${r.rating}</span>`:'—'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      Pages.teachers._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Teachers','Teaching staff across all campuses — classes, ratings and workload.',
          `<button class="btn btn-ghost" id="tExp">${MCIcon('download')} Export</button>
           <button class="btn btn-primary" id="tAdd">${MCIcon('plus')} Add Teacher</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'teachers',tint:'t-teal',label:'Total Staff',value:F(totalStaff),deltaHtml:`<span class="delta flat">${F(newThisMonth)} joined this month</span>`})}
          ${UI.statCard({icon:'learners',tint:'t-purple',label:'Learners per Staff',value:learnersPerStaff.toFixed(1),deltaHtml:`<span class="delta flat">${F(Number(stats.activeLearners||0))} active learners</span>`})}
          ${UI.statCard({icon:'briefcase',tint:'t-amber',label:'Avg Experience',value:averageExperience.toFixed(1)+' yrs',deltaHtml:`<span class="delta flat">from staff records</span>`})}
          ${UI.statCard({icon:'attendance',tint:'t-green',label:'Attendance Entries',value:F(attendanceEntries),deltaHtml:`<span class="delta flat">captured this month</span>`})}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Teacher directory</h3></div><span class="spacer"></span>
            <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="tQ" placeholder="Search teachers…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div>
        </div>`;
    },
    mount(root){
      root.querySelector('#tQ').addEventListener('input',e=>UI.tableFilter(Pages.teachers._tid,e.target.value));
      root.querySelector('#tExp').addEventListener('click',()=>UI.downloadCSV('mobsie-teachers.csv',
        ['Teacher','Email','Campus','Class','Learners','Experience (yrs)','Rating','Status'],
        DB.teachers.map(t=>[t.name,t.email,t.branch,t.cls,t.students,t.years,t.rating,t.status])));
      root.querySelector('#tAdd').addEventListener('click',()=>UI.modal({
        title:'Add Teacher',
        body:`<div class="field"><label>Full name</label><input type="text" data-f="name" placeholder="Full name"></div>
          <div class="form-row">
            <div class="field"><label>Campus</label><select data-f="branch">${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Class</label><select data-f="grade">${DB.GRADES.map(g=>`<option>${g}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>Email</label><input type="email" data-f="email" placeholder="name@mobsie.co.za"></div>
          <div class="form-row">
            <div class="field"><label>Phone</label><input type="tel" data-f="phone" placeholder="082 555 0182"></div>
            <div class="field"><label>Experience (years)</label><input type="number" data-f="years" value="0" min="0" max="80"></div>
          </div>
          <div class="field"><label>Profile image</label>
            <label class="file-picker">${MCIcon('upload')}<strong>Choose a profile photo</strong><span data-file-name>PNG or JPG, up to 5 MB</span>
              <input type="file" data-f="image" accept="image/png,image/jpeg">
            </label>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Add & Invite</button>`,
        mount(r,close){
          const imageInput=r.querySelector('[data-f="image"]');
          imageInput.addEventListener('change',()=>{
            const file=imageInput.files[0];
            r.querySelector('[data-file-name]').textContent=file?file.name:'PNG or JPG, up to 5 MB';
          });
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            const file=imageInput.files[0];
            if(!v.name||!v.email||!file){UI.toast('Name, email and profile image are required','alert');return;}
            if(file.size>5*1024*1024){UI.toast('Profile image must be smaller than 5 MB','alert');return;}
            const branch=DB.branches.find(x=>x.name===v.branch);
            if(!branch){UI.toast('Select a valid campus','alert');return;}
            try{
              const imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
              const created=await MobsieApi.mutate('/api/team',{method:'POST',body:JSON.stringify({
                branchId:branch.id,name:v.name,title:v.grade,yearsExperience:+v.years||0,isPrincipal:false,
                contactEmail:v.email,contactPhone:v.phone||'',imageData
              })});
              const member=created.data[0];
              DB.teachers.unshift({id:member.id,name:v.name,email:v.email,phone:v.phone||'',
              school:DB.SCHOOL_NAME,schoolId:'sch-1',branch:v.branch,grade:v.grade,cls:v.grade+' A',
              students:0,years:+v.years||0,rating:'—',status:'Active',imageUrl:member.imageUrl});
            const b=DB.branches.find(x=>x.name===v.branch); if(b) b.teachers++;
            DB.log('Added teacher',v.name+' — '+v.branch,'ok');
              DB.recount(); DB.save();
              close();UI.toast(v.name+' saved with Cloudinary image');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };
})();
