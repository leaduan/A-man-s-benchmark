(function () {
  function checked(on) {
    return on ? ' checked' : '';
  }

  function userForm(user) {
    const editing = Boolean(user);
    return `
      <h2>${editing ? 'Edit account' : 'New account'}</h2>
      <p class="lede">Admins and students live in the same account table.</p>
      <form id="user-form" class="stack">
        <label class="field">Name
          <input name="student_name" required value="${AMB.escape(user ? user.student_name : '')}">
        </label>
        <label class="field">Email
          <input name="email" type="email" required value="${AMB.escape(user ? user.email : '')}">
        </label>
        <label class="field">Major
          <input name="major" value="${AMB.escape(user ? user.major : '')}">
        </label>
        <label class="field">Password
          <span class="hint">${editing ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}</span>
          <input name="password" type="password" ${editing ? '' : 'required'} autocomplete="new-password">
        </label>
        <label class="check-line"><input type="checkbox" name="is_admin"${checked(Boolean(user && user.is_admin))}> Admin</label>
        <label class="check-line"><input type="checkbox" name="is_active"${checked(!user || user.is_active)}> Can sign in</label>
        <p class="error-text" id="user-error"></p>
        <div class="row-actions">
          <button class="btn" type="submit">${editing ? 'Save account' : 'Create account'}</button>
          <button class="btn secondary" type="button" data-close>Cancel</button>
        </div>
      </form>`;
  }

  function openUser(user, redraw) {
    AMB.modal(userForm(user), (root) => {
      const form = root.querySelector('#user-form');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        const payload = {
          student_name: String(data.get('student_name') || '').trim(),
          email: String(data.get('email') || '').trim(),
          major: String(data.get('major') || '').trim(),
          is_admin: form.querySelector('[name="is_admin"]').checked,
          is_active: form.querySelector('[name="is_active"]').checked,
        };
        const password = String(data.get('password') || '');
        if (password) payload.password = password;
        try {
          await AMB.saveAdminUser(payload, user && user.id);
          AMB.closeModal();
          AMB.toast(user ? 'Account saved.' : 'Account created.');
          redraw();
        } catch (err) {
          root.querySelector('#user-error').textContent = err.message;
          button.disabled = false;
        }
      });
    });
  }

  async function render(root, alive) {
    const [gate, users] = await Promise.all([AMB.adminGate(), AMB.adminUsers()]);
    if (!alive()) return;
    const rows = users.map((user) => {
      const self = AMB.user && AMB.user.email === user.email;
      return `
      <tr>
        <td>
          <div class="task-title">${AMB.escape(user.student_name || user.email)}</div>
          <div class="task-meta">${AMB.escape(user.email)}</div>
        </td>
        <td>${user.is_admin ? 'Admin' : 'Student'}</td>
        <td>${user.is_active ? 'Open' : 'Closed'}</td>
        <td>${AMB.escape(user.major || '—')}</td>
        <td class="num">${user.task_count}</td>
        <td class="row-actions">
          ${self ? '' : `<button type="button" class="btn ${user.is_active ? 'danger' : 'secondary'} small" data-active="${user.is_active ? '0' : '1'}" data-id="${user.id}">${user.is_active ? 'Deactivate' : 'Activate'}</button>`}
          <button type="button" class="btn secondary small" data-edit="${user.id}">Edit</button>
          <button type="button" class="btn danger small" data-remove="${user.id}">Remove</button>
        </td>
      </tr>`;
    }).join('');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Admin</h1>
          <p class="lede">Same account table for admins and students. This page also controls the public sign-in card.</p>
        </div>
        <button type="button" class="btn" id="add-account">Add account</button>
      </div>
      <div class="stack">
        <form class="card" id="gate-form">
          <h2>Sign-in panel</h2>
          <div class="stack">
            <label class="check-line"><input type="checkbox" name="registration_open"${checked(gate.registration_open)}> Registration is open</label>
            <label class="check-line"><input type="checkbox" name="login_open"${checked(gate.login_open)}> Student sign-in is open</label>
            <label class="field">Note on the sign-in card
              <textarea name="panel_note" maxlength="500">${AMB.escape(gate.panel_note || '')}</textarea>
            </label>
            <p class="error-text" id="gate-error"></p>
            <button class="btn" type="submit">Save panel</button>
          </div>
        </form>
        <section class="card">
          <h2>Accounts</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Person</th><th>Role</th><th>Sign-in</th><th>Major</th><th class="num">Tasks</th><th></th></tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="6">No accounts yet.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
      </div>`;

    const redraw = () => App.show('admin', true);
    root.querySelector('#add-account').addEventListener('click', () => openUser(null, redraw));
    root.querySelectorAll('[data-active]').forEach((button) => {
      button.addEventListener('click', async () => {
        const user = users.find((item) => String(item.id) === button.dataset.id);
        if (!user) return;
        const opening = button.dataset.active === '1';
        button.disabled = true;
        try {
          await AMB.saveAdminUser({ is_active: opening }, user.id);
          AMB.toast(opening ? 'Account can sign in again.' : 'Account deactivated. They cannot sign in.');
          redraw();
        } catch (err) {
          AMB.toast(err.message);
          button.disabled = false;
        }
      });
    });
    root.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const user = users.find((item) => String(item.id) === button.dataset.edit);
        if (user) openUser(user, redraw);
      });
    });
    root.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', async () => {
        const user = users.find((item) => String(item.id) === button.dataset.remove);
        if (!user) return;
        const name = user.student_name || user.email;
        if (!window.confirm(`Remove ${name}? Their workspace goes with the account.`)) return;
        button.disabled = true;
        try {
          await AMB.deleteAdminUser(user.id);
          AMB.toast('Account removed.');
          redraw();
        } catch (err) {
          AMB.toast(err.message);
          button.disabled = false;
        }
      });
    });
    root.querySelector('#gate-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await AMB.saveAdminGate({
          registration_open: form.querySelector('[name="registration_open"]').checked,
          login_open: form.querySelector('[name="login_open"]').checked,
          panel_note: form.querySelector('[name="panel_note"]').value,
        });
        AMB.toast('Sign-in panel saved.');
        button.disabled = false;
      } catch (err) {
        form.querySelector('#gate-error').textContent = err.message;
        button.disabled = false;
      }
    });
  }

  window.AdminPage = { render };
})();
