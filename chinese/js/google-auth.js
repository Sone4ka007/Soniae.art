/* Chinese Lab Google sign-in and optimistic local-first sync.
 * Requires a configured Supabase project and RLS in supabase/schema.sql.
 * The public publishable key is safe in this file; provider secrets are NOT.
 */
(function (global) {
  'use strict';
  const config = global.CHINESE_LAB_SUPABASE || {};
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || '') &&
    typeof config.publishableKey === 'string' && config.publishableKey.length > 20;
  let client = null, user = null, status = enabled ? 'loading' : 'unconfigured';
  let callbacks = null, revision = null, conflict = null, errorMessage = '';
  let timer = 0, busy = false, requested = false, lastWritten = '', switchId = 0;
  // Supabase returns OAuth errors to the site's redirect URL. Preserve them
  // before its SDK processes or clears the URL, rather than silently showing guest.
  let redirectError = (() => {
    try {
      const query = new URLSearchParams(global.location.search || '');
      const hash = new URLSearchParams((global.location.hash || '').replace(/^#/, ''));
      const code = query.get('error') || hash.get('error');
      if (!code) return '';
      return 'Вход через Google не завершён. Проверьте настройки авторизации или попробуйте позже.';
    } catch { return ''; }
  })();

  function notify() { if (callbacks && callbacks.onStatus) callbacks.onStatus(); }
  function current() { return { enabled, user, status, conflict: conflict && conflict.kind, errorMessage }; }
  function canonical(value) {
    const normalize = v => Array.isArray(v) ? v.map(normalize) :
      v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])) : v;
    return JSON.stringify(normalize(value));
  }
  function meaningful(p) {
    if (!p || typeof p !== 'object') return false;
    if (Number(p.xp || 0) || Number(p.correct || 0) || Number(p.attempts || 0)) return true;
    return ['stories','weak','saved','srs','ciDone','questWords','sessions'].some(k => p[k] && Object.keys(p[k]).length);
  }
  function storedBackup(data, label) {
    try {
      const key = 'sonya-chinese-lab-conflict-backup-' + (user?.id || 'guest') + '-' + label;
      global.localStorage.setItem(key, JSON.stringify({at:Date.now(),data}));
    } catch (e) { console.warn('Chinese Lab: backup was not saved', e); }
  }
  async function readCloud() {
    const { data, error } = await client.from('chinese_lab_progress')
      .select('data,revision').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function transition(nextUser) {
    const id = ++switchId;
    if ((nextUser?.id || null) === (user?.id || null) && status !== 'loading') return;
    clearTimeout(timer);
    user = nextUser || null;
    revision = null; conflict = null; lastWritten = ''; requested = false;
    status = user ? 'loading' : redirectError ? 'error' : 'guest';
    if (user) { redirectError = ''; errorMessage = ''; }
    else if (redirectError) errorMessage = redirectError;
    if (callbacks) callbacks.onIdentity(user);
    notify();
    if (!user) return;
    try {
      const remote = await readCloud();
      if (id !== switchId) return;
      const local = callbacks.getProgress();
      const guest = callbacks.getGuestProgress();
      if (!remote) {
        revision = null;
        if (meaningful(local)) {
          status = 'synced'; lastWritten = ''; schedule(local);
        } else if (meaningful(guest)) {
          conflict = {kind:'guest',guest};
          status = 'choice';
        } else {
          status = 'synced';
        }
      } else {
        revision = Number(remote.revision);
        const remoteData = global.ChineseLabProgress.validate(remote.data);
        if (!meaningful(local)) {
          callbacks.applyProgress(remoteData);
          lastWritten = canonical(remoteData);
          status = 'synced';
        } else if (canonical(local) === canonical(remoteData)) {
          lastWritten = canonical(local);
          status = 'synced';
        } else {
          conflict = {kind:'different',remote:remoteData,local};
          status = 'choice';
        }
      }
    } catch (e) {
      if (id !== switchId) return;
      console.error('Chinese Lab: cloud initialization failed', e);
      errorMessage = e.message || 'Ошибка подключения к облаку';
      status = 'error';
    }
    notify();
  }
  async function init(api) {
    callbacks = api;
    if (!enabled) { notify(); return; }
    try {
      const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = createClient(config.url.replace(/\/$/,''), config.publishableKey, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
      client.auth.onAuthStateChange((event, session) => {
        if (['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) {
          // Never await Supabase calls directly inside auth callbacks.
          setTimeout(() => { transition(session?.user || null); }, 0);
        }
      });
      const {data,error} = await client.auth.getSession();
      if (error) throw error;
      await transition(data.session?.user || null);
    } catch (e) {
      console.error('Chinese Lab: Supabase client unavailable', e);
      errorMessage = e.message || 'Не удалось загрузить авторизацию';
      status = 'error'; notify();
    }
  }
  async function signIn() {
    if (!enabled || !client) return;
    redirectError = '';
    errorMessage = '';
    try {
      const {error} = await client.auth.signInWithOAuth({
        provider:'google',
        options:{
          redirectTo:global.location.origin + global.location.pathname,
          queryParams:{prompt:'select_account'}
        }
      });
      if (error) throw error;
    } catch (e) {
      errorMessage = e.message || 'Не удалось войти через Google';
      status = 'error'; notify();
    }
  }
  async function signOut() {
    if (!client) return;
    clearTimeout(timer);
    const {error} = await client.auth.signOut();
    if (error) { errorMessage = error.message; status='error'; notify(); return; }
    await transition(null);
  }
  async function choose(choice) {
    if (!conflict || !user || status !== 'choice') return;
    const pending=conflict;
    if (choice==='later') { conflict=null; status='paused'; notify(); return; }
    if (pending.kind==='guest') {
      if (choice==='guest') {
        callbacks.applyProgress(pending.guest);
        conflict=null; status='synced'; lastWritten=''; notify(); schedule(callbacks.getProgress());
      } else if (choice==='empty') {
        conflict=null; status='synced'; lastWritten=''; notify();
      }
      return;
    }
    if (pending.kind==='different' && choice==='cloud') {
      storedBackup(pending.local,'local');
      callbacks.applyProgress(pending.remote);
      lastWritten=canonical(pending.remote);
      conflict=null; status='synced'; notify();
    } else if (pending.kind==='different' && choice==='device') {
      storedBackup(pending.remote,'cloud');
      conflict=null; status='synced'; lastWritten='';
      notify(); schedule(callbacks.getProgress());
    }
  }
  function backupText(source) {
    if (!conflict) return null;
    const payload = source==='guest' ? conflict.guest : source==='cloud' ? conflict.remote : conflict.local;
    if (!payload) return null;
    return global.ChineseLabProgress.exportText(payload);
  }
  function schedule() {
    if (!user || status!=='synced') return;
    requested=true;
    clearTimeout(timer);
    timer=setTimeout(flush,1100);
  }
  async function flush() {
    if (busy || !user || status!=='synced') return;
    const myId=user.id;
    const snapshot=callbacks.getProgress();
    const content=canonical(snapshot);
    if (!requested || content===lastWritten) { requested=false; return; }
    busy=true;requested=false;
    try {
      let nextRevision;
      if (revision===null) {
        const {data,error}=await client.from('chinese_lab_progress')
          .insert({user_id:myId,data:snapshot,revision:1})
          .select('revision').single();
        if(error) throw error;
        nextRevision=Number(data.revision);
      } else {
        const {data,error}=await client.from('chinese_lab_progress')
          .update({data:snapshot,revision:revision+1,updated_at:new Date().toISOString()})
          .eq('user_id',myId).eq('revision',revision)
          .select('revision').maybeSingle();
        if(error) throw error;
        if(!data) {
          status='error';
          errorMessage='Прогресс изменился на другом устройстве. Синхронизация приостановлена, чтобы избежать потери данных.';
          requested=false; notify(); return;
        }
        nextRevision=Number(data.revision);
      }
      if (!user || user.id!==myId) return;
      revision=nextRevision;
      lastWritten=content;
      if (canonical(callbacks.getProgress())!==content) requested=true;
    } catch(e) {
      if (!user || user.id!==myId) return;
      console.error('Chinese Lab: cloud save failed',e);
      status='error'; errorMessage=e.message || 'Синхронизация недоступна';
      requested=true;
    } finally {
      busy=false;notify();
      if (requested && status==='synced') schedule();
    }
  }
  async function retry() {
    if (!user || !client || busy) return;
    errorMessage=''; status='loading'; notify();
    // Re-check remote revision before resuming writes: never blindly overwrite.
    const oldUser=user; user=null;
    await transition(oldUser);
  }
  global.addEventListener('online',()=> {if(status==='error' && user) retry();});
  global.ChineseLabCloud=Object.freeze({enabled,init,current,signIn,signOut,choose,schedule,retry,backupText});
})(window);
