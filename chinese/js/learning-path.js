/* Chinese Lab — five-step learning path. Navigation only; exercise state remains unchanged. */
(function (global) {
  'use strict';
  const STAGES = Object.freeze([
    Object.freeze({id:'words',mode:'words',title:'СЛОВАРЬ',icon:'字',modes:['words']}),
    Object.freeze({id:'games',mode:'pairs',title:'ИГРЫ',icon:'↔',modes:['pairs','sceneMatch','translate','reverse','build','sentence','review']}),
    Object.freeze({id:'input',mode:'input',title:'ИСТОРИЯ',icon:'文',modes:['input']}),
    Object.freeze({id:'story',mode:'story',title:'КВЕСТ',icon:'◎',modes:['story']}),
    Object.freeze({id:'practice',mode:'writing',title:'ПИСЬМО И ВИДЕО',icon:'✎',modes:['writing','video']})
  ]);
  const MODES = new Set(STAGES.flatMap(stage=>stage.modes));
  const stageForMode = mode => STAGES.find(stage=>stage.modes.includes(mode))?.id || null;
  function modeForStage(stageId, progress) {
    const stage=STAGES.find(item=>item.id===stageId);
    if(!stage)return null;
    const recent=stageId==='games'?progress?.lastGameMode:stageId==='practice'?progress?.lastPracticeMode:null;
    return stage.modes.includes(recent)?recent:stage.mode;
  }
  function navigation(mode,progress,modeInfo,esc) {
    const activeStage=stageForMode(mode);
    const stages=STAGES.map((stage,index)=>{
      const active=stage.id===activeStage;
      const single=stage.modes.length===1;
      const target=single?stage.mode:stage.id;
      const action=single?'mode':'stage';
      return '<button type="button" class="learning-step'+(active?' is-active':'')+
        '" data-action="'+action+'" data-id="'+esc(target)+'" aria-pressed="'+active+
        '"><span class="learning-step-number">'+String(index+1).padStart(2,'0')+
        '</span><span class="learning-step-icon" aria-hidden="true">'+esc(stage.icon)+
        '</span><span class="learning-step-label">'+esc(stage.title)+'</span></button>';
    }).join('');
    const stage=STAGES.find(item=>item.id===activeStage);
    const modes=stage && stage.modes.length>1?stage.modes.map(id=>{
      const item=modeInfo.find(info=>info.id===id);
      if(!item)return '';
      const active=id===mode;
      return '<button type="button" data-action="mode" data-id="'+esc(id)+
        '" class="mode-btn'+(active?' is-active':'')+'" aria-pressed="'+active+
        '"><span class="mode-icon">'+esc(item.icon)+'</span>'+esc(item.title)+'</button>';
    }).join(''):'';
    return {stages,modes,stage:activeStage};
  }
  function resumeTarget(progress,lessons) {
    const available=new Set((lessons||[]).map(lesson=>lesson.id));
    const id=Number(progress?.lastLessonId);
    const lessonId=available.has(id)?id:(lessons?.[0]?.id||1);
    const preferred=[progress?.lastStudyMode,progress?.lastMode].find(mode=>MODES.has(mode))||'words';
    const snapshots=progress?.sessions?.[String(lessonId)]||{};
    // When an old account only stores lastMode, keep that activity. Do not
    // jump to an unrelated lesson with an older unfinished round.
    const recent=Object.entries(snapshots)
      .filter(([mode,record])=>MODES.has(mode)&&record?.game&&Number.isFinite(record.updatedAt))
      .sort((a,b)=>b[1].updatedAt-a[1].updatedAt)[0];
    const mode=progress?.lastStudyMode&&MODES.has(progress.lastStudyMode)
      ?preferred:(recent?.[0]||preferred);
    return {lessonId,mode};
  }
  function dueCount(srs,now=Date.now()) {
    return Object.values(srs||{}).filter(record=>record&&Number.isFinite(record.due)&&record.due<=now).length;
  }
  global.ChineseLabLearningPath=Object.freeze({STAGES,stageForMode,modeForStage,navigation,resumeTarget,dueCount});
})(window);
