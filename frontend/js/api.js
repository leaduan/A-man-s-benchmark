/* Dual-mode data layer: Django REST when /api responds, localStorage otherwise. */
(function () {
  const KEY = 'amb.workspace.v1';
  const CATEGORIES = [
    'University Coursework',
    'Research',
    'Programming and Technical Skills',
    'Reading',
    'Personal Development',
    'Health and Fitness',
    'Other',
  ];
  const PRIORITIES = ['High', 'Medium', 'Low'];
  const STATUSES = ['Pending', 'In Progress', 'Completed'];
  const AREAS = [
    { id: 1, order: 1, code: 'academic_mastery', title: 'Academic Mastery', priority_tag: '1st Priority', description: 'First-principles course understanding, problem-set mastery, rigorous exam preparation.' },
    { id: 2, order: 2, code: 'scientific_thinking', title: 'Scientific Thinking & Research', priority_tag: '2nd Priority', description: 'Literature review, hypothesis formulation, numerical simulations, analytical rigor.' },
    { id: 3, order: 3, code: 'deep_work', title: 'Deep Work & Limit-Breaking Discipline', priority_tag: '3rd Priority', description: 'Resisting cheap dopamine, sustaining uninterrupted focus, overcoming mental resistance.' },
    { id: 4, order: 4, code: 'physical_stamina', title: 'Physical Stamina & Recovery', priority_tag: '4th Priority', description: 'Sleep timing consistency, cardiovascular capacity, nutrition fueling mental stamina.' },
    { id: 5, order: 5, code: 'character_integrity', title: 'Character & Intellectual Honesty', priority_tag: '5th Priority', description: 'Admitting knowledge gaps without ego, keeping promises to oneself, relentless integrity.' },
  ];

  let zone = 'Asia/Dhaka';

  const AMB = {
    mode: 'local',
    user: null,
    CATEGORIES,
    PRIORITIES,
    STATUSES,
    escape,
    toast,
    modal,
    closeModal,
    bind,
    clearCharts,
    isoDate,
    today,
    monday,
    addDaysIso,
    dateInZone,
    formatLong,
    formatMinutes,
    sortTasks,
    setZone,
  };

  function escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function setZone(name) {
    zone = name || 'Asia/Dhaka';
  }

  function zonedDate(value) {
    const parsed = value instanceof Date ? value : new Date(value || Date.now());
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed);
  }

  function today() {
    return zonedDate(new Date());
  }

  function dateInZone(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return zonedDate(value);
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function addDaysIso(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + days));
    const yy = utc.getUTCFullYear();
    const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(utc.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  function monday(weeks) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(new Date());
    const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
    const diff = (index <= 0 ? -6 : 1 - index) + weeks * 7;
    return addDaysIso(today(), diff);
  }

  function formatLong(iso) {
    if (!iso) return 'No date';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function formatMinutes(mins) {
    const value = Number(mins) || 0;
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (!h) return `${m}m`;
    if (!m) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function errorMessage(data) {
    if (!data) return 'Request failed.';
    if (typeof data === 'string') return data.slice(0, 240);
    if (data.detail) return String(data.detail);
    return Object.entries(data).map(([key, value]) => {
      const msg = Array.isArray(value) ? value.join(' ') : String(value);
      return `${key}: ${msg}`;
    }).join(' ');
  }

  function unwrap(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return data;
  }

  const responseCache = new Map();

  function remember(path, data) {
    responseCache.set(path, JSON.stringify(data));
  }

  async function request(method, path, body) {
    const cacheable = method === 'GET' && (path === '/api/settings/' || path === '/api/dashboard-summary/');
    if (cacheable && responseCache.has(path)) return JSON.parse(responseCache.get(path));
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && method !== 'HEAD') {
      const token = csrfToken();
      if (token) headers['X-CSRFToken'] = token;
    }
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (err) { data = { detail: text.slice(0, 180) }; }
    }
    if (!response.ok) {
      const detail = data && data.detail ? String(data.detail) : '';
      const signedOut = response.status === 401 || (response.status === 403 && /credential|authenticated/i.test(detail));
      if (signedOut && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
        AMB.user = null;
        if (window.App && App.showGate) App.showGate();
      }
      throw new Error(errorMessage(data));
    }
    if (method !== 'GET' && method !== 'HEAD') responseCache.clear();
    if (cacheable && data) remember(path, data);
    if (path === '/api/dashboard-summary/' && data && data.settings) remember('/api/settings/', data.settings);
    return data;
  }

  function priorityRank(priority) {
    if (priority === 'High') return 3;
    if (priority === 'Medium') return 2;
    return 1;
  }

  function sortTasks(list, sort) {
    const items = [...list];
    const due = (value) => value || '9999-99-99';
    items.sort((a, b) => {
      if (sort === 'due_date') {
        return due(a.due_date).localeCompare(due(b.due_date)) || priorityRank(b.priority) - priorityRank(a.priority);
      }
      if (sort === 'priority') {
        return priorityRank(b.priority) - priorityRank(a.priority) || due(a.due_date).localeCompare(due(b.due_date));
      }
      if (sort === 'status') {
        return a.status.localeCompare(b.status) || due(a.due_date).localeCompare(due(b.due_date));
      }
      const done = (a.status === 'Completed') - (b.status === 'Completed');
      if (done) return done;
      const academy = (a.category === 'University Coursework' ? 0 : 1) - (b.category === 'University Coursework' ? 0 : 1);
      if (academy) return academy;
      const rank = priorityRank(b.priority) - priorityRank(a.priority);
      if (rank) return rank;
      return due(a.due_date).localeCompare(due(b.due_date));
    });
    return items;
  }

  function defaultSettings() {
    return {
      student_name: '',
      aspiration: '',
      major: '',
      gpa_target: '',
      current_execution_rate: 0,
      target_execution_rate: 90,
      weekly_study_pr_hours: 0,
      longest_session_pr_minutes: 0,
      timezone: 'Asia/Dhaka',
      weekly_intention: '',
    };
  }

  function buildDemoRecords() {
    const day = (offset) => addDaysIso(today(), offset);
    const tasks = [
      ['Linear algebra problem set 6', 'Every exercise written out, including the spectral theorem proofs.', 'University Coursework', 'High', -6, 'Completed'],
      ['Griffiths problem set, chapter 3', 'Each problem solved without the solution manual, errors listed.', 'University Coursework', 'High', -4, 'Completed'],
      ['Lab report: magnetic field mapping', 'Report submitted with the uncertainty stated on every plot.', 'University Coursework', 'High', -3, 'Completed'],
      ['Recitation worksheet: multipole expansion', 'Worksheet corrected in pen after recitation.', 'University Coursework', 'Medium', -2, 'Completed'],
      ['Relaxation-method grid exercise', '20 by 20 grid converges and the plot is in the notebook.', 'University Coursework', 'Medium', -5, 'Completed'],
      ['Reading quiz: Griffiths 4.1-4.4', 'Quiz taken closed-book and the misses copied into the error list.', 'University Coursework', 'Medium', -1, 'Completed'],
      ['Corrections on problem set 5', 'Every marked item reworked before the next lecture.', 'University Coursework', 'High', -7, 'Completed'],
      ['Electrodynamics midterm review', 'Griffiths chapters 1-7 closed-book, missed items rewritten from memory.', 'University Coursework', 'High', 3, 'In Progress'],
      ['Problem set 8: boundary-value problems', 'Every part finished without the solution manual.', 'University Coursework', 'High', 1, 'Pending'],
      ['Jackson notes, three derivations', 'Three derivations written in my own notation, not transcribed.', 'Research', 'Medium', 5, 'Pending'],
      ['Finite-difference Laplace solver', 'Solver runs, convergence plot saved, boundary bug written down.', 'Programming and Technical Skills', 'Low', 9, 'Pending'],
      ['Feynman Lectures Vol. II, chapter 20', 'One-page summary in my own words.', 'Reading', 'Medium', 4, 'Pending'],
      ['Lights out by 23:30', 'Four study nights in bed by 23:30, logged the same night.', 'Health and Fitness', 'Medium', 4, 'Pending'],
      ['Weekly intention, one sentence', 'One sentence on the settings card, specific enough to fail.', 'Personal Development', 'Low', 2, 'In Progress'],
    ].map(([title, description, category, priority, offset, status]) => ({
      title, description, category, priority, status, due_date: day(offset),
    }));

    const sessions = [
      [0, 'Electrodynamics', 210, 'Griffiths 2.3-2.5, eight problems without the manual'],
      [1, 'Quantum Mechanics', 180, 'Finite well derivation, three pages'],
      [2, 'Mathematical Methods', 150, 'Fourier series problem set, parts a-d'],
      [3, 'Electrodynamics', 240, 'Timed past exam, 2023, closed notes'],
      [4, 'Research Reading', 120, 'Jackson 1.7-1.9, notes in my own notation'],
      [5, 'Programming', 90, 'Laplace solver grid, still diverging at the boundary'],
      [6, 'Quantum Mechanics', 160, 'Operator identities, two errors found on review'],
      [8, 'Electrodynamics', 100, 'Prior week review'],
      [9, 'Quantum Mechanics', 140, ''],
      [10, 'Mathematical Methods', 80, ''],
      [11, 'Electrodynamics', 200, ''],
      [12, 'Research Reading', 90, ''],
      [13, 'Programming', 110, ''],
    ].map(([offset, subject, duration_minutes, notes]) => ({
      subject, duration_minutes, notes, date: day(-offset),
    }));

    const scoreText = {
      0: {
        academic_mastery: [4, 'Closed the Griffiths chapter 3 set without the solution manual. Two boundary-condition sign errors, both written out.'],
        scientific_thinking: [3, 'Annotated four pages of Jackson in my own notation. No original calculation yet.'],
        deep_work: [4, 'Four blocks longer than 150 minutes. Phone left in the other room for each one.'],
        physical_stamina: [3, 'Asleep after 00:30 on two nights. One training session.'],
        character_integrity: [4, 'Logged both electrostatics mistakes in the error list instead of rounding the work up.'],
      },
      '-1': {
        academic_mastery: [4, 'Finished the electrostatics problem set and the magnetic-field lab report.'],
        scientific_thinking: [4, 'Read Jackson 1.7-1.9 and re-derived the multipole term once.'],
        deep_work: [3, 'One 200-minute block. Two evenings broken by an open browser tab.'],
        physical_stamina: [4, 'In bed by 23:40 on four nights. Two easy runs.'],
        character_integrity: [4, 'Stated the lab uncertainty instead of dropping the noisy points.'],
      },
      '-2': {
        academic_mastery: [4, 'Linear algebra problem set 6 complete, including the spectral theorem exercises.'],
        scientific_thinking: [2, 'No research block. Coursework took the week.'],
        deep_work: [3, 'Three sessions, none past 90 minutes.'],
        physical_stamina: [3, 'Sleep drifted past midnight three times.'],
        character_integrity: [4, 'Kept the promise to start the lab report on Monday.'],
      },
    };
    const scores = [];
    Object.entries(scoreText).forEach(([week, pillars]) => {
      const weekStart = monday(Number(week));
      Object.entries(pillars).forEach(([code, pair]) => {
        scores.push({ score_area_code: code, week_start: weekStart, rating: pair[0], evidence: pair[1] });
      });
    });

    const reviews = [
      {
        week_start: monday(0),
        accomplishments: 'Seven coursework items are done. The 240-minute past exam was the longest block.',
        failures: 'Problem set 8 is still open, and two nights ran past midnight.',
        distractions: 'A browser tab stayed open through the first programming block.',
        lessons_learned: 'The long electrodynamics block held when the phone was in the other room.',
        next_week_improvements: 'Start boundary-value problems on the first evening, not after the timed exam.',
        non_negotiable_1: 'Finish problem set 8 without the solution manual.',
        non_negotiable_2: 'Three Jackson derivations in my own notation.',
        non_negotiable_3: 'Lights out by 23:30 on study nights.',
      },
      {
        week_start: monday(-1),
        accomplishments: 'Finished the electrostatics set and submitted the lab report.',
        failures: 'Started Jackson late and broke two evenings with an open browser tab.',
        distractions: 'Left a browser tab open during the first evening block.',
        lessons_learned: 'A 200-minute block holds when the phone is in another room.',
        next_week_improvements: 'Schedule the research block before Thursday.',
        non_negotiable_1: 'Close the Griffiths chapter 3 set without the manual.',
        non_negotiable_2: 'Re-derive the multipole term once from scratch.',
        non_negotiable_3: 'In bed by 23:40 on four nights.',
      },
    ];
    return {
      settings: {
        ...defaultSettings(),
        student_name: 'Alexander Vance',
        aspiration: 'Theoretical Physicist & Research Scientist',
        major: 'Honors Physics & Pure Mathematics',
        gpa_target: '3.95 / 4.00',
        weekly_study_pr_hours: 44,
        longest_session_pr_minutes: 255,
        weekly_intention: 'Dominate the electrodynamics midterm and beat the 44-hour deep-work record',
      },
      tasks,
      sessions,
      scores,
      reviews,
    };
  }

  function emptyStore() {
    return { nextId: 1, settings: defaultSettings(), tasks: [], sessions: [], scores: [], reviews: [] };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.settings) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveStore(store) {
    localStorage.setItem(KEY, JSON.stringify(store));
  }

  function takeId(store) {
    const id = store.nextId || 1;
    store.nextId = id + 1;
    return id;
  }

  function materialize(records) {
    const store = emptyStore();
    const now = new Date().toISOString();
    store.settings = { ...defaultSettings(), ...records.settings };
    store.tasks = records.tasks.map((task) => ({
      ...task,
      id: takeId(store),
      created_at: now,
      updated_at: now,
      completed_at: task.status === 'Completed' ? now : null,
    }));
    store.sessions = records.sessions.map((session) => ({ ...session, id: takeId(store), created_at: now }));
    store.scores = records.scores.map((score) => {
      const area = AREAS.find((item) => item.code === score.score_area_code);
      return {
        ...score,
        id: takeId(store),
        score_area: area ? area.id : null,
        created_at: now,
        updated_at: now,
      };
    });
    store.reviews = records.reviews.map((review) => ({ ...review, id: takeId(store), created_at: now, updated_at: now }));
    return store;
  }

  function ensureLocal() {
    let store = loadStore();
    if (!store) {
      store = materialize(buildDemoRecords());
      saveStore(store);
    }
    return store;
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function localDashboard(store) {
    const tasks = store.tasks;
    const academy = tasks.filter((task) => task.category === 'University Coursework');
    const academyTotal = academy.length;
    const academyCompleted = academy.filter((task) => task.status === 'Completed').length;
    const academyRate = academyTotal ? Math.round((academyCompleted / academyTotal) * 100) : 0;
    store.settings.current_execution_rate = academyRate;

    const start = today();
    const seven = addDaysIso(start, -7);
    const fourteen = addDaysIso(start, -14);
    const sumMins = (from, to, exclusive) => store.sessions
      .filter((session) => session.date >= from && (exclusive ? session.date < to : session.date <= to))
      .reduce((total, session) => total + Number(session.duration_minutes || 0), 0);
    const currentMins = sumMins(seven, start, false);
    const priorMins = sumMins(fourteen, seven, true);
    const currentHours = round1(currentMins / 60);
    const priorHours = round1(priorMins / 60);
    const studyDelta = round1(currentHours - priorHours);
    const deltaPercent = priorHours > 0 ? Math.round(((currentHours - priorHours) / priorHours) * 100) : 0;
    const longest = store.sessions
      .filter((session) => session.date >= seven && session.date <= start)
      .reduce((max, session) => Math.max(max, Number(session.duration_minutes || 0)), 0);

    const recentRatings = [];
    const scoreboard = AREAS.map((area) => {
      const latest = store.scores
        .filter((score) => score.score_area === area.id)
        .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
      if (latest) recentRatings.push(latest.rating);
      return {
        id: area.id,
        title: area.title,
        code: area.code,
        priority_tag: area.priority_tag,
        rating: latest ? latest.rating : 0,
        evidence: latest ? latest.evidence : 'No evaluation logged.',
      };
    });
    const scoreAvg = recentRatings.length ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length : 0;
    const prTarget = Number(store.settings.weekly_study_pr_hours) || 0;
    const prRatio = prTarget > 0 ? Math.min(1, currentHours / prTarget) : 0;
    const limitBreaker = Math.min(100, Math.round((academyRate / 100) * 40 + prRatio * 35 + Math.min(1, scoreAvg / 5) * 25));
    const sessionPr = Number(store.settings.longest_session_pr_minutes) || 0;

    const urgent = sortTasks(tasks.filter((task) => task.status !== 'Completed'), 'academy_first').slice(0, 5);
    const chart = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = addDays(new Date(), -i);
      const key = isoDate(date);
      const mins = store.sessions
        .filter((session) => session.date === key)
        .reduce((total, session) => total + Number(session.duration_minutes || 0), 0);
      chart.push({
        date: key,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hours: round1(mins / 60),
      });
    }
    saveStore(store);
    return {
      settings: clone(store.settings),
      academy_standing: {
        current_execution: academyRate,
        target_execution: store.settings.target_execution_rate,
        completed_count: academyCompleted,
        total_count: academyTotal,
        completion_rate: academyRate,
        target_delta: round1(academyRate - store.settings.target_execution_rate),
      },
      pr_challenge: {
        weekly_intention: store.settings.weekly_intention,
        current_week_hours: currentHours,
        weekly_pr_hours: store.settings.weekly_study_pr_hours,
        pr_progress_percent: prTarget ? Math.min(100, Math.round((currentHours / prTarget) * 100)) : 0,
        longest_session_this_week_mins: longest,
        single_session_pr_mins: sessionPr,
        longest_session_progress_percent: sessionPr ? Math.min(100, Math.round((longest / sessionPr) * 100)) : 0,
      },
      kpis: {
        academy_completed: academyCompleted,
        academy_total: academyTotal,
        academy_completion_rate: academyRate,
        pending_count: tasks.filter((task) => task.status !== 'Completed').length,
        high_priority_pending_count: tasks.filter((task) => task.status !== 'Completed' && task.priority === 'High').length,
        study_hours_current: currentHours,
        study_hours_prior: priorHours,
        study_hours_delta: studyDelta,
        study_hours_delta_percent: deltaPercent,
        study_record_to_beat: store.settings.weekly_study_pr_hours,
        limit_breaker_index: limitBreaker,
      },
      urgent_tasks: urgent,
      scoreboard_preview: scoreboard,
      weekly_study_chart: chart,
    };
  }

  function hydrateScore(score) {
    const area = AREAS.find((item) => item.id === score.score_area);
    return {
      ...score,
      score_area_title: area ? area.title : score.score_area_title || '',
      score_area_code: area ? area.code : score.score_area_code || '',
    };
  }

  async function init() {
    try {
      const response = await fetch('/api/auth/me/', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      if (!response.ok) {
        AMB.mode = 'remote';
        AMB.user = null;
        return;
      }
      const data = await response.json();
      AMB.mode = 'remote';
      if (data.authenticated) {
        AMB.user = data;
        setZone(data.timezone);
      } else {
        AMB.user = null;
      }
      return;
    } catch (err) {
      AMB.mode = 'local';
      AMB.user = null;
      try { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (zoneErr) { setZone('Asia/Dhaka'); }
      ensureLocal();
    }
  }

  async function login(email, password) {
    const data = await request('POST', '/api/auth/login/', { email, password });
    AMB.mode = 'remote';
    AMB.user = data;
    setZone(data.timezone);
    return data;
  }

  async function register(payload) {
    const data = await request('POST', '/api/auth/register/', payload);
    AMB.mode = 'remote';
    AMB.user = data;
    setZone(data.timezone);
    return data;
  }

  async function logout() {
    await request('POST', '/api/auth/logout/');
    AMB.user = null;
  }

  async function getSettings() {
    if (AMB.mode === 'remote') return request('GET', '/api/settings/');
    return clone(ensureLocal().settings);
  }

  async function saveSettings(payload) {
    if (AMB.mode === 'remote') return request('POST', '/api/settings/', payload);
    const store = ensureLocal();
    Object.assign(store.settings, payload);
    saveStore(store);
    return clone(store.settings);
  }

  async function getTasks() {
    if (AMB.mode === 'remote') return unwrap(await request('GET', '/api/tasks/'));
    return clone(ensureLocal().tasks);
  }

  async function saveTask(payload, id) {
    if (AMB.mode === 'remote') {
      return request(id ? 'PUT' : 'POST', id ? `/api/tasks/${id}/` : '/api/tasks/', payload);
    }
    const store = ensureLocal();
    const now = new Date().toISOString();
    if (id) {
      const existing = store.tasks.find((task) => task.id === id);
      if (!existing) throw new Error('Priority not found.');
      Object.assign(existing, payload, { updated_at: now });
      if (existing.status === 'Completed') {
        if (!existing.completed_at) existing.completed_at = now;
      } else {
        existing.completed_at = null;
      }
      saveStore(store);
      return clone(existing);
    }
    const created = {
      ...payload,
      id: takeId(store),
      created_at: now,
      updated_at: now,
      completed_at: payload.status === 'Completed' ? now : null,
    };
    store.tasks.push(created);
    saveStore(store);
    return clone(created);
  }

  async function deleteTask(id) {
    if (AMB.mode === 'remote') return request('DELETE', `/api/tasks/${id}/`);
    const store = ensureLocal();
    store.tasks = store.tasks.filter((task) => task.id !== id);
    saveStore(store);
    return null;
  }

  async function toggleTask(id) {
    if (AMB.mode === 'remote') return request('POST', `/api/tasks/${id}/toggle_complete/`);
    const store = ensureLocal();
    const task = store.tasks.find((item) => item.id === Number(id) || item.id === id);
    if (!task) throw new Error('Priority not found.');
    const now = new Date().toISOString();
    if (task.status === 'Completed') {
      task.status = 'Pending';
      task.completed_at = null;
    } else {
      task.status = 'Completed';
      task.completed_at = now;
    }
    task.updated_at = now;
    saveStore(store);
    return clone(task);
  }

  async function getScoreAreas() {
    if (AMB.mode === 'remote') return unwrap(await request('GET', '/api/score-areas/'));
    return clone(AREAS);
  }

  async function getWeeklyScores(weekStart) {
    if (AMB.mode === 'remote') {
      const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : '';
      return unwrap(await request('GET', `/api/weekly-scores/${query}`));
    }
    const scores = ensureLocal().scores.map(hydrateScore);
    return weekStart ? scores.filter((score) => score.week_start === weekStart) : scores;
  }

  async function saveWeeklyScore(payload) {
    if (AMB.mode === 'remote') return request('POST', '/api/weekly-scores/', payload);
    const store = ensureLocal();
    const now = new Date().toISOString();
    let existing = store.scores.find((score) => score.score_area === payload.score_area && score.week_start === payload.week_start);
    if (existing) {
      Object.assign(existing, payload, { updated_at: now });
    } else {
      existing = { ...payload, id: takeId(store), created_at: now, updated_at: now };
      store.scores.push(existing);
    }
    saveStore(store);
    return hydrateScore(existing);
  }

  async function getSessions() {
    if (AMB.mode === 'remote') return unwrap(await request('GET', '/api/study-sessions/'));
    return clone(ensureLocal().sessions);
  }

  async function saveSession(payload) {
    if (AMB.mode === 'remote') return request('POST', '/api/study-sessions/', payload);
    const store = ensureLocal();
    const created = { ...payload, id: takeId(store), created_at: new Date().toISOString() };
    store.sessions.push(created);
    saveStore(store);
    return clone(created);
  }

  async function deleteSession(id) {
    if (AMB.mode === 'remote') return request('DELETE', `/api/study-sessions/${id}/`);
    const store = ensureLocal();
    store.sessions = store.sessions.filter((session) => session.id !== id);
    saveStore(store);
    return null;
  }

  async function getReviews() {
    if (AMB.mode === 'remote') return unwrap(await request('GET', '/api/weekly-reviews/'));
    return clone(ensureLocal().reviews);
  }

  async function saveReview(payload) {
    if (AMB.mode === 'remote') return request('POST', '/api/weekly-reviews/', payload);
    const store = ensureLocal();
    const now = new Date().toISOString();
    let existing = store.reviews.find((review) => review.week_start === payload.week_start);
    if (existing) Object.assign(existing, payload, { updated_at: now });
    else {
      existing = { ...payload, id: takeId(store), created_at: now, updated_at: now };
      store.reviews.push(existing);
    }
    saveStore(store);
    return clone(existing);
  }

  async function dashboard() {
    if (AMB.mode === 'remote') return request('GET', '/api/dashboard-summary/');
    return localDashboard(ensureLocal());
  }

  async function deleteCollection(path) {
    const rows = unwrap(await request('GET', `/api/${path}/`)) || [];
    for (const row of rows) {
      if (row && row.id) await request('DELETE', `/api/${path}/${row.id}/`);
    }
  }

  async function snapshot() {
    const [settings, tasks, sessions, scores, reviews] = await Promise.all([
      getSettings(), getTasks(), getSessions(), getWeeklyScores(), getReviews(),
    ]);
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      settings,
      tasks: tasks.map((task) => ({
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        due_date: task.due_date,
        status: task.status,
      })),
      study_sessions: sessions.map((session) => ({
        subject: session.subject,
        date: session.date,
        duration_minutes: session.duration_minutes,
        notes: session.notes,
      })),
      weekly_scores: scores.map((score) => ({
        score_area_code: score.score_area_code,
        week_start: score.week_start,
        rating: score.rating,
        evidence: score.evidence,
      })),
      weekly_reviews: reviews.map((review) => ({
        week_start: review.week_start,
        accomplishments: review.accomplishments,
        failures: review.failures,
        distractions: review.distractions,
        lessons_learned: review.lessons_learned,
        next_week_improvements: review.next_week_improvements,
        non_negotiable_1: review.non_negotiable_1,
        non_negotiable_2: review.non_negotiable_2,
        non_negotiable_3: review.non_negotiable_3,
      })),
    };
  }

  async function importSnapshot(data) {
    if (!data || !data.settings || !Array.isArray(data.tasks)) {
      throw new Error('This file is not a workspace snapshot.');
    }
    const records = {
      settings: data.settings,
      tasks: data.tasks,
      sessions: data.study_sessions || [],
      scores: data.weekly_scores || [],
      reviews: data.weekly_reviews || [],
    };
    if (AMB.mode === 'local') {
      saveStore(materialize(records));
      return;
    }
    await deleteCollection('tasks');
    await deleteCollection('study-sessions');
    await deleteCollection('weekly-reviews');
    await deleteCollection('weekly-scores');
    await saveSettings(records.settings);
    for (const task of records.tasks) await saveTask(task);
    for (const session of records.sessions) await saveSession(session);
    for (const review of records.reviews) await saveReview(review);
    const areas = await getScoreAreas();
    for (const score of records.scores) {
      const area = areas.find((item) => item.code === score.score_area_code);
      if (!area) continue;
      await saveWeeklyScore({
        score_area: area.id,
        week_start: score.week_start,
        rating: score.rating,
        evidence: score.evidence,
      });
    }
  }

  async function resetDemo() {
    const records = buildDemoRecords();
    if (AMB.mode === 'local') {
      saveStore(materialize(records));
      return;
    }
    await importSnapshot({
      settings: records.settings,
      tasks: records.tasks,
      study_sessions: records.sessions,
      weekly_scores: records.scores,
      weekly_reviews: records.reviews,
    });
  }

  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }

  function modal(inner, onMount) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
    const back = root.querySelector('.modal-back');
    back.addEventListener('click', (event) => {
      if (event.target === back) closeModal();
    });
    root.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    if (onMount) onMount(root);
  }

  function bind(el, type, handler) {
    const key = `_amb_${type}`;
    if (el[key]) el.removeEventListener(type, el[key]);
    el[key] = handler;
    el.addEventListener(type, handler);
  }

  function clearCharts() {
    if (!window.Chart) return;
    document.querySelectorAll('canvas').forEach((canvas) => {
      const chart = Chart.getChart(canvas);
      if (chart) chart.destroy();
    });
  }

  Object.assign(AMB, {
    init,
    getSettings,
    saveSettings,
    getTasks,
    saveTask,
    deleteTask,
    toggleTask,
    getScoreAreas,
    getWeeklyScores,
    saveWeeklyScore,
    getSessions,
    saveSession,
    deleteSession,
    getReviews,
    saveReview,
    dashboard,
    snapshot,
    importSnapshot,
    resetDemo,
    login,
    register,
    logout,
  });

  const TITLES = {
    overview: 'Overview',
    priorities: 'My Priorities',
    scoreboard: 'Internal Scoreboard',
    reflection: 'Weekly Reflection',
    study: 'Study Tracker',
    settings: 'Settings',
  };
  let showToken = 0;

  function closeDrawer() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
    document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
  }

  function markTab(tab) {
    document.getElementById('topbar-title').textContent = TITLES[tab] || 'Overview';
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const on = button.dataset.tab === tab;
      button.classList.toggle('active', on);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    try { sessionStorage.setItem('amb-tab', tab); } catch (err) { /* private mode */ }
    closeDrawer();
  }

  async function refreshChrome() {
    try {
      const settings = await getSettings();
      if (settings.timezone) setZone(settings.timezone);
      document.getElementById('profile-name').textContent = settings.student_name || (AMB.user && AMB.user.email) || 'Student';
      document.getElementById('profile-major').textContent = settings.major || (AMB.user && AMB.user.email) || '';
      document.getElementById('profile-status').textContent = settings.aspiration || 'Signed in';
    } catch (err) {
      document.getElementById('profile-status').textContent = 'Profile unavailable';
    }
    const badge = document.getElementById('api-badge');
    if (AMB.mode === 'remote') {
      badge.textContent = 'Django REST API';
      badge.className = 'badge badge-live';
    } else {
      badge.textContent = 'Local workspace';
      badge.className = 'badge badge-local';
    }
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) logoutButton.hidden = AMB.mode !== 'remote';
  }

  function headerDate() {
    const [y, m, d] = today().split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function showGate(message) {
    const gate = document.getElementById('gate');
    const workspace = document.getElementById('workspace');
    if (!gate || !workspace) return;
    workspace.hidden = true;
    gate.hidden = false;
    const error = document.getElementById('gate-error');
    if (error) error.textContent = message || '';
    document.querySelectorAll('#gate button[type="submit"]').forEach((button) => { button.disabled = false; });
  }

  function openWorkspace() {
    const gate = document.getElementById('gate');
    const workspace = document.getElementById('workspace');
    if (gate) gate.hidden = true;
    if (workspace) workspace.hidden = false;
    const date = document.getElementById('topbar-date');
    if (date) date.textContent = headerDate();
    let saved = 'overview';
    try { saved = sessionStorage.getItem('amb-tab') || 'overview'; } catch (err) { /* private mode */ }
    show(TITLES[saved] ? saved : 'overview');
  }

  function gateMode(mode) {
    const login = document.getElementById('login-form');
    const register = document.getElementById('register-form');
    const signIn = document.getElementById('tab-signin');
    const create = document.getElementById('tab-create');
    if (!login || !register) return;
    login.hidden = mode !== 'login';
    register.hidden = mode !== 'register';
    if (signIn) signIn.classList.toggle('active', mode === 'login');
    if (create) create.classList.toggle('active', mode === 'register');
    const error = document.getElementById('gate-error');
    if (error) error.textContent = '';
  }

  function rendererFor(tab) {
    return {
      overview: window.Overview,
      priorities: window.Priorities,
      scoreboard: window.Scoreboard,
      reflection: window.Reflection,
      study: window.StudyPage,
      settings: window.SettingsPage,
    }[tab];
  }

  async function show(tab, silent) {
    if (!TITLES[tab]) tab = 'overview';
    const token = ++showToken;
    if (window.StudyPage && StudyPage.onHide) StudyPage.onHide();
    clearCharts();
    markTab(tab);
    const root = document.getElementById('content');
    if (!silent) root.innerHTML = '<p class="loading">Loading…</p>';
    const renderer = rendererFor(tab);
    try {
      await renderer.render(root, () => token === showToken);
    } catch (err) {
      if (token !== showToken) return;
      root.innerHTML = `<section class="card error-card"><h2>Could not load this section</h2><p>${escape(err.message || 'Unknown error')}</p></section>`;
    }
    if (token === showToken) refreshChrome();
  }

  function start() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => show(button.dataset.tab));
    });
    document.getElementById('menu-btn').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const open = sidebar.classList.toggle('open');
      document.getElementById('backdrop').classList.toggle('show', open);
      document.getElementById('menu-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.getElementById('backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot && modalRoot.childElementCount) {
        closeModal();
        return;
      }
      closeDrawer();
    });
    const signOut = document.getElementById('logout-btn');
    if (signOut) {
      signOut.addEventListener('click', async () => {
        try { await logout(); } catch (err) { /* session already gone */ }
        showGate();
      });
    }
    const signInTab = document.getElementById('tab-signin');
    const createTab = document.getElementById('tab-create');
    if (signInTab) signInTab.addEventListener('click', () => gateMode('login'));
    if (createTab) createTab.addEventListener('click', () => gateMode('register'));
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(loginForm);
        const button = loginForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          await login(form.get('email'), form.get('password'));
          openWorkspace();
        } catch (err) {
          document.getElementById('gate-error').textContent = err.message;
          button.disabled = false;
        }
      });
    }
    if (registerForm) {
      registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(registerForm);
        const button = registerForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          await register({
            student_name: String(form.get('student_name') || '').trim(),
            email: String(form.get('email') || '').trim(),
            password: form.get('password'),
            timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka'),
          });
          openWorkspace();
        } catch (err) {
          document.getElementById('gate-error').textContent = err.message;
          button.disabled = false;
        }
      });
    }
    init().then(() => {
      if (AMB.mode === 'remote' && !AMB.user) {
        showGate();
        return;
      }
      openWorkspace();
    });
  }

  window.AMB = AMB;
  window.App = { start, show, refreshChrome, showGate };
})();
