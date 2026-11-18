(function () {
  function download(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `amb-workspace-${AMB.today()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function render(root, alive) {
    const settings = await AMB.getSettings();
    if (!alive()) return;
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Settings</h1>
          <p class="lede">Targets are personal records to beat. Execution is calculated from coursework.</p>
        </div>
      </div>
      <div class="stack">
        <form class="card" id="settings-form">
          <div class="form-grid">
            <label class="field">Name
              <input name="student_name" required value="${AMB.escape(settings.student_name || '')}">
            </label>
            <label class="field">Aspiration
              <input name="aspiration" value="${AMB.escape(settings.aspiration || '')}">
            </label>
            <label class="field">Major
              <input name="major" value="${AMB.escape(settings.major || '')}">
            </label>
            <label class="field">GPA target
              <input name="gpa_target" value="${AMB.escape(settings.gpa_target || '')}">
            </label>
            <label class="field">Academy standard (%)
              <input name="target_execution_rate" type="number" min="1" max="100" step="0.1" required value="${Number(settings.target_execution_rate)}">
            </label>
            <label class="field">Weekly study record (hours)
              <span class="hint">Leave at 0 until you have a record to beat.</span>
              <input name="weekly_study_pr_hours" type="number" min="0" step="0.5" value="${Number(settings.weekly_study_pr_hours)}">
            </label>
            <label class="field">Longest session record (minutes)
              <input name="longest_session_pr_minutes" type="number" min="0" step="5" value="${Number(settings.longest_session_pr_minutes)}">
            </label>
            <label class="field">Timezone
              <select name="timezone">${['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Yangon', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC'].concat(settings.timezone && !['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Yangon', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC'].includes(settings.timezone) ? [settings.timezone] : []).map((zone) => `<option value="${AMB.escape(zone)}"${zone === (settings.timezone || 'Asia/Dhaka') ? ' selected' : ''}>${AMB.escape(zone)}</option>`).join('')}</select>
            </label>
            <label class="field">Current academy execution
              <input value="${Number(settings.current_execution_rate)}%" disabled>
              <span class="hint">Calculated from completed coursework tasks.</span>
            </label>
            <label class="field wide">Weekly intention
              <input name="weekly_intention" value="${AMB.escape(settings.weekly_intention || '')}">
            </label>
          </div>
          <p class="error-text" id="settings-error"></p>
          <button class="btn" type="submit">Save settings</button>
        </form>
        <section class="card">
          <h2>Data</h2>
          <p class="lede">Export a JSON snapshot, replace the workspace from a file, or restore the sample data.</p>
          <div class="actions" style="margin-top:14px">
            <button type="button" class="btn secondary" id="export-btn">Export snapshot</button>
            <label class="btn secondary">Import snapshot
              <input id="import-file" type="file" accept="application/json,.json" hidden>
            </label>
            <button type="button" class="btn danger" id="reset-btn">Reset demo data</button>
          </div>
        </section>
      </div>`;

    AMB.bind(root, 'submit', async (event) => {
      if (event.target.id !== 'settings-form') return;
      event.preventDefault();
      const form = new FormData(event.target);
      const payload = {
        student_name: String(form.get('student_name') || '').trim(),
        aspiration: String(form.get('aspiration') || '').trim(),
        major: String(form.get('major') || '').trim(),
        gpa_target: String(form.get('gpa_target') || '').trim(),
        target_execution_rate: Number(form.get('target_execution_rate')),
        weekly_study_pr_hours: Number(form.get('weekly_study_pr_hours')),
        longest_session_pr_minutes: Number(form.get('longest_session_pr_minutes')),
        timezone: form.get('timezone'),
        weekly_intention: String(form.get('weekly_intention') || '').trim(),
      };
      if (!payload.student_name) {
        root.querySelector('#settings-error').textContent = 'Name is required.';
        return;
      }
      if (!(payload.target_execution_rate > 0) || payload.weekly_study_pr_hours < 0 || payload.longest_session_pr_minutes < 0) {
        root.querySelector('#settings-error').textContent = 'The academy standard must be greater than zero.';
        return;
      }
      const button = event.target.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await AMB.saveSettings(payload);
        AMB.setZone(payload.timezone);
        AMB.toast('Settings saved.');
        await App.refreshChrome();
        button.disabled = false;
        root.querySelector('#settings-error').textContent = '';
      } catch (err) {
        root.querySelector('#settings-error').textContent = err.message;
        button.disabled = false;
      }
    });

    AMB.bind(root, 'click', (event) => {
      if (event.target.id === 'export-btn') {
        AMB.snapshot().then((data) => {
          download(data);
          AMB.toast('Snapshot downloaded.');
        }).catch((err) => AMB.toast(err.message));
        return;
      }
      if (event.target.id === 'reset-btn') {
        AMB.modal(`
          <h2 id="dialog-title">Reset demo data</h2>
          <p>This replaces the current workspace with the sample scientist dataset. Export a snapshot first if you want to keep what is here.</p>
          <div class="actions">
            <button type="button" class="btn danger" id="confirm-reset">Replace workspace</button>
            <button type="button" class="btn secondary" data-close>Cancel</button>
          </div>`, (modalRoot) => {
          modalRoot.querySelector('#confirm-reset').addEventListener('click', async (click) => {
            click.target.disabled = true;
            try {
              await AMB.resetDemo();
              AMB.closeModal();
              AMB.toast('Demo workspace restored.');
              await App.show('settings', true);
            } catch (err) {
              AMB.toast(err.message);
              click.target.disabled = false;
            }
          });
        });
      }
    });

    AMB.bind(root, 'change', async (event) => {
      if (event.target.id !== 'import-file') return;
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (!window.confirm('Replace the current workspace with this snapshot?')) return;
      try {
        const text = await file.text();
        await AMB.importSnapshot(JSON.parse(text));
        AMB.toast('Snapshot imported.');
        await App.show('settings', true);
      } catch (err) {
        AMB.toast(err.message || 'Could not read that file.');
      }
    });
  }

  window.SettingsPage = { render };
})();
