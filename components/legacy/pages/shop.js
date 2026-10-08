/* Mobsie Connect — Shop: Products, Orders, Inventory */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN, R=DB.fmtR;

  function productArt(p,seed){
    if(p.imageUrl) return `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" style="width:100%;height:150px;display:block;object-fit:contain;background:var(--card-soft);padding:10px">`;
    return `<svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" style="width:100%;height:110px;display:block">
      <defs><linearGradient id="pa${seed}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.hue}" stop-opacity=".18"/><stop offset="1" stop-color="${p.hue}" stop-opacity=".38"/></linearGradient></defs>
      <rect width="200" height="140" fill="url(#pa${seed})"/>
      <circle cx="${40+seed*31%120}" cy="${30+seed*17%70}" r="26" fill="#fff" opacity=".5"/>
      <rect x="${70+seed*13%60}" y="${50+seed*7%40}" width="52" height="52" rx="14" fill="${p.hue}" opacity=".55"/>
    </svg>`;
  }

  Pages.products={
    render(){
      return `
        ${UI.pageHead('Products','School shop catalogue — uniforms, stationery and more, sold in the parent app.',
          `<button class="btn btn-primary" id="addProd">${MCIcon('plus')} Add Product</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'products',tint:'t-orange',label:'Active Products',value:String(DB.products.filter(p=>p.status!=='Hidden').length+16),deltaHtml:`<span class="delta flat">across 5 campus shops</span>`})}
          ${UI.statCard({icon:'orders',tint:'t-green',label:'Shop Revenue',value:'R86,400',deltaHtml:UI.delta(14,'up','this month')})}
          ${UI.statCard({icon:'trendUp',tint:'t-purple',label:'Best Seller',value:'Golf Shirt',deltaHtml:`<span class="delta flat">218 sold</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-red',label:'Stock Alerts',value:String(DB.products.filter(p=>p.stock<20).length),deltaHtml:`<span class="delta flat">${DB.products.filter(p=>p.stock===0).length} out of stock</span>`})}
        </div>
        <div class="grid cards-4">${DB.products.map((p,i)=>`
          <div class="card" style="overflow:hidden">
            ${productArt(p,i+2)}
            <div style="padding:14px 16px">
              <div style="display:flex;align-items:flex-start;gap:8px">
                <div style="min-width:0"><div style="font-weight:700;color:var(--ink-900)">${esc(p.name)}</div>
                <div class="small muted">${p.cat}</div></div>
                <span style="margin-left:auto;font-weight:800;color:var(--ink-900)">${R(p.price)}</span>
              </div>
              <div class="divider" style="margin:11px 0 10px"></div>
              <div style="display:flex;align-items:center;gap:8px">
                ${UI.status(p.status)}
                <span class="small muted" style="margin-left:auto">${p.sold} sold</span>
                <button class="icon-btn" data-pmenu="${i}">${MCIcon('more')}</button>
              </div>
            </div>
          </div>`).join('')}</div>`;
    },
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-pmenu]');
        if(!b) return;
        const p=DB.products[+b.dataset.pmenu];
        UI.menu(b,[
          {icon:'edit',label:'Edit product',onClick:()=>UI.modal({
            title:'Edit Product',
            body:`<div class="field"><label>Name</label><input type="text" data-f="name" value="${esc(p.name)}"></div>
              <div class="form-row">
                <div class="field"><label>Price (R)</label><input type="number" data-f="price" value="${p.price}"></div>
                <div class="field"><label>Category</label><select data-f="cat">${['Uniform','Stationery','Accessories','Books'].map(c=>`<option ${p.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
              </div>
              <div class="field"><label>Replace image (optional)</label><label class="file-picker">${MCIcon('upload')}<strong>Choose product image</strong><span data-file-name>PNG or JPG</span><input type="file" data-f="image" accept="image/png,image/jpeg"></label></div>`,
            foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save</button>`,
            mount(r,close){
              r.querySelector('[data-x]').addEventListener('click',close);
              const imageInput=r.querySelector('[data-f="image"]');
              imageInput.addEventListener('change',()=>{r.querySelector('[data-file-name]').textContent=imageInput.files[0]?.name||'PNG or JPG';});
              r.querySelector('[data-s]').addEventListener('click',async()=>{
                const v=UI.formVals(r);
                try{
                  const file=imageInput.files[0];
                  const imageData=file?await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);}):undefined;
                  const response=await MobsieApi.mutate('/api/shop/products',{method:'PUT',body:JSON.stringify({
                    id:p.id,name:v.name||p.name,category:v.cat,price:+v.price,stock:p.stock,
                    status:p.status==='Hidden'?'HIDDEN':p.stock===0?'OUT_OF_STOCK':'ACTIVE',imageData
                  })});
                  const saved=response.data[0];
                  Object.assign(p,{name:saved.name,price:Number(saved.price),cat:saved.category,stock:saved.stock,imageUrl:saved.imageUrl,status:saved.status==='HIDDEN'?'Hidden':saved.status==='OUT_OF_STOCK'?'Out of Stock':saved.stock<20?'Low Stock':'Active'});
                  close();UI.toast('Product updated in Neon');App.refresh();
                }catch(error){UI.toast(error.message,'alert');}
              });
            }
          })},
          {icon:'inventory',label:'Adjust stock',onClick:()=>App.go('inventory')},
          {icon:'pause',label:p.status==='Hidden'?'Show in shop':'Hide from shop',onClick:async()=>{
            const next=p.status==='Hidden'?(p.stock===0?'OUT_OF_STOCK':'ACTIVE'):'HIDDEN';
            try{
              await MobsieApi.mutate('/api/shop/products',{method:'PUT',body:JSON.stringify({
                id:p.id,name:p.name,category:p.cat,price:p.price,stock:p.stock,status:next
              })});
              p.status=next==='HIDDEN'?'Hidden':p.stock===0?'Out of Stock':p.stock<20?'Low Stock':'Active';
              UI.toast(p.status==='Hidden'?p.name+' hidden from the shop':p.name+' is live again');
              App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          }},
        ],{align:'right'});
      });
      root.querySelector('#addProd').addEventListener('click',()=>UI.modal({
        title:'Add Product',
        body:`<div class="form-row">
            <div class="field"><label>Product name</label><input type="text" data-f="name" placeholder="e.g. Summer Hat"></div>
            <div class="field"><label>Category</label><select data-f="cat"><option>Uniform</option><option>Stationery</option><option>Accessories</option><option>Books</option></select></div></div>
          <div class="form-row">
            <div class="field"><label>Price (R)</label><input type="number" data-f="price" placeholder="0.00"></div>
            <div class="field"><label>Initial stock</label><input type="number" data-f="stock" placeholder="0"></div></div>
          <div class="field"><label>Available in</label><select data-f="avail"><option>All campus shops</option><option>Selected campuses</option></select></div>
          <div class="field"><label>Product image</label><label class="file-picker">${MCIcon('upload')}<strong>Choose product image</strong><span data-file-name>PNG or JPG, up to 5 MB</span><input type="file" data-f="image" accept="image/png,image/jpeg"></label></div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Add Product</button>`,
        mount(r,close){
          const imageInput=r.querySelector('[data-f="image"]');
          imageInput.addEventListener('change',()=>{r.querySelector('[data-file-name]').textContent=imageInput.files[0]?.name||'PNG or JPG, up to 5 MB';});
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.name||!v.price){UI.toast('Product name and price are required','alert');return;}
            const hues=['#F97316','#16A34A','#7C3AED','#2563EB','#0D9488','#DB2777'];
            const stock=Math.round(+v.stock)||0;
            try{
              const file=imageInput.files[0];
              if(file&&file.size>5*1024*1024){UI.toast('Product image must be smaller than 5 MB','alert');return;}
              const imageData=file?await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);}):undefined;
              const response=await MobsieApi.mutate('/api/shop/products',{method:'POST',body:JSON.stringify({
                name:v.name,category:v.cat,price:+v.price,stock,status:stock===0?'OUT_OF_STOCK':'ACTIVE',imageData
              })});
              const saved=response.data[0];
              DB.products.unshift({id:saved.id,name:saved.name,cat:saved.category,price:Number(saved.price),stock:saved.stock,sold:saved.sold,
                status:saved.status==='OUT_OF_STOCK'?'Out of Stock':saved.stock<20?'Low Stock':'Active',imageUrl:saved.imageUrl,hue:hues[v.name.length%hues.length]});
              DB.log('Added product',v.name,'ok');
              close();UI.toast(v.name+' saved to Neon and published');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };

  Pages.orders={
    render(){
      const rows=App.scoped(DB.ordersList);
      const tbl=UI.table({
        pageSize:9, rows,
        onRow:o=>UI.drawer({
          title:'Order '+o.id,
          body:`
            <div style="display:flex;gap:8px;margin-bottom:18px">${UI.status(o.status)}</div>
            ${UI.dl([['Customer',esc(o.parent)],['School',esc(o.school)],['Items',esc(o.items)],['Total',`<b>${R(o.total)}</b>`],['Placed',esc(o.date)],['Collection','At reception, main branch']])}
            <div class="divider"></div>
            <h4 style="margin-bottom:10px">Order timeline</h4>
            <div class="feed">
              <div class="feed-item"><span class="f-ic t-green">${MCIcon('check')}</span><div class="f-txt"><div class="f-main">Paid in app</div><div class="f-sub">${esc(o.date)}</div></div></div>
              <div class="feed-item"><span class="f-ic t-blue">${MCIcon('products')}</span><div class="f-txt"><div class="f-main">Being prepared</div><div class="f-sub">School shop team</div></div></div>
              <div class="feed-item"><span class="f-ic t-amber">${MCIcon('push')}</span><div class="f-txt"><div class="f-main">Parent notified when ready</div><div class="f-sub">Automatic push notification</div></div></div>
            </div>`,
          foot:`<button class="btn btn-ghost" id="ordSlip">${MCIcon('printer')} Packing Slip</button>
                ${o.status==='Processing'?`<button class="btn btn-green" id="ordReady">${MCIcon('check')} Mark Ready</button>`
                 :o.status==='Ready for Collection'?`<button class="btn btn-green" id="ordDone">${MCIcon('check')} Mark Collected</button>`:''}`,
          mount(root,close){
            root.querySelector('#ordSlip').addEventListener('click',()=>UI.downloadCSV('packing-slip-'+o.id+'.csv',
              ['Order','Customer','Campus','Items','Total (R)','Placed'],
              [[o.id,o.parent,o.school,o.items,o.total,o.date]]));
            const rd=root.querySelector('#ordReady');
            if(rd) rd.addEventListener('click',async()=>{
              try{await MobsieApi.mutate('/api/shop/orders',{method:'PUT',body:JSON.stringify({id:o.dbId,status:'READY_FOR_COLLECTION'})});}catch(error){UI.toast(error.message,'alert');return;}
              o.status='Ready for Collection';
              DB.log('Order ready',o.id+' — '+o.parent,'ok');
              close();UI.toast(o.parent+' notified — order ready for collection');App.refresh();
            });
            const dn=root.querySelector('#ordDone');
            if(dn) dn.addEventListener('click',async()=>{
              try{await MobsieApi.mutate('/api/shop/orders',{method:'PUT',body:JSON.stringify({id:o.dbId,status:'COLLECTED'})});}catch(error){UI.toast(error.message,'alert');return;}
              o.status='Collected';
              close();UI.toast(o.id+' marked collected');App.refresh();
            });
          }
        }),
        columns:[
          {key:'id',label:'Order'},
          {key:'parent',label:'Customer',render:r=>UI.personCell(r.parent,r.school)},
          {key:'items',label:'Items'},
          {key:'total',label:'Total',num:true,render:r=>`<b>${R(r.total)}</b>`},
          {key:'date',label:'Placed'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      Pages.orders._tid=UI.lastTableId();
      return `
        ${UI.pageHead('Orders','Shop orders paid in-app, collected at school.',
          `<button class="btn btn-ghost">${MCIcon('download')} Export</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'orders',tint:'t-green',label:'Orders This Month',value:F(412),deltaHtml:UI.delta(14,'up','vs April')})}
          ${UI.statCard({icon:'waiting',tint:'t-amber',label:'Awaiting Collection',value:String(DB.ordersList.filter(o=>o.status==='Ready for Collection').length+15),deltaHtml:`<span class="delta flat">parents notified</span>`})}
          ${UI.statCard({icon:'wallet',tint:'t-purple',label:'Avg Order Value',value:'R229',deltaHtml:UI.delta(3,'up','vs April')})}
          ${UI.statCard({icon:'refresh',tint:'t-blue',label:'Refund Rate',value:'0.8%',deltaHtml:`<span class="delta flat">4 refunds</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Recent orders</h3></div><span class="spacer"></span>
          <div class="toolbar" style="margin:0"><div class="input-wrap" style="min-width:220px">${MCIcon('search')}<input id="oQ" placeholder="Search orders…"></div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){ root.querySelector('#oQ').addEventListener('input',e=>UI.tableFilter(Pages.orders._tid,e.target.value)); }
  };

  Pages.inventory={
    render(){
      const rows=DB.products.map(p=>({...p,
        reorder:p.stock===0?'Reorder now':(p.stock<20?'Reorder soon':'Healthy'),
        value:p.stock*p.price}));
      const tbl=UI.table({
        pageSize:9, rows,
        columns:[
          {key:'name',label:'Product',render:r=>`<div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${r.cat}</div>`},
          {key:'stock',label:'In stock',num:true,render:r=>`<b style="color:${r.stock===0?'var(--red-600)':r.stock<20?'var(--amber-600)':'var(--ink-900)'};font-variant-numeric:tabular-nums">${r.stock}</b>`},
          {key:'sold',label:'Sold (term)',num:true},
          {key:'value',label:'Stock value',num:true,render:r=>R(r.value)},
          {key:'stock',label:'Level',sortable:false,render:r=>{
            const pct=Math.min(100,Math.round(r.stock/4));
            const tone=r.stock===0?'red':r.stock<20?'amber':'';
            return `<div style="display:flex;align-items:center;gap:10px;min-width:130px"><span class="meter ${tone}"><i style="width:${Math.max(3,pct)}%"></i></span></div>`;}},
          {key:'reorder',label:'Reorder',render:r=>UI.badge(r.reorder,r.reorder==='Healthy'?'green':r.reorder==='Reorder soon'?'amber':'red')},
          {label:'',sortable:false,render:r=>`<button class="btn btn-soft btn-sm" data-restock="${esc(r.name)}">Restock</button>`},
        ],
      });
      return `
        ${UI.pageHead('Inventory','Live stock levels across every school shop.',
          `<button class="btn btn-ghost">${MCIcon('download')} Stock Report</button>
           <button class="btn btn-primary" id="receiveStock">${MCIcon('plus')} Receive Stock</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'inventory',tint:'t-blue',label:'SKUs Tracked',value:String(DB.products.length+16),deltaHtml:`<span class="delta flat">5 campus shops</span>`})}
          ${UI.statCard({icon:'wallet',tint:'t-green',label:'Stock Value',value:DB.fmtRk(DB.products.reduce((a,p)=>a+p.stock*p.price,0)),deltaHtml:`<span class="delta flat">at retail price</span>`})}
          ${UI.statCard({icon:'alert',tint:'t-amber',label:'Low Stock',value:String(DB.products.filter(p=>p.stock>0&&p.stock<20).length),deltaHtml:`<span class="delta flat">reorder suggested</span>`})}
          ${UI.statCard({icon:'x',tint:'t-red',label:'Out of Stock',value:String(DB.products.filter(p=>p.stock===0).length),deltaHtml:`<span class="delta flat">orders paused</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Stock levels</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-restock]');
        if(!b) return;
        const p=DB.products.find(x=>x.name===b.dataset.restock);
        if(p) receiveStock(p);
      });
      root.querySelector('#receiveStock').addEventListener('click',()=>receiveStock());
    }
  };

  function receiveStock(selected){
    UI.modal({
      title:'Receive Stock',
      body:`<div class="field"><label>Product</label><select data-f="product">${DB.products.map(p=>`<option value="${esc(p.id||'')}" ${selected===p?'selected':''}>${esc(p.name)} — ${p.stock} in stock</option>`).join('')}</select></div>
        <div class="field"><label>Quantity received</label><input type="number" min="1" value="50" data-f="quantity"></div>`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Stock</button>`,
      mount(r,close){
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const v=UI.formVals(r),p=DB.products.find(item=>item.id===v.product),quantity=Math.round(+v.quantity);
          if(!p||!quantity||quantity<1){UI.toast('Select a product and valid quantity','alert');return;}
          try{
            const response=await MobsieApi.mutate('/api/shop/inventory',{method:'PUT',body:JSON.stringify({productId:p.id,quantity})});
            p.stock=response.data.stock;p.status=p.stock<20?'Low Stock':(p.status==='Hidden'?'Hidden':'Active');
            DB.log('Restocked product',p.name+' (+'+quantity+' units)','ok');
            close();UI.toast(quantity+' units of '+p.name+' saved to Neon');App.refresh();
          }catch(error){UI.toast(error.message,'alert');}
        });
      }
    });
  }
})();
