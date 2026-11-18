(function () {
  const timer = { base: 0, runningSince: null, handle: null, subject: '', notes: '' };

  function elapsedMs() {
    return timer.base + (timer.runningSince ? Date.now() - timer.runningSince : 0);
  }

  function clockText() {
    const total = Math.floor(elapsedMs() / 1000);
    const hours = String(Math.floor(total / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function paintClock() {
    const el = document.getElementById('timer-clock');
    if (el) el.textContent = clockText();
  }

  function ensureTick() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = null;
    if (timer.runningSince && document.getElementById('timer-clock')) {
      timer.handle = setInterval(paintClock, 250);
    }
  }

  function onHide() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = null;
  }

  function drawSubjects(sessions) {
    const canvas = document.getElementById('subject-chart');
    if (!canvas || !window.Chart) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const totals = new Map();
    sessions.forEach((session) => {
      totals.set(session.subject, (totals.get(session.subject) || 0) + Number(session.duration_minutes || 0));
    });
    const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (!rows.length) return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row[0]),
        datasets: [{
          label: 'Hours',
          data: rows.map((row) => Math.round((row[1] / 60) * 10) / 10),
          backgroundColor: AMB.chartColors().barAlt,
          borderRadius: 4,
          maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: 'y',
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: AMB.chartColors().tick }, grid: { color: AMB.chartColors().grid } },
          y: { ticks: { color: AMB.chartColors().label }, grid: { display: false } },
        },
      },
    });
  }

  function hoursBetween(sessions, fromIso) {
    const end = AMB.today();
    const minutes = sessions
      .filter((session) => !fromIso || (session.date >= fromIso && session.date <= end))
      .reduce((total, session) => total + Number(session.duration_minutes || 0), 0);
    return (minutes / 60).toFixed(1);
  }

  async function render(root, alive) {
    const sessions = await AMB.getSessions();
    if (!alive()) return;
    const ordered = [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Study Tracker</h1>
          <p class="lede">Log deep work by subject. The clock is a record, not a score.</p>
        </div>
      </div>
      <div class="kpi-grid cols-3">
        <article class="card kpi"><h3>Last 7 days</h3><p class="metric kpi-value">${hoursBetween(sessions, AMB.addDaysIso(AMB.today(), -7))}<span> h</span></p></article>
        <article class="card kpi"><h3>Last 30 days</h3><p class="metric kpi-value">${hoursBetween(sessions, AMB.addDaysIso(AMB.today(), -30))}<span> h</span></p></article>
        <article class="card kpi"><h3>All time</h3><p class="metric kpi-value">${hoursBetween(sessions, null)}<span> h</span></p></article>
      </div>
      <div class="layout-main">
        <div class="stack">
          <section class="card">
            <h2>Focus timer</h2>
            <p class="timer-display" id="timer-clock">${clockText()}</p>
            <div class="form-grid">
              <label class="field wide">Subject
                <input id="timer-subject" value="${AMB.escape(timer.subject)}" placeholder="Electrodynamics">
              </label>
              <label class="field wide">Notes
                <input id="timer-notes" value="${AMB.escape(timer.notes)}" placeholder="Optional">
              </label>
            </div>
            <div class="actions" style="margin-top:14px">
              <button type="button" class="btn" id="timer-start" ${timer.runningSince ? 'disabled' : ''}>Start</button>
              <button type="button" class="btn secondary" id="timer-stop" ${timer.runningSince ? '' : 'disabled'}>Stop</button>
              <button type="button" class="btn secondary" id="timer-reset">Reset</button>
              <button type="button" class="btn secondary" id="timer-log">Log this block</button>
            </div>
          </section>
          <section class="card">
            <h2>Log a session</h2>
            <form id="session-form" class="form-grid">
              <label class="field">Subject
                <input name="subject" required placeholder="Quantum Mechanics">
              </label>
              <label class="field">Date
                <input type="date" name="date" required value="${AMB.today()}">
              </label>
              <label class="field">Duration (minutes)
                <input type="number" name="duration_minutes" min="1" step="1" required>
              </label>
              <label class="field">Notes
                <input name="notes" placeholder="Optional">
              </label>
              <div class="wide"><button class="btn" type="submit">Add session</button></div>
            </form>
            <p class="error-text" id="session-error"></p>
          </section>
        </div>
        <section class="card">
          <h2>By subject</h2>
          <div class="chart-wrap tall"><canvas id="subject-chart"></canvas></div>
          ${ordered.length ? '' : '<p class="empty">No sessions yet.</p>'}
        </section>
      </div>
      <section class="card" style="margin-top:16px">
        <h2>History</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Subject</th><th class="num">Duration</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              ${ordered.length ? ordered.map((session) => `
                <tr>
                  <td>${AMB.escape(AMB.formatLong(session.date))}</td>
                  <td>${AMB.escape(session.subject)}</td>
                  <td class="num">${AMB.formatMinutes(session.duration_minutes)}</td>
                  <td>${AMB.escape(session.notes || '')}</td>
                  <td><button type="button" class="linkish danger" data-delete="${session.id}">Delete</button></td>
                </tr>`).join('') : '<tr><td colspan="5" class="empty">No sessions logged.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;

    drawSubjects(ordered);
    ensureTick();

    const remember = () => {
      const subject = root.querySelector('#timer-subject');
      const notes = root.querySelector('#timer-notes');
      if (subject) timer.subject = subject.value;
      if (notes) timer.notes = notes.value;
    };
    AMB.bind(root, 'input', (event) => {
      if (event.target.id === 'timer-subject' || event.target.id === 'timer-notes') remember();
    });
    AMB.bind(root, 'click', async (event) => {
      if (event.target.id === 'timer-start') {
        if (!timer.runningSince) timer.runningSince = Date.now();
        await render(root, alive);
        return;
      }
      if (event.target.id === 'timer-stop') {
        if (timer.runningSince) {
          timer.base += Date.now() - timer.runningSince;
          timer.runningSince = null;
        }
        await render(root, alive);
        return;
      }
      if (event.target.id === 'timer-reset') {
        timer.base = 0;
        timer.runningSince = null;
        await render(root, alive);
        return;
      }
      if (event.target.id === 'timer-log') {
        remember();
        const minutes = Math.round(elapsedMs() / 60000);
        if (!timer.subject.trim()) {
          AMB.toast('Name the subject before logging this block.');
          return;
        }
        if (minutes < 1) {
          AMB.toast('A logged block needs at least one minute.');
          return;
        }
        try {
          await AMB.saveSession({
            subject: timer.subject.trim(),
            date: AMB.today(),
            duration_minutes: minutes,
            notes: timer.notes.trim(),
          });
          timer.base = 0;
          timer.runningSince = null;
          AMB.toast('Session logged.');
          await render(root, alive);
        } catch (err) {
          AMB.toast(err.message);
        }
        return;
      }
      const remove = event.target.closest('[data-delete]');
      if (!remove) return;
      if (!window.confirm('Delete this session?')) return;
      await AMB.deleteSession(Number(remove.dataset.delete));
      AMB.toast('Session deleted.');
      await render(root, alive);
    });
    AMB.bind(root, 'submit', async (event) => {
      if (event.target.id !== 'session-form') return;
      event.preventDefault();
      const form = new FormData(event.target);
      const payload = {
        subject: String(form.get('subject') || '').trim(),
        date: form.get('date'),
        duration_minutes: Number(form.get('duration_minutes')),
        notes: String(form.get('notes') || '').trim(),
      };
      const button = event.target.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await AMB.saveSession(payload);
        AMB.toast('Session added.');
        await render(root, alive);
      } catch (err) {
        root.querySelector('#session-error').textContent = err.message;
        button.disabled = false;
      }
    });
  }

  window.StudyPage = { render, onHide };
})();
