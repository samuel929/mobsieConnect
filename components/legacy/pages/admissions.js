/* Mobsie Connect — Admissions: Applications, Interviews, Waiting List */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN;

  /* ---------- Applications ---------- */
  // Move an application through the pipeline, keeping donut + badges consistent
  function setAppStatus(a,st){
    const old=DB.APP_STATUS.indexOf(a.status), nw=DB.APP_STATUS.indexOf(st);
    if(old>=0&&DB.appCounts[old]>0) DB.appCounts[old]--;
    if(nw>=0) DB.appCounts[nw]++;
    if(a.status==='Pending Review'&&st!=='Pending Review'&&DB.counters.pendingReview>0) DB.counters.pendingReview--;
    a.status=st;
  }

  function scheduleInterviewModal(a,existing){
    UI.modal({
      title:existing?'Reschedule Interview':'Schedule Interview',
      body:`
        ${a?`<p class="small muted" style="margin-bottom:14px">For <b>${esc(a.child)}</b> · ${esc(a.grade)} · ${esc(a.school)}</p>`
           :existing?'':`<div class="field"><label>Application</label><select data-f="app">${DB.applications.filter(x=>x.status==='Pending Review'||x.status==='Documents Required').map(x=>`<option value="${x.id}">${esc(x.child)} — ${esc(x.school)}</option>`).join('')}</select></div>`}
        <div class="form-row">
          <div class="field"><label>Date</label><input type="text" data-f="date" value="${existing?esc(existing.date):'May 25, 2026'}"></div>
          <div class="field"><label>Time</label><input type="text" data-f="time" value="${existing?esc(existing.time):'09:00'}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Mode</label><select data-f="mode"><option ${existing&&existing.mode==='In-person'?'selected':''}>In-person</option><option ${existing&&existing.mode==='Virtual'?'selected':''}>Virtual</option></select></div>
          <div class="field"><label>Interviewer</label><input type="text" data-f="interviewer" value="${existing?esc(existing.interviewer):'Mpho Baloyi'}"></div>
        </div>`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${existing?'Save New Time':'Schedule & Notify Parent'}</button>`,
      mount(r,close){
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-s]').addEventListener('click',async(event)=>{
          const saveButton=event.currentTarget;
          const v=UI.formVals(r);
          if(existing){
            Object.assign(existing,{date:v.date,time:v.time,mode:v.mode,interviewer:v.interviewer,status:'Scheduled'});
            UI.toast('Interview rescheduled — parent notified');
          }else{
            const app=a||DB.applications.find(x=>x.id===v.app);
            if(!app){UI.toast('Pick an application first','alert');return;}
            const identifier=app.dbId||app.databaseId||app.applicationId||app.id;
            saveButton.disabled=true;
            try{
              await MobsieApi.mutate('/api/applications/'+encodeURIComponent(identifier)+'/status',{
                method:'PUT',
                body:JSON.stringify({
                  status:'INTERVIEW_SCHEDULED',
                  interviewDate:v.date,
                  interviewTime:v.time,
                  teamName:v.interviewer?`${v.interviewer} and the admissions team`:'Mobsie Kids admissions team'
                })
              });
            }catch(error){
              saveButton.disabled=false;
              UI.toast(error.message||'Could not schedule the interview','alert');
              return;
            }
            DB.interviews.unshift({id:'INT-'+(200+DB.interviews.length+1),child:app.child,parent:app.parent,
              school:app.school,branch:app.branch,grade:app.grade,date:v.date,time:v.time,
              interviewer:v.interviewer||'Mpho Baloyi',mode:v.mode,status:'Scheduled'});
            setAppStatus(app,'Interview Scheduled');
            DB.log('Scheduled interview',app.child+' — '+v.date,'ok');
            UI.toast('Interview scheduled — email sent to '+app.parent);
          }
          close();App.refresh();
        });
      }
    });
  }

  async function openApplication(a) {
  let detail = null;

  /**
   * The real database UUID must be available.
   */
  const applicationIdentifier =
    a.databaseId ||
    a.applicationId ||
    a.id;

  if (applicationIdentifier && window.MobsieApi) {
    try {
      const response = await MobsieApi.request(
        "/api/applications/" +
          encodeURIComponent(applicationIdentifier)
      );

      detail =
        response?.data ||
        null;

      console.log(
        "APPLICATION DETAIL:",
        detail
      );

      console.log(
        "DOCUMENTS:",
        detail?.documents
      );
    } catch (error) {
      console.error(
        "Could not load application:",
        error
      );

      UI.toast(
        "Could not load the complete application record: " +
          (error?.message || "Unknown error"),
        "alert"
      );
    }
  }

  const preferences =
    detail?.preferences || null;

  /**
   * Documents returned from PostgreSQL / API.
   */
  const uploadedDocuments =
    Array.isArray(detail?.documents)
      ? detail.documents
      : Array.isArray(a.documents)
        ? a.documents
        : [];

  const documentCount =
    uploadedDocuments.length ||
    Number(a.docs) ||
    0;

  const preferenceDetails =
    preferences
      ? `
        <div class="divider"></div>

        <h4 style="margin-bottom:10px">
          School preferences & emergency details
        </h4>

        ${UI.dl([
          [
            "Preferred branch",
            esc(
              preferences.branchName ||
                "—"
            ),
          ],
          [
            "Reason for branch",
            esc(
              preferences.reason ||
                "—"
            ),
          ],
          [
            "Preferred start date",
            esc(
              preferences.preferredStartDate ||
                "—"
            ),
          ],
          [
            "Enrolment type",
            esc(
              String(
                preferences.enrollmentType ||
                  "—"
              ).replace(/_/g, " ")
            ),
          ],
          [
            "Aftercare",
            preferences.aftercareRequested ? "Included" : "Not selected",
          ],
          [
            "Previous school",
            esc(
              preferences.previousSchool ||
                "—"
            ),
          ],
          [
            "Previous school phone",
            esc(
              preferences.previousSchoolPhone ||
                "—"
            ),
          ],
          [
            "Referral source",
            esc(
              preferences.referralSource ||
                "—"
            ),
          ],
          [
            "Medical information",
            esc(
              preferences.allergies ||
                "None supplied"
            ),
          ],
          [
            "Emergency contact",
            esc(
              [
                preferences.emergencyContactName,
                preferences.emergencyContactPhone,
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            ),
          ],
        ])}
      `
      : "";

  /**
   * Uploaded documents UI.
   */
  const documentsPanel =
    uploadedDocuments.length > 0
      ? `
        <div class="divider"></div>

        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            margin-bottom:12px;
          "
        >
          <div>
            <h4 style="margin:0">
              Uploaded documents
            </h4>

            <div class="small muted">
              ${uploadedDocuments.length}
              file${
                uploadedDocuments.length === 1
                  ? ""
                  : "s"
              } uploaded
            </div>
          </div>

          ${UI.badge(
            String(
              uploadedDocuments.length
            ),
            "blue"
          )}
        </div>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px;
          "
        >
          ${uploadedDocuments
            .map((document, index) => {
              const fileUrl =
                document.fileUrl ||
                document.url ||
                document.secureUrl ||
                document.secure_url ||
                "";

              const originalName =
                document.originalName ||
                document.fileName ||
                document.filename ||
                `Document ${index + 1}`;

              const documentKind =
                String(
                  document.kind ||
                    document.type ||
                    "Document"
                ).replace(/_/g, " ");

              const mimeType =
                document.mimeType ||
                document.mime_type ||
                "";

              const isImage =
                mimeType.startsWith(
                  "image/"
                ) ||
                /\.(jpg|jpeg|png|gif|webp)$/i.test(
                  fileUrl
                );

              const isPdf =
                mimeType ===
                  "application/pdf" ||
                /\.pdf($|\?)/i.test(
                  fileUrl
                );

              const fileSize =
                document.fileSize ||
                document.size ||
                null;

              const formattedSize =
                fileSize
                  ? formatDocumentSize(
                      Number(fileSize)
                    )
                  : "";

              return `
                <div
                  class="feed-item"
                  style="
                    border:1px solid var(--ink-100);
                    border-radius:12px;
                    padding:12px;
                    align-items:center;
                  "
                >
                  ${
                    isImage && fileUrl
                      ? `
                        <div
                          style="
                            width:48px;
                            height:48px;
                            border-radius:10px;
                            overflow:hidden;
                            flex:none;
                            background:var(--ink-50);
                          "
                        >
                          <img
                            src="${esc(
                              fileUrl
                            )}"
                            alt="${esc(
                              originalName
                            )}"
                            style="
                              width:100%;
                              height:100%;
                              object-fit:cover;
                            "
                            onerror="this.style.display='none'"
                          >
                        </div>
                      `
                      : `
                        <span
                          class="f-ic ${
                            isPdf
                              ? "t-red"
                              : "t-blue"
                          }"
                        >
                          ${MCIcon("file")}
                        </span>
                      `
                  }

                  <div
                    class="f-txt"
                    style="
                      min-width:0;
                      flex:1;
                    "
                  >
                    <div class="f-main">
                      ${esc(
                        documentKind
                      )}
                    </div>

                    <div
                      class="f-sub"
                      style="
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                      "
                    >
                      ${esc(
                        originalName
                      )}

                      ${
                        formattedSize
                          ? ` · ${esc(
                              formattedSize
                            )}`
                          : ""
                      }
                    </div>
                  </div>

                  ${
                    fileUrl
                      ? `
                        <a
                          class="btn btn-ghost btn-sm"
                          href="${esc(
                            fileUrl
                          )}"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="
                            margin-left:auto;
                            flex:none;
                          "
                        >
                          ${MCIcon(
                            "eye"
                          )}
                          View
                        </a>
                      `
                      : `
                        <span
                          class="small muted"
                          style="margin-left:auto"
                        >
                          File unavailable
                        </span>
                      `
                  }
                </div>
              `;
            })
            .join("")}
        </div>
      `
      : `
        <div class="divider"></div>

        <div
          style="
            padding:20px;
            border:1px dashed var(--ink-200);
            border-radius:12px;
            text-align:center;
          "
        >
          <div
            style="
              display:flex;
              justify-content:center;
              margin-bottom:8px;
            "
          >
            <span class="f-ic t-blue">
              ${MCIcon("file")}
            </span>
          </div>

          <div
            style="
              font-weight:700;
              color:var(--ink-800);
              margin-bottom:4px;
            "
          >
            No uploaded documents
          </div>

          <p
            class="small muted"
            style="margin:0"
          >
            Documents uploaded by the parent
            will appear here.
          </p>
        </div>
      `;

  UI.drawer({
    title:
      "Application " +
      (a.id || ""),

    headIcon: `
      <span
        class="s-ic t-orange"
        style="
          width:38px;
          height:38px;
          border-radius:12px;
          display:grid;
          place-items:center;
        "
      >
        ${MCIcon(
          "applications"
        )}
      </span>
    `,

    body: `
      <div
        style="
          display:flex;
          align-items:center;
          gap:14px;
          margin-bottom:18px;
        "
      >
        ${UI.avatar(
          a.child,
          "xl"
        )}

        <div>
          <div
            style="
              font-size:17px;
              font-weight:800;
              color:var(--ink-900);
            "
          >
            ${esc(
              a.child
            )}
          </div>

          <div class="muted small">
            Applying for
            ${esc(
              a.grade
            )}
            ·
            ${esc(
              a.school
            )}
          </div>
        </div>

        <span style="margin-left:auto">
          ${UI.status(
            a.status
          )}
        </span>
      </div>

      ${UI.dl([
        [
          "Parent",
          esc(
            detail?.parentName ||
              a.parent ||
              "—"
          ),
        ],

        [
          "Email",
          esc(
            detail?.parentEmail ||
              a.email ||
              "—"
          ),
        ],

        [
          "Phone",
          esc(
            detail?.parentPhone ||
              a.phone ||
              "—"
          ),
        ],

        [
          "School",
          esc(
            a.school ||
              "—"
          ),
        ],

        [
          "Branch",
          esc(
            preferences?.branchName ||
              a.branch ||
              "—"
          ),
        ],

        [
          "Grade",
          esc(
            a.grade ||
              "—"
          ),
        ],

        [
          "Application type",
          esc(String(detail?.applicationType || a.applicationType || "NEW").replace(/_/g, " ")),
        ],

        [
          "Registration fee",
          (detail?.registrationFeeWaived || a.registrationFeeWaived) ? "Waived for re-registration" : "Required",
        ],

        [
          "Disability disclosed",
          (detail?.childHasDisability ?? a.childHasDisability) ? "Yes" : "No",
        ],

        ...(detail?.childHasDisability || a.childHasDisability ? [[
          "Disability details",
          esc(detail?.disabilityDetails || a.disabilityDetails || "Not supplied"),
        ]] : []),

        [
          "Person responsible for fees",
          esc([
            preferences?.feePayerFirstName,
            preferences?.feePayerLastName,
          ].filter(Boolean).join(" ") || "—"),
        ],

        [
          "Submitted",
          esc(
            a.date ||
              "—"
          ),
        ],

        [
          "Documents",
          `${documentCount} uploaded`,
        ],
      ])}

      <div style="margin-top:10px">
        ${UI.meterRow(
          "Documents",
          Math.min(
            100,
            Math.round(
              (documentCount / 10) *
                100
            )
          ),
          "orange"
        )}
      </div>

      ${preferenceDetails}

      ${documentsPanel}

      <div class="divider"></div>

      <h4 style="margin-bottom:10px">
        Application timeline
      </h4>

      <div class="feed">

        <div class="feed-item">
          <span class="f-ic t-green">
            ${MCIcon("check")}
          </span>

          <div class="f-txt">
            <div class="f-main">
              Application submitted via
              parent app
            </div>

            <div class="f-sub">
              ${esc(
                a.date ||
                  ""
              )}
            </div>
          </div>
        </div>

        <div class="feed-item">
          <span class="f-ic t-blue">
            ${MCIcon("file")}
          </span>

          <div class="f-txt">
            <div class="f-main">
              ${documentCount}
              document${
                documentCount === 1
                  ? ""
                  : "s"
              }
              uploaded
            </div>

            <div class="f-sub">
              Application documents
            </div>
          </div>
        </div>

        <div class="feed-item">
          <span class="f-ic t-amber">
            ${MCIcon("waiting")}
          </span>

          <div class="f-txt">
            <div class="f-main">
              Awaiting admissions review
            </div>

            <div class="f-sub">
              Assigned to Mpho Baloyi
            </div>
          </div>
        </div>

      </div>
    `,

    foot: `
      <button
        class="btn btn-danger"
        id="apWaitlist"
      >
        ${MCIcon("x")}
        Add to Waiting List
      </button>

      <button
        class="btn btn-ghost"
        id="apInterview"
      >
        ${MCIcon(
          "interviews"
        )}
        Schedule Interview
      </button>

      <button
        class="btn btn-green"
        id="apApprove"
      >
        ${MCIcon("check")}
        Approve
      </button>
    `,

    mount(root, close) {
      root
        .querySelector(
          "#apApprove"
        )
        ?.addEventListener(
          "click",
          async (event) => {
            const button = event.currentTarget;
            const identifier = a.dbId || a.databaseId || a.applicationId || a.id;
            button.disabled = true;
            try {
              await MobsieApi.mutate(
                "/api/applications/" + encodeURIComponent(identifier) + "/status",
                {
                  method: "PUT",
                  body: JSON.stringify({ status: "APPROVED" }),
                }
              );
              setAppStatus(a, "Approved");
              DB.log("Approved application", a.id + " — " + a.child, "ok");
              close();
              UI.toast("Application approved and email sent to " + a.parent);
              App.refresh();
            } catch (error) {
              button.disabled = false;
              UI.toast(error.message || "Could not approve the application", "alert");
            }
          }
        );

      root
        .querySelector(
          "#apWaitlist"
        )
        ?.addEventListener(
          "click",
          async (event) => {
            const button = event.currentTarget;
            const identifier = a.dbId || a.databaseId || a.applicationId || a.id;
            button.disabled = true;
            try {
              await MobsieApi.mutate(
                "/api/applications/" + encodeURIComponent(identifier) + "/status",
                {
                  method: "PUT",
                  body: JSON.stringify({ status: "WAITLISTED" }),
                }
              );
              setAppStatus(a, "Waitlisted");
              if (!DB.waitingList.some((item) => item.applicationId === identifier)) {
                DB.waitingList.push({
                  id:'WL-'+String(104+DB.waitingList.length),applicationId:identifier,
                  child:a.child,parent:a.parent,school:a.school,schoolId:a.schoolId,
                  branch:a.branch,grade:a.grade,position:DB.waitingList.length+1,
                  since:new Date().toLocaleDateString('en-ZA'),priority:'Standard',offered:false
                });
              }
              DB.save();
              DB.log("Added application to waiting list", a.id + " — " + a.child, "warn");
              close();
              UI.toast("Application added to the waiting list");
              App.refresh();
            } catch (error) {
              button.disabled = false;
              UI.toast(error.message || "Could not add the application to the waiting list", "alert");
            }
          }
        );

      root
        .querySelector(
          "#apInterview"
        )
        ?.addEventListener(
          "click",
          () => {
            close();

            scheduleInterviewModal(
              a
            );
          }
        );
    },
  });
}

function formatDocumentSize(bytes) {
  if (
    !bytes ||
    Number.isNaN(bytes)
  ) {
    return "";
  }

  if (bytes < 1024) {
    return bytes + " B";
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return (
      (
        bytes /
        1024
      ).toFixed(1) +
      " KB"
    );
  }

  return (
    (
      bytes /
      (1024 * 1024)
    ).toFixed(1) +
    " MB"
  );
}

  const aState={tab:'All'};
  function renderApplications(){
    const total=DB.appCounts.reduce((a,b)=>a+b,0);
    const stages=[
      {label:'Applications',value:total},
      {label:'Docs complete',value:total-DB.appCounts[1]},
      {label:'Interviewed',value:DB.appCounts[2]+DB.appCounts[3]+DB.appCounts[4]},
      {label:'Approved',value:DB.appCounts[3]},
      {label:'Enrolled',value:Math.max(1,DB.appCounts[3]-1)},
    ];
    const isDeregistrations=aState.tab==='Deregistrations';
    const rows=isDeregistrations
      ? App.scoped(DB.deregistrations||[])
      : App.scoped(DB.applications).filter(r=>aState.tab==='All'||(aState.tab==='Waiting List'?r.status==='Waitlisted':r.status===aState.tab));
    const tbl=isDeregistrations?UI.table({
      pageSize:9,rows,
      onRow:r=>UI.drawer({
        title:'Deregistration — '+esc(r.learner),
        body:`${UI.dl([
          ['Learner',esc(r.learner)],['Parent / guardian',esc(r.parent)],
          ['Parent email',esc(r.email||'—')],['Branch',esc(r.branch||'—')],
          ['Last attendance date',esc(r.lastDay||'—')],['Scheduled removal',esc(r.removalDate||'—')],
          ['Reason',esc(r.reason||'—')],['Status',UI.status(r.status)]
        ])}${r.comments?`<div class="divider"></div><h4>Parent comments</h4><p class="small">${esc(r.comments)}</p>`:''}`
      }),
      columns:[
        {key:'learner',label:'Learner',render:r=>UI.personCell(r.learner,r.branch)},
        {key:'parent',label:'Parent / guardian',render:r=>`<div>${esc(r.parent)}</div><div class="cell-sub">${esc(r.email||'')}</div>`},
        {key:'lastDay',label:'Last attendance',render:r=>esc(r.lastDay||'—')},
        {key:'removalDate',label:'Removal date',render:r=>esc(r.removalDate||'—')},
        {key:'reason',label:'Reason'},
        {key:'status',label:'Status',render:r=>UI.status(r.status)},
        {label:'',sortable:false,render:()=>`<button class="icon-btn">${MCIcon('chevRight')}</button>`},
      ],
    }):UI.table({
      pageSize:9, rows, onRow:openApplication,
      columns:[
        {key:'id',label:'ID',render:r=>`<span class="cell-main" style="font-variant-numeric:tabular-nums">${r.id}</span>`},
        {key:'child',label:'Child',render:r=>UI.personCell(r.child,r.grade)},
        {key:'parent',label:'Parent',render:r=>`<div>${esc(r.parent)}</div><div class="cell-sub">${esc(r.phone)}</div>`},
        {key:'school',label:'School',render:r=>`<div>${esc(r.school)}</div><div class="cell-sub">${esc(r.branch)}</div>`},
        {key:'date',label:'Submitted'},
        {key:'docs',label:'Docs',num:true,render:r=>`${r.docs}/10`},
        {key:'status',label:'Status',render:r=>UI.status(r.status)},
        {label:'',sortable:false,render:r=>`<button class="icon-btn">${MCIcon('chevRight')}</button>`},
      ],
    });
    Pages.applications._tid=UI.lastTableId();
    const tabs=['All','Pending Review','Documents Required','Interview Scheduled','Approved','Waiting List','Deregistrations'];
    const counts={All:DB.applications.length};
    tabs.slice(1).forEach(t=>counts[t]=t==='Deregistrations'?(DB.deregistrations||[]).length:DB.applications.filter(a=>a.status===(t==='Waiting List'?'Waitlisted':t)).length);
    return `
      ${UI.pageHead('Applications','Every admission application across your campuses, from first click to enrolment.',
        `<button class="btn btn-ghost">${MCIcon('download')} Export</button>
         <button class="btn btn-primary" id="newApp">${MCIcon('plus')} New Application</button>`)}
      <div class="grid" style="grid-template-columns:1.3fr 1fr 1fr;margin-bottom:20px" id="admTop">
        ${UI.card('Admissions funnel',Charts.funnel({stages}),{sub:'This term · conversion from application to enrolment'})}
        ${UI.card('This month',`
          <div class="grid cards-2" style="gap:10px">
            <div class="mini-stat"><span class="ms-ic t-orange">${MCIcon('applications')}</span><div><div class="ms-val">${total}</div><div class="ms-lbl">New applications</div></div></div>
            <div class="mini-stat"><span class="ms-ic t-amber">${MCIcon('waiting')}</span><div><div class="ms-val">${DB.appCounts[0]}</div><div class="ms-lbl">Pending review</div></div></div>
            <div class="mini-stat"><span class="ms-ic t-green">${MCIcon('check')}</span><div><div class="ms-val">${DB.appCounts[3]}</div><div class="ms-lbl">Approved</div></div></div>
            <div class="mini-stat"><span class="ms-ic t-teal">${MCIcon('interviews')}</span><div><div class="ms-val">${DB.appCounts[2]}</div><div class="ms-lbl">Interviews set</div></div></div>
          </div>
          <div class="divider"></div>
          <div class="small muted">Average time to decision <b style="color:var(--ink-900)">3.2 days</b> · fastest campus <b style="color:var(--ink-900)">Cosmo City (0.9 d)</b></div>`)}
        ${UI.card('Intake by campus',`<div class="rank-list">${DB.liveBranches().map((b,i)=>`
          <div class="rank-item"><span class="rk">${i+1}</span>
          <span class="r-txt"><div class="r-nm">${esc(b.name)}</div><div class="r-sub">${esc(b.city)}</div></span>
          <span class="meter orange" style="flex:1"><i style="width:${88-i*14}%"></i></span>
          <span class="r-val">${12-i*2}</span></div>`).join('')}</div>`,{sub:'Applications this month'})}
      </div>
      <div class="card">
        <div class="card-body" style="padding-bottom:0">
          <div class="tabs" style="margin-bottom:0">${tabs.map(t=>`<button class="${aState.tab===t?'on':''}" data-tab="${t}">${t}<span class="cnt">${counts[t]}</span></button>`).join('')}</div>
        </div>
        <div class="card-body" style="padding-top:10px;padding-left:0;padding-right:0">${tbl}</div>
      </div>
      <style>@media(max-width:1280px){#admTop{grid-template-columns:1fr 1fr}}@media(max-width:860px){#admTop{grid-template-columns:1fr}}</style>`;
  }
  Pages.applications={
    render:renderApplications,
    mount(root){
      root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{aState.tab=b.dataset.tab;App.route='applications';document.getElementById('content').innerHTML=renderApplications();UI.hydrate();Pages.applications.mount(document.getElementById('content'));}));
      const na=root.querySelector('#newApp');
      if(na) na.addEventListener('click',()=>UI.modal({
        title:'New Application',
        body:`<div class="form-row">
            <div class="field"><label>Child's name</label><input type="text" data-f="child" placeholder="Full name"></div>
            <div class="field"><label>Grade applying for</label><select data-f="grade">${DB.GRADES.map(g=>`<option>${g}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>Parent / guardian</label><input type="text" data-f="parent" placeholder="Full name"></div>
          <div class="form-row">
            <div class="field"><label>Parent email</label><input type="email" data-f="email" placeholder="parent@email.com"></div>
            <div class="field"><label>Parent phone</label><input type="tel" data-f="phone" placeholder="082 555 0182"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Relationship</label><select data-f="relationship"><option>Mother</option><option>Father</option><option>Guardian</option><option>Other</option></select></div>
            <div class="field"><label>Child date of birth</label><input type="date" data-f="dateOfBirth"></div>
          </div>
          <div class="field"><label>Child gender</label><select data-f="gender"><option value="BOY">Boy</option><option value="GIRL">Girl</option><option value="OTHER">Other</option></select></div>
          <div class="form-row">
            <div class="field"><label>School</label><select data-f="school">${DB.schools.slice(0,15).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Preferred branch</label><select data-f="branch" required>
              <option value="">Select a branch</option>
              ${DB.liveBranches().map(b=>`<option value="${esc(b.name)}">${esc(b.name)} — ${esc(b.city)}</option>`).join('')}
            </select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Submit Application</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',async()=>{
            const v=UI.formVals(r);
            if(!v.child||!v.parent||!v.email||!v.phone||!v.dateOfBirth||!v.branch){
              UI.toast('Complete the child, parent and preferred branch details','alert');return;
            }
            const s=DB.schools.find(x=>x.id===v.school)||DB.schools[0];
            try{
              const created=await MobsieApi.mutate('/api/applications?tenantId='+encodeURIComponent(MobsieSession.tenantId),{
                method:'POST',body:JSON.stringify({
                  parentName:v.parent,parentEmail:v.email,parentPhone:v.phone,relationship:v.relationship,
                  childName:v.child,childDateOfBirth:v.dateOfBirth,childGender:v.gender,currentGrade:v.grade
                })
              });
              const application=created.data.application;
              DB.applications.unshift({
  /**
   * Display ID
   */
  id:
    application.reference,

  /**
   * Real PostgreSQL application UUID
   *
   * REQUIRED for loading documents.
   */
  databaseId:
    application.id,

  child:
    v.child,

  parent:
    v.parent,

  email:
    v.email,

  phone:
    v.phone,

  school:
    s.name,

  schoolId:
    s.id,

  branch:
    v.branch ||
    s.city + " Branch",

  grade:
    v.grade,

  status:
    "Pending Review",

  date:
    new Date().toLocaleDateString(
      "en-ZA"
    ),

  documents:
    application.documents || [],

  docs:
    application.documents?.length || 0,
});
            DB.appCounts[0]++;DB.counters.pendingReview++;
            aState.tab='All';
            DB.log('Captured application',v.child+' — '+s.name,'ok');
              close();UI.toast('Application saved to Neon');App.refresh();
            }catch(error){UI.toast(error.message,'alert');}
          });
        }
      }));
    }
  };

  /* ---------- Interviews ---------- */
  function renderInterviews(){
    const rows=App.scoped(DB.interviews);
    const today=rows.slice(0,3);
    const tbl=UI.table({
      pageSize:8, rows,
      onRow:iv=>UI.drawer({
        title:'Interview '+iv.id,
        body:`
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">${UI.avatar(iv.child,'xl')}
          <div><div style="font-size:17px;font-weight:800;color:var(--ink-900)">${esc(iv.child)}</div>
          <div class="muted small">${esc(iv.grade)} · ${esc(iv.school)}</div></div>
          <span style="margin-left:auto">${UI.status(iv.status)}</span></div>
          ${UI.dl([['Parent',esc(iv.parent)],['Date',esc(iv.date)],['Time',iv.time],['Mode',esc(iv.mode)],['Interviewer',esc(iv.interviewer)],['Branch',esc(iv.branch)]])}`,
        foot:`<button class="btn btn-ghost" id="ivRes">${MCIcon('calendar')} Reschedule</button><button class="btn btn-green" id="ivDone">${MCIcon('check')} Mark Completed</button>`,
        mount(root,close){
          root.querySelector('#ivRes').addEventListener('click',()=>{close();scheduleInterviewModal(null,iv);});
          root.querySelector('#ivDone').addEventListener('click',()=>{
            iv.status='Completed';
            DB.log('Completed interview',iv.id+' — '+iv.child,'ok');
            close();UI.toast('Interview marked completed');App.refresh();
          });
        }
      }),
      columns:[
        {key:'id',label:'ID'},
        {key:'child',label:'Child',render:r=>UI.personCell(r.child,r.grade)},
        {key:'school',label:'School',render:r=>`<div>${esc(r.school)}</div><div class="cell-sub">${esc(r.branch)}</div>`},
        {key:'date',label:'Date',render:r=>`<div class="cell-main">${r.date}</div><div class="cell-sub">${r.time}</div>`},
        {key:'mode',label:'Mode',render:r=>UI.status(r.mode)},
        {key:'interviewer',label:'Interviewer',render:r=>UI.personCell(r.interviewer)},
        {key:'status',label:'Status',render:r=>UI.status(r.status)},
      ],
    });
    return `
      ${UI.pageHead('Interviews','Admission interviews across all schools and branches.',
        `<button class="btn btn-primary" id="ivNew">${MCIcon('plus')} Schedule Interview</button>`)}
      <div class="grid cards-3" style="margin-bottom:20px">${today.map(iv=>`
        <div class="card" style="padding:16px 18px">
          <div style="display:flex;align-items:center;gap:12px">${UI.avatar(iv.child,'lg')}
            <div style="min-width:0"><div style="font-weight:700;color:var(--ink-900)">${esc(iv.child)}</div>
            <div class="small muted">${esc(iv.school)}</div></div>
            <span style="margin-left:auto">${UI.badge(iv.mode,iv.mode==='Virtual'?'purple':'blue')}</span></div>
          <div class="divider" style="margin:12px 0"></div>
          <div style="display:flex;align-items:center;gap:14px" class="small">
            <span style="display:inline-flex;align-items:center;gap:6px;color:var(--ink-600);font-weight:600">${MCIcon('calendar')} ${iv.date}</span>
            <span style="display:inline-flex;align-items:center;gap:6px;color:var(--ink-600);font-weight:600">${MCIcon('clock')} ${iv.time}</span>
            <button class="btn btn-soft btn-sm" style="margin-left:auto">Join</button>
          </div>
        </div>`).join('')}</div>
      <div class="card"><div class="card-head"><div><h3>All interviews</h3></div></div>
        <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
  }
  Pages.interviews={
    render:renderInterviews,
    mount(root){
      root.querySelector('#ivNew').addEventListener('click',()=>scheduleInterviewModal(null));
    }
  };

  /* ---------- Waiting List ---------- */
  function renderWaiting(){
    const rows=App.scoped(DB.waitingList);
    const tbl=UI.table({
      pageSize:10, rows,
      columns:[
        {key:'position',label:'#',num:true,render:r=>`<b style="font-variant-numeric:tabular-nums">${r.position}</b>`},
        {key:'child',label:'Child',render:r=>UI.personCell(r.child,r.grade)},
        {key:'parent',label:'Parent'},
        {key:'school',label:'School',render:r=>`<div>${esc(r.school)}</div><div class="cell-sub">${esc(r.branch)}</div>`},
        {key:'since',label:'On list since'},
        {key:'priority',label:'Priority',render:r=>UI.status(r.priority)},
        {label:'',sortable:false,render:r=>r.offered?UI.status('Offered'):`<button class="btn btn-soft btn-sm" data-offer="${r.id}">Offer place</button>`},
      ],
    });
    return `
      ${UI.pageHead('Waiting List','Families queued for a place, with sibling and staff priority handling.',
        `<button class="btn btn-ghost" id="wlNotify">${MCIcon('campaigns')} Notify All</button>
         <button class="btn btn-primary" id="wlAdd">${MCIcon('plus')} Add to List</button>`)}
      <div class="grid cards-4" style="margin-bottom:20px">
        ${UI.statCard({icon:'waiting',tint:'t-amber',label:'On Waiting List',value:F(DB.waitingList.length),deltaHtml:UI.delta(12,'up','this term')})}
        ${UI.statCard({icon:'parents',tint:'t-purple',label:'Sibling Priority',value:F(DB.waitingList.filter(w=>w.priority==='Sibling').length),deltaHtml:`<span class="delta flat">of the list</span>`})}
        ${UI.statCard({icon:'check',tint:'t-green',label:'Placed This Month',value:'9',deltaHtml:UI.delta(9,'up','vs April')})}
        ${UI.statCard({icon:'clock',tint:'t-blue',label:'Avg Wait Time',value:'6.4 wks',deltaHtml:UI.delta(4,'down','improving')})}
      </div>
      <div class="card"><div class="card-head"><div><h3>Current waiting list</h3><div class="sub">Ordered by position — offers release automatically when a seat opens</div></div></div>
        <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
  }
  Pages['waiting-list']={
    render:renderWaiting,
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-offer]');
        if(b){
          const w=DB.waitingList.find(x=>x.id===b.dataset.offer);
          if(w){w.offered=true;DB.log('Offered place',w.child+' — '+w.school,'ok');
            UI.toast('Offer sent — family has 48 hours to accept');App.refresh();}
        }
      });
      root.querySelector('#wlNotify').addEventListener('click',()=>UI.toast('Position update sent to all '+DB.waitingList.length+' families'));
      root.querySelector('#wlAdd').addEventListener('click',()=>UI.modal({
        title:'Add to Waiting List',
        body:`<div class="form-row">
            <div class="field"><label>Child's name</label><input type="text" data-f="child" placeholder="Full name"></div>
            <div class="field"><label>Grade</label><select data-f="grade">${DB.GRADES.map(g=>`<option>${g}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>Parent / guardian</label><input type="text" data-f="parent" placeholder="Full name"></div>
          <div class="form-row">
            <div class="field"><label>School</label><select data-f="school">${DB.schools.slice(0,15).map(s=>`<option>${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Priority</label><select data-f="priority"><option>Standard</option><option>Sibling</option><option>Staff Child</option></select></div>
          </div>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>Add to List</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            const v=UI.formVals(r);
            if(!v.child){UI.toast('Child name is required','alert');return;}
            DB.waitingList.push({id:'WL-'+(103+DB.waitingList.length),child:v.child,parent:v.parent||'—',
              school:v.school,branch:'Main branch',grade:v.grade,position:DB.waitingList.length+1,
              since:'May 18, 2026',priority:v.priority});
            DB.log('Added to waiting list',v.child+' — '+v.school,'info');
            close();UI.toast('Added to the waiting list at position '+DB.waitingList.length);App.refresh();
          });
        }
      }));
    }
  };
})();
