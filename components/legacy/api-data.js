(function () {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      // Dashboard data must always represent Neon, especially for timetables
      // which are also consumed by the Expo parent app.
      cache: options.cache || 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) throw new Error(body.error?.message || `Request failed (${response.status})`);
    return body;
  }

  const statusLabel = (value) =>
    String(value || '')
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const PERSISTED_MODELS = [
    'schools', 'branches', 'teachers', 'parents', 'learners', 'applications', 'appCounts',
    'waitingList', 'payments', 'invoices', 'conversations', 'newsletters', 'pushLog',
    'albums', 'products', 'ordersList', 'documentsList', 'adminUsers', 'rolePerms',
    'auditLog', 'events', 'counters', 'customCal', 'homeworkList', 'docFolders', 'reportRuns',
  ];

  let saveTimer;
  let saveInFlight = Promise.resolve();
  function installRemotePersistence() {
    if (window.DB.__remotePersistenceInstalled) return;
    const localSave = window.DB.save.bind(window.DB);
    window.DB.save = function save() {
      localSave();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const state = Object.fromEntries(PERSISTED_MODELS.map((key) => [key, window.DB[key]]));
        saveInFlight = saveInFlight
          .catch(() => undefined)
          .then(() => request('/api/control-centre/state', {
            method: 'PUT',
            body: JSON.stringify({ state }),
          }))
          .catch((error) => window.UI?.toast(`Database sync failed: ${error.message}`, 'error'));
      }, 250);
    };
    window.DB.flush = () => saveInFlight;
    window.DB.__remotePersistenceInstalled = true;
  }

  async function load() {
    const session = window.MobsieSession;
    if (!session || !window.DB) return;
    const tenant = session.tenantId;
    const principal = session.role === 'PRINCIPAL';
    const stored = await request('/api/control-centre/state').catch(() => null);

    const calls = [
      request(`/api/branches?tenantId=${encodeURIComponent(tenant)}&limit=100`),
      request('/api/students?limit=100'),
      request(`/api/academics?year=${new Date().getFullYear()}&limit=200`),
      request('/api/events?from=2020-01-01T00:00:00.000Z&to=2035-01-01T00:00:00.000Z&limit=250'),
      request('/api/daily-activities'),
    ];
    if (principal) {
      calls.push(
        request('/api/parents?limit=500'),
        request(`/api/team?tenantId=${encodeURIComponent(tenant)}&limit=100`),
        request('/api/applications?limit=100'),
        request('/api/deregistrations?limit=500'),
        request('/api/shop/products?limit=100'),
        request('/api/shop/orders?limit=100'),
        request('/api/mobile-admin/feedback?limit=500'),
        request('/api/parents/stats'),
        request('/api/team/stats'),
        request('/api/students/stats'),
        request('/api/attendance/stats'),
        request('/api/reports/stats'),
        request('/api/users'),
      );
    }
    const results = await Promise.allSettled(calls);
    const successful = results.map((result) => (result.status === 'fulfilled' ? result.value.data : null));
    const [branches, students, academics, events, dailyActivities, parents, team, applications, deregistrations, products, orders, feedback, parentStats, teamStats, learnerStats, attendanceStats, reportStats, users] = successful;

    if (branches) {
      window.DB.branches = branches.map((branch) => ({
        id: branch.id,
        schoolId: 'sch-1',
        school: window.DB.SCHOOL_NAME,
        name: branch.name,
        city: branch.city,
        region: branch.region,
        principal: branch.principalName || 'To be appointed',
        principalEmail: branch.principalEmail || '',
        principalPhone: branch.principalPhone || '',
        students: branch.learnerCount || 0,
        teachers: branch.teacherCount || 0,
        revenue: 0,
        attendance: branch.attendanceRate || 0,
        phone: branch.phone || '',
        email: branch.email || '',
        address: branch.address || '',
        imageUrl: branch.imageUrl,
        status: branch.status === 'COMING_SOON' ? 'Coming Soon' : statusLabel(branch.status),
        since: new Date(branch.createdAt).getFullYear().toString(),
      }));
    }
    if (students) {
      window.DB.learners = students.map((student) => ({
        id: student.id,
        name: student.name,
        school: window.DB.SCHOOL_NAME,
        schoolId: 'sch-1',
        branch: student.branchName,
        grade: student.grade,
        cls: student.className,
        parent: student.parentName,
        age: '',
        attendance: student.attendanceRate,
        fees: '—',
        status: statusLabel(student.enrollmentStatus),
      }));
    }
    if (parents) {
      window.DB.parents = parents.map((parent) => ({
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone || '',
        school: window.DB.SCHOOL_NAME,
        schoolId: 'sch-1',
        branch: parent.branchName || 'Not assigned',
        branchId: parent.branchId || '',
        children: Number(parent.children || 0),
        balance: 0,
        status: parent.isActive === false ? 'Inactive' : 'Active',
        joined: parent.createdAt ? new Date(parent.createdAt).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }) : '',
      }));
    }
    if (parentStats) {
      window.DB.parentStats = parentStats;
      window.DB.totals.parents = Number(parentStats.totalParents || 0);
    }
    if (academics) window.DB.academicRecords = academics;
    if (team) {
      window.DB.teachers = team.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.contactEmail || '',
        phone: member.contactPhone || '',
        school: window.DB.SCHOOL_NAME,
        schoolId: 'sch-1',
        branch: member.branchName,
        grade: member.title,
        cls: member.title,
        students: Number(member.studentCount || 0),
        years: member.yearsExperience,
        rating: '—',
        status: 'Active',
        imageUrl: member.imageUrl,
        createdAt: member.createdAt,
      }));
    }
    if (teamStats) {
      window.DB.teamStats = teamStats;
      window.DB.totals.teachers = Number(teamStats.totalStaff || 0);
    }
    if (learnerStats) {
      window.DB.learnerStats=learnerStats;
      window.DB.totals.students=Number(learnerStats.totalLearners||0);
    }
    if (attendanceStats) window.DB.attendanceStats=attendanceStats;
    if (reportStats) window.DB.reportStats=reportStats;
    if (users) {
      window.DB.adminUsers=users.map((account)=>({
        id:account.id,name:account.name,email:account.email,
        role:account.role==='PRINCIPAL'?'Principal':'Teacher',roleValue:account.role,
        branchId:account.branchId||'',scope:account.branchName||'Entire school group',
        last:account.lastLoginAt?new Date(account.lastLoginAt).toLocaleString('en-ZA'):'Never',
        status:account.isActive?'Active':'Suspended',
      }));
    }
    if (applications) {
      window.DB.applications = applications.map((application) => ({
        // Keep the UUID for API mutations; the reference remains the display id.
        dbId: application.id,
        id: application.reference,
        child: application.childName,
        parent: application.parentName,
        email: application.parentEmail,
        phone: application.parentPhone,
        school: window.DB.SCHOOL_NAME,
        schoolId: 'sch-1',
        branch: '—',
        applicationType: application.applicationType || 'NEW',
        registrationFeeWaived: Boolean(application.registrationFeeWaived),
        childHasDisability: Boolean(application.childHasDisability),
        disabilityDetails: application.disabilityDetails || '',
        grade: application.currentGrade,
        status: statusLabel(application.status),
        date: new Date(application.createdAt).toLocaleDateString('en-ZA'),
        docs: application.documentCount,
      }));
      window.DB.counters.pendingReview = applications.filter((item) => item.status === 'PENDING_REVIEW').length;
    }
    if (deregistrations) {
      window.DB.deregistrations = deregistrations.map((item) => ({
        id: item.id,
        studentId: item.studentId,
        learner: item.studentName || 'Unknown learner',
        parent: item.parentName || 'Unknown parent',
        email: item.parentEmail || '',
        school: window.DB.SCHOOL_NAME,
        schoolId: 'sch-1',
        branch: item.branchName || 'Not assigned',
        branchId: item.branchId || '',
        lastDay: item.lastDayOfAttendance || '',
        removalDate: item.removalScheduledFor || '',
        reason: statusLabel(item.reason),
        comments: item.comments || '',
        status: statusLabel(item.status),
        submittedAt: item.submittedAt || '',
      }));
    }
    if (events) {
      window.DB.apiEvents = events;
      window.DB.events = events.map((event) => {
        const date = new Date(event.startsAt);
        return {
          mo: date.toLocaleString('en', { month: 'short' }).toUpperCase(),
          dy: String(date.getDate()),
          name: event.title,
          sub: event.branchName || event.audience,
          time: event.allDay ? 'All day' : date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
          tint: 't-orange',
          people: 0,
        };
      });
    }
    if (dailyActivities) window.DB.dailyActivities = dailyActivities;
    if (products?.length) {
      const hues=['#F97316','#16A34A','#7C3AED','#2563EB','#0D9488','#DB2777'];
      window.DB.products=products.map((product,index)=>({
        id:product.id,name:product.name,cat:product.category,price:Number(product.price),
        stock:product.stock,sold:product.sold,
        status:product.status==='HIDDEN'?'Hidden':product.status==='OUT_OF_STOCK'?'Out of Stock':product.stock<20?'Low Stock':'Active',
        imageUrl:product.imageUrl,hue:hues[index%hues.length],
      }));
    }
    if (orders?.length) {
      const labels={PROCESSING:'Processing',READY_FOR_COLLECTION:'Ready for Collection',COLLECTED:'Collected',CANCELLED:'Cancelled'};
      window.DB.ordersList=orders.map((order)=>({
        dbId:order.id,id:order.reference,parent:order.parentName,school:order.branchName||window.DB.SCHOOL_NAME,
        items:order.items,total:Number(order.total),date:new Date(order.createdAt).toLocaleDateString('en-ZA'),
        status:labels[order.status]||statusLabel(order.status),
      }));
    }
    if (Array.isArray(feedback)) {
      const feedbackStatus = { NEW: 'New', OPEN: 'New', READ: 'Read', RESOLVED: 'Responded' };
      window.DB.feedback = feedback.map((item) => ({
        id: item.id,
        who: item.parentName || 'Parent',
        school: item.branchName || window.DB.SCHOOL_NAME,
        topic: statusLabel(item.category || 'GENERAL'),
        text: item.message || '',
        rating: Number(item.rating || 0),
        status: feedbackStatus[item.status] || statusLabel(item.status || 'NEW'),
        date: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
          : '',
      }));
    }
    // The normalized feeds seed a new tenant. Once dashboard state exists, its
    // modal edits are authoritative so a reload cannot undo a saved action.
    if (stored?.data?.state) {
      Object.entries(stored.data.state).forEach(([key, value]) => {
        if (PERSISTED_MODELS.includes(key) && !['branches','teachers','parents','learners','applications','products','ordersList','feedback'].includes(key)) window.DB[key] = value;
      });
    }
    // Saved control-centre state may predate the Mobsie Connect rename.
    // Keep mutable school details while enforcing the current product name.
    if (Array.isArray(window.DB.schools)) {
      window.DB.schools.forEach((school) => {
        school.name = window.DB.SCHOOL_NAME;
        school.initials = 'MC';
      });
    }
    if (Array.isArray(window.DB.branches)) {
      window.DB.branches.forEach((branch) => { branch.school = window.DB.SCHOOL_NAME; });
    }
    window.DB.recount();
    installRemotePersistence();
    if (!stored?.data) window.DB.save();
  }

  async function mutate(path, options = {}) {
    return request(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  }

  window.MobsieApi = { request, mutate, load, models: PERSISTED_MODELS };
})();
