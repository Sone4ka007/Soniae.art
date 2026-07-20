const TELEGRAM_API = 'https://api.telegram.org';

export default async (request) => {
  if (request.method !== 'POST') return new Response('OK');
  const update = await request.json();
  const message = update.message;
  const adminId = String(Netlify.env.get('TELEGRAM_ADMIN_ID') || '');
  if (!message || String(message.from?.id) !== adminId) return new Response('OK');
  if (!message.photo?.length || !message.caption?.startsWith('#work')) {
    await reply(message.chat.id, 'Пришли фотографию с подписью, начинающейся с #work. Формат есть в README_BOT.md.');
    return new Response('OK');
  }
  try {
    const fields = parseCaption(message.caption);
    if (!fields.title || !fields.series) throw new Error('Нужны поля «Название» и «Серия».');
    const photo = message.photo.at(-1);
    const fileInfo = await tg('getFile', {file_id: photo.file_id});
    const bytes = await fetch(`${TELEGRAM_API}/file/bot${token()}/${fileInfo.result.file_path}`).then(r=>r.arrayBuffer());
    const slug = `${Date.now()}-${slugify(fields.title)}`;
    const imagePath = `assets/images/uploads/${slug}.jpg`;
    const works = await githubGetJson('content/works.json');
    const item = {id:slug,title:fields.title,series:fields.series,seriesId:slugify(fields.series),year:fields.year||new Date().getFullYear().toString(),materials:fields.materials||'',size:fields.size||'',image:imagePath,featured:false,status:fields.status||'not_for_sale',price:fields.price||'',description:fields.description||''};
    works.push(item);
    await githubCommit([{path:imagePath,content:Buffer.from(bytes).toString('base64'),encoding:'base64'},{path:'content/works.json',content:JSON.stringify(works,null,2)+'\n',encoding:'utf-8'}],`Add artwork: ${fields.title}`);
    await reply(message.chat.id, `Работа «${fields.title}» добавлена. Netlify обновит сайт после сборки.`);
  } catch (e) { await reply(message.chat.id, `Не получилось добавить работу: ${e.message}`); }
  return new Response('OK');
};

function token(){return Netlify.env.get('TELEGRAM_BOT_TOKEN')}
async function tg(method, body){return fetch(`${TELEGRAM_API}/bot${token()}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json())}
async function reply(chat_id,text){return tg('sendMessage',{chat_id,text})}
function parseCaption(text){const map={};for(const line of text.split('\n').slice(1)){const i=line.indexOf(':');if(i<0)continue;const k=line.slice(0,i).trim().toLowerCase();const v=line.slice(i+1).trim();const keys={'название':'title','серия':'series','год':'year','материалы':'materials','размер':'size','описание':'description','статус':'status','цена':'price'};if(keys[k])map[keys[k]]=v}return map}
function slugify(s){return s.toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'')}
function ghHeaders(){return {'authorization':`Bearer ${Netlify.env.get('GITHUB_TOKEN')}`,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','content-type':'application/json'}}
function repo(){const [owner,name]=Netlify.env.get('GITHUB_REPOSITORY').split('/');return {owner,name,branch:Netlify.env.get('GITHUB_BRANCH')||'main'}}
async function githubGetJson(path){const {owner,name,branch}=repo();const r=await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${path}?ref=${branch}`,{headers:ghHeaders()});if(!r.ok)throw new Error('Не удалось прочитать каталог работ из GitHub');const j=await r.json();return JSON.parse(Buffer.from(j.content,'base64').toString('utf-8'))}
async function githubCommit(files,message){const {owner,name,branch}=repo();let r=await fetch(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${branch}`,{headers:ghHeaders()});const ref=await r.json();const parent=ref.object.sha;r=await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits/${parent}`,{headers:ghHeaders()});const base=await r.json();const treeItems=files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.encoding==='base64'?undefined:f.content}));for(let i=0;i<files.length;i++){if(files[i].encoding==='base64'){const br=await fetch(`https://api.github.com/repos/${owner}/${name}/git/blobs`,{method:'POST',headers:ghHeaders(),body:JSON.stringify({content:files[i].content,encoding:'base64'})});const bj=await br.json();treeItems[i].sha=bj.sha}}
r=await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees`,{method:'POST',headers:ghHeaders(),body:JSON.stringify({base_tree:base.tree.sha,tree:treeItems})});const tree=await r.json();r=await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits`,{method:'POST',headers:ghHeaders(),body:JSON.stringify({message,tree:tree.sha,parents:[parent]})});const commit=await r.json();await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${branch}`,{method:'PATCH',headers:ghHeaders(),body:JSON.stringify({sha:commit.sha,force:false})})}
