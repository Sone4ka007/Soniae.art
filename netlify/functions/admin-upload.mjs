const GH='https://api.github.com';
export default async (request)=>{
  if(request.method!=='POST') return json({ok:false,error:'POST only'},405);
  try{
    const body=await request.json();
    const secret=Netlify.env.get('TELEGRAM_SETUP_SECRET');
    if(!secret||body.secret!==secret) return json({ok:false,error:'Forbidden'},403);
    const token=Netlify.env.get('GITHUB_TOKEN');
    const repo=Netlify.env.get('GITHUB_REPOSITORY');
    const branch=Netlify.env.get('GITHUB_BRANCH')||'main';
    if(!token||!repo) throw new Error('Missing GitHub environment variables');
    const [owner,name]=repo.split('/');
    const headers={authorization:`Bearer ${token}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','content-type':'application/json'};
    const api=async(path,opts={})=>{const r=await fetch(`${GH}/repos/${owner}/${name}${path}`,{...opts,headers:{...headers,...(opts.headers||{})}});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}if(!r.ok)throw new Error(`${r.status}: ${typeof d==='string'?d:(d.message||'GitHub error')}`);return d};
    const ref=await api(`/git/ref/heads/${branch}`); const parent=ref.object.sha;
    const commit=await api(`/git/commits/${parent}`); const baseTree=commit.tree.sha;
    const entries=[];
    for(const f of (body.files||[])){
      const blob=await api('/git/blobs',{method:'POST',body:JSON.stringify({content:f.content,encoding:'base64'})});
      entries.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha});
    }
    for(const f of (body.textFiles||[])) entries.push({path:f.path,mode:'100644',type:'blob',content:f.content});
    const tree=await api('/git/trees',{method:'POST',body:JSON.stringify({base_tree:baseTree,tree:entries})});
    const next=await api('/git/commits',{method:'POST',body:JSON.stringify({message:body.message||'Sync portfolio',tree:tree.sha,parents:[parent]})});
    await api(`/git/refs/heads/${branch}`,{method:'PATCH',body:JSON.stringify({sha:next.sha,force:false})});
    return json({ok:true,commit:next.sha,files:entries.length});
  }catch(e){return json({ok:false,error:e.message},500)}
};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}})}
