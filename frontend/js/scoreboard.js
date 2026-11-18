(function () {
  const LINE_COLORS = ['#4f46e5', '#1e293b', '#64748b', '#b45309', '#047857'];
  let weekStart = null;

  function drawTrajectory(areas, scores) {
    const canvas = document.getElementById('trajectory-chart');
    if (!canvas || !window.Chart) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const weeks = [...new Set(scores.map((score) => score.week_start))].sort();
    if (!weeks.length) return;
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: weeks.map((week) => AMB.formatLong(week)),
        datasets: areas.map((area, index) => ({
          label: area.title,
          data: weeks.map((week) => {
            const match = scores.find((score) => score.score_area === area.id && score.week_start === week);
            return match ? match.rating : null;
          }),
          borderColor: LINE_COLORS[index % LINE_COLORS.length],
          backgroundColor: LINE_COLORS[index % LINE_COLORS.length],
          spanGaps: false,
          tension: 0.15,
          pointRadius: 3,
          borderWidth: 2,
        })),
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 1, max: 5, ticks: { stepSize: 1, color: AMB.chartColors().tick }, grid: { color: AMB.chartColors().grid } },
          x: { ticks: { color: AMB.chartColors().tick }, grid: { display: false } },
        },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, color: AMB.chartColors().label } } },
      },
    });
  }

  async function render(root, alive) {
    if (!weekStart) weekStart = AMB.monday(0);
    const [areas, weekScores, allScores] = await Promise.all([
      AMB.getScoreAreas(),
      AMB.getWeeklyScores(weekStart),
      AMB.getWeeklyScores(),
    ]);
    if (!alive()) return;
    const ordered = [...areas].sort((a, b) => a.order - b.order);

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Internal Scoreboard</h1>
          <p class="lede">A rating without concrete evidence is rejected. One entry per pillar each week.</p>
        </div>
        <div class="week-switch">
          <button type="button" class="btn secondary small" id="prev-week">Previous</button>
          <strong>Week of ${AMB.escape(AMB.formatLong(weekStart))}</strong>
          <button type="button" class="btn secondary small" id="next-week">Next</button>
        </div>
      </div>
      <div class="stack">
        ${ordered.map((area) => {
          const current = weekScores.find((score) => score.score_area === area.id);
          const history = allScores
            .filter((score) => score.score_area === area.id)
            .sort((a, b) => b.week_start.localeCompare(a.week_start))
            .slice(0, 6);
          const rating = current ? current.rating : 0;
          return `
            <section class="card" data-area="${area.id}">
              <div class="pillar-head">
                <span class="order">${String(area.order).padStart(2, '0')}</span>
                <div>
                  <h2>${AMB.escape(area.title)}</h2>
                  <p class="tag">${AMB.escape(area.priority_tag)}</p>
                </div>
              </div>
              <p class="desc">${AMB.escape(area.description || '')}</p>
              <div class="ratings" role="radiogroup" aria-label="${AMB.escape(area.title)} rating">
                ${[1, 2, 3, 4, 5].map((value) => `
                  <button type="button" class="rate${rating === value ? ' selected' : ''}" data-value="${value}" aria-pressed="${rating === value}">${value}</button>
                `).join('')}
              </div>
              <p class="scale-note">1 very poor · 5 limit-breaking</p>
              <label class="field">Objective evidence
                <span class="hint">Name the work: problems solved, pages annotated, sessions kept.</span>
                <textarea data-evidence>${AMB.escape(current ? current.evidence : '')}</textarea>
              </label>
              ${history.length ? `<div class="history">${history.map((score) => `<span class="mini">${AMB.escape(AMB.formatLong(score.week_start))} · ${score.rating}</span>`).join('')}</div>` : '<p class="empty">No evaluations filed yet.</p>'}
              <button type="button" class="btn small" data-save>Save evaluation</button>
              <p class="error-text"></p>
            </section>`;
        }).join('')}
        <section class="card">
          <h2>Trajectory</h2>
          <div class="chart-wrap tall"><canvas id="trajectory-chart"></canvas></div>
          ${allScores.length ? '' : '<p class="empty">The line chart appears after the first saved week.</p>'}
        </section>
      </div>`;

    drawTrajectory(ordered, allScores);
    AMB.bind(root, 'click', async (event) => {
      if (event.target.id === 'prev-week' || event.target.id === 'next-week') {
        weekStart = AMB.addDaysIso(weekStart, event.target.id === 'next-week' ? 7 : -7);
        await render(root, alive);
        return;
      }
      const rate = event.target.closest('.rate');
      if (rate) {
        const group = rate.parentElement;
        group.querySelectorAll('.rate').forEach((button) => {
          const on = button === rate;
          button.classList.toggle('selected', on);
          button.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        return;
      }
      const save = event.target.closest('[data-save]');
      if (!save) return;
      const card = save.closest('[data-area]');
      const selected = card.querySelector('.rate.selected');
      const evidence = card.querySelector('[data-evidence]').value.trim();
      const error = card.querySelector('.error-text');
      if (!selected) {
        error.textContent = 'Choose a rating from 1 to 5.';
        return;
      }
      if (!evidence) {
        error.textContent = 'Objective evidence is required.';
        return;
      }
      save.disabled = true;
      try {
        await AMB.saveWeeklyScore({
          score_area: Number(card.dataset.area),
          week_start: weekStart,
          rating: Number(selected.dataset.value),
          evidence,
        });
        AMB.toast('Evaluation saved.');
        await render(root, alive);
      } catch (err) {
        error.textContent = err.message;
        save.disabled = false;
      }
    });
  }

  window.Scoreboard = { render };
})();
