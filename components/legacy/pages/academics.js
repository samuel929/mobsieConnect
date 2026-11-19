/* Mobsie Connect — Academics: Attendance, Homework, Reports, Calendar */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN;

  /* ---------- Attendance ---------- */
  const attendanceClassCode=(value)=>{
    const label=String(value||'').trim().toUpperCase();
    const stage=label.match(/STAGE[\s_-]*(\d+)/);
    if(stage)return `STAGE_${stage[1]}`;
    if(/GRADE[\s_-]*R\b/.test(label))return 'GRADE_R';
    return label.split('—')[0].trim().replace(/[\s-]+/g,'_');
  };
  const attendanceClassLabel=(value)=>{
    const label=String(value||'').replace(/_/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    return label?label.charAt(0).toUpperCase()+label.slice(1):'—';
  };
  const attendanceState={branchId:'',classCode:'',studentId:''};
  const attendanceLearners=()=>{
    const branch=(DB.branches||[]).find(item=>String(item.id)===String(attendanceState.branchId));
    return (DB.learners||[]).filter(learner=>{
      const branchMatches=!attendanceState.branchId||String(learner.branchId||'')===String(attendanceState.branchId)||learner.branch===branch?.name;
      const classMatches=!attendanceState.classCode||[learner.cls,learner.grade].some(value=>attendanceClassCode(value)===attendanceState.classCode);
      return branchMatches&&classMatches;
    });
  };
  const attendanceRecords=()=>{
    const records=DB.attendanceStats?.records||[];
    return records.filter(record=>(!attendanceState.branchId||String(record.branchId)===String(attendanceState.branchId))
      &&(!attendanceState.classCode||[record.className,record.grade].some(value=>attendanceClassCode(value)===attendanceState.classCode))
      &&(!attendanceState.studentId||String(record.studentId)===String(attendanceState.studentId)));
  };
  Pages.attendance={
    render(){
      const stats=DB.attendanceStats||{overall:{entries:0,present:0,percentage:0},grades:[],dates:[],heatmap:[],branches:[]};
      const days=(stats.dates||[]).map(date=>new Date(date+'T00:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short'}));
      const grades=[...new Set((stats.heatmap||[]).map(row=>row.grade))];
      const gradeLabels=grades.map(attendanceClassLabel);
      const data=grades.map(grade=>(stats.dates||[]).map(date=>Number((stats.heatmap||[]).find(row=>row.grade===grade&&row.date===date)?.percentage||0)));
      const branchRows=stats.branches||[];
      const branchLearners=(DB.learners||[]).filter(learner=>{
        if(!attendanceState.branchId)return true;
        const branch=(DB.branches||[]).find(item=>String(item.id)===String(attendanceState.branchId));
        return String(learner.branchId||'')===String(attendanceState.branchId)||learner.branch===branch?.name;
      });
      const classMap=new Map();
      branchLearners.forEach(learner=>{
        const value=learner.cls||learner.grade;
        if(value)classMap.set(attendanceClassCode(value),value);
      });
      const learners=attendanceLearners();
      const filteredRecords=attendanceRecords();
      const filteredPresent=filteredRecords.filter(record=>String(record.status).toUpperCase()==='PRESENT').length;
      const filteredAbsent=filteredRecords.filter(record=>String(record.status).toUpperCase()==='ABSENT').length;
      const filteredPercentage=filteredRecords.length?Math.round(filteredPresent/filteredRecords.length*1000)/10:0;
      const selectedLearner=learners.find(learner=>String(learner.id)===String(attendanceState.studentId));
      const historyTable=UI.table({
        pageSize:12,rows:filteredRecords,
        columns:[
          {key:'date',label:'Date',render:r=>new Date(r.date+'T00:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'})},
          {key:'studentName',label:'Learner'},
          {key:'branchName',label:'Campus'},
          {key:'className',label:'Class',render:r=>esc(attendanceClassLabel(r.className||r.grade))},
          {key:'status',label:'Status',render:r=>UI.status(String(r.status||'').toLowerCase().replace(/^./,letter=>letter.toUpperCase()))},
        ],
      });
      const tbl=UI.table({
        pageSize:8, rows:branchRows,
        onRow:row=>{
          attendanceState.branchId=String(row.id||'');attendanceState.classCode='';attendanceState.studentId='';
          App.refresh();
          setTimeout(()=>document.getElementById('attFilters')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
        },
        columns:[
          {key:'name',label:'Campus',render:r=>`<div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${esc(r.city)}</div>`},
          {key:'learners',label:'Learners',num:true,render:r=>F(r.learners)},
          {key:'percentage',label:'Last 7 days',render:r=>`<div style="display:flex;align-items:center;gap:10px;min-width:150px"><span class="meter"><i style="width:${DB.safeNumber(r.percentage)}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.entries?DB.safeNumber(r.percentage).toFixed(1):'—'}${r.entries?'%':''}</b></div>`},
          {key:'entries',label:'Entries',num:true},
          {key:'absentToday',label:'Absent today',num:true},
        ],
      });
      return `
        ${UI.pageHead('Attendance','Live attendance across every campus and class.',
          `<button class="btn btn-ghost" id="attExp">${MCIcon('download')} Export Register</button>
           <button class="btn btn-primary" id="attCap">${MCIcon('attendance')} Capture Attendance</button>`)}
        <div class="card" id="attFilters" style="margin-bottom:20px;scroll-margin-top:90px">
          <div class="card-head"><div><h3>Filter attendance</h3><div class="sub">Choose a campus, class and learner to view their complete attendance history.</div></div></div>
          <div class="card-body">
            <div class="form-row" style="align-items:end">
              <div class="field"><label>Campus</label><select id="attFilterCampus"><option value="">All campuses</option>${DB.liveBranches().map(branch=>`<option value="${esc(branch.id)}" ${String(branch.id)===String(attendanceState.branchId)?'selected':''}>${esc(branch.name)}</option>`).join('')}</select></div>
              <div class="field"><label>Class</label><select id="attFilterClass"><option value="">All classes</option>${[...classMap.entries()].map(([code,label])=>`<option value="${esc(code)}" ${code===attendanceState.classCode?'selected':''}>${esc(attendanceClassLabel(label))}</option>`).join('')}</select></div>
              <div class="field"><label>Learner</label><select id="attFilterLearner"><option value="">All learners</option>${learners.map(learner=>`<option value="${esc(learner.id)}" ${String(learner.id)===String(attendanceState.studentId)?'selected':''}>${esc(learner.name)}</option>`).join('')}</select></div>
              <button class="btn btn-ghost" id="attFilterClear" type="button">Clear filters</button>
            </div>
          </div>
        </div>
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'learners',tint:'t-blue',label:selectedLearner?'Learner':'Matching learners',value:selectedLearner?selectedLearner.name:F(learners.length),deltaHtml:`<span class="delta flat">${selectedLearner?esc(selectedLearner.branch):'current filter'}</span>`})}
          ${UI.statCard({icon:'attendance',tint:'t-green',label:'Overall attendance',value:filteredRecords.length?filteredPercentage+'%':'—',deltaHtml:`<span class="delta flat">all captured dates</span>`})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Present',value:F(filteredPresent),deltaHtml:`<span class="delta flat">register entries</span>`})}
          ${UI.statCard({icon:'clock',tint:'t-red',label:'Absent',value:F(filteredAbsent),deltaHtml:`<span class="delta flat">register entries</span>`})}
        </div>
        <div class="card" style="margin-bottom:20px"><div class="card-head"><div><h3>${selectedLearner?esc(selectedLearner.name)+' attendance history':'Filtered attendance history'}</h3><div class="sub">${F(filteredRecords.length)} saved register entries</div></div></div><div class="card-body" style="padding:0;padding-top:8px">${filteredRecords.length?historyTable:'<div class="empty-state" style="padding:55px 20px"><b>No attendance records found</b><p>Change the filters or capture a register for this selection.</p></div>'}</div></div>
        <div class="grid" style="grid-template-columns:1fr 1.6fr;margin-bottom:20px" id="attTop">
          ${UI.card('Platform average',`
            <div style="display:flex;align-items:center;gap:20px">
              <div style="width:130px;flex-shrink:0">${Charts.ring({pct:Number(stats.overall.percentage||0),size:132,thick:12})}</div>
              <div style="flex:1">
                <div style="font-weight:700;color:var(--ink-900);font-size:15px">Average Attendance</div>
                <div class="small muted" style="margin-top:6px">${F(Number(stats.overall.present||0))} present entries from ${F(Number(stats.overall.entries||0))} captured this month</div>
                <div class="divider"></div>
                <div class="small muted">${stats.overall.entries?'Calculated from saved attendance registers in Neon.':'No attendance has been captured this month.'}</div>
              </div>
            </div>
            <div class="divider"></div>
            ${(stats.grades||[]).length?(stats.grades||[]).map(row=>UI.meterRow(attendanceClassLabel(row.grade),Number(row.percentage||0))).join(''):'<p class="small muted">Grade attendance will appear after registers are captured.</p>'}`)}
          ${UI.card('Attendance heatmap',days.length?'<div class="chart-box" style="overflow-x:auto">'+Charts.heatmap({rows:gradeLabels,cols:days,data})+'</div>':'<div class="empty-state" style="padding:70px 20px"><b>No attendance history</b><p>Capture a register to populate this chart.</p></div>',{sub:'Grade × saved attendance date · % present',right:days.length?UI.legend([{color:'#DCFCE7',label:'≤84%'},{color:'#4ADE80',label:'88–92%'},{color:'#15803D',label:'96%+'}]):''})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Attendance by campus</h3><div class="sub">Click a campus to view its classes, learners and complete attendance history.</div></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>
        <style>@media(max-width:1100px){#attTop{grid-template-columns:1fr}}</style>`;
    },
    mount(root){
      const campusFilter=root.querySelector('#attFilterCampus');
      const classFilter=root.querySelector('#attFilterClass');
      const learnerFilter=root.querySelector('#attFilterLearner');
      campusFilter.addEventListener('change',()=>{attendanceState.branchId=campusFilter.value;attendanceState.classCode='';attendanceState.studentId='';App.refresh();});
      classFilter.addEventListener('change',()=>{attendanceState.classCode=classFilter.value;attendanceState.studentId='';App.refresh();});
      learnerFilter.addEventListener('change',()=>{attendanceState.studentId=learnerFilter.value;App.refresh();});
      root.querySelector('#attFilterClear').addEventListener('click',()=>{attendanceState.branchId='';attendanceState.classCode='';attendanceState.studentId='';App.refresh();});
      root.querySelector('#attExp').addEventListener('click',()=>UI.downloadCSV('attendance-register.csv',
        ['Date','Learner','Campus','Class','Status'],attendanceRecords().map(record=>[record.date,record.studentName,record.branchName,record.className||record.grade,record.status])));
      root.querySelector('#attCap').addEventListener('click',()=>UI.modal({
        title:'Capture Attendance',
        body:`<div class="attendance-capture-form">
          <p class="attendance-capture-form__intro">Select a campus and class, then mark each learner's attendance for the day.</p>
          <section class="attendance-capture-form__section">
            <div class="attendance-capture-form__section-title">Register details</div>
            <div class="form-row">
            <div class="field"><label>Campus</label><select data-f="branch">${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Class</label><select data-f="grade">${DB.GRADES.map(g=>`<option value="${esc(attendanceClassCode(g))}">${esc(g)}</option>`).join('')}</select></div>
            </div>
            <div class="field attendance-capture-form__date"><label>Attendance date</label><input type="date" data-f="date" value="${new Date().toISOString().slice(0,10)}"></div>
          </section>
          <section class="attendance-capture-form__section attendance-capture-form__learners">
            <div class="attendance-capture-form__register-head">
              <div><div class="attendance-capture-form__section-title">Learner register</div><p>Mark individual learners or update the whole class at once.</p></div>
              <div class="attendance-capture-form__bulk">
                <span>Set everyone</span>
                <button class="btn btn-soft btn-sm" type="button" data-bulk="PRESENT">All present</button>
                <button class="btn btn-soft btn-sm" type="button" data-bulk="ABSENT">All absent</button>
              </div>
            </div>
            <div class="student-register" data-register></div>
          </section>
        </div>`,
        foot:`<div class="attendance-capture-actions"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Save Register</button></div>`,
        mount(r,close){
          const branchSelect=r.querySelector('[data-f="branch"]');
          const gradeSelect=r.querySelector('[data-f="grade"]');
          const register=r.querySelector('[data-register]');
          const renderKids=()=>{
            const branch=branchSelect.value,grade=gradeSelect.value;
            const kids=DB.learners.filter(kid=>
              kid.branch===branch&&
              attendanceClassCode(kid.grade)===grade
            );
            const learnerClass=(kid)=>{
              const values=[kid.grade,kid.cls].filter(Boolean).map(value=>String(value).trim());
              return [...new Set(values)].join(' · ')||'Class not assigned';
            };
            register.innerHTML=kids.length?kids.map(kid=>`
              <label class="student-att-row">
                <span class="student-att-row__identity"><strong>${esc(kid.name)}</strong><span>${esc(learnerClass(kid))}</span></span>
                <span class="student-att-row__status"><label for="attendance-${esc(kid.id)}">Status</label><select id="attendance-${esc(kid.id)}" data-student="${esc(kid.id)}"><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select></span>
              </label>`).join(''):`<div class="small muted" style="padding:18px;text-align:center">No learners found for this campus and class.</div>`;
          };
          branchSelect.addEventListener('change',renderKids);
          gradeSelect.addEventListener('change',renderKids);
          r.querySelectorAll('[data-bulk]').forEach(button=>button.addEventListener('click',()=>{
            register.querySelectorAll('select').forEach(select=>{select.value=button.dataset.bulk;});
          }));
          renderKids();
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            const branch=DB.branches.find(item=>item.name===v.branch);
            const entries=[...register.querySelectorAll('[data-student]')].map(select=>({studentId:select.dataset.student,status:select.value}));
            if(!branch||!entries.length){UI.toast('Select a class with enrolled learners','alert');return;}
            try{
              await MobsieApi.mutate('/api/attendance',{method:'POST',body:JSON.stringify({branchId:branch.id,attendanceDate:v.date,entries})});
              const absent=entries.filter(entry=>entry.status==='ABSENT').length;
              DB.log('Captured attendance',v.grade+' — '+v.branch+' ('+(entries.length-absent)+' present, '+absent+' absent)','ok');
              close();UI.toast('Register saved to Neon — parents of absentees notified');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };

  /* ---------- Daily activity timetable ---------- */
  /* ---------- Daily activity timetable ---------- */

const dailyState = {
  branchId: '',
  className: '',
  // Start with the complete Neon timetable after login. A date is only sent
  // to the API after the administrator explicitly applies that filter.
  date: '',
  loading: false,
  loaded: false,
  error: '',
};

const dailyTypes = [
  ['DROP_OFF', 'Drop-off', 'car', 't-green'],
  ['ASSEMBLY', 'Morning Assembly', 'sparkle', 't-teal'],
  ['LESSON', 'Mathematics', 'homework', 't-purple'],
  ['SNACK', 'Snack Break', 'clock', 't-amber'],
  ['READING', 'Reading Time', 'homework', 't-pink'],
  ['LUNCH', 'Lunch', 'attendance', 't-green'],
];

const dailyTypeMeta = (type) =>
  dailyTypes.find((item) => item[0] === type) || [
    'CUSTOM',
    'Activity',
    'clock',
    't-blue',
  ];

const dailyDateValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const dailyTimeValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 5);
};


/* =========================================================
   CLASS OPTIONS
========================================================= */

const dailyClassOptions = (branchId) => {
  const branch = (DB.branches || []).find(
    (item) => String(item.id) === String(branchId)
  );

  const branchName = branch?.name;

  const classes = [
    ...new Set(
      (DB.learners || [])
        .filter((learner) => {
          if (!branchId) return true;

          return (
            String(learner.branchId || '') === String(branchId) ||
            learner.branch === branchName
          );
        })
        .flatMap((learner) => [learner.grade, learner.cls])
        .filter(Boolean)
        .map((value) => String(value).trim())
    ),
  ];

  if (classes.length) {
    return classes;
  }

  return DB.GRADES || [
    'Playgroup',
    'Nursery',
    'Grade RR',
    'Grade R',
    'Grade 1',
    'Grade 2',
  ];
};


const dailyFilterClassOptions = (branchId) => {
  const values = [
    ...dailyClassOptions(branchId),

    ...(DB.dailyActivities || [])
      .filter((item) => {
        if (!branchId) return true;

        return String(item.branchId) === String(branchId);
      })
      .map((item) => item.className)
      .filter(Boolean),
  ];

  return [...new Set(values)];
};


/* =========================================================
   FILTER ACTIVITIES
========================================================= */

const dailyRows = () => {
  return (DB.dailyActivities || [])
    .filter((item) => {
      const correctBranch =
        !dailyState.branchId ||
        String(item.branchId) === String(dailyState.branchId);

      const correctClass =
        !dailyState.className ||
        String(item.className) === String(dailyState.className);

      const correctDate =
        !dailyState.date ||
        dailyDateValue(item.activityDate) === dailyState.date;

      return correctBranch && correctClass && correctDate;
    })
    .sort((a, b) => {
      const dateOrder = dailyDateValue(b.activityDate).localeCompare(dailyDateValue(a.activityDate));
      if (dateOrder) return dateOrder;
      return dailyTimeValue(a.startTime).localeCompare(dailyTimeValue(b.startTime));
    });
};


const dailyDateLabel = () => {
  if (!dailyState.date) {
    return 'All dates';
  }

  const date = new Date(`${dailyState.date}T12:00:00`);

  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};


/* =========================================================
   DATABASE READ
========================================================= */

async function loadDailyActivities() {
  dailyState.loading = true;
  dailyState.error = '';

  try {
    const params = new URLSearchParams();

    if (dailyState.branchId) {
      params.set('branchId', dailyState.branchId);
    }

    if (dailyState.className) {
      params.set('className', dailyState.className);
    }

    if (dailyState.date) {
      params.set('date', dailyState.date);
    }

    const url =
      '/api/daily-activities' +
      (params.toString() ? `?${params.toString()}` : '');

    console.log('[Daily Activity] GET', url);

    const response = await MobsieApi.request(url, {
      cache: 'no-store',
    });

    console.log('[Daily Activity] response:', response);

    /*
     * Support common API response shapes:
     *
     * { data: [...] }
     * { data: { items: [...] } }
     * [...]
     */
    let activities = [];

    if (Array.isArray(response)) {
      activities = response;
    } else if (Array.isArray(response?.data)) {
      activities = response.data;
    } else if (Array.isArray(response?.data?.items)) {
      activities = response.data.items;
    } else if (Array.isArray(response?.items)) {
      activities = response.items;
    }

    DB.dailyActivities = activities;

    dailyState.loaded = true;

    return activities;
  } catch (error) {
    console.error('[Daily Activity] GET failed:', error);

    dailyState.error =
      error?.message || 'Could not load daily activities.';

    throw error;
  } finally {
    dailyState.loading = false;
  }
}


/* =========================================================
   CREATE / EDIT FORM
========================================================= */

function dailyForm(initial = {}) {
  const meta = dailyTypeMeta(initial.activityType);

  const branchId =
    initial.branchId ||
    dailyState.branchId ||
    DB.liveBranches()?.[0]?.id ||
    '';

  const availableClasses = dailyClassOptions(branchId);

  const className =
    initial.className ||
    dailyState.className ||
    availableClasses[0] ||
    '';

  return `
    <div class="daily-editor">

      <div
        style="
          padding:14px 16px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:12px;
          margin-bottom:18px;
          color:#475569;
          font-size:14px;
        "
      >
        Activities saved here are stored in the database and can be
        displayed in the parent mobile app.
      </div>

      <div class="form-row">

        <div class="field">
          <label>Branch *</label>

          <select
            data-f="branchId"
            data-daily-form-branch
          >
            ${(DB.liveBranches() || [])
              .map(
                (branch) => `
                <option
                  value="${esc(branch.id)}"
                  ${
                    String(branchId) === String(branch.id)
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(branch.name)}
                </option>
              `
              )
              .join('')}
          </select>
        </div>

        <div class="field">
          <label>Class / stage *</label>

          <select
            data-f="className"
            data-daily-form-class
          >
            ${availableClasses
              .map(
                (value) => `
                <option
                  value="${esc(value)}"
                  ${
                    String(className) === String(value)
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(value)}
                </option>
              `
              )
              .join('')}
          </select>
        </div>

      </div>

      <div class="form-row">

        <div class="field">
          <label>Date *</label>

          <input
            type="date"
            data-f="activityDate"
            value="${esc(
              dailyDateValue(initial.activityDate) ||
                dailyState.date ||
                new Date().toISOString().slice(0, 10)
            )}"
          >
        </div>

        <div class="field">
          <label>Activity type *</label>

          <select data-f="activityType">

            ${dailyTypes
              .map(
                ([value, label]) => `
                <option
                  value="${value}"
                  ${
                    (initial.activityType || 'DROP_OFF') === value
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(label)}
                </option>
              `
              )
              .join('')}

          </select>
        </div>

      </div>

      <div class="field">

        <label>Title *</label>

        <input
          type="text"
          data-f="title"
          maxlength="120"
          value="${esc(initial.title || meta[1])}"
          placeholder="e.g. Morning Assembly"
        >

      </div>

      <div class="form-row">

        <div class="field">

          <label>Start time *</label>

          <input
            type="time"
            data-f="startTime"
            value="${esc(
              dailyTimeValue(initial.startTime) || '07:00'
            )}"
          >

        </div>

        <div class="field">

          <label>End time *</label>

          <input
            type="time"
            data-f="endTime"
            value="${esc(
              dailyTimeValue(initial.endTime) || '08:00'
            )}"
          >

        </div>

      </div>

      <div class="field">

        <label>Description</label>

        <textarea
          data-f="description"
          rows="4"
          maxlength="1000"
          placeholder="Tell parents what happened or what to expect."
        >${esc(initial.description || '')}</textarea>

      </div>

      <div class="form-row">

        <div class="field">

          <label>Icon</label>

          <select data-f="icon">

            ${[
              'car',
              'sparkle',
              'homework',
              'clock',
              'attendance',
              'calendar',
              'message',
              'book',
            ]
              .map(
                (icon) => `
                  <option
                    value="${icon}"
                    ${
                      (initial.icon || meta[2]) === icon
                        ? 'selected'
                        : ''
                    }
                  >
                    ${icon}
                  </option>
                `
              )
              .join('')}

          </select>

        </div>

        <div class="field">

          <label>Colour</label>

          <input
            type="color"
            data-f="color"
            value="${esc(initial.color || '#16A34A')}"
          >

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   PAGE
========================================================= */

Pages['daily-activity'] = {

  render() {
    const rows = dailyRows();

    const branch = dailyState.branchId
      ? (DB.branches || []).find(
          (item) =>
            String(item.id) === String(dailyState.branchId)
        )
      : null;

    const branchName = branch?.name || 'All branches';
    const activityGroups = [...rows.reduce((groups, row) => {
      const campus = row.branchName || (DB.branches || []).find(
        (item) => String(item.id) === String(row.branchId)
      )?.name || 'Unknown campus';
      if (!groups.has(campus)) groups.set(campus, []);
      groups.get(campus).push(row);
      return groups;
    }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right));

    return `

      ${UI.pageHead(
        'Daily Activity',
        'Manage the timetable parents see in the mobile app.',
        `
          <button
            class="btn btn-ghost"
            id="dailyRefresh"
          >
            ${MCIcon('clock')}
            Refresh
          </button>

          <button
            class="btn btn-primary"
            id="dailyNew"
          >
            ${MCIcon('plus')}
            Add Activity
          </button>
        `
      )}


      <!-- FILTERS -->

      <div
        class="card"
        style="
          margin-bottom:20px;
          padding:18px;
        "
      >

        <div
          class="toolbar"
          style="
            gap:12px;
            flex-wrap:wrap;
            align-items:end;
          "
        >

          <div
            class="field"
            style="
              margin:0;
              min-width:220px;
              flex:1;
            "
          >

            <label>Campus</label>

            <select id="dailyBranch">

              <option value="">
                All branches
              </option>

              ${(DB.liveBranches() || [])
                .map(
                  (branch) => `
                    <option
                      value="${esc(branch.id)}"
                      ${
                        String(dailyState.branchId) ===
                        String(branch.id)
                          ? 'selected'
                          : ''
                      }
                    >
                      ${esc(branch.name)}
                    </option>
                  `
                )
                .join('')}

            </select>

          </div>


          <div
            class="field"
            style="
              margin:0;
              min-width:200px;
              flex:1;
            "
          >

            <label>Class / stage</label>

            <select id="dailyClass">

              <option value="">
                All classes
              </option>

              ${dailyFilterClassOptions(
                dailyState.branchId
              )
                .map(
                  (value) => `
                    <option
                      value="${esc(value)}"
                      ${
                        dailyState.className === value
                          ? 'selected'
                          : ''
                      }
                    >
                      ${esc(value)}
                    </option>
                  `
                )
                .join('')}

            </select>

          </div>


          <div
            class="field"
            style="
              margin:0;
              min-width:180px;
            "
          >

            <label>Date</label>

            <input
              id="dailyDate"
              type="date"
              value="${esc(dailyState.date)}"
            >

          </div>


          <button
            class="btn btn-primary"
            id="dailyFilter"
          >
            ${MCIcon('filter')}
            Apply
          </button>

        </div>

      </div>


      <!-- TIMETABLE -->

      <div
        class="card"
        style="
          padding:28px 32px;
        "
      >

        <div
          class="card-head"
          style="
            padding:0 0 24px;
          "
        >

          <div>

            <h2 style="margin:0 0 5px">

              ${esc(dailyDateLabel())}

            </h2>

            <div class="muted">

              ${esc(branchName)}

              ·

              ${esc(
                dailyState.className || 'All classes'
              )}

              ·

              ${rows.length} ${
                rows.length === 1
                  ? 'activity'
                  : 'activities'
              }

            </div>

          </div>


          <button
            class="btn btn-primary"
            id="dailyNewTop"
          >
            ${MCIcon('plus')}
            Add Activity
          </button>

        </div>


        ${
          dailyState.loading
            ? `

              <div
                style="
                  padding:60px 20px;
                  text-align:center;
                "
              >

                <b>
                  Loading activities from database...
                </b>

              </div>

            `
            : dailyState.error
            ? `

              <div class="empty-state">

                <div class="empty-ico">
                  ${MCIcon('clock')}
                </div>

                <b>
                  Could not load activities
                </b>

                <p>
                  ${esc(dailyState.error)}
                </p>

                <button
                  class="btn btn-primary"
                  id="dailyRetry"
                >
                  Try again
                </button>

              </div>

            `
            : rows.length
            ? `

              <div class="daily-campus-groups">

                ${activityGroups.map(([campusName, campusRows]) => `
                  <section class="daily-campus-group">
                    <div class="daily-campus-group__head">
                      <div class="daily-campus-group__identity">
                        <span class="daily-campus-group__icon">${MCIcon('branches')}</span>
                        <div><h3>${esc(campusName)}</h3><p>${campusRows.length} ${campusRows.length===1?'activity':'activities'}${dailyState.className?' · '+esc(dailyState.className):' · All classes'}</p></div>
                      </div>
                      <button class="btn btn-soft btn-sm" data-daily-campus="${esc(campusRows[0]?.branchId||'')}">View campus only</button>
                    </div>
                    <div class="feed">
                ${campusRows
                  .map((row) => {
                    const meta = dailyTypeMeta(
                      row.activityType
                    );

                    const tint = meta[3];

                    return `

                      <div
                        class="feed-item"
                        style="
                          align-items:center;
                          padding:20px 0;
                          gap:16px;
                        "
                      >

                        <span
                          class="f-ic ${tint}"
                          style="
                            width:56px;
                            height:56px;
                            border-radius:16px;
                          "
                        >

                          ${MCIcon(
                            row.icon || meta[2]
                          )}

                        </span>


                        <div
                          class="f-txt"
                          style="
                            flex:1;
                            min-width:0;
                          "
                        >

                          <div
                            class="f-main"
                            style="
                              font-size:18px;
                            "
                          >

                            <b>
                              ${esc(row.title)}
                            </b>

                          </div>


                          <div
                            class="f-sub"
                            style="
                              margin-top:5px;
                              font-size:14px;
                            "
                          >

                            ${esc(
                              row.description ||
                                'No description added.'
                            )}

                          </div>


                          <div
                            style="
                              display:flex;
                              align-items:center;
                              gap:8px;
                              margin-top:10px;
                              flex-wrap:wrap;
                            "
                          >

                            ${UI.badge(
                              meta[1],
                              tint.replace('t-', '')
                            )}

                            <span class="small muted">

                              ${esc(
                                row.className ||
                                  'No class'
                              )}

                            </span>

                            <span class="daily-activity-date">
                              ${esc(new Date(`${dailyDateValue(row.activityDate)}T12:00:00`).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}))}
                            </span>

                          </div>

                        </div>


                        <div
                          style="
                            font-weight:700;
                            white-space:nowrap;
                          "
                        >

                          ${esc(
                            dailyTimeValue(
                              row.startTime
                            )
                          )}

                          –

                          ${esc(
                            dailyTimeValue(
                              row.endTime
                            )
                          )}

                        </div>


                        <button
                          class="btn btn-soft btn-sm"
                          data-daily-edit="${esc(row.id)}"
                        >

                          ${MCIcon('edit')}

                          Edit

                        </button>


                        <button
                          class="btn btn-ghost btn-sm daily-activity-delete"
                          data-daily-delete="${esc(
                            row.id
                          )}"
                          aria-label="Delete activity"
                        >

                          ${MCIcon('delete')}

                          Delete

                        </button>

                      </div>

                    `;
                  })
                  .join('')}
                    </div>
                  </section>
                `).join('')}

              </div>

            `
            : `

              <div
                class="empty-state"
                style="
                  padding:60px 20px;
                "
              >

                <b>
                  No activity found
                </b>

                <p>
                  There is no activity for this branch,
                  class and date.
                </p>

                <button
                  class="btn btn-primary"
                  id="dailyEmpty"
                >

                  ${MCIcon('plus')}

                  Add Activity

                </button>

              </div>

            `
        }


        <div class="divider"></div>


        <div
          class="toolbar"
          style="
            margin-top:18px;
            flex-wrap:wrap;
          "
        >

          <span
            class="muted"
            style="
              font-weight:700;
            "
          >

            Quick add:

          </span>


          ${dailyTypes
            .map(
              ([type, label, icon]) => `

                <button
                  class="btn btn-soft btn-sm"
                  data-daily-quick="${type}"
                >

                  ${MCIcon(icon)}

                  ${esc(label)}

                </button>

              `
            )
            .join('')}

        </div>

      </div>

    `;
  },


  mount(root) {

    /* =====================================================
       OPEN CREATE / EDIT MODAL
    ===================================================== */

    const openEditor = (item = {}) => {

      UI.modal({

        title: item.id
          ? 'Edit Activity'
          : 'Add Activity',

        body: dailyForm(item),

        foot: `

          <button
            class="btn btn-ghost"
            data-x
          >
            Cancel
          </button>

          <button
            class="btn btn-primary"
            data-s
          >
            ${
              item.id
                ? 'Save Changes'
                : 'Create Activity'
            }
          </button>

        `,

        mount(modal, close) {

          const cancelButton =
            modal.querySelector('[data-x]');

          const saveButton =
            modal.querySelector('[data-s]');

          const branchSelect =
            modal.querySelector(
              '[data-daily-form-branch]'
            );

          const classSelect =
            modal.querySelector(
              '[data-daily-form-class]'
            );

          const typeSelect =
            modal.querySelector(
              '[data-f="activityType"]'
            );


          cancelButton?.addEventListener(
            'click',
            close
          );


          /* BRANCH -> CLASS */

          branchSelect?.addEventListener(
            'change',
            () => {

              const classes =
                dailyClassOptions(
                  branchSelect.value
                );

              classSelect.innerHTML =
                classes
                  .map(
                    (value) => `

                      <option
                        value="${esc(value)}"
                      >
                        ${esc(value)}
                      </option>

                    `
                  )
                  .join('');

            }
          );


          /* ACTIVITY TYPE DEFAULTS */

          typeSelect?.addEventListener(
            'change',
            () => {

              const meta =
                dailyTypeMeta(
                  typeSelect.value
                );

              const titleInput =
                modal.querySelector(
                  '[data-f="title"]'
                );

              const iconSelect =
                modal.querySelector(
                  '[data-f="icon"]'
                );

              if (titleInput) {
                titleInput.value =
                  meta[1];
              }

              if (iconSelect) {
                iconSelect.value =
                  meta[2];
              }

            }
          );


          /* =================================================
             CREATE / UPDATE
          ================================================= */

          saveButton?.addEventListener(
            'click',
            async () => {

              const values =
                UI.formVals(modal);


              values.title =
                String(
                  values.title || ''
                ).trim();

              values.description =
                String(
                  values.description || ''
                ).trim();


              if (
                !values.branchId ||
                !values.className ||
                !values.activityDate ||
                !values.title ||
                !values.startTime ||
                !values.endTime
              ) {

                UI.toast(
                  'Complete all required fields.',
                  'alert'
                );

                return;
              }


              if (
                values.endTime <=
                values.startTime
              ) {

                UI.toast(
                  'End time must be after start time.',
                  'alert'
                );

                return;
              }


              const method =
                item.id
                  ? 'PUT'
                  : 'POST';


              const endpoint =
                item.id
                  ? `/api/daily-activities/${encodeURIComponent(
                      item.id
                    )}`
                  : '/api/daily-activities';


              console.log(
                `[Daily Activity] ${method}`,
                endpoint,
                values
              );


              try {

                saveButton.disabled = true;

                saveButton.textContent =
                  item.id
                    ? 'Saving...'
                    : 'Creating...';


                const response =
                  await MobsieApi.mutate(
                    endpoint,
                    {
                      method,

                      headers: {
                        'Content-Type':
                          'application/json',
                      },

                      body:
                        JSON.stringify(
                          values
                        ),
                    }
                  );


                console.log(
                  '[Daily Activity] save response:',
                  response
                );


                dailyState.branchId =
                  values.branchId;

                dailyState.className =
                  values.className;

                dailyState.date =
                  dailyDateValue(
                    values.activityDate
                  );


                close();


                await loadDailyActivities();


                App.refresh();


                UI.toast(
                  item.id
                    ? 'Activity updated successfully.'
                    : 'Activity created successfully.'
                );

              } catch (error) {

                console.error(
                  '[Daily Activity] SAVE ERROR:',
                  error
                );


                saveButton.disabled = false;

                saveButton.textContent =
                  item.id
                    ? 'Save Changes'
                    : 'Create Activity';


                UI.toast(
                  error?.message ||
                    'Could not save activity.',
                  'alert'
                );

              }

            }
          );

        },

      });

    };


    /* =====================================================
       CREATE BUTTONS
    ===================================================== */

    const openNew = () =>
      openEditor({});


    root
      .querySelectorAll(
        '#dailyNew,#dailyNewTop,#dailyEmpty'
      )
      .forEach((button) => {

        button?.addEventListener(
          'click',
          openNew
        );

      });


    /* =====================================================
       REFRESH
    ===================================================== */

    root
      .querySelector('#dailyRefresh')
      ?.addEventListener(
        'click',
        async () => {

          try {

            await loadDailyActivities();

            App.refresh();

            UI.toast(
              'Daily activities refreshed.'
            );

          } catch (error) {

            UI.toast(
              error?.message ||
                'Could not refresh.',
              'alert'
            );

          }

        }
      );


    root
      .querySelector('#dailyRetry')
      ?.addEventListener(
        'click',
        async () => {

          try {

            await loadDailyActivities();

            App.refresh();

          } catch (error) {

            console.error(error);

          }

        }
      );


    /* =====================================================
       BRANCH FILTER
    ===================================================== */

    root
      .querySelector('#dailyBranch')
      ?.addEventListener(
        'change',
        (event) => {

          const classSelect =
            root.querySelector(
              '#dailyClass'
            );

          if (!classSelect) {
            return;
          }


          const classes =
            dailyFilterClassOptions(
              event.target.value
            );


          classSelect.innerHTML =
            `

              <option value="">
                All classes
              </option>

            ` +
            classes
              .map(
                (value) => `

                  <option
                    value="${esc(value)}"
                  >
                    ${esc(value)}
                  </option>

                `
              )
              .join('');

        }
      );


    /* =====================================================
       APPLY FILTER
    ===================================================== */

    root
      .querySelector('#dailyFilter')
      ?.addEventListener(
        'click',
        async () => {

          dailyState.branchId =
            root.querySelector(
              '#dailyBranch'
            )?.value || '';

          dailyState.className =
            root.querySelector(
              '#dailyClass'
            )?.value || '';

          dailyState.date =
            root.querySelector(
              '#dailyDate'
            )?.value || '';


          try {

            await loadDailyActivities();

            App.refresh();

          } catch (error) {

            UI.toast(
              error?.message ||
                'Could not load activities.',
              'alert'
            );

          }

        }
      );

    root.querySelectorAll('[data-daily-campus]').forEach((button) => {
      button.addEventListener('click', async () => {
        dailyState.branchId = button.dataset.dailyCampus || '';
        dailyState.className = '';
        try {
          await loadDailyActivities();
          App.refresh();
        } catch (error) {
          UI.toast(error?.message || 'Could not load campus activities.', 'alert');
        }
      });
    });


    /* =====================================================
       QUICK ADD
    ===================================================== */

    root
      .querySelectorAll(
        '[data-daily-quick]'
      )
      .forEach((button) => {

        button.addEventListener(
          'click',
          () => {

            const [
              type,
              label,
              icon,
            ] =
              dailyTypeMeta(
                button.dataset.dailyQuick
              );


            openEditor({
              activityType: type,
              title: label,
              icon,
            });

          }
        );

      });


    /* =====================================================
       EDIT / DELETE
    ===================================================== */

    root.addEventListener(
      'click',
      async (event) => {

        const editButton =
          event.target.closest(
            '[data-daily-edit]'
          );

        const deleteButton =
          event.target.closest(
            '[data-daily-delete]'
          );


        /* EDIT */

        if (editButton) {

          const activity =
            (
              DB.dailyActivities ||
              []
            ).find(
              (item) =>
                String(item.id) ===
                String(
                  editButton.dataset
                    .dailyEdit
                )
            );


          if (!activity) {

            UI.toast(
              'Activity could not be found.',
              'alert'
            );

            return;
          }


          openEditor(activity);

          return;
        }


        /* DELETE */

        if (deleteButton) {

          const id =
            deleteButton.dataset
              .dailyDelete;


          const activity =
            (
              DB.dailyActivities ||
              []
            ).find(
              (item) =>
                String(item.id) ===
                String(id)
            );


          if (!activity) {

            UI.toast(
              'Activity could not be found.',
              'alert'
            );

            return;
          }


          const confirmed =
            window.confirm(
              `Delete "${activity.title}"?`
            );


          if (!confirmed) {
            return;
          }


          try {

            deleteButton.disabled =
              true;


            console.log(
              '[Daily Activity] DELETE',
              id
            );


            await MobsieApi.mutate(
              `/api/daily-activities/${encodeURIComponent(
                id
              )}`,
              {
                method: 'DELETE',
              }
            );


            await loadDailyActivities();


            App.refresh();


            UI.toast(
              'Activity deleted successfully.'
            );

          } catch (error) {

            console.error(
              '[Daily Activity] DELETE ERROR:',
              error
            );


            deleteButton.disabled =
              false;


            UI.toast(
              error?.message ||
                'Could not delete activity.',
              'alert'
            );

          }

        }

      }
    );


    /* =====================================================
       INITIAL DATABASE READ
    ===================================================== */

    if (!dailyState.loaded &&
        !dailyState.loading) {

      loadDailyActivities()
        .then(() => {

          App.refresh();

        })
        .catch((error) => {

          console.error(
            '[Daily Activity] INITIAL LOAD ERROR:',
            error
          );


          /*
           * Re-render so that the actual API error
           * appears on the Daily Activity page.
           */
          App.refresh();

        });

    }

  },

};
  /* ---------- Learning ---------- */
  Pages.homework={
    render(){
      return `
        ${UI.pageHead('Learning','Digital learning tools for teachers, learners and families.')}
        <div class="card" style="min-height:430px;display:grid;place-items:center;padding:48px">
          <div style="max-width:560px;text-align:center">
            <span class="s-ic t-purple" style="width:72px;height:72px;border-radius:22px;display:grid;place-items:center;margin:0 auto 22px">${MCIcon('homework')}</span>
            <span class="badge t-purple" style="margin-bottom:14px">Coming soon</span>
            <h2 style="font-size:28px;margin:0 0 12px;color:var(--ink-900)">Learning is on the way</h2>
            <p class="muted" style="font-size:16px;line-height:1.65;margin:0">We’re building a focused space for classroom activities, learning resources and parent progress updates.</p>
          </div>
        </div>`;
    },
    mount(){}
  };

  /* ---------- Reports ---------- */
  Pages.reports={
    render(){
      return `
        ${UI.pageHead('Reports','Reporting and analytics tools are being prepared for a future release.')}
        <div class="card" style="min-height:520px;display:grid;place-items:center">
          <div style="max-width:560px;text-align:center;padding:64px 28px">
            <span class="s-ic t-purple" style="width:72px;height:72px;border-radius:22px;display:grid;place-items:center;margin:0 auto 22px">${MCIcon('reports')}</span>
            <span class="badge t-purple" style="margin-bottom:14px">Coming soon</span>
            <h2 style="font-size:28px;margin:0 0 12px;color:var(--ink-900)">Reports are coming soon</h2>
            <p class="muted" style="font-size:16px;line-height:1.65;margin:0">We’re building a reliable reporting centre for learner progress, attendance and operational insights.</p>
          </div>
        </div>`;
    },
    mount(){}
  };

  /* ---------- Calendar ---------- */
  const calState={month:new Date().toISOString().slice(0,7),branch:'',category:''};
  const categoryTone={
    SCHOOL_EVENT:'green',SPORT:'green',MEETING:'orange',ACADEMIC:'blue',HOLIDAY:'red'
  };
  function monthLabel(value){
    const [year,month]=value.split('-').map(Number);
    return new Date(year,month-1,1).toLocaleDateString('en-ZA',{month:'long',year:'numeric'});
  }
  function calendarEvents(){
    const [year,month]=calState.month.split('-').map(Number);
    return (DB.apiEvents||[]).filter(event=>{
      const date=new Date(event.startsAt);
      return date.getFullYear()===year&&date.getMonth()===month-1
        &&(!calState.branch||event.branchId===calState.branch)
        &&(!calState.category||event.category===calState.category);
    });
  }
  Pages.calendar={
    render(){
      const [year,month]=calState.month.split('-').map(Number);
      const first=new Date(year,month-1,1);
      const daysInMonth=new Date(year,month,0).getDate();
      const previousDays=new Date(year,month-1,0).getDate();
      const leading=(first.getDay()+6)%7;
      const events=calendarEvents();
      const evByDay={};
      events.forEach(event=>{
        const day=new Date(event.startsAt).getDate();
        (evByDay[day]=evByDay[day]||[]).push({t:event.title,c:categoryTone[event.category]||'blue'});
      });
      const tone={orange:['var(--orange-100)','var(--orange-700)'],green:['var(--green-100)','var(--green-700)'],
        purple:['var(--purple-100)','var(--purple-700)'],blue:['var(--blue-100)','var(--blue-600)'],
        teal:['var(--teal-100)','var(--teal-600)'],red:['var(--red-100)','var(--red-600)']};
      let cells='';
      const dows=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      dows.forEach(d=>cells+=`<div class="cal-dow">${d}</div>`);
      const totalCells=Math.ceil((leading+daysInMonth)/7)*7;
      const today=new Date();
      for(let i=0;i<totalCells;i++){
        const day=i-leading+1;
        const inMonth=day>=1&&day<=daysInMonth;
        const label=inMonth?day:(day<1?previousDays+day:day-daysInMonth);
        const evs=inMonth?(evByDay[day]||[]):[];
        const isToday=inMonth&&today.getFullYear()===year&&today.getMonth()===month-1&&today.getDate()===day;
        cells+=`<div class="cal-cell ${inMonth?'':'dim'} ${isToday?'today':''}">
          <span class="d">${label}</span>
          ${evs.map(e=>`<span class="cal-ev" style="background:${tone[e.c][0]};color:${tone[e.c][1]}">${esc(e.t)}</span>`).join('')}
        </div>`;
      }
      return `
        ${UI.pageHead('Calendar','One calendar across all campuses — from sports days to term breaks.',
          `<input class="select" type="month" id="calMonth" value="${calState.month}" aria-label="Calendar month">
           <button class="btn btn-primary" id="addEvent">${MCIcon('plus')} Add Event</button>`)}
        <div class="toolbar" style="justify-content:flex-end">
          <select class="select" id="calBranch"><option value="">All branches</option>${DB.liveBranches().map(branch=>`<option value="${branch.id}" ${calState.branch===branch.id?'selected':''}>${esc(branch.name)}</option>`).join('')}</select>
          <select class="select" id="calCategory"><option value="">All categories</option>
            ${[['SCHOOL_EVENT','School events'],['SPORT','Sport'],['ACADEMIC','Academic'],['MEETING','Meetings'],['HOLIDAY','Holidays']].map(([value,label])=>`<option value="${value}" ${calState.category===value?'selected':''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="grid" style="grid-template-columns:2.4fr 1fr" id="calWrap">
          <div class="card"><div class="card-body" style="padding:0"><div class="cal-grid">${cells}</div></div></div>
          <div>
            ${UI.card(monthLabel(calState.month)+' events',`<div>${events.length?events.map(event=>{
              const date=new Date(event.startsAt),toneName=categoryTone[event.category]||'blue';
              return `<div class="event-item"><span class="ev-date t-${toneName}"><span class="mo">${date.toLocaleString('en',{month:'short'}).toUpperCase()}</span><span class="dy">${date.getDate()}</span></span>
              <span class="e-txt"><div class="e-nm">${esc(event.title)}</div><div class="e-sub">${esc(event.branchName||event.audience)}</div></span>
              <span class="e-time">${event.allDay?'All day':date.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
            }).join(''):'<div class="small muted">No events match these date filters.</div>'}</div>`)}
            <div style="height:20px"></div>
            ${UI.card('Event categories',`
              <div class="toggle-row"><span class="t-txt"><span class="t-nm">School events</span></span><span style="width:12px;height:12px;border-radius:4px;background:var(--green-500)"></span></div>
              <div class="toggle-row"><span class="t-txt"><span class="t-nm">Meetings</span></span><span style="width:12px;height:12px;border-radius:4px;background:var(--orange-500)"></span></div>
              <div class="toggle-row"><span class="t-txt"><span class="t-nm">Parent engagements</span></span><span style="width:12px;height:12px;border-radius:4px;background:var(--purple-500)"></span></div>
              <div class="toggle-row"><span class="t-txt"><span class="t-nm">Trips & outings</span></span><span style="width:12px;height:12px;border-radius:4px;background:var(--blue-500)"></span></div>
              <div class="toggle-row"><span class="t-txt"><span class="t-nm">Holidays & closures</span></span><span style="width:12px;height:12px;border-radius:4px;background:var(--red-500)"></span></div>`)}
          </div>
        </div>
        <style>@media(max-width:1100px){#calWrap{grid-template-columns:1fr}}</style>`;
    },
    mount(root){
      const rerender=()=>{document.getElementById('content').innerHTML=Pages.calendar.render();UI.hydrate();Pages.calendar.mount(document.getElementById('content'));};
      root.querySelector('#calMonth').addEventListener('change',e=>{calState.month=e.target.value;rerender();});
      root.querySelector('#calBranch').addEventListener('change',e=>{calState.branch=e.target.value;rerender();});
      root.querySelector('#calCategory').addEventListener('change',e=>{calState.category=e.target.value;rerender();});
      root.querySelector('#addEvent').addEventListener('click',()=>UI.modal({
        title:'Add Event',
        body:`<div class="field"><label>Event name</label><input type="text" data-f="name" placeholder="e.g. Sports Day"></div>
          <div class="form-row">
            <div class="field"><label>Date</label><input type="date" data-f="date" value="${calState.month}-01"></div>
            <div class="field"><label>Time</label><input type="time" data-f="time" value="08:00"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Audience</label><select data-f="aud"><option>All campuses</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Category</label><select data-f="cat"><option value="green">School event</option><option value="orange">Meeting</option><option value="purple">Parent engagement</option><option value="blue">Trip / outing</option><option value="red">Holiday / closure</option></select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Create Event</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.name||!v.date||!v.time){UI.toast('Event name, date and time are required','alert');return;}
            const category={green:'SCHOOL_EVENT',orange:'MEETING',purple:'MEETING',blue:'ACADEMIC',red:'HOLIDAY'}[v.cat];
            const branch=DB.branches.find(b=>b.name===v.aud);
            const startsAt=new Date(`${v.date}T${v.time}:00`).toISOString();
            const endsAt=new Date(new Date(startsAt).getTime()+60*60*1000).toISOString();
            try{
              const response=await MobsieApi.mutate('/api/events',{method:'POST',body:JSON.stringify({
                branchId:branch?.id||null,title:v.name,category,
                audience:branch?'BRANCH':'ALL',startsAt,endsAt,allDay:false
              })});
              const created=response.data[0];
              DB.apiEvents=DB.apiEvents||[];DB.apiEvents.push({...created,branchName:branch?.name||null});
              calState.month=v.date.slice(0,7);
              DB.log('Created calendar event',v.name+' — '+v.date,'ok');
              close();UI.toast('Event saved and pushed to parent apps');rerender();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };
})();
