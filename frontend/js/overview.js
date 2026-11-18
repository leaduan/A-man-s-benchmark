(function () {
  function pct(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function deltaSentence(kpis) {
    const delta = Number(kpis.study_hours_delta);
    if (!kpis.study_hours_prior && !kpis.study_hours_current) return 'No hours logged across the last two weeks.';
    if (delta > 0) return `Up ${delta.toFixed(1)} h from last week.`;
    if (delta < 0) return `Down ${Math.abs(delta).toFixed(1)} h from last week.`;
    return 'Level with last week.';
  }

  function taskHtml(task) {
    const done = task.status === 'Completed';
    const academy = task.category === 'University Coursework';
    return `
      <article class="task${done ? ' done' : ''}">
        <button type="button" class="check" data-toggle="${task.id}" aria-label="${done ? 'Reopen priority' : 'Mark complete'}">${done ? '✓' : ''}</button>
        <div>
          <div class="task-title">${AMB.escape(task.title)}</div>
          <div class="task-meta">
            ${academy ? '<span class="pill pill-academy">Academy #1</span>' : `<span class="pill">${AMB.escape(task.category)}</span>`}
            <span class="pill${task.priority === 'High' ? ' pill-high' : ''}">${AMB.escape(task.priority)}</span>
            <span>${AMB.escape(task.status)}</span>
            <span>Due ${AMB.escape(AMB.formatLong(task.due_date))}</span>
          </div>
          ${task.description ? `<p class="task-dod">${AMB.escape(task.description)}</p>` : ''}
        </div>
      </article>`;
  }

  function drawChart(rows) {
    const canvas = document.getElementById('weekly-chart');
    if (!canvas || !window.Chart) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [{
          label: 'Hours',
          data: rows.map((row) => row.hours),
          backgroundColor: AMB.chartColors().bar,
          borderRadius: 4,
          maxBarThickness: 36,
        }],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: AMB.chartColors().tick } },
          y: { beginAtZero: true, ticks: { color: AMB.chartColors().tick }, grid: { color: AMB.chartColors().grid } },
        },
      },
    });
  }

  async function render(root, alive) {
    const data = await AMB.dashboard();
    if (!alive()) return;
    const standing = data.academy_standing;
    const pr = data.pr_challenge;
    const kpis = data.kpis;
    const gap = Math.round((Number(standing.target_execution) - Number(standing.current_execution)) * 10) / 10;
    const met = gap <= 0;
    const unlogged = data.scoreboard_preview.filter((item) => item.evidence === 'No evaluation logged.');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Overview</h1>
          <p class="lede">Coursework leads the queue. The only benchmark is your own record.</p>
        </div>
      </div>
      <div class="stack">
        <section class="card academy-card">
          <div class="card-kicker">Priority #1</div>
          <h2>Academy standing</h2>
          <p class="metric-xl"><span class="metric">${standing.current_execution}%</span> execution</p>
          <p class="muted">${standing.total_count ? `${standing.completed_count} of ${standing.total_count} coursework tasks complete. ${met ? 'The academy standard is met.' : `${gap} points short of the ${standing.target_execution}% standard.`}` : 'No coursework yet. The first priority you add should be university work.'}</p>
          <div class="bar">
            <span style="width:${pct(standing.current_execution)}%"></span>
            <i class="target-tick" style="left:${pct(standing.target_execution)}%" title="Standard"></i>
          </div>
          <div class="bar-legend"><span>Current execution</span><span>Standard ${standing.target_execution}%</span></div>
        </section>

        <section class="card">
          <div class="card-kicker">Personal record</div>
          <p class="intention">${AMB.escape(pr.weekly_intention)}</p>
          <div class="pr-grid">
            <div>
              <div class="bar-label"><span>Deep study this week</span><span class="metric">${Number(pr.weekly_pr_hours) > 0 ? `${Number(pr.current_week_hours).toFixed(1)} / ${Number(pr.weekly_pr_hours).toFixed(1)} h` : `${Number(pr.current_week_hours).toFixed(1)} h · set your record`}</span></div>
              <div class="bar"><span style="width:${pct(pr.pr_progress_percent)}%"></span></div>
            </div>
            <div>
              <div class="bar-label"><span>Longest block this week</span><span class="metric">${Number(pr.single_session_pr_mins) > 0 ? `${AMB.formatMinutes(pr.longest_session_this_week_mins)} / ${AMB.formatMinutes(pr.single_session_pr_mins)}` : `${AMB.formatMinutes(pr.longest_session_this_week_mins)} · set your record`}</span></div>
              <div class="bar"><span style="width:${pct(pr.longest_session_progress_percent)}%"></span></div>
            </div>
          </div>
        </section>

        <section class="kpi-grid">
          <article class="card kpi">
            <h3>Academy done</h3>
            <p class="metric kpi-value">${kpis.academy_completed}<span>/${kpis.academy_total}</span></p>
            <p class="kpi-note">${kpis.academy_completion_rate}% of coursework</p>
          </article>
          <article class="card kpi">
            <h3>Still open</h3>
            <p class="metric kpi-value">${kpis.pending_count}</p>
            <p class="kpi-note">${kpis.high_priority_pending_count} high priority</p>
          </article>
          <article class="card kpi">
            <h3>Study hours</h3>
            <p class="metric kpi-value">${Number(kpis.study_hours_current).toFixed(1)}<span> h</span></p>
            <p class="kpi-note">${deltaSentence(kpis)} ${Number(kpis.study_record_to_beat) > 0 ? `Record: ${Number(kpis.study_record_to_beat).toFixed(1)} h.` : 'Set a weekly record in Settings.'}</p>
          </article>
          <article class="card kpi emphasis">
            <h3>Limit-breaker</h3>
            <p class="metric kpi-value">${kpis.limit_breaker_index}</p>
            <p class="kpi-note">40% academy, 35% study record, 25% scoreboard.</p>
          </article>
        </section>

        <div class="split">
          <section class="card">
            <div class="section-head">
              <h2>Open priorities</h2>
              <button type="button" class="linkish" data-goto="priorities">Open queue</button>
            </div>
            <div class="task-list">
              ${data.urgent_tasks.length ? data.urgent_tasks.map(taskHtml).join('') : '<p class="empty">No open priorities. The queue is clear.</p>'}
            </div>
          </section>
          <section class="card">
            <div class="section-head">
              <h2>Scoreboard</h2>
              <button type="button" class="linkish" data-goto="scoreboard">File evidence</button>
            </div>
            <div class="preview-row">
              ${data.scoreboard_preview.map((item) => {
                const missing = item.evidence === 'No evaluation logged.';
                return `
                  <div class="preview-line">
                    <span>${AMB.escape(item.title)}</span>
                    <span class="metric">${missing ? '—' : `${item.rating}/5`}</span>
                    <div class="bar"><span style="width:${missing ? 0 : pct((item.rating / 5) * 100)}%"></span></div>
                  </div>`;
              }).join('')}
            </div>
            ${unlogged.length ? '<p class="kpi-note" style="margin-top:10px">Unlogged pillars are counted as 3 until you file evidence.</p>' : ''}
          </section>
        </div>

        <section class="card">
          <h2>Study, last 7 days</h2>
          <div class="chart-wrap"><canvas id="weekly-chart"></canvas></div>
        </section>
      </div>`;

    drawChart(data.weekly_study_chart || []);
    AMB.bind(root, 'click', async (event) => {
      const goto = event.target.closest('[data-goto]');
      if (goto) {
        App.show(goto.dataset.goto);
        return;
      }
      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      toggle.disabled = true;
      try {
        await AMB.toggleTask(toggle.dataset.toggle);
        await App.show('overview', true);
      } catch (err) {
        AMB.toast(err.message);
        toggle.disabled = false;
      }
    });
  }

  window.Overview = { render };
})();
