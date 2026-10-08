/* Mobsie Connect — Support, Users, Roles & Permissions, Audit Logs, Settings */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN;

  /* ---------- Support tickets ---------- */
  Pages.support={
    render(){
      const open=DB.tickets.filter(t=>t.status==='Open').length;
      const prog=DB.tickets.filter(t=>t.status==='In Progress').length;
      const tbl=UI.table({
        pageSize:9, rows:DB.tickets,
        onRow:t=>UI.drawer({
          title:t.id+' — '+t.subject,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.status(t.status)} ${UI.badge(t.priority+' priority',t.priority==='Urgent'?'red':t.priority==='High'?'amber':'blue')}</div>
            ${UI.dl([['School',esc(t.school)],['Raised by',esc(t.by)],['Age',esc(t.age)],['Assigned to',esc(t.agent)]])}
            <div class="divider"></div>
            <h4 style="margin-bottom:10px">Conversation</h4>
            <div class="feed">
              <div class="feed-item">${UI.avatar(t.by)}<div class="f-txt"><div class="f-main"><b>${esc(t.by)}</b> opened the ticket</div><div class="f-sub">“${esc(t.subject)}” · ${t.age} ago</div></div></div>
              ${t.agent!=='Unassigned'?`<div class="feed-item">${UI.avatar(t.agent)}<div class="f-txt"><div class="f-main"><b>${esc(t.agent)}</b> is investigating</div><div class="f-sub">Internal note added</div></div></div>`:''}
            </div>
            <div class="field" style="margin-top:14px"><label>Reply</label><textarea id="ticReply" placeholder="Type a reply…"></textarea></div>`,
          foot:`<button class="btn btn-ghost" id="ticAssign">${MCIcon('users')} Assign</button>
                <button class="btn btn-green" id="ticResolve">${MCIcon('check')} Resolve</button>
                <button class="btn btn-primary" id="ticSend">${MCIcon('send')} Send Reply</button>`,
          mount(root,close){
            root.querySelector('#ticAssign').addEventListener('click',e=>{
              UI.menu(e.currentTarget,['Katlego M.','Refilwe N.','Thandi Admin'].map(a=>({label:a,icon:'users',
                checked:t.agent===a,onClick:()=>{t.agent=a;if(t.status==='Open')t.status='In Progress';
                  DB.log('Assigned ticket',t.id+' → '+a,'info');
                  UI.toast(t.id+' assigned to '+a);App.refresh();}})));
            });
            root.querySelector('#ticResolve').addEventListener('click',()=>{
              t.status='Resolved';
              DB.log('Resolved ticket',t.id+' — '+t.subject,'ok');
              close();UI.toast(t.id+' resolved — '+t.by+' notified');App.refresh();
            });
            root.querySelector('#ticSend').addEventListener('click',()=>{
              const txt=root.querySelector('#ticReply').value.trim();
              if(!txt){UI.toast('Type a reply first','alert');return;}
              if(t.status==='Open')t.status='In Progress';
              if(t.agent==='Unassigned')t.agent='Thandi Admin';
              DB.log('Replied to ticket',t.id,'info');
              close();UI.toast('Reply sent on '+t.id);App.refresh();
            });
          }
        }),
        columns:[
          {key:'id',label:'Ticket'},
          {key:'subject',label:'Subject',render:r=>`<div class="cell-main">${esc(r.subject)}</div><div class="cell-sub">${esc(r.school)}</div>`},
          {key:'by',label:'Raised by',render:r=>UI.personCell(r.by)},
          {key:'priority',label:'Priority',render:r=>UI.badge(r.priority,r.priority==='Urgent'?'red':r.priority==='High'?'amber':'blue')},
          {key:'age',label:'Age'},
          {key:'agent',label:'Agent',render:r=>r.agent==='Unassigned'?`<span class="muted">Unassigned</span>`:UI.personCell(r.agent)},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      return `
        ${UI.pageHead('Support Tickets','Help requests from your campuses — SLA-tracked and assigned to your team.',
          `<button class="btn btn-primary" id="ticNew">${MCIcon('plus')} New Ticket</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'support',tint:'t-orange',label:'Open',value:String(open),deltaHtml:`<span class="delta flat">2 urgent</span>`})}
          ${UI.statCard({icon:'refresh',tint:'t-blue',label:'In Progress',value:String(prog),deltaHtml:`<span class="delta flat">2 agents active</span>`})}
          ${UI.statCard({icon:'clock',tint:'t-purple',label:'First Response',value:'38m',deltaHtml:UI.delta(15,'down','beating 1h SLA')})}
          ${UI.statCard({icon:'heart',tint:'t-green',label:'CSAT (Support)',value:'4.8/5',deltaHtml:`<span class="delta flat">last 90 days</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Ticket queue</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#ticNew').addEventListener('click',()=>UI.modal({
        title:'New Ticket',
        body:`<div class="field"><label>Subject</label><input type="text" data-f="subject" placeholder="What's the issue?"></div>
          <div class="form-row">
            <div class="field"><label>Campus</label><select data-f="school"><option>Head Office</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Priority</label><select data-f="priority"><option>Normal</option><option>High</option><option>Urgent</option></select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Open Ticket</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            if(!v.subject){UI.toast('Describe the issue first','alert');return;}
            DB.tickets.unshift({id:'TIC-'+(1209+DB.tickets.length-7),subject:v.subject,school:v.school,
              by:'Thandi Admin',priority:v.priority,status:'Open',age:'now',agent:'Unassigned'});
            DB.log('Opened ticket',v.subject,'info');
            close();UI.toast('Ticket opened — support team notified');App.refresh();
          });
        }
      }));
    }
  };

  /* ---------- Users ---------- */
  Pages.users={
    render(){
      const tbl=UI.table({
        pageSize:9, rows:DB.adminUsers,
        columns:[
          {key:'name',label:'User',render:r=>UI.personCell(r.name,r.email)},
          {key:'role',label:'Role',render:r=>UI.badge(r.role,{'Super Admin':'orange','School Owner':'purple','Branch Principal':'blue','Finance Manager':'green','Admissions':'teal','Teacher':'amber','Support Lead':'pink','Support Agent':'pink'}[r.role]||'ink')},
          {key:'scope',label:'Access scope'},
          {key:'last',label:'Last active'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
          {label:'',sortable:false,render:r=>`<button class="icon-btn" data-umenu="${esc(r.email)}">${MCIcon('more')}</button>`},
        ],
      });
      return `
        ${UI.pageHead('Users','Everyone with access to the Control Centre, scoped by role.',
          `<button class="btn btn-primary" id="invUser">${MCIcon('plus')} Create User</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'users',tint:'t-blue',label:'Staff Accounts',value:F(DB.totals.teachers+DB.adminUsers.length+3),deltaHtml:UI.delta(0,'up','this month').replace('0%','5')})}
          ${UI.statCard({icon:'roles',tint:'t-orange',label:'Super Admins',value:'2',deltaHtml:`<span class="delta flat">2FA enforced</span>`})}
          ${UI.statCard({icon:'branches',tint:'t-purple',label:'Campus Principals',value:String(DB.adminUsers.filter(u=>u.role==='Branch Principal').length),deltaHtml:`<span class="delta flat">1 per campus</span>`})}
          ${UI.statCard({icon:'lock',tint:'t-green',label:'2FA Enabled',value:'98%',deltaHtml:UI.delta(2,'up','vs April')})}
        </div>
        <div class="card"><div class="card-head"><div><h3>User accounts</h3></div><span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="uQ" placeholder="Search users…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#uQ').addEventListener('input',e=>UI.tableFilter(UI.lastTableId(),e.target.value));
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-umenu]');
        if(!b) return;
        const u=DB.adminUsers.find(x=>x.email===b.dataset.umenu);
        if(!u) return;
        UI.menu(b,[
          {icon:'roles',label:'Change role',onClick:()=>App.go('roles')},
          {icon:'refresh',label:'Reset password',onClick:()=>{
            DB.log('Reset user password',u.email,'info');
            UI.toast('Password reset email sent to '+u.email);
          }},
          '-',
          {icon:'pause',label:u.status==='Suspended'?'Restore access':'Suspend access',danger:u.status!=='Suspended',onClick:()=>{
            u.status=u.status==='Suspended'?'Active':'Suspended';
            DB.log((u.status==='Suspended'?'Suspended user':'Restored user'),u.email,'warn');
            UI.toast(u.name+(u.status==='Suspended'?' suspended':' restored'));App.refresh();
          }},
        ],{align:'right'});
      });
      root.querySelector('#invUser').addEventListener('click',()=>UI.modal({
        title:'Create User',
        body:`<div class="user-editor">
          <section class="user-editor__section"><div class="user-editor__section-title">Account details</div>
            <div class="form-row">
              <div class="field"><label>Full name</label><input type="text" data-f="name" autocomplete="name" placeholder="Enter full name"></div>
              <div class="field"><label>Email address</label><input type="email" data-f="email" autocomplete="email" placeholder="name@mobsie.co.za"></div>
            </div>
            <div class="form-row" style="margin-top:15px">
              <div class="field"><label>Role</label><select data-f="role"><option value="PRINCIPAL">Principal</option><option value="TEACHER">Teacher</option></select></div>
              <div class="field"><label>Campus access</label><select data-f="branchId"><option value="">Entire school group</option>${DB.liveBranches().map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></div>
            </div>
          </section>
          <section class="user-editor__section"><div class="user-editor__section-title">Login password</div>
            <div class="form-row">
              <div class="field"><label>Password</label><div class="password-control"><input type="password" data-f="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Enter password"><button class="password-toggle" type="button" data-password-toggle="password" aria-label="Show password">${MCIcon('eye')}</button></div><div class="password-help"><span>Minimum 8 characters</span><span data-password-length></span></div></div>
              <div class="field"><label>Confirm password</label><div class="password-control"><input type="password" data-f="confirmPassword" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Repeat password"><button class="password-toggle" type="button" data-password-toggle="confirmPassword" aria-label="Show password">${MCIcon('eye')}</button></div><div class="password-help"><span>Repeat the password</span><span class="password-help__match" data-password-match></span></div></div>
            </div>
          </section>
        </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Create User</button>`,
        mount(r,close){
          const password=r.querySelector('[data-f="password"]');
          const confirmPassword=r.querySelector('[data-f="confirmPassword"]');
          const lengthStatus=r.querySelector('[data-password-length]');
          const matchStatus=r.querySelector('[data-password-match]');
          const updatePasswordStatus=()=>{
            lengthStatus.textContent=password.value?`${password.value.length}/8 minimum`:'';
            if(!confirmPassword.value){matchStatus.textContent='';matchStatus.className='password-help__match';return;}
            const matches=password.value===confirmPassword.value;
            matchStatus.textContent=matches?'Passwords match':'Passwords do not match';
            matchStatus.className=`password-help__match ${matches?'ok':'bad'}`;
          };
          password.addEventListener('input',updatePasswordStatus);
          confirmPassword.addEventListener('input',updatePasswordStatus);
          r.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
            const input=r.querySelector(`[data-f="${button.dataset.passwordToggle}"]`);
            const showing=input.type==='text';input.type=showing?'password':'text';
            button.setAttribute('aria-label',showing?'Show password':'Hide password');
          }));
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.name||!v.email||!v.password){UI.toast('Name, email and password are required','alert');return;}
            if(v.password.length<8){UI.toast('Password must contain at least 8 characters','alert');return;}
            if(v.password!==v.confirmPassword){UI.toast('Passwords do not match','alert');return;}
            const save=r.querySelector('[data-s]');save.disabled=true;save.textContent='Creating…';
            try{
              const response=await MobsieApi.mutate('/api/users',{method:'POST',body:JSON.stringify({name:v.name,email:v.email,password:v.password,role:v.role,branchId:v.branchId||null})});
              const account=response.data[0];
              DB.adminUsers.unshift({id:account.id,name:account.name,email:account.email,role:account.role==='PRINCIPAL'?'Principal':'Teacher',roleValue:account.role,branchId:account.branchId||'',scope:account.branchName||'Entire school group',last:'Never',status:'Active'});
              DB.log('Created user',v.email+' — '+v.role,'ok');
              close();UI.toast('User created. They can now log in with this password.');App.refresh();
            }catch(error){save.disabled=false;save.textContent='Create User';UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };

  /* ---------- Roles & Permissions (RBAC matrix) ---------- */
  Pages.roles={
    render(){
      const rp=DB.rolePerms;
      const head=rp.roles.map(r=>`<th style="text-align:center"><div style="display:flex;flex-direction:column;align-items:center;gap:5px"><span class="avatar sm" style="background:${r.color}">${r.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</span>${r.name}<span class="muted" style="font-weight:550;text-transform:none;letter-spacing:0">${F(r.users)} users</span></div></th>`).join('');
      const rows=rp.perms.map((p,pi)=>`<tr><td class="cell-main">${p}</td>${rp.roles.map((r,ri)=>`
        <td class="pc"><button class="perm-dot ${r.grants[pi]?'yes':'no'}" data-perm="${ri}:${pi}" aria-label="${r.name} — ${p}">${MCIcon(r.grants[pi]?'check':'x')}</button></td>`).join('')}</tr>`).join('');
      return `
        ${UI.pageHead('Roles & Permissions','Role-based access control — click any cell to grant or revoke.',
          `<button class="btn btn-ghost">${MCIcon('copy')} Duplicate Role</button>
           <button class="btn btn-purple" id="newRole">${MCIcon('plus')} Create Custom Role</button>`)}
        <div class="grid cards-3" style="margin-bottom:20px">
          ${UI.statCard({icon:'roles',tint:'t-purple',label:'Defined Roles',value:String(DB.rolePerms.roles.length),deltaHtml:`<span class="delta flat">RBAC enforced everywhere</span>`})}
          ${UI.statCard({icon:'lock',tint:'t-orange',label:'Permission Checks / day',value:'184K',deltaHtml:`<span class="delta flat">avg 4ms overhead</span>`})}
          ${UI.statCard({icon:'audit',tint:'t-blue',label:'Changes This Month',value:'14',deltaHtml:`<span class="delta flat">all logged to audit trail</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Permission matrix</h3><div class="sub">Every grant is scoped — a School Owner only ever sees their own school</div></div></div>
          <div class="card-body table-wrap" style="padding-top:8px">
            <table class="mc perm-table"><thead><tr><th>Permission</th>${head}</tr></thead><tbody>${rows}</tbody></table>
          </div></div>`;
    },
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-perm]');
        if(!b) return;
        const [ri,pi]=b.dataset.perm.split(':').map(Number);
        const r=DB.rolePerms.roles[ri];
        r.grants[pi]=r.grants[pi]?0:1;
        b.className='perm-dot '+(r.grants[pi]?'yes':'no');
        b.innerHTML=MCIcon(r.grants[pi]?'check':'x');
        DB.log((r.grants[pi]?'Granted permission':'Revoked permission'),DB.rolePerms.perms[pi]+' — '+r.name,'warn');
        DB.save();
        UI.toast(`${r.grants[pi]?'Granted':'Revoked'} “${DB.rolePerms.perms[pi]}” for ${r.name}`);
      });
      root.querySelector('#newRole').addEventListener('click',()=>UI.modal({
        title:'Create Custom Role',
        body:`<div class="field"><label>Role name</label><input type="text" placeholder="e.g. Marketing Coordinator"></div>
          <div class="field"><label>Start from</label><select>${DB.rolePerms.roles.map(r=>`<option>${r.name}</option>`).join('')}</select></div>
          <div class="field"><label>Default scope</label><select><option>One school</option><option>One branch</option><option>Entire platform</option></select></div>
          <p class="small muted">You can fine-tune every permission in the matrix after creating the role.</p>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-purple" data-s>Create Role</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const nm=r.querySelector('input').value.trim();
            if(!nm){UI.toast('Name the role first','alert');return;}
            const base=DB.rolePerms.roles.find(x=>x.name===r.querySelector('select').value)||DB.rolePerms.roles[2];
            DB.rolePerms.roles.push({name:nm,color:'#0D9488',users:0,grants:[...base.grants]});
            DB.log('Created custom role',nm,'warn');
            close();UI.toast('Role "'+nm+'" created — fine-tune it in the matrix');App.refresh();
          });
        }
      }));
    }
  };

  /* ---------- Audit Logs ---------- */
  Pages.audit={
    render(){
      const tone={ok:'t-green',info:'t-blue',warn:'t-amber'};
      const icon={ok:'check',info:'info',warn:'alert'};
      const tbl=UI.table({
        pageSize:10, rows:DB.auditLog,
        columns:[
          {key:'time',label:'When'},
          {key:'who',label:'Actor',render:r=>UI.personCell(r.who,r.role)},
          {key:'act',label:'Action',render:r=>`<span style="display:inline-flex;align-items:center;gap:8px"><span class="f-ic ${tone[r.type]}" style="width:28px;height:28px;border-radius:8px;display:inline-grid;place-items:center">${MCIcon(icon[r.type])}</span><b>${esc(r.act)}</b></span>`},
          {key:'target',label:'Target'},
          {label:'',sortable:false,render:()=>`<button class="icon-btn">${MCIcon('eye')}</button>`},
        ],
      });
      Pages.audit._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Audit Logs','Every sensitive action, recorded forever. POPIA-ready.',
          `<button class="select">${MCIcon('calendar')} Last 7 days ${MCIcon('chevDown')}</button>
           <button class="btn btn-ghost" id="audExp">${MCIcon('download')} Export Log</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'audit',tint:'t-blue',label:'Events (7 days)',value:F(2148),deltaHtml:`<span class="delta flat">all retained 7 years</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-amber',label:'Sensitive Actions',value:'23',deltaHtml:`<span class="delta flat">suspensions, role changes</span>`})}
          ${UI.statCard({icon:'eye',tint:'t-purple',label:'Impersonations',value:'2',deltaHtml:`<span class="delta flat">all consented & logged</span>`})}
          ${UI.statCard({icon:'lock',tint:'t-green',label:'Failed Logins',value:'7',deltaHtml:UI.delta(12,'down','vs last week')})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Activity stream</h3></div><span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="aQ" placeholder="Search the log…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#aQ').addEventListener('input',e=>UI.tableFilter(Pages.audit._tid,e.target.value));
      root.querySelector('#audExp').addEventListener('click',()=>UI.downloadCSV('mobsie-audit-log.csv',
        ['When','Actor','Role','Action','Target'],
        DB.auditLog.map(a=>[a.time,a.who,a.role,a.act,a.target])));
    }
  };

  /* ---------- Settings (incl. white-label) ---------- */
  const setState={tab:0};
  Pages.settings={
    render(){
      const tabs=['General','White Label','Notifications','Integrations','Security'];
      const bodies=[
        // General
        UI.card('Platform details',`
          <div class="form-row">
            <div class="field"><label>Platform name</label><input type="text" value="Mobsie Connect"></div>
            <div class="field"><label>Support email</label><input type="email" value="support@mobsie.co.za"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Timezone</label><select><option>Africa/Johannesburg (SAST)</option></select></div>
            <div class="field"><label>Currency</label><select><option>South African Rand (R)</option></select></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Default language</label><select><option>English</option><option>isiZulu</option><option>Sepedi</option><option>Afrikaans</option></select></div>
            <div class="field"><label>Academic year</label><select><option>Jan – Dec 2026</option></select></div>
          </div>`)+
        UI.card('Demo data',`
          <p class="small muted" style="margin-bottom:12px">Everything you change in this preview — approvals, new campuses, payments, uploads — is saved in this browser. Reset to go back to the original demo data.</p>
          <button class="btn btn-danger" id="resetData">${MCIcon('refresh')} Reset Demo Data</button>`,{cls:'',attrs:'style="margin-top:20px"'}),
        // White label
        `<div class="grid" style="grid-template-columns:1.4fr 1fr;gap:20px" id="wlWrap">
          ${UI.card('School branding',`
            <p class="small muted" style="margin-bottom:14px">Each school can customise its own look in the parent app, invoices, reports and certificates — while the Mobsie Connect platform identity stays consistent underneath.</p>
            <div class="field"><label>Scope</label><select><option>${esc(DB.SCHOOL_NAME)} — all campuses</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Logo</label>
              <div style="display:flex;align-items:center;gap:14px">
                <span class="school-logo" id="wlLogo" style="background:#F97316;width:56px;height:56px;border-radius:16px">${DB.initials(DB.SCHOOL_NAME)}</span>
                <button class="btn btn-ghost btn-sm">${MCIcon('upload')} Upload new logo</button>
              </div></div>
            <div class="form-row">
              <div class="field"><label>Primary colour</label>
                <div style="display:flex;gap:8px;padding:6px 0">
                  <span class="color-dot on" data-wl="p" style="background:#F97316"></span><span class="color-dot" data-wl="p" style="background:#16A34A"></span>
                  <span class="color-dot" data-wl="p" style="background:#7C3AED"></span><span class="color-dot" data-wl="p" style="background:#2563EB"></span>
                  <span class="color-dot" data-wl="p" style="background:#DB2777"></span><span class="color-dot" data-wl="p" style="background:#0D9488"></span>
                </div></div>
              <div class="field"><label>Secondary colour</label>
                <div style="display:flex;gap:8px;padding:6px 0">
                  <span class="color-dot" data-wl="s" style="background:#F97316"></span><span class="color-dot on" data-wl="s" style="background:#16A34A"></span>
                  <span class="color-dot" data-wl="s" style="background:#7C3AED"></span><span class="color-dot" data-wl="s" style="background:#2563EB"></span>
                  <span class="color-dot" data-wl="s" style="background:#FBBF24"></span><span class="color-dot" data-wl="s" style="background:#94A3B8"></span>
                </div></div>
            </div>
            <div class="toggle-row"><span class="t-txt"><span class="t-nm">Branded email headers</span><span class="t-sub">School logo and colours on every email</span></span><button class="toggle on" data-tg></button></div>
            <div class="toggle-row"><span class="t-txt"><span class="t-nm">Branded invoices & statements</span><span class="t-sub">PDF documents carry school identity</span></span><button class="toggle on" data-tg></button></div>
            <div class="toggle-row"><span class="t-txt"><span class="t-nm">Branded certificates</span><span class="t-sub">Graduation & merit certificates</span></span><button class="toggle on" data-tg></button></div>
            <div class="toggle-row"><span class="t-txt"><span class="t-nm">Custom app splash screen</span><span class="t-sub">Enterprise plan only</span></span><button class="toggle" data-tg></button></div>`)}
          ${UI.card('Live preview',`
            <div style="border:1px solid var(--line);border-radius:18px;overflow:hidden">
              <div id="wlHead" style="background:linear-gradient(120deg,#F97316,#F9731688);padding:18px;color:#fff">
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="school-logo" style="background:rgba(255,255,255,.25);width:38px;height:38px;border-radius:12px;font-size:13px">${DB.initials(DB.SCHOOL_NAME)}</span>
                  <div><div style="font-weight:800">${esc(DB.SCHOOL_NAME)}</div><div style="font-size:11.5px;opacity:.9">Powered by Mobsie Connect</div></div>
                </div></div>
              <div style="padding:16px">
                <div style="font-weight:700;color:var(--ink-900);margin-bottom:8px">Invoice INV-000880</div>
                <div class="small muted">Monthly Fees — May</div>
                <div style="font-size:22px;font-weight:800;color:var(--ink-900);margin:6px 0 12px">R2,350.00</div>
                <button class="btn btn-sm btn-block" id="wlBtn" style="background:#16A34A;color:#fff">Pay in App</button>
              </div></div>
            <p class="small muted" style="margin-top:12px">Preview updates live as you change the branding.</p>`)}
        </div><style>@media(max-width:1100px){#wlWrap{grid-template-columns:1fr}}</style>`,
        // Notifications
        UI.card('Notification defaults',`
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Push for new applications</span><span class="t-sub">Notify admissions team instantly</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Daily digest email</span><span class="t-sub">07:00 summary for every school owner</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Payment failure alerts</span><span class="t-sub">Finance managers, immediately</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Weekly platform report</span><span class="t-sub">Mondays to super admins</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Quiet hours</span><span class="t-sub">No parent push between 20:00 – 06:00</span></span><button class="toggle on" data-tg></button></div>`),
        // Integrations
        UI.card('Integrations',`
          ${[['Mobsie Pay','Payments & payouts','green','Connected'],
             ['Xero','Accounting sync','blue','Connected'],
             ['WhatsApp Business','Parent messaging','green','Connected'],
             ['Google Workspace','Staff SSO','purple','Connected'],
             ['PowerBI','Data export','amber','Available']].map(i=>`
            <div class="toggle-row"><span class="f-ic t-${i[2]}" style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center">${MCIcon('zap')}</span>
              <span class="t-txt"><span class="t-nm">${i[0]}</span><span class="t-sub">${i[1]}</span></span>
              ${i[3]==='Connected'?UI.badge('Connected','green'):`<button class="btn btn-soft btn-sm">Connect</button>`}</div>`).join('')}`),
        // Security
        UI.card('Security',`
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Enforce 2FA for admins</span><span class="t-sub">TOTP or SMS fallback</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Session timeout</span><span class="t-sub">Sign out after 12 hours idle</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">Impersonation consent</span><span class="t-sub">Schools approve support access first</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">POPIA data residency</span><span class="t-sub">All data stored in za-north region</span></span><button class="toggle on" data-tg></button></div>
          <div class="toggle-row"><span class="t-txt"><span class="t-nm">IP allow-list for super admins</span><span class="t-sub">Restrict Control Centre logins</span></span><button class="toggle" data-tg></button></div>`),
      ];
      return `
        ${UI.pageHead('Settings','Platform configuration, branding and security.',
          `<button class="btn btn-primary" id="saveSet">${MCIcon('check')} Save Changes</button>`)}
        <div class="tabs">${tabs.map((t,i)=>`<button class="${setState.tab===i?'on':''}" data-stab="${i}">${t}</button>`).join('')}</div>
        <div id="setBody">${bodies[setState.tab]}</div>`;
    },
    mount(root){
      DB.settings=DB.settings||{tabs:{}};
      const saved=DB.settings.tabs[setState.tab];
      if(saved){
        root.querySelectorAll('[data-tg]').forEach((toggle,index)=>
          toggle.classList.toggle('on',Boolean(saved.toggles?.[index])));
        root.querySelectorAll('.color-dot').forEach((dot,index)=>
          dot.classList.toggle('on',Boolean(saved.colors?.[index])));
      }
      root.querySelectorAll('[data-stab]').forEach(b=>b.addEventListener('click',()=>{
        setState.tab=+b.dataset.stab;
        document.getElementById('content').innerHTML=Pages.settings.render();
        UI.hydrate(); Pages.settings.mount(document.getElementById('content'));
      }));
      root.addEventListener('click',e=>{
        const tg=e.target.closest('[data-tg]');
        if(tg){ tg.classList.toggle('on'); }
        const cd=e.target.closest('.color-dot');
        if(cd){
          cd.parentElement.querySelectorAll('.color-dot').forEach(x=>x.classList.remove('on'));
          cd.classList.add('on');
          const col=cd.style.background;
          const head=document.getElementById('wlHead');
          const btn=document.getElementById('wlBtn');
          const logo=document.getElementById('wlLogo');
          if(cd.dataset.wl==='p'&&head){ head.style.background=`linear-gradient(120deg,${col},${col}cc)`; if(logo) logo.style.background=col; }
          if(cd.dataset.wl==='s'&&btn){ btn.style.background=col; }
          UI.toast('Brand colour updated — preview refreshed');
        }
      });
      root.querySelector('#saveSet').addEventListener('click',()=>{
        DB.settings.tabs[setState.tab]={
          toggles:Array.from(root.querySelectorAll('[data-tg]')).map(toggle=>toggle.classList.contains('on')),
          colors:Array.from(root.querySelectorAll('.color-dot')).map(dot=>dot.classList.contains('on'))
        };
        DB.log('Updated settings','Settings tab '+setState.tab,'ok');
        App.refresh();UI.toast('Settings saved to Neon');
      });
      const rd=root.querySelector('#resetData');
      if(rd) rd.addEventListener('click',()=>UI.modal({
        title:'Reset demo data?',
        body:`<p>All your changes in this preview — approvals, new campuses, payments, uploads — will be cleared and the original demo data restored.</p>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-danger" data-s>${MCIcon('refresh')} Reset Everything</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{close();DB.reset();});
        }
      }));
    }
  };
})();
