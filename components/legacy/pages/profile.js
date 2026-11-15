/* Read-only profile for the currently signed-in Control Centre user. */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc;
  const formatDate=value=>value?new Date(value).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'}):'Never';
  Pages.profile={
    render(){return `${UI.pageHead('My Profile','Your assigned account details, role and access scope.')}<div id="myProfile"><div class="card"><div class="card-body"><div class="screen-skeleton" style="min-height:360px"><div class="skeleton-title"></div><div class="skeleton-subtitle"></div><div class="skeleton-panel"></div></div></div></div></div>`;},
    async mount(root){
      const host=root.querySelector('#myProfile');
      try{
        const response=await fetch('/api/auth/profile',{credentials:'include',cache:'no-store'}),body=await response.json().catch(()=>({}));
        if(!response.ok||!body.ok)throw new Error(body.error?.message||'Unable to load your profile.');
        const profile=body.data||{},permissions=Array.isArray(profile.permissions)?profile.permissions:[];
        const scope=profile.branchName?(profile.className?`${profile.branchName} · ${profile.className}`:profile.branchName):'Entire school group';
        host.innerHTML=`<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:20px">
          <div class="card"><div class="card-body" style="padding:28px"><div style="display:flex;align-items:center;gap:18px;padding-bottom:24px;border-bottom:1px solid var(--line)">
            ${UI.avatar(profile.name,'xl')}<div style="min-width:0"><h2 style="margin:0 0 5px;font-size:24px">${esc(profile.name||'User')}</h2><div class="muted">${esc(profile.email||'—')}</div></div><span style="margin-left:auto">${UI.status(profile.isActive?'Active':'Suspended')}</span></div>
            <div style="padding-top:24px">${UI.dl([['Dashboard role',esc(profile.roleName||'Not assigned')],['Access scope',esc(scope)],['Campus',esc(profile.branchName||'All campuses')],['Assigned class',esc(profile.className||'Not applicable')],['Last active',esc(formatDate(profile.lastLoginAt))],['Account created',esc(formatDate(profile.createdAt))]])}</div></div></div>
          <div class="card"><div class="card-head"><div><h3>Role permissions</h3><div class="sub">Dashboard areas assigned to your role</div></div></div><div class="card-body">
            ${permissions.length?`<div style="display:flex;flex-wrap:wrap;gap:9px">${permissions.map(permission=>UI.badge(esc(permission),'green')).join('')}</div>`:`<div class="muted">No dashboard permissions are assigned.</div>`}
            <div style="margin-top:24px;padding:16px;border-radius:14px;background:var(--bg);border:1px solid var(--line)"><div style="font-weight:800;margin-bottom:6px">Read-only profile</div><div class="muted small">You cannot change your details, role, campus, class or permissions here. A Super Admin or authorised principal must update them from Users and Roles &amp; Permissions.</div></div>
          </div></div></div>`;
      }catch(error){host.innerHTML=`<div class="card"><div class="card-body"><h3>Unable to load your profile</h3><p class="muted">${esc(error.message||'Please try again.')}</p><button class="btn btn-primary" data-retry>Try again</button></div></div>`;host.querySelector('[data-retry]')?.addEventListener('click',()=>this.mount(root));}
    }
  };
})();

