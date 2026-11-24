const DEFAULT_URL = 'https://thechesedfund.com/tiferesavigdor/chanukah';

// ── Auth helpers ───────────────────────────────────────────────────────────

async function hmac(password, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function isAuthenticated(request, env) {
  const token = getCookie(request, '_yta_sess');
  if (!token) return false;
  const expected = await hmac(env.ADMIN_PASSWORD || 'changeme', 'yta-admin-session');
  return token === expected;
}

async function makeSessionCookie(env) {
  const token = await hmac(env.ADMIN_PASSWORD || 'changeme', 'yta-admin-session');
  return `_yta_sess=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}

// ── Pages ──────────────────────────────────────────────────────────────────

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YTA Admin Login</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0f2149 0%,#1a3a7a 100%);min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.3);padding:2.5rem;width:100%;max-width:360px}
  .logo{text-align:center;margin-bottom:2rem}
  .logo h1{font-size:1.6rem;color:#0f2149;font-weight:800;letter-spacing:-.5px}
  .logo p{color:#888;font-size:.85rem;margin-top:.3rem}
  label{display:block;font-size:.8rem;font-weight:600;color:#444;margin-bottom:.4rem}
  input[type=password]{width:100%;padding:.7rem 1rem;border:1.5px solid #dde1e8;border-radius:8px;font-size:.95rem;outline:none;transition:border .2s}
  input[type=password]:focus{border-color:#1a3a7a}
  button{width:100%;margin-top:1.2rem;padding:.8rem;background:#0f2149;color:#fff;border:none;border-radius:8px;font-size:.95rem;font-weight:700;cursor:pointer;transition:background .2s}
  button:hover{background:#1a3a7a}
  .error{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:6px;padding:.6rem .9rem;font-size:.85rem;margin-bottom:1rem;text-align:center}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>YTA Redirects</h1>
    <p>Admin Panel</p>
  </div>
  ${error ? '<div class="error">Incorrect password. Try again.</div>' : ''}
  <form method="POST" action="/admin/login">
    <label>Password</label>
    <input type="password" name="password" autofocus placeholder="Enter admin password">
    <button type="submit">Sign In</button>
  </form>
</div>
</body>
</html>`;
}

function adminPage(entries, host) {
  const rows = entries.map(e => {
    const fullUrl = `https://${host}/${e.path}`;
    return `
    <tr>
      <td>
        <code>/${e.path}</code><br>
        <span class="full-url" onclick="copyUrl('${fullUrl}')" title="Click to copy">
          ${fullUrl} <span class="copy-icon">⎘</span>
        </span>
      </td>
      <td><a href="${e.url}" target="_blank">${e.url}</a></td>
      <td>
        <form method="POST" action="/admin/delete" style="display:inline">
          <input type="hidden" name="path" value="${e.path}">
          <button class="del" onclick="return confirm('Delete /${e.path}?')">Delete</button>
        </form>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YTA Redirect Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#f0f4f8;color:#1a1a1a;padding:2rem}
  header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
  header h1{font-size:1.4rem;color:#0f2149;font-weight:800}
  .logout{font-size:.8rem;color:#888;text-decoration:none;border:1px solid #dde1e8;padding:.3rem .7rem;border-radius:6px}
  .logout:hover{background:#fff}
  .card{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:1.5rem;margin-bottom:1.5rem}
  h2{font-size:.95rem;font-weight:700;margin-bottom:1rem;color:#333}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:.65rem .8rem;border-bottom:1px solid #eef0f3;font-size:.88rem;vertical-align:top}
  th{background:#f7f9fc;font-weight:700;color:#555;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
  code{background:#eef1f8;padding:.15rem .4rem;border-radius:4px;font-size:.82rem;font-weight:600;color:#0f2149}
  .full-url{display:inline-block;margin-top:.3rem;font-size:.78rem;color:#3b82f6;cursor:pointer;user-select:none}
  .full-url:hover{color:#1d4ed8}
  .copy-icon{font-size:.9em;opacity:.7}
  a{color:#3b82f6;text-decoration:none;font-size:.85rem;word-break:break-all}
  a:hover{text-decoration:underline}
  .form-row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end}
  .form-group{display:flex;flex-direction:column;gap:.35rem}
  label{font-size:.78rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.04em}
  input[type=text]{padding:.55rem .8rem;border:1.5px solid #dde1e8;border-radius:7px;font-size:.88rem;outline:none;transition:border .2s}
  input[type=text]:focus{border-color:#1a3a7a}
  .path-input{width:160px}
  .url-input{width:400px}
  button{padding:.55rem 1.1rem;border:none;border-radius:7px;cursor:pointer;font-size:.88rem;font-weight:700;transition:background .15s}
  .add{background:#0f2149;color:#fff}
  .add:hover{background:#1a3a7a}
  .del{background:#fee2e2;color:#b91c1c;padding:.35rem .7rem;font-size:.8rem}
  .del:hover{background:#fecaca}
  .empty{color:#aaa;font-style:italic;padding:.8rem;text-align:center}
  .default-badge{display:inline-block;background:#fef9ec;border:1px solid #fcd34d;color:#92400e;border-radius:5px;padding:.3rem .7rem;font-size:.8rem;margin-bottom:1rem}
  .toast{position:fixed;bottom:1.5rem;right:1.5rem;background:#1a3a7a;color:#fff;padding:.6rem 1.1rem;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none}
  .toast.show{opacity:1}
</style>
</head>
<body>
<header>
  <h1>YTA Redirects</h1>
  <a class="logout" href="/admin/logout">Sign out</a>
</header>

<div class="card">
  <h2>Add Redirect</h2>
  <div class="default-badge">Default → <strong>${DEFAULT_URL}</strong></div>
  <form method="POST" action="/admin/add">
    <div class="form-row">
      <div class="form-group">
        <label>Path</label>
        <input class="path-input" type="text" name="path" placeholder="cysk" required>
      </div>
      <div class="form-group">
        <label>Destination URL</label>
        <input class="url-input" type="text" name="url" placeholder="https://thechesedfund.com/..." required>
      </div>
      <button class="add" type="submit">Add</button>
    </div>
  </form>
</div>

<div class="card">
  <h2>Active Redirects</h2>
  <table>
    <thead><tr><th>Short URL</th><th>Destination</th><th></th></tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="3" class="empty">No redirects yet — add one above.</td></tr>'}
    </tbody>
  </table>
</div>

<div class="toast" id="toast">Copied!</div>
<script>
function copyUrl(url){
  navigator.clipboard.writeText(url).then(()=>{
    const t=document.getElementById('toast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2000);
  });
}
</script>
</body>
</html>`;
}

// ── Main handler ───────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/admin' || path.startsWith('/admin/')) {

      // Login form submit
      if (path === '/admin/login' && request.method === 'POST') {
        const form = await request.formData();
        const pw = form.get('password') || '';
        if (pw === (env.ADMIN_PASSWORD || 'changeme')) {
          const cookie = await makeSessionCookie(env);
          return new Response(null, {
            status: 303,
            headers: { Location: '/admin', 'Set-Cookie': cookie },
          });
        }
        return new Response(loginPage(true), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      }

      // Logout
      if (path === '/admin/logout') {
        return new Response(null, {
          status: 303,
          headers: {
            Location: '/admin',
            'Set-Cookie': '_yta_sess=; Path=/admin; HttpOnly; Secure; Max-Age=0',
          },
        });
      }

      // Check session
      if (!(await isAuthenticated(request, env))) {
        return new Response(loginPage(false), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      }

      if (path === '/admin/add' && request.method === 'POST') {
        const form = await request.formData();
        const p = (form.get('path') || '').replace(/^\/+/, '').trim();
        const u = (form.get('url') || '').trim();
        if (p && u) await env.REDIRECTS.put(p, u);
        return new Response(null, { status: 303, headers: { Location: '/admin' } });
      }

      if (path === '/admin/delete' && request.method === 'POST') {
        const form = await request.formData();
        const p = (form.get('path') || '').trim();
        if (p) await env.REDIRECTS.delete(p);
        return new Response(null, { status: 303, headers: { Location: '/admin' } });
      }

      const entries = await (async () => {
        const list = await env.REDIRECTS.list();
        return Promise.all(list.keys.map(async ({ name }) => ({ path: name, url: await env.REDIRECTS.get(name) })));
      })();
      return new Response(adminPage(entries, url.hostname), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // KV redirect lookup
    const key = path.replace(/^\/+/, '').split('/')[0];
    if (key) {
      const dest = await env.REDIRECTS.get(key);
      if (dest) return Response.redirect(dest, 301);
    }

    return Response.redirect(DEFAULT_URL, 301);
  }
};
