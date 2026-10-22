/* Mobsie Connect — Media: Gallery albums + Media Library */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN;

  // Decorative album art — layered SVG, no external images
  function albumArt(a,seed){
    if(a.imageUrl) return `<img class="g-art" src="${esc(a.imageUrl)}" alt="${esc(a.name)}" style="width:100%;height:100%;display:block;object-fit:cover">`;
    return `<svg class="g-art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="ga${seed}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a.hue2}"/><stop offset="1" stop-color="${a.hue1}"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#ga${seed})"/>
      <circle cx="${60+seed*37%280}" cy="${40+seed*53%180}" r="60" fill="#fff" opacity=".14"/>
      <circle cx="${300-seed*29%200}" cy="${210-seed*41%120}" r="90" fill="#fff" opacity=".10"/>
      <circle cx="${180+seed*17%160}" cy="${150+seed*23%100}" r="34" fill="#fff" opacity=".18"/>
      <path d="M0 240 Q100 ${200+seed*13%50} 200 235 T400 225 V300 H0 Z" fill="#fff" opacity=".16"/>
    </svg>`;
  }

  Pages.gallery={
    render(){
      const b=App.branchObj();
      const rows=b?DB.albums.filter(a=>a.branch===b.name):DB.albums;
      return `
        ${UI.pageHead('Gallery','Class and event photo albums — parents only ever see their own child\'s classes.',
          `<button class="btn btn-primary" id="upAlbum">${MCIcon('upload')} Upload Album</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'gallery',tint:'t-orange',label:'Photos This Month',value:F(DB.albums.reduce((a,x)=>a+x.count,0)+806),deltaHtml:UI.delta(18,'up','vs April')})}
          ${UI.statCard({icon:'media',tint:'t-purple',label:'Albums',value:F(DB.albums.length+40),deltaHtml:`<span class="delta flat">across 5 campuses</span>`})}
          ${UI.statCard({icon:'eye',tint:'t-blue',label:'Parent Views',value:F(18340),deltaHtml:UI.delta(22,'up','this month')})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Awaiting Approval',value:'7',deltaHtml:`<span class="delta flat">auto-blur enabled</span>`})}
        </div>
        <div class="gallery-grid">${rows.map(a=>{const i=DB.albums.indexOf(a);return `
          <div class="g-item" data-album="${i}">
            ${albumArt(a,i+3)}
            <div class="g-actions" aria-label="Picture actions">
              <button type="button" class="g-action" data-picture-edit="${i}" title="Edit picture">${MCIcon('edit')}<span>Edit</span></button>
              <button type="button" class="g-action" data-picture-rename="${i}" title="Rename picture">${MCIcon('file')}<span>Rename</span></button>
              <button type="button" class="g-action danger" data-picture-delete="${i}" title="Delete picture">${MCIcon('trash')}<span>Delete</span></button>
            </div>
            <div class="g-cap"><div class="g-nm">${esc(a.name)}</div>
            <div class="g-sub">${esc(a.branch)} · ${a.count} photos · ${a.date}</div></div>
          </div>`;}).join('')}
        </div>`;
    },
    mount(root){
      const savePictureChange=(message)=>{
        DB.save();
        UI.toast(message);
        App.refresh();
      };
      const fileToDataUrl=(file)=>new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error('The selected picture could not be read.'));
        reader.readAsDataURL(file);
      });

      root.querySelectorAll('[data-picture-edit]').forEach(button=>button.addEventListener('click',(event)=>{
        event.stopPropagation();
        const index=Number(button.dataset.pictureEdit);
        const picture=DB.albums[index];
        if(!picture)return;
        UI.modal({
          title:'Edit Picture',
          body:`<div class="field"><label>Picture title</label><input type="text" data-f="name" value="${esc(picture.name)}"></div>
            <div class="form-row">
              <div class="field"><label>Campus</label><select data-f="branch">${DB.liveBranches().map(branch=>`<option${branch.name===picture.branch?' selected':''}>${esc(branch.name)}</option>`).join('')}</select></div>
              <div class="field"><label>Photo count</label><input type="number" min="1" data-f="count" value="${Number(picture.count)||1}"></div>
            </div>
            <div class="field"><label>Uploaded date</label><input type="text" data-f="date" value="${esc(picture.date||'')}" placeholder="e.g. 22 Oct 2026"></div>
            <div class="field"><label>Replace picture <span class="muted">(optional)</span></label><label class="file-picker">${MCIcon('upload')}<strong>Choose a new picture</strong><span data-edit-file-name>PNG, JPG or WebP, up to 8 MB</span><input type="file" data-edit-image accept="image/png,image/jpeg,image/webp"></label></div>`,
          foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save changes</button>`,
          mount(modal,close){
            modal.querySelector('[data-x]').addEventListener('click',close);
            const imageInput=modal.querySelector('[data-edit-image]');
            imageInput.addEventListener('change',()=>{modal.querySelector('[data-edit-file-name]').textContent=imageInput.files[0]?.name||'PNG, JPG or WebP, up to 8 MB';});
            modal.querySelector('[data-s]').addEventListener('click',async()=>{
              const values=UI.formVals(modal);
              const replacement=imageInput.files[0];
              if(!values.name.trim()){UI.toast('Picture title is required','alert');return;}
              if(replacement&&replacement.size>8*1024*1024){UI.toast('Gallery pictures must be smaller than 8 MB','alert');return;}
              const saveButton=modal.querySelector('[data-s]');
              saveButton.disabled=true;
              saveButton.textContent='Saving…';
              try{
                let uploaded=null;
                if(replacement){
                  uploaded=await MobsieApi.mutate('/api/uploads',{method:'POST',body:JSON.stringify({fileData:await fileToDataUrl(replacement),originalName:replacement.name,purpose:'gallery'})});
                }
                Object.assign(picture,{
                  name:values.name.trim(),branch:values.branch,
                  count:Math.max(1,Number(values.count)||1),date:values.date.trim(),
                  ...(uploaded?{imageUrl:uploaded.data.url,publicId:uploaded.data.publicId}:{}),
                });
                DB.log('Edited gallery picture',picture.name+' — '+picture.branch,'ok');
                close();
                savePictureChange('Picture changes saved');
              }catch(error){
                saveButton.disabled=false;
                saveButton.textContent='Save changes';
                UI.toast(error.message||'Picture could not be updated','alert');
              }
            });
          }
        });
      }));

      root.querySelectorAll('[data-picture-rename]').forEach(button=>button.addEventListener('click',(event)=>{
        event.stopPropagation();
        const index=Number(button.dataset.pictureRename);
        const picture=DB.albums[index];
        if(!picture)return;
        UI.modal({
          title:'Rename Picture',
          body:`<div class="field"><label>New picture name</label><input type="text" data-f="name" value="${esc(picture.name)}" autofocus></div>`,
          foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Rename</button>`,
          mount(modal,close){
            modal.querySelector('[data-x]').addEventListener('click',close);
            modal.querySelector('[data-s]').addEventListener('click',()=>{
              const name=String(UI.formVals(modal).name||'').trim();
              if(!name){UI.toast('Enter a picture name','alert');return;}
              const previousName=picture.name;
              picture.name=name;
              DB.log('Renamed gallery picture',previousName+' → '+name,'ok');
              close();
              savePictureChange('Picture renamed');
            });
          }
        });
      }));

      root.querySelectorAll('[data-picture-delete]').forEach(button=>button.addEventListener('click',(event)=>{
        event.stopPropagation();
        const index=Number(button.dataset.pictureDelete);
        const picture=DB.albums[index];
        if(!picture)return;
        UI.modal({
          title:'Delete Picture',
          body:`<p>Delete <strong>${esc(picture.name)}</strong> from the gallery?</p><p class="small muted">Parents will no longer be able to view this picture. This action cannot be undone.</p>`,
          foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-danger" data-s>${MCIcon('trash')} Delete picture</button>`,
          mount(modal,close){
            modal.querySelector('[data-x]').addEventListener('click',close);
            modal.querySelector('[data-s]').addEventListener('click',()=>{
              const removed=DB.albums.splice(index,1)[0];
              DB.log('Deleted gallery picture',removed.name+' — '+removed.branch,'warn');
              close();
              savePictureChange('Picture deleted');
            });
          }
        });
      }));

      root.querySelectorAll('[data-album]').forEach(el=>el.addEventListener('click',(event)=>{
        if(event.target.closest('.g-actions'))return;
        const a=DB.albums[+el.dataset.album];
        UI.drawer({
          title:a.name,
          body:`
            <div style="border-radius:16px;overflow:hidden;position:relative;aspect-ratio:16/9;margin-bottom:18px">${albumArt(a,+el.dataset.album+3)}</div>
            ${UI.dl([['School',esc(a.school)],['Branch',esc(a.branch)],['Photos',String(a.count)],['Uploaded',esc(a.date)],['Visibility','Parents of tagged classes'],['Approved by','Branch principal']])}
            <div class="divider"></div>
            <div class="grid cards-3" style="gap:8px">${Array.from({length:6},(_,i)=>`
              <div style="border-radius:12px;overflow:hidden;aspect-ratio:1;position:relative">${albumArt(a,i*7+2)}</div>`).join('')}</div>`,
          foot:`<button class="btn btn-ghost" id="albDl">${MCIcon('download')} Download</button>
                <button class="btn btn-primary" id="albShare">${MCIcon('campaigns')} Share to Parents</button>`,
          mount(r,close){
            r.querySelector('#albDl').addEventListener('click',()=>{
              UI.downloadCSV(a.name.replace(/[^\w]+/g,'-').toLowerCase()+'-album.csv',
                ['Album','Branch','Photo count','Uploaded','Visibility'],
                [[a.name,a.branch,a.count,a.date,'Parents of tagged classes']]);
              UI.toast('Album manifest downloaded');
            });
            r.querySelector('#albShare').addEventListener('click',()=>{
              DB.pushLog.unshift({title:'New gallery album: '+a.name+' 📸',audience:a.branch,time:'Just now',
                delivered:Math.round((DB.branches.find(x=>x.name===a.branch)||{students:180}).students*0.78),
                opened:0,status:'Delivered'});
              DB.log('Shared album',a.name+' — '+a.branch,'ok');
              close();UI.toast('Album shared — parents got a push notification');App.refresh();
            });
          }
        });
      }));
      root.querySelector('#upAlbum').addEventListener('click',()=>UI.modal({
        title:'Upload Album',
        body:`<div class="field"><label>Album name</label><input type="text" data-f="name" placeholder="e.g. Heritage Day 2026"></div>
          <div class="form-row">
            <div class="field"><label>Campus</label><select data-f="branch">${DB.liveBranches().map(b=>`<option>${UI.esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Photos</label><input type="number" data-f="count" value="1" readonly></div>
          </div>
          <div class="field"><label>Album cover photo</label><label class="file-picker">${MCIcon('upload')}<strong>Choose a gallery photo</strong><span data-file-name>PNG or JPG, up to 8 MB</span><input type="file" data-f="image" accept="image/png,image/jpeg,image/webp"></label></div>
          <p class="small muted">Photos go to the campus principal for approval before parents see them.</p>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${MCIcon('upload')} Upload</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          const imageInput=r.querySelector('[data-f="image"]');
          imageInput.addEventListener('change',()=>{r.querySelector('[data-file-name]').textContent=imageInput.files[0]?.name||'PNG or JPG, up to 8 MB';});
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            const file=imageInput.files[0];
            if(!v.name||!file){UI.toast('Album name and photo are required','alert');return;}
            if(file.size>8*1024*1024){UI.toast('Gallery photos must be smaller than 8 MB','alert');return;}
            const hues=[['#F97316','#FDBA74'],['#16A34A','#86EFAC'],['#7C3AED','#C4B5FD'],['#2563EB','#93C5FD'],['#0D9488','#5EEAD4'],['#DB2777','#F9A8D4']];
            const h=hues[v.name.length%hues.length];
            try{
              const fileData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
              const response=await MobsieApi.mutate('/api/uploads',{method:'POST',body:JSON.stringify({fileData,originalName:file.name,purpose:'gallery'})});
              DB.albums.unshift({name:v.name,school:DB.SCHOOL_NAME,branch:v.branch,count:1,
                date:new Date().toLocaleDateString('en-ZA'),hue1:h[0],hue2:h[1],
                imageUrl:response.data.url,publicId:response.data.publicId});
              DB.log('Uploaded album',v.name+' — '+v.branch,'ok');
              DB.save();
              close();UI.toast('Album saved to Neon with its Cloudinary photo');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };

  Pages.media={
    render(){
      const ICONS={Video:'video',Image:'gallery',Audio:'mic',Document:'file'};
      const TINTS={Video:'t-purple',Image:'t-orange',Audio:'t-teal',Document:'t-blue'};
      const tbl=UI.table({
        pageSize:8, rows:DB.mediaFiles,
        columns:[
          {key:'name',label:'File',render:r=>`<div class="person-cell"><span class="f-ic ${TINTS[r.type]}" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center">${MCIcon(ICONS[r.type])}</span><div class="pc-txt"><div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${r.type} · ${r.size}</div></div></div>`},
          {key:'school',label:'School'},
          {key:'by',label:'Uploaded by',render:r=>UI.personCell(r.by)},
          {key:'date',label:'Date'},
          {label:'',sortable:false,render:r=>`<span style="display:inline-flex;gap:4px"><button class="icon-btn" data-fdl="${esc(r.name)}">${MCIcon('download')}</button><button class="icon-btn" data-fcopy="${esc(r.name)}">${MCIcon('copy')}</button><button class="icon-btn" data-fdel="${esc(r.name)}">${MCIcon('trash')}</button></span>`},
        ],
      });
      return `
        ${UI.pageHead('Media Library','Every file behind your school — branded assets, videos, documents.',
          `<button class="btn btn-primary" id="upFiles">${MCIcon('upload')} Upload Files</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'database',tint:'t-purple',label:'Storage Used',value:'324 GB',deltaHtml:`<span class="delta flat">of 1 TB school pool</span>`})}
          ${UI.statCard({icon:'media',tint:'t-orange',label:'Total Files',value:F(DB.mediaFiles.length+8404),deltaHtml:UI.delta(6,'up','this month')})}
          ${UI.statCard({icon:'video',tint:'t-blue',label:'Videos',value:F(214),deltaHtml:`<span class="delta flat">84 GB</span>`})}
          ${UI.statCard({icon:'file',tint:'t-teal',label:'Documents',value:F(1102),deltaHtml:`<span class="delta flat">shared with campuses</span>`})}
        </div>
        <div class="card" style="margin-bottom:20px"><div class="card-body">
          ${UI.meterRow('Photos & albums',52,'orange',' %')}
          ${UI.meterRow('Video',23,'purple',' %')}
          ${UI.meterRow('Documents',16,'blue',' %')}
          ${UI.meterRow('Audio & other',9,'teal',' %')}
        </div></div>
        <div class="card"><div class="card-head"><div><h3>Recent uploads</h3></div><span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="mQ" placeholder="Search files…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      const tid=UI.lastTableId();
      root.querySelector('#mQ').addEventListener('input',e=>UI.tableFilter(tid,e.target.value));
      root.addEventListener('click',e=>{
        const del=e.target.closest('[data-fdel]');
        if(del){
          const i=DB.mediaFiles.findIndex(f=>f.name===del.dataset.fdel);
          if(i>=0){const f=DB.mediaFiles.splice(i,1)[0];DB.log('Deleted file',f.name,'warn');
            UI.toast('Deleted '+f.name);App.refresh();}
          return;
        }
        if(e.target.closest('[data-fcopy]')){UI.toast('Share link copied to clipboard');return;}
        if(e.target.closest('[data-fdl]')){
          const name=e.target.closest('[data-fdl]').dataset.fdl;
          const file=DB.mediaFiles.find(item=>item.name===name);
          UI.downloadCSV(name.replace(/[^\w]+/g,'-').toLowerCase()+'-metadata.csv',
            ['Name','Type','Size','Campus','Uploaded by','Date'],
            [[file?.name,file?.type,file?.size,file?.school,file?.by,file?.date]]);
          UI.toast('File metadata downloaded');
        }
      });
      root.querySelector('#upFiles').addEventListener('click',()=>UI.modal({
        title:'Upload Files',
        body:`<div class="field"><label>File name</label><input type="text" data-f="name" placeholder="e.g. winter-concert-poster.png"></div>
          <div class="form-row">
            <div class="field"><label>Type</label><select data-f="type"><option>Image</option><option>Video</option><option>Document</option><option>Audio</option></select></div>
            <div class="field"><label>Campus</label><select data-f="school"><option>Head Office</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${MCIcon('upload')} Upload</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            if(!v.name){UI.toast('Name the file first','alert');return;}
            DB.mediaFiles.unshift({name:v.name,type:v.type,size:DB.ri(1,48)/10+' MB',school:v.school,
              by:'Thandi Admin',date:'May 18, 2026'});
            DB.log('Uploaded file',v.name,'ok');
            close();UI.toast(v.name+' uploaded');App.refresh();
          });
        }
      }));
    }
  };
})();
