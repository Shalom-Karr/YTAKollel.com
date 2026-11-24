const DEFAULT_URL = 'https://thechesedfund.com/tiferesavigdor/chanukah';

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  const decoded = atob(auth.slice(6));
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return password === (env.ADMIN_PASSWORD || 'changeme');
}

function unauthorizedResponse() {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="YTA Admin"' },
  });
}

async function listRedirects(env) {
  const list = await env.REDIRECTS.list();
  return await Promise.all(
    list.keys.map(async ({ name }) => ({ path: name, url: await env.REDIRECTS.get(name) }))
  );
}

function adminPage(entries) {
  const rows = entries.map(e => `
    <tr>
      <td><code>/${e.path}</code></td>
      <td><a href="${e.url}" target="_blank">${e.url}</a></td>
      <td>
        <form method="POST" action="/admin/delete" style="display:inline">
          <input type="hidden" name="path" value="${e.path}">
          <button class="del" onclick="return confirm('Delete /${e.path}?')">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YTA Redirect Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#f4f6f8;color:#1a1a1a;padding:2rem}
  h1{font-size:1.4rem;margin-bottom:1.5rem;color:#1a4080}
  .card{background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);padding:1.5rem;margin-bottom:1.5rem}
  h2{font-size:1rem;margin-bottom:1rem;color:#444}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:.6rem .8rem;border-bottom:1px solid #e8eaed;font-size:.9rem}
  th{background:#f0f4ff;font-weight:600}
  code{background:#f0f4ff;padding:.1rem .4rem;border-radius:4px;font-size:.85rem}
  .form-row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end}
  .form-group{display:flex;flex-direction:column;gap:.3rem}
  label{font-size:.8rem;font-weight:600;color:#555}
  input[type=text]{padding:.5rem .75rem;border:1px solid #cdd2d8;border-radius:6px;font-size:.9rem;width:220px}
  input[type=text]:focus{outline:none;border-color:#3b82f6}
  button{padding:.5rem 1rem;border:none;border-radius:6px;cursor:pointer;font-size:.9rem;font-weight:600}
  .add{background:#1a4080;color:#fff}
  .add:hover{background:#153366}
  .del{background:#fee2e2;color:#b91c1c}
  .del:hover{background:#fecaca}
  .empty{color:#999;font-style:italic;padding:.8rem}
  .default{background:#f0f4ff;border-radius:6px;padding:.75rem 1rem;font-size:.85rem;color:#444;margin-bottom:1rem}
  .default strong{color:#1a4080}
</style>
</head>
<body>
<h1>YTA Redirect Admin</h1>

<div class="card">
  <h2>Add Redirect</h2>
  <p class="default">Default (all unmatched paths): <strong>${DEFAULT_URL}</strong></p>
  <form method="POST" action="/admin/add">
    <div class="form-row">
      <div class="form-group">
        <label>Path (without /)</label>
        <input type="text" name="path" placeholder="cysk" required>
      </div>
      <div class="form-group">
        <label>Destination URL</label>
        <input type="text" name="url" placeholder="https://thechesedfund.com/..." required style="width:380px">
      </div>
      <button class="add" type="submit">Add</button>
    </div>
  </form>
</div>

<div class="card">
  <h2>Current Redirects</h2>
  <table>
    <thead><tr><th>Path</th><th>Destination</th><th></th></tr></thead>
    <tbody>
      ${rows.length ? rows : '<tr><td colspan="3" class="empty">No custom redirects yet.</td></tr>'}
    </tbody>
  </table>
</div>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Admin routes
    if (path === '/admin' || path.startsWith('/admin/')) {
      if (!checkAuth(request, env)) return unauthorizedResponse();

      if (path === '/admin/add' && request.method === 'POST') {
        const form = await request.formData();
        const p = (form.get('path') || '').replace(/^\/+/, '').trim();
        const u = (form.get('url') || '').trim();
        if (p && u) await env.REDIRECTS.put(p, u);
        return Response.redirect(url.origin + '/admin', 303);
      }

      if (path === '/admin/delete' && request.method === 'POST') {
        const form = await request.formData();
        const p = (form.get('path') || '').trim();
        if (p) await env.REDIRECTS.delete(p);
        return Response.redirect(url.origin + '/admin', 303);
      }

      const entries = await listRedirects(env);
      return new Response(adminPage(entries), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // KV redirect lookup (first path segment only, e.g. /cysk or /cysk/anything)
    const key = path.replace(/^\/+/, '').split('/')[0];
    if (key) {
      const dest = await env.REDIRECTS.get(key);
      if (dest) return Response.redirect(dest, 301);
    }

    // Default
    return Response.redirect(DEFAULT_URL, 301);
  }
};
