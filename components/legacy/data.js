/* Mobsie Connect — demo data for the real school group:
   ONE school · 5 live campuses (Soshanguve ×2, Mamelodi, Cosmo City, Sky-City)
   plus an expansion pipeline (Atteridgeville, Soweto, Thembisa).
   Deterministic (seeded) so every load renders the same. */
(function(){
  // ← Change the school group's name here — it flows through the whole app.
  const SCHOOL_NAME='Mobsie Connect';

  // --- Seeded RNG -------------------------------------------------------
  let _s=20260518;
  function rnd(){ _s|=0; _s=_s+0x6D2B79F5|0; let t=Math.imul(_s^_s>>>15,1|_s);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }
  const ri=(a,b)=>Math.floor(rnd()*(b-a+1))+a;
  const pick=a=>a[Math.floor(rnd()*a.length)];

  // --- Pools ------------------------------------------------------------
  const FIRST=['Thandi','Lebo','Sipho','Bongani','Naledi','Kagiso','Palesa','Tshepo','Zanele','Ayanda','Nomvula','Katlego','Karabo','Mpho','Refilwe','Themba','Lerato','Boitumelo','Neo','Amahle','Sibusiso','Nandi','Tumelo','Dineo','Khanyi','Lwazi','Precious','Gugu','Vusi','Zodwa','Prince','Busisiwe','Andile','Ntombi','Sello','Mandla','Portia','Musa','Nthabiseng','Solly'];
  const LAST=['Motaung','Dlamini','Nkosi','Mokoena','Khumalo','Mahlangu','Ndlovu','Sithole','Mabaso','Zwane','Tshabalala','Molefe','Maluleke','Baloyi','Chauke','Ngobeni','Tau','Mnisi','Radebe','Sibiya','Mthembu','Maseko','Nxumalo','Shabangu','Kekana','Modise','Phiri','Mashaba','Sekhukhune','Lekota'];
  // 2026 Mobsie Kids curriculum stages (GDE grade codes: 0000, 000, 00, 0, R).
  const GRADES=['Stage 1 — Bambino (6–18 months)','Stage 2 — Shapes (2–3 years)','Stage 3 — Colours (3–4 years)','Stage 4 — Alphabets (4–5 years)','Grade R — Numbers (5–6 years)'];
  const AV=['#F97316','#16A34A','#7C3AED','#2563EB','#0D9488','#DB2777','#D97706','#DC2626'];

  const name=()=>pick(FIRST)+' '+pick(LAST);
  const initials=n=>n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const avColor=n=>AV[(n.length*7+n.charCodeAt(0))%AV.length];
  const email=n=>n.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,'.')+'@'+pick(['gmail.com','outlook.com','yahoo.com','icloud.com']);
  const phone=()=>'0'+pick(['61','62','71','72','73','82','83','84'])+' '+ri(100,999)+' '+String(ri(0,9999)).padStart(4,'0');

  // --- Formatters -------------------------------------------------------
  const fmtN=n=>n.toLocaleString('en-ZA');
  const fmtR=n=>'R'+Math.round(n).toLocaleString('en-ZA');
  const fmtRk=n=>n>=1e6?'R'+(n/1e6).toFixed(1)+'M':n>=1e3?'R'+(n/1e3).toFixed(0)+'K':'R'+Math.round(n);

  // --- The school -------------------------------------------------------
  const schools=[{
    id:'sch-1', name:SCHOOL_NAME, city:'Pretoria & Johannesburg',
    owner:'Thandi Admin', ownerEmail:'thandi@mobsie.co.za', phone:'012 555 0182',
    plan:'Enterprise', planFee:4999, status:'Active', perf:94,
    branches:5, students:0, parents:0, teachers:0, mrr:0,   // totals filled below
    joined:'Jan 2021', color:'#F97316', initials:initials(SCHOOL_NAME),
    storageGB:64, seats:80,
  }];
  const school=schools[0];

  // --- The five live campuses + expansion pipeline ----------------------
  const branches=[
    {id:'br-0',schoolId:'sch-1',school:SCHOOL_NAME,name:'Soshanguve Branch 1',city:'Soshanguve',region:'Pretoria',
     principal:'Naledi Khumalo',students:232,teachers:15,revenue:429000,attendance:93,phone:phone(),status:'Active',since:'Jan 2021'},
    {id:'br-1',schoolId:'sch-1',school:SCHOOL_NAME,name:'Soshanguve Branch 2',city:'Soshanguve',region:'Pretoria',
     principal:'Sipho Dlamini',students:168,teachers:11,revenue:311000,attendance:91,phone:phone(),status:'Active',since:'Aug 2022'},
    {id:'br-2',schoolId:'sch-1',school:SCHOOL_NAME,name:'Mamelodi Branch',city:'Mamelodi',region:'Pretoria',
     principal:'Lerato Mokoena',students:189,teachers:12,revenue:350000,attendance:92,phone:phone(),status:'Active',since:'Jan 2023'},
    {id:'br-3',schoolId:'sch-1',school:SCHOOL_NAME,name:'Cosmo City Branch',city:'Cosmo City, Randburg',region:'Johannesburg',
     principal:'Ayanda Sithole',students:246,teachers:16,revenue:455000,attendance:94,phone:phone(),status:'Active',since:'Jan 2024'},
    {id:'br-4',schoolId:'sch-1',school:SCHOOL_NAME,name:'Sky-City Branch',city:'Sky-City, Alberton',region:'Johannesburg',
     principal:'Kagiso Zwane',students:175,teachers:12,revenue:324000,attendance:90,phone:phone(),status:'Active',since:'Jul 2025'},
    // Expansion pipeline — announced, not yet open
    {id:'br-5',schoolId:'sch-1',school:SCHOOL_NAME,name:'Atteridgeville Branch',city:'Atteridgeville',region:'Pretoria',
     principal:'To be appointed',students:0,teachers:0,revenue:0,attendance:0,phone:'—',status:'Coming Soon',since:'Opening 2027'},
    {id:'br-6',schoolId:'sch-1',school:SCHOOL_NAME,name:'Soweto Branch',city:'Soweto',region:'Johannesburg',
     principal:'To be appointed',students:0,teachers:0,revenue:0,attendance:0,phone:'—',status:'Coming Soon',since:'Opening 2027'},
    {id:'br-7',schoolId:'sch-1',school:SCHOOL_NAME,name:'Thembisa Branch',city:'Thembisa',region:'Johannesburg',
     principal:'To be appointed',students:0,teachers:0,revenue:0,attendance:0,phone:'—',status:'Coming Soon',since:'Opening 2027'},
  ];
  const liveBranches=()=>branches.filter(b=>b.status!=='Coming Soon');

  // --- Aggregates -------------------------------------------------------
  const live=liveBranches();
  school.students=live.reduce((a,b)=>a+b.students,0);          // 1,010
  school.parents=Math.round(school.students*0.78);             // 788
  school.teachers=live.reduce((a,b)=>a+b.teachers,0);          // 66
  school.mrr=live.reduce((a,b)=>a+b.revenue,0);                // R1.869M fees / month
  const totals={
    schools:1, branches:live.length,
    students:school.students, parents:school.parents,
    teachers:school.teachers, mrr:school.mrr,
  };

  // --- People (samples shown in directories) ----------------------------
  const brOf=()=>pick(live);
  const teachers=[],parents=[],learners=[];
  const principals=live.map(b=>b.principal);
  for(let i=0;i<24;i++){
    const b=brOf(); const n=i<5?principals[i]:name();
    teachers.push({id:'t-'+i,name:n,email:email(n),phone:phone(),school:SCHOOL_NAME,schoolId:'sch-1',branch:b.name,
      grade:pick(GRADES),cls:pick(GRADES)+' '+pick(['A','B']),students:ri(14,24),
      years:ri(1,14),rating:(ri(38,50)/10).toFixed(1),status:rnd()<.93?'Active':'On Leave'});
  }
  for(let i=0;i<36;i++){
    const b=brOf(); const n=name();
    parents.push({id:'p-'+i,name:n,email:email(n),phone:phone(),school:SCHOOL_NAME,schoolId:'sch-1',branch:b.name,
      children:ri(1,3),balance:rnd()<.74?0:ri(450,6200),status:rnd()<.9?'Active':'Overdue',
      joined:`${pick(['Jan','Feb','Mar','Apr','May'])} ${ri(2022,2026)}`});
  }
  for(let i=0;i<48;i++){
    const b=brOf(); const p=pick(parents);
    const n=pick(FIRST)+' '+p.name.split(' ')[1];
    learners.push({id:'l-'+i,name:n,school:SCHOOL_NAME,schoolId:'sch-1',branch:b.name,grade:pick(GRADES),
      cls:pick(['A','B']),parent:p.name,age:ri(2,7),attendance:ri(82,99),
      fees:rnd()<.8?'Paid':'Outstanding',status:rnd()<.95?'Enrolled':'On Hold'});
  }

  // --- Admissions -------------------------------------------------------
  const APP_STATUS=['Pending Review','Documents Required','Interview Scheduled','Approved','Waitlisted'];
  const appCounts=[16,8,6,5,3]; // 38 total this intake
  const applications=[];
  for(let i=0;i<20;i++){
    const b=brOf(); const pn=name();
    applications.push({id:'APP-'+String(1042+i),child:pick(FIRST)+' '+pn.split(' ')[1],parent:pn,
      email:email(pn),phone:phone(),school:SCHOOL_NAME,schoolId:'sch-1',branch:b.name,grade:pick(GRADES),
      status:i<6?'Pending Review':pick(APP_STATUS),date:`May ${ri(2,18)}, 2026`,docs:ri(2,6)});
  }
  const interviews=Array.from({length:8},(_,i)=>{
    const a=pick(applications);
    return {id:'INT-'+(201+i),child:a.child,parent:a.parent,school:SCHOOL_NAME,branch:a.branch,grade:a.grade,
      date:`May ${ri(19,29)}, 2026`,time:`${ri(8,14)}:${pick(['00','30'])}`,
      interviewer:pick(principals),mode:pick(['In-person','Virtual']),status:pick(['Scheduled','Scheduled','Confirmed','Completed'])};
  });
  const waitingList=Array.from({length:12},(_,i)=>{
    const b=brOf(); const pn=name();
    return {id:'WL-'+(88+i),child:pick(FIRST)+' '+pn.split(' ')[1],parent:pn,school:SCHOOL_NAME,branch:b.name,
      grade:pick(GRADES),position:i+1,since:`${pick(['Feb','Mar','Apr'])} ${ri(3,28)}, 2026`,
      priority:pick(['Standard','Standard','Sibling','Staff Child'])};
  });

  // --- Finance ----------------------------------------------------------
  const payMethods=['Card','EFT','Debit Order','Cash','SnapScan'];
  const payments=Array.from({length:30},(_,i)=>{
    const p=pick(parents);
    return {id:'PAY-'+String(9032-i),parent:p.name,school:SCHOOL_NAME,branch:p.branch,
      amount:ri(9,48)*50,method:pick(payMethods),date:`May ${ri(1,18)}, 2026`,
      status:rnd()<.88?'Successful':(rnd()<.5?'Pending':'Failed'),ref:'INV-'+String(880-i).padStart(6,'0')};
  });
  const invoices=Array.from({length:28},(_,i)=>{
    const p=pick(parents);
    const st=rnd()<.66?'Paid':(rnd()<.55?'Due':'Overdue');
    return {id:'INV-'+String(880-i).padStart(6,'0'),parent:p.name,school:SCHOOL_NAME,branch:p.branch,
      desc:pick(['Monthly Fees — May','Registration Fee','Aftercare — May','Stationery Pack','Uniform Order','School Trip — Zoo']),
      amount:ri(9,52)*50,issued:`May ${ri(1,12)}, 2026`,due:`May ${ri(15,31)}, 2026`,status:st};
  });
  const discounts=[
    {code:'SIBLING10',desc:'Sibling discount — 2nd child',type:'10% off fees',uses:64,limit:'Unlimited',status:'Active',schools:'All campuses'},
    {code:'EARLYBIRD27',desc:'2027 early registration',type:'R500 off',uses:31,limit:'200',status:'Active',schools:'All campuses'},
    {code:'STAFF50',desc:'Staff children',type:'50% off fees',uses:12,limit:'Unlimited',status:'Active',schools:'All campuses'},
    {code:'WINTER15',desc:'Winter enrolment promo',type:'15% off first month',uses:18,limit:'100',status:'Scheduled',schools:'Cosmo City · Sky-City'},
    {code:'LOYALTY5',desc:'Founding families — Soshanguve',type:'5% off fees',uses:47,limit:'Unlimited',status:'Active',schools:'Soshanguve 1 & 2'},
    {code:'OPENDAY26',desc:'Open day sign-up promo',type:'R250 off registration',uses:88,limit:'88',status:'Expired',schools:'All campuses'},
  ];

  // --- Communications ---------------------------------------------------
  const conversations=Array.from({length:10},(_,i)=>{
    const p=pick(parents);
    const msgs=[];
    const openers=['Good morning! I wanted to ask about the school trip next week.','Hi, is the aftercare programme running this Friday?','Hello, my child will be absent tomorrow due to a doctor\'s appointment.','Hi there — I haven\'t received this month\'s invoice yet.','Good day, can I update my contact details on the app?'];
    msgs.push({dir:'in',text:openers[i%openers.length],time:`0${ri(8,9)}:${ri(10,59)}`});
    msgs.push({dir:'out',text:'Good morning! Thanks for reaching out — let me check that for you right away. 😊',time:`0${ri(8,9)}:${ri(10,59)}`});
    msgs.push({dir:'in',text:'Thank you so much, I appreciate it!',time:`${ri(10,11)}:${ri(10,59)}`});
    msgs.push({dir:'out',text:'All sorted! You should see the update in your Mobsie app now. Have a lovely day!',time:`${ri(10,11)}:${ri(10,59)}`});
    return {id:'c-'+i,who:p.name,school:SCHOOL_NAME,branch:p.branch,unread:i<3?ri(1,4):0,
      time:i<4?`${ri(2,55)}m`:`${ri(1,9)}h`,msgs,preview:msgs[0].text};
  });
  const newsletters=[
    {title:'May Updates',audience:'All campuses',sent:'May 17, 2026',recipients:788,openRate:71,status:'Sent'},
    {title:'Winter Uniform Reminder',audience:'All campuses',sent:'May 12, 2026',recipients:781,openRate:62,status:'Sent'},
    {title:'Sports Day — Soshanguve',audience:'Soshanguve Branch 1 & 2',sent:'May 9, 2026',recipients:312,openRate:84,status:'Sent'},
    {title:'Term 2 Calendar',audience:'All campuses',sent:'Apr 28, 2026',recipients:774,openRate:76,status:'Sent'},
    {title:'June Holiday Programme',audience:'All campuses',sent:'—',recipients:0,openRate:0,status:'Draft'},
  ];
  const pushLog=[
    {title:'Gate closes 17:30 today ⏰',audience:'Cosmo City Branch',time:'Today, 14:02',delivered:192,opened:154,status:'Delivered'},
    {title:'New gallery photos 📸',audience:'Soshanguve Branch 1',time:'Today, 11:20',delivered:181,opened:149,status:'Delivered'},
    {title:'Invoice ready — May fees',audience:'All campuses',time:'Yesterday, 08:00',delivered:779,opened:598,status:'Delivered'},
    {title:'Sports Day this Friday! 🏆',audience:'Soshanguve Branch 1 & 2',time:'May 16, 09:12',delivered:309,opened:281,status:'Delivered'},
    {title:'Load shedding: early pickup',audience:'Mamelodi Branch',time:'May 15, 12:45',delivered:146,opened:139,status:'Delivered'},
  ];
  const smsLog=[
    {to:'All parents — Cosmo City',msg:'Reminder: Parent meeting tomorrow 18:00 in the main hall.',time:'Today, 12:30',count:189,status:'Delivered'},
    {to:'Overdue accounts (all campuses)',msg:'Friendly reminder: your May invoice is due. Pay in the Mobsie app.',time:'Yesterday, 09:00',count:64,status:'Delivered'},
    {to:'Grade R parents — Soshanguve 1',msg:'Grade R outing to the planetarium on 26 May. Permission slips due Friday.',time:'May 15, 10:15',count:41,status:'Delivered'},
    {to:'All parents — Sky-City',msg:'School closed Monday 25 May (staff training). Aftercare available.',time:'May 14, 14:40',count:138,status:'Delivered'},
  ];
  const campaigns=[
    {name:'2027 Enrolment Drive',subject:'Secure your child\'s place for 2027 🎒',audience:'Waiting list + open-day leads',sent:642,openRate:52,clickRate:14,status:'Running'},
    {name:'May Fee Reminder',subject:'Your May statement is ready',audience:'All active parents',sent:779,openRate:72,clickRate:33,status:'Completed'},
    {name:'Winter Holiday Club',subject:'Fun-filled winter holiday programme ❄️',audience:'All campuses — opt-in',sent:611,openRate:56,clickRate:21,status:'Completed'},
    {name:'Refer-a-Friend',subject:'Give R500, get R500',audience:'Engaged parents (90d)',sent:418,openRate:47,clickRate:11,status:'Paused'},
  ];
  const feedback=Array.from({length:9},(_,i)=>{
    const p=pick(parents);
    const txt=['The new app update is fantastic — love the gallery!','Please add more vegetarian lunch options.','Teacher Naledi has been wonderful with my son.','Pickup queue at Cosmo City is too slow on Fridays.','Could we get invoices as PDF downloads?','The sports day was beautifully organised. Thank you!','More notice for casual days please.','Learning updates arrive quite late in the evening.','Reception staff at Sky-City are always so friendly.'][i];
    return {id:'FB-'+(301+i),who:p.name,school:p.branch,rating:ri(3,5),text:txt,
      date:`May ${ri(8,18)}, 2026`,status:i<2?'New':pick(['Reviewed','Responded','Reviewed']),topic:pick(['App','Food','Staff','Operations','Payments','Events'])};
  });

  // --- Media ------------------------------------------------------------
  const albums=[
    {name:'Sports Day 2026',school:SCHOOL_NAME,branch:'Soshanguve Branch 1',count:84,date:'May 16, 2026',hue1:'#F97316',hue2:'#FDBA74'},
    {name:'Grade R Farm Trip',school:SCHOOL_NAME,branch:'Mamelodi Branch',count:56,date:'May 14, 2026',hue1:'#16A34A',hue2:'#86EFAC'},
    {name:'Art Week Exhibition',school:SCHOOL_NAME,branch:'Cosmo City Branch',count:41,date:'May 12, 2026',hue1:'#7C3AED',hue2:'#C4B5FD'},
    {name:'Mother\'s Day Tea',school:SCHOOL_NAME,branch:'Sky-City Branch',count:63,date:'May 10, 2026',hue1:'#DB2777',hue2:'#F9A8D4'},
    {name:'Science Fun Day',school:SCHOOL_NAME,branch:'Soshanguve Branch 2',count:38,date:'May 8, 2026',hue1:'#2563EB',hue2:'#93C5FD'},
    {name:'Autumn Picnic',school:SCHOOL_NAME,branch:'Mamelodi Branch',count:47,date:'May 5, 2026',hue1:'#D97706',hue2:'#FCD34D'},
    {name:'Book Character Day',school:SCHOOL_NAME,branch:'Soshanguve Branch 1',count:72,date:'Apr 30, 2026',hue1:'#0D9488',hue2:'#5EEAD4'},
    {name:'Graduation Rehearsal',school:SCHOOL_NAME,branch:'Cosmo City Branch',count:29,date:'Apr 26, 2026',hue1:'#DC2626',hue2:'#FCA5A5'},
  ];
  const mediaFiles=[
    {name:'sports-day-highlights.mp4',type:'Video',size:'248 MB',school:'Soshanguve Branch 1',by:'Sipho Dlamini',date:'May 16, 2026'},
    {name:'newsletter-may-banner.png',type:'Image',size:'1.2 MB',school:'Head Office',by:'Thandi Admin',date:'May 15, 2026'},
    {name:'grade-r-song.mp3',type:'Audio',size:'6.4 MB',school:'Soshanguve Branch 1',by:'Naledi Khumalo',date:'May 14, 2026'},
    {name:'winter-menu-2026.pdf',type:'Document',size:'840 KB',school:'Head Office',by:'Thandi Admin',date:'May 13, 2026'},
    {name:'art-week-collage.jpg',type:'Image',size:'3.1 MB',school:'Cosmo City Branch',by:'Ayanda Sithole',date:'May 12, 2026'},
    {name:'fire-drill-notice.pdf',type:'Document',size:'220 KB',school:'Sky-City Branch',by:'Kagiso Zwane',date:'May 11, 2026'},
    {name:'open-day-promo.mp4',type:'Video',size:'96 MB',school:'Head Office',by:'Thandi Admin',date:'May 9, 2026'},
    {name:'mothers-day-tea.jpg',type:'Image',size:'2.7 MB',school:'Sky-City Branch',by:'Zanele Mabaso',date:'May 10, 2026'},
  ];

  // --- Shop -------------------------------------------------------------
  const products=[
    {name:'Winter Tracksuit',cat:'Uniform',price:420,stock:86,sold:142,status:'Active',hue:'#F97316'},
    {name:'School Golf Shirt',cat:'Uniform',price:180,stock:122,sold:218,status:'Active',hue:'#16A34A'},
    {name:'Mobsie Backpack',cat:'Accessories',price:350,stock:34,sold:115,status:'Active',hue:'#7C3AED'},
    {name:'Stationery Pack — Gr R',cat:'Stationery',price:260,stock:12,sold:170,status:'Low Stock',hue:'#2563EB'},
    {name:'Sun Hat',cat:'Uniform',price:95,stock:140,sold:188,status:'Active',hue:'#D97706'},
    {name:'Art Smock',cat:'Uniform',price:120,stock:0,sold:98,status:'Out of Stock',hue:'#DB2777'},
    {name:'Water Bottle 500ml',cat:'Accessories',price:85,stock:210,sold:302,status:'Active',hue:'#0D9488'},
    {name:'Reader Set — Level 1',cat:'Books',price:310,stock:28,sold:74,status:'Active',hue:'#DC2626'},
  ];
  const ordersList=Array.from({length:20},(_,i)=>{
    const p=pick(parents), pr=pick(products), qty=ri(1,3);
    return {id:'ORD-'+String(4410-i),parent:p.name,school:p.branch,items:qty+' × '+pr.name,
      total:pr.price*qty,date:`May ${ri(8,18)}, 2026`,
      status:pick(['Processing','Ready for Collection','Collected','Collected','Processing'])};
  });

  // --- Documents / support / users / audit ------------------------------
  const documentsList=[
    {name:'2026 Enrolment Policy.pdf',folder:'Policies',size:'1.4 MB',by:'Thandi Admin',date:'May 12, 2026',shared:'All campuses'},
    {name:'POPIA Compliance Pack.zip',folder:'Compliance',size:'12 MB',by:'Thandi Admin',date:'May 8, 2026',shared:'Principals'},
    {name:'Teacher Onboarding Guide.docx',folder:'HR',size:'860 KB',by:'Lerato Mokoena',date:'May 6, 2026',shared:'All campuses'},
    {name:'Fee Structure 2026.xlsx',folder:'Finance',size:'240 KB',by:'Prince Tau',date:'Apr 30, 2026',shared:'Finance team'},
    {name:'Emergency Procedures.pdf',folder:'Safety',size:'2.2 MB',by:'Thandi Admin',date:'Apr 24, 2026',shared:'All campuses'},
    {name:'Expansion Plan — Atteridgeville.pdf',folder:'Expansion',size:'4.8 MB',by:'Thandi Admin',date:'Apr 18, 2026',shared:'Head Office'},
    {name:'Curriculum Map — Term 2.pdf',folder:'Academics',size:'3.6 MB',by:'Naledi Khumalo',date:'Apr 15, 2026',shared:'All teachers'},
  ];
  const tickets=[
    {id:'TIC-1208',subject:'Cannot upload gallery photos',school:'Soshanguve Branch 1',by:'Sipho Dlamini',priority:'High',status:'Open',age:'2h',agent:'Unassigned'},
    {id:'TIC-1207',subject:'Invoice totals not matching statement',school:'Head Office',by:'Prince Tau',priority:'Urgent',status:'In Progress',age:'5h',agent:'Katlego M.'},
    {id:'TIC-1206',subject:'Set up Atteridgeville as a new campus',school:'Head Office',by:'Thandi Admin',priority:'Normal',status:'In Progress',age:'1d',agent:'Katlego M.'},
    {id:'TIC-1205',subject:'Parent app login loop on Android',school:'Sky-City Branch',by:'Kagiso Zwane',priority:'High',status:'Open',age:'1d',agent:'Unassigned'},
    {id:'TIC-1204',subject:'Bulk import learners from Excel',school:'Cosmo City Branch',by:'Ayanda Sithole',priority:'Normal',status:'Waiting on Customer',age:'2d',agent:'Refilwe N.'},
    {id:'TIC-1203',subject:'Change banking details for payouts',school:'Head Office',by:'Prince Tau',priority:'Normal',status:'Resolved',age:'3d',agent:'Katlego M.'},
    {id:'TIC-1202',subject:'SMS credits not topping up',school:'Mamelodi Branch',by:'Lerato Mokoena',priority:'High',status:'Resolved',age:'4d',agent:'Refilwe N.'},
  ];
  const adminUsers=[
    {name:'Thandi Admin',email:'thandi@mobsie.co.za',role:'Super Admin',scope:'Entire school group',last:'Now',status:'Active'},
    {name:'Naledi Khumalo',email:'naledi@mobsie.co.za',role:'Branch Principal',scope:'Soshanguve Branch 1',last:'25m ago',status:'Active'},
    {name:'Sipho Dlamini',email:'sipho@mobsie.co.za',role:'Branch Principal',scope:'Soshanguve Branch 2',last:'1h ago',status:'Active'},
    {name:'Lerato Mokoena',email:'lerato@mobsie.co.za',role:'Branch Principal',scope:'Mamelodi Branch',last:'2h ago',status:'Active'},
    {name:'Ayanda Sithole',email:'ayanda@mobsie.co.za',role:'Branch Principal',scope:'Cosmo City Branch',last:'3h ago',status:'Active'},
    {name:'Kagiso Zwane',email:'kagiso@mobsie.co.za',role:'Branch Principal',scope:'Sky-City Branch',last:'Yesterday',status:'Active'},
    {name:'Prince Tau',email:'prince@mobsie.co.za',role:'Finance Manager',scope:'All campuses',last:'2h ago',status:'Active'},
    {name:'Mpho Baloyi',email:'mpho@mobsie.co.za',role:'Admissions',scope:'All campuses',last:'2d ago',status:'Active'},
    {name:'Refilwe Ndlovu',email:'refilwe@mobsie.co.za',role:'Support Agent',scope:'All campuses',last:'1h ago',status:'Active'},
  ];
  const rolePerms={
    perms:['View dashboard','Manage school profile','Manage campuses','Manage learners','Manage teachers','Admissions','Finance','Communications','Media & gallery','Reports & analytics','User management','Platform settings'],
    roles:[
      {name:'Super Admin',color:'#F97316',users:2,grants:[1,1,1,1,1,1,1,1,1,1,1,1]},
      {name:'School Owner',color:'#7C3AED',users:1,grants:[1,1,1,1,1,1,1,1,1,1,1,0]},
      {name:'Branch Principal',color:'#2563EB',users:5,grants:[1,0,0,1,1,1,0,1,1,1,0,0]},
      {name:'Finance Manager',color:'#16A34A',users:2,grants:[1,0,0,0,0,0,1,0,0,1,0,0]},
      {name:'Admissions',color:'#0D9488',users:2,grants:[1,0,0,1,0,1,0,1,0,0,0,0]},
      {name:'Teacher',color:'#D97706',users:66,grants:[1,0,0,1,0,0,0,1,1,0,0,0]},
    ],
  };
  const auditLog=[
    {who:'Thandi Admin',role:'Super Admin',act:'Updated expansion plan',target:'Atteridgeville Branch — 2027',time:'Today, 13:42',type:'info'},
    {who:'Prince Tau',role:'Finance Manager',act:'Exported payment report',target:'All campuses — May 2026',time:'Today, 12:18',type:'info'},
    {who:'Naledi Khumalo',role:'Branch Principal',act:'Added new teacher',target:'Karabo Mnisi — Grade 1B',time:'Today, 11:04',type:'ok'},
    {who:'Ayanda Sithole',role:'Branch Principal',act:'Approved gallery album',target:'Art Week — Cosmo City',time:'Today, 10:37',type:'ok'},
    {who:'System',role:'Automation',act:'Generated monthly invoices',target:'788 parents',time:'Today, 08:00',type:'ok'},
    {who:'Lerato Mokoena',role:'Branch Principal',act:'Updated attendance register',target:'Grade R — Mamelodi',time:'Today, 07:55',type:'info'},
    {who:'Thandi Admin',role:'Super Admin',act:'Changed role permissions',target:'Admissions role',time:'Yesterday, 16:20',type:'warn'},
    {who:'Mpho Baloyi',role:'Admissions',act:'Approved application',target:'APP-1046 — Amahle Chauke',time:'Yesterday, 15:02',type:'ok'},
    {who:'System',role:'Automation',act:'Nightly database backup',target:'Completed in 1m 42s',time:'Yesterday, 02:00',type:'ok'},
    {who:'Refilwe Ndlovu',role:'Support Agent',act:'Reset user password',target:'kagiso@mobsie.co.za',time:'Yesterday, 11:31',type:'info'},
  ];

  // --- Time series ------------------------------------------------------
  // Cumulative fee collections for May vs the same days last month
  const revSeries={labels:['May 12','May 13','May 14','May 15','May 16','May 17','May 18'],
    revenue:[312000,588000,842000,1118000,1394000,1652000,1868500],
    mrr:[280000,540000,760000,1005000,1256000,1470000,1704000]};
  const growthSeries={labels:['Dec','Jan','Feb','Mar','Apr','May'],
    schools:[3,3,4,4,5,5], students:[812,830,878,914,968,1010]};

  const activity=[
    {icon:'applications',tint:'t-orange',main:'New application received from <b>Lebo Motaung</b>',sub:'Soshanguve Branch 1 · 2 min ago'},
    {icon:'payments',tint:'t-green',main:'Payment received from <b>Prince Tau</b>',sub:'Invoice #INV-000879 · R2,350.00 · 15 min ago'},
    {icon:'newsletters',tint:'t-purple',main:'Newsletter <b>"May Updates"</b> sent',sub:'Delivered to 788 parents · 1 hour ago'},
    {icon:'gallery',tint:'t-amber',main:'New gallery images uploaded',sub:'Cosmo City Branch · 23 new images · 2 hours ago'},
    {icon:'homework',tint:'t-blue',main:'Teacher <b>Sipho Dlamini</b> uploaded a learning activity',sub:'Grade 1A · Mathematics · 3 hours ago'},
  ];
  const events=[
    {mo:'MAY',dy:'20',name:'Principals\' Meeting',sub:'All 5 campuses · virtual',time:'10:00 AM',tint:'t-orange',people:7},
    {mo:'MAY',dy:'22',name:'Sports Day',sub:'Soshanguve Branch 1',time:'08:00 AM',tint:'t-green',people:56},
    {mo:'MAY',dy:'24',name:'Parent Workshop',sub:'Mamelodi Branch',time:'02:00 PM',tint:'t-purple',people:18},
    {mo:'MAY',dy:'28',name:'Mid Term Break',sub:'All campuses',time:'All day',tint:'t-blue',people:0},
  ];

  // Live counters shown in sidebar badges / dashboard chips
  const counters={pendingReview:16};
  const customCal=[];
  const homeworkList=[
    {title:'Counting to 20 with objects',cls:'Grade R A',school:'Soshanguve Branch 1',teacher:'Naledi Khumalo',due:'May 19',done:88,subject:'Numeracy',tint:'t-orange'},
    {title:'My Family — drawing & telling',cls:'Nursery B',school:'Soshanguve Branch 2',teacher:'Sipho Dlamini',due:'May 19',done:74,subject:'Life Skills',tint:'t-green'},
    {title:'Letter sounds: S, A, T',cls:'Grade R B',school:'Cosmo City Branch',teacher:'Palesa Nkosi',due:'May 20',done:65,subject:'Literacy',tint:'t-purple'},
    {title:'Shapes hunt at home',cls:'Grade 1 A',school:'Mamelodi Branch',teacher:'Karabo Mnisi',due:'May 20',done:52,subject:'Numeracy',tint:'t-blue'},
    {title:'Read-along: The Hungry Caterpillar',cls:'Grade 1 B',school:'Sky-City Branch',teacher:'Zanele Mabaso',due:'May 21',done:41,subject:'Literacy',tint:'t-teal'},
    {title:'Winter clothing collage',cls:'Grade 2 A',school:'Soshanguve Branch 1',teacher:'Lerato Mokoena',due:'May 22',done:12,subject:'Art',tint:'t-pink'},
  ];
  const docFolders=[
    {name:'Policies',count:24,tint:'t-orange'},{name:'Compliance',count:18,tint:'t-red'},
    {name:'Finance',count:41,tint:'t-green'},{name:'HR',count:33,tint:'t-purple'},
    {name:'Academics',count:57,tint:'t-blue'},{name:'Expansion',count:9,tint:'t-pink'},
  ];
  const reportRuns=[
    {name:'Term 2 Progress Reports',type:'Report cards',scope:'All campuses',date:'Due Jun 20',status:'In Progress',done:64,tint:'t-purple'},
    {name:'Attendance Summary — May',type:'Attendance',scope:'All campuses',date:'Generated May 18',status:'Completed',done:100,tint:'t-green'},
    {name:'Fee Collection Report — May',type:'Finance',scope:'All campuses',date:'Generated May 18',status:'Completed',done:100,tint:'t-blue'},
    {name:'Learner Development — Playgroup',type:'Milestones',scope:'All campuses',date:'Due May 30',status:'In Progress',done:38,tint:'t-orange'},
    {name:'Expansion Readiness — Atteridgeville',type:'Operations',scope:'Head Office',date:'Due Jun 30',status:'Scheduled',done:0,tint:'t-teal'},
  ];

  window.DB={rnd,ri,pick,FIRST,LAST,GRADES,AV,SCHOOL_NAME,
    name,initials,avColor,email,phone,fmtN,fmtR,fmtRk,
    schools,branches,liveBranches,totals,teachers,parents,learners,
    applications,appCounts,APP_STATUS,interviews,waitingList,deregistrations:[],
    payments,invoices,discounts,
    conversations,newsletters,pushLog,smsLog,campaigns,feedback,
    albums,mediaFiles,products,ordersList,
    documentsList,tickets,adminUsers,rolePerms,auditLog,
    revSeries,growthSeries,activity,events,
    counters,customCal,homeworkList,docFolders,reportRuns,settings:{tabs:{}}};

  // Always read live campuses from the current (possibly restored) branch list
  DB.liveBranches=()=>DB.branches.filter(b=>b.status!=='Coming Soon');

  /* ---- Persistence: user changes survive reload (browser-local) ---- */
  const PERSIST=['schools','branches','teachers','parents','learners','applications','appCounts',
    'interviews','waitingList','payments','invoices','discounts','conversations','newsletters',
    'pushLog','smsLog','campaigns','feedback','albums','mediaFiles','products','ordersList',
    'documentsList','tickets','adminUsers','rolePerms','auditLog','events','counters','customCal',
    'homeworkList','docFolders','reportRuns','settings'];
  const PKEY='mobsie-db-v2';
  DB.save=function(){
    try{
      const o={};
      PERSIST.forEach(k=>o[k]=DB[k]);
      localStorage.setItem(PKEY,JSON.stringify(o));
    }catch(e){/* storage unavailable in this context — session-only */}
  };
  DB.reset=function(){
    try{localStorage.removeItem(PKEY);}catch(e){}
    location.reload();
  };
  DB.log=function(act,target,type){
    DB.auditLog.unshift({who:'Thandi Admin',role:'Super Admin',act,target,time:'Just now',type:type||'info'});
  };
  DB.recount=function(){
    const lv=DB.branches.filter(b=>b.status!=='Coming Soon');
    DB.totals.schools=DB.schools.length;
    DB.totals.branches=lv.length;
    DB.totals.students=DB.learnerStats
      ? Number(DB.learnerStats.totalLearners||0)
      : lv.reduce((a,b)=>a+b.students,0);
    DB.totals.parents=DB.parentStats
      ? Number(DB.parentStats.totalParents||0)
      : (Array.isArray(DB.parents)?DB.parents.length:0);
    DB.totals.teachers=DB.teamStats
      ? Number(DB.teamStats.totalStaff||0)
      : (Array.isArray(DB.teachers)?DB.teachers.length:0);
    DB.totals.mrr=lv.reduce((a,b)=>a+b.revenue,0);
  };
  try{
    const s=JSON.parse(localStorage.getItem(PKEY));
    if(s) PERSIST.forEach(k=>{ if(s[k]!=null) DB[k]=s[k]; });
    // Branding is application-owned. Do not allow an older browser snapshot
    // to restore the retired "Mobsie Academy" display name.
    DB.schools.forEach(school=>{
      school.name=SCHOOL_NAME;
      school.initials=initials(SCHOOL_NAME);
    });
    DB.branches.forEach(branch=>{ branch.school=SCHOOL_NAME; });
    DB.recount();
  }catch(e){/* fresh data */}
})();
