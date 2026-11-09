(function(global){
'use strict';
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(opts){
 const {game,speakButton,sceneURL}=opts, rp=game.roleplay, lessonId=Number(opts.lessonId)||1;
 const config={
  1:{person:'ВАН',name:'王老师 · ГОСПОЖА ВАН',scene:'campus-submit',alt:'Студенческий центр, госпожа Ван и документы',
    heading:'РАЗГОВОР С ПРЕПОДАВАТЕЛЬНИЦЕЙ',
    intro:'Ты приехала в Китай учиться в магистратуре. Сегодня впервые обращаешься в университетский центр. Стипендия поможет семье. Тебе нужно решить вопрос самой, разговаривая по-китайски.'},
  2:{person:'ЧЭНЬ',name:'陈阿姨 · ГОСПОЖА ЧЭНЬ',scene:'apartment',alt:'Квартира, которую показывает госпожа Чэнь',
    heading:'РАЗГОВОР С ХОЗЯЙКОЙ',
    intro:'Ты — Анна. После университета ищешь жильё рядом с кампусом. Хозяйка показывает светлую квартиру за 3000 юаней. Тебе нужно самой узнать цену, условия заселения и насколько шумно по вечерам.'},
  3:{person:'КАССИР',name:'服务员 · СОТРУДНИК КАФЕ',scene:'mobile_cafe',alt:'Кафе: касса, QR-коды и чек',
    heading:'РАЗГОВОР В КАФЕ',
    intro:'Ты — Анна. Пришла с Сяолинем купить кофе. У кассы есть QR-код, но рядом заметна подозрительная наклейка. Сама уточни стоимость, способы оплаты и как пользоваться кодом.'},
  4:{person:'ПАССАЖИРКА',name:'乘客 · ПАССАЖИРКА',scene:'metro_help',alt:'Станция метро: билетный автомат и стойка помощи',
    heading:'РАЗГОВОР С ПАССАЖИРКОЙ',
    intro:'Ты — Анна. Едешь на мероприятие в университет, но телефон остался без связи и нет наличных для билета. Незнакомая пассажирка предлагает помощь. Объясни проблему, попроси помощь с билетом и поблагодари её.'}
 };
 const info=config[lessonId]||config[1],mod=global.ChineseLabRoleplay.forLesson(lessonId);
 const mission=mod?.byId(rp.active),person=info.person,sceneLabel=info.alt,introText=info.intro;
 if(!mission)return '<p>Диалог пока недоступен.</p>';
 const done=rp.done.length,finished=rp.done.includes(rp.active),intro=done===0;
 const tasks=mod.missions.map(m=>{
   const completed=rp.done.includes(m.id),unlocked=rp.done.includes('purpose')||m.id==='purpose';
   return '<button type="button" data-action="quest-roleplay-topic" data-id="'+esc(m.id)+'" class="quest-rp-goal'+(completed?' done':'')+(rp.active===m.id?' current':'')+'" '+(!unlocked||completed?'disabled':'')+'><span>'+(completed?'✓':'○')+'</span>'+esc(m.title)+'</button>';
 }).join('');
 const transcript=rp.history.slice(-4).map(entry=>
   '<div class="quest-rp-history-item"><div><b>ТЫ</b><span lang="zh-CN">'+esc(entry.student)+'</span>'+speakButton(entry.student)+'</div><div><b>'+person+'</b><span lang="zh-CN">'+esc(entry.teacher)+'</span>'+speakButton(entry.teacher)+'</div></div>'
 ).join('');
 const stateLine=rp.feedback?'<div class="quest-rp-feedback '+(rp.feedback.ok?'good':rp.feedback.clarified?'clarified':'retry')+'" role="status"><b>'+(rp.feedback.ok?'ТЕБЯ ПОНЯЛИ':rp.feedback.clarified?'СОБЕСЕДНИК ПОВТОРИЛ':'СОБЕСЕДНИК НЕ ПОНЯЛ')+'</b><div lang="zh-CN">'+esc(rp.feedback.reply)+'</div>'+speakButton(rp.feedback.reply)+(rp.showTranslation?'<p>'+esc(rp.feedback.replyRu)+'</p>':'')+(rp.feedback.ok?'':rp.feedback.reason?'<p>'+esc(rp.feedback.reason)+'</p>':'')+'</div>':'';
 const tileBank=rp.hint&&!finished?'<div class="quest-rp-bank"><p>Собери реплику из слов или напиши собственную фразу. Порядок нужно выбрать самостоятельно.</p><div>'+mission.tiles.slice().sort((a,b)=>a.localeCompare(b,'zh')).map(token=>
   '<button type="button" data-action="quest-roleplay-tile" data-token="'+esc(token)+'" lang="zh-CN">'+esc(token)+'</button>'
 ).join('')+'</div><button type="button" class="quest-rp-link" data-action="quest-roleplay-example">ПОКАЗАТЬ ПРИМЕР ФРАЗЫ</button>'+(rp.example?'<p class="quest-rp-sample" lang="zh-CN">'+esc(mission.sample)+'</p>':'')+'</div>':'';
 let actions='';
 if(done===mod.missions.length){
   actions='<div class="quest-ready"><span>✓ ТЫ САМА ВЫЯСНИЛА УСЛОВИЯ ПО-КИТАЙСКИ.</span><button type="button" class="action-btn" data-action="quest-next">ПРОДОЛЖИТЬ ИССЛЕДОВАНИЕ →</button></div>';
 }else if(finished){
   actions='<button type="button" data-action="quest-roleplay-next" class="action-btn">ПРОДОЛЖИТЬ РАЗГОВОР →</button>';
 }else{
   actions='<div class="quest-rp-compose"><label for="quest-roleplay-input">ТВОЯ РЕПЛИКА НА КИТАЙСКОМ</label><textarea id="quest-roleplay-input" rows="2" maxlength="200" lang="zh-CN" placeholder="Напиши свою реплику по-китайски…">'+esc(rp.draft||'')+'</textarea><div class="quest-rp-controls"><button type="button" class="action-btn" data-action="quest-roleplay-send">ОТВЕТИТЬ ПО-КИТАЙСКИ →</button><button type="button" data-action="quest-roleplay-hint" class="action-btn secondary">'+(rp.hint?'СКРЫТЬ БЛОКИ':'ПОМОЩЬ СО СЛОВАМИ')+'</button><button type="button" class="quest-rp-link" data-action="quest-roleplay-clear">ОЧИСТИТЬ</button></div>'+tileBank+'</div>';
 }
 return '<div class="quest-rp">'+
  '<div class="quest-rp-scene"><img src="'+esc(sceneURL(info.scene))+'" alt="'+esc(sceneLabel)+'"/><div><b>ТВОЯ РОЛЬ — АННА</b><p>'+esc(introText)+'</p></div></div>'+
  '<div class="quest-rp-progress"><b>'+(info.heading)+'</b><span>'+done+' / '+mod.missions.length+' ЗАДАЧ</span></div>'+
  '<div class="quest-rp-topics">'+tasks+'</div>'+
  (transcript?'<details class="quest-rp-history"><summary>ПРЕДЫДУЩИЕ РЕПЛИКИ ('+rp.history.length+')</summary>'+transcript+'</details>':'')+
  '<section class="quest-rp-turn"><div class="quest-rp-dialogue"><div class="quest-rp-name">'+(info.name)+'</div><div class="quest-rp-teacher" lang="zh-CN">'+esc(mission.teacher)+' '+speakButton(mission.teacher)+'</div><button type="button" data-action="quest-roleplay-translate" class="quest-rp-link">'+(rp.showTranslation?'СКРЫТЬ ПЕРЕВОД':'ПЕРЕВОД РЕПЛИКИ')+'</button>'+(rp.showTranslation?'<p>'+esc(mission.teacherRu)+'</p>':'')+'</div>'+
  '<div class="quest-rp-task"><b>ТВОЯ ЗАДАЧА</b><p>'+esc(mission.goal)+'</p></div>'+
  stateLine+actions+'</section></div>';
}
global.ChineseLabRoleplayView=Object.freeze({render});
})(typeof window!=='undefined'?window:globalThis);
