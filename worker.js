/**
 * كراسي — Cloudflare Worker bridge
 * GitHub remains the permanent image store. Keep GITHUB_TOKEN and ADMIN_KEY
 * in Worker secrets; NEVER put them in index.html.
 */
const SUBJECTS = new Set(['math','sci','phy','phi','fr','en','his','geo','isl']);
const TYPES = new Set(['l','e']);
const MAX_BYTES = 3 * 1024 * 1024;

function cors(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const allowOrigin = allowed === '*' ? '*' : (origin === allowed ? origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', ...headers}});
}
function validTarget(subject, type) { return SUBJECTS.has(subject) && TYPES.has(type); }
function ghHeaders(env) {
  return {'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
}
function apiUrl(env, path='') {
  const owner = encodeURIComponent(env.GITHUB_OWNER);
  const repo = encodeURIComponent(env.GITHUB_REPO);
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}
async function github(env, url, options={}) {
  const r = await fetch(url, { ...options, headers:{...ghHeaders(env), ...(options.headers||{})} });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(body.message || `GitHub API error ${r.status}`);
  return body;
}
function decodeName(name) {
  const m = name.match(/^(\d+)_([^_]+)_([\w-]+)\.jpg$/);
  if (!m) return {by:'تلميذ', t:0};
  let by='تلميذ'; try { by=decodeURIComponent(m[2]); } catch {}
  return {by, t:Number(m[1]) || 0};
}
async function handle(request, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH || !env.ADMIN_KEY) {
    return json({error:'إعدادات الخادم غير مكتملة. راجع README.'}, 500);
  }
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, {status:204});

  if (url.pathname === '/api/admin-check' && request.method === 'POST') {
    const body = await request.json().catch(()=>({}));
    return json({ok: typeof body.key === 'string' && body.key === env.ADMIN_KEY}, 200);
  }

  if (url.pathname === '/api/images' && request.method === 'GET') {
    const subject=url.searchParams.get('subject'), type=url.searchParams.get('type');
    if (!validTarget(subject,type)) return json({error:'قسم غير صالح'},400);
    const path=`uploads/${subject}/${type}`;
    let files=[];
    try { files=await github(env, apiUrl(env, path)+`?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`); }
    catch(e) { if (!String(e.message).includes('Not Found')) throw e; }
    const items=(Array.isArray(files)?files:[]).filter(f=>f.type==='file' && f.name.endsWith('.jpg')).map(f=>({
      id:f.sha, path:f.path, sha:f.sha, d:f.download_url, ...decodeName(f.name)
    })).sort((a,b)=>a.t-b.t);
    return json({items},200);
  }

  if (url.pathname === '/api/images' && request.method === 'POST') {
    const body=await request.json().catch(()=>null);
    if (!body || !validTarget(body.subject,body.type) || typeof body.by!=='string' || typeof body.data!=='string') return json({error:'بيانات الرفع غير صالحة'},400);
    const match=body.data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json({error:'يجب أن تكون الصورة JPEG'},400);
    const binary=atob(match[1]);
    if (binary.length>MAX_BYTES) return json({error:'حجم الصورة بعد الضغط أكبر من 3MB'},413);
    const safeName=encodeURIComponent(body.by.trim().slice(0,40) || 'student').replace(/_/g,'%5F');
    const stamp=Date.now();
    const filename=`${stamp}_${safeName}_${crypto.randomUUID()}.jpg`;
    const path=`uploads/${body.subject}/${body.type}/${filename}`;
    const result=await github(env,apiUrl(env,path),{method:'PUT',body:JSON.stringify({message:`Add classroom image ${filename}`,content:match[1],branch:env.GITHUB_BRANCH})});
    const file=result.content;
    return json({item:{id:file.sha,path:file.path,sha:file.sha,d:file.download_url,by:body.by.trim().slice(0,40)||'تلميذ',t:stamp}},201);
  }

  if (url.pathname === '/api/images' && request.method === 'DELETE') {
    if (request.headers.get('X-Admin-Key') !== env.ADMIN_KEY) return json({error:'غير مصرح بالحذف'},403);
    const body=await request.json().catch(()=>({}));
    if (typeof body.path!=='string' || !/^uploads\/(math|sci|phy|phi|fr|en|his|geo|isl)\/(l|e)\/[^/]+\.jpg$/.test(body.path) || typeof body.sha!=='string') return json({error:'مسار الحذف غير صالح'},400);
    await github(env,apiUrl(env,body.path),{method:'DELETE',body:JSON.stringify({message:`Delete classroom image ${body.path.split('/').pop()}`,sha:body.sha,branch:env.GITHUB_BRANCH})});
    return json({ok:true},200);
  }
  return json({error:'Not found'},404);
}
export default {
  async fetch(request, env) {
    const headers=cors(env,request.headers.get('Origin')||'');
    try {
      const response=await handle(request,env);
      const out=new Response(response.body,response);
      for (const [k,v] of Object.entries(headers)) out.headers.set(k,v);
      out.headers.set('Cache-Control','no-store');
      return out;
    } catch(e) {
      const response=json({error:e.message||'حدث خطأ في الخادم'},500,headers);
      return response;
    }
  }
};
