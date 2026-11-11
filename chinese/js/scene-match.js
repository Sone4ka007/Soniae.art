/* Chinese Lab — illustrated object-to-word matching. */
(function (global) {
  'use strict';
  const ASSETS = new Set([
    'cafeteria-search','campus-submit','family-room','family-shop',
    'festival-home','festival-zoo','fitness-gym','fitness-training',
    'gallery-friends','gallery-studio','internship-interview',
    'internship-notice','lesson14-shoes','lesson14-tea-shop',
    'park-rest','plans-desk','plans-office','rest-plan',
    'winter-plan','winter-station','tech-bike','tech-video','lesson8-vocabulary','lesson11-vocabulary'
  ]);
  // Original pen-and-ink drawings supplied by Sonya. The schedule (课程表)
  // and passport (护照) are deliberately excluded: neither is lesson-1 vocabulary.
  const LESSON_ONE_ART = Object.freeze([
    {
      image:'sonya-lesson1-documents',
      title:'Документы на стипендию',
      spots:[
        {id:'sonya-visa',word:'签证',x:3.52,y:5.97,w:24.81,h:49.68},
        {id:'sonya-materials',word:'材料',x:37.96,y:0.65,w:18.89,h:47.74},
        {id:'sonya-student-id',word:'证件',x:16.02,y:54.84,w:26.39,h:34.84},
        {id:'sonya-scholarship',word:'奖学金',x:57.31,y:52.9,w:26.57,h:42.26}
      ]
    },
    {
      image:'sonya-lesson1-campus',
      title:'Университетская жизнь',
      spots:[
        {id:'sonya-teacher',word:'教师',x:5.28,y:0.65,w:21.2,h:49.19},
        {id:'sonya-course',word:'课程',x:34.91,y:5.97,w:25.37,h:42.1},
        {id:'sonya-canteen',word:'食堂',x:68.15,y:10.48,w:27.78,h:32.42},
        {id:'sonya-activity',word:'活动',x:9.54,y:51.94,w:33.06,h:44.52}
      ]
    }
  ]);
  // This round uses only lesson-8 vocabulary. The four zones correspond
  // to distinct drawings, so no generic HSK-3 objects can leak into it.
  const LESSON_ART = Object.freeze({
    8:Object.freeze({
      image:'lesson8-vocabulary', title:'Отдых и путешествия',
      spots:[
        {id:'lesson8-hat',word:'帽子',x:2,y:18,w:22.4,h:70},
        {id:'lesson8-nature',word:'大自然',x:26.2,y:18,w:22.4,h:70},
        {id:'lesson8-wall',word:'长城',x:50.7,y:18,w:22.4,h:70},
        {id:'lesson8-palace',word:'故宫',x:75.2,y:18,w:22.4,h:70}
      ]
    }),
    9:Object.freeze({
      image:'gallery-studio', title:'Друзья и воспоминания',
      spots:[
        {id:'lesson9-responsibility',word:'责任',x:54,y:22,w:32,h:32},
        {id:'lesson9-chocolate',word:'巧克力',x:10,y:64,w:23,h:23},
        {id:'lesson9-feeling',word:'感受',x:38,y:61,w:15,h:28},
        {id:'lesson9-wish',word:'祝',x:69,y:60,w:21,h:29}
      ]
    }),
    10:Object.freeze({
      image:'winter-plan', title:'Подготовка к зимней поездке',
      spots:[
        {id:'lesson10-temp',word:'气温',x:11,y:24,w:29,h:36},
        {id:'lesson10-distance',word:'公里',x:56,y:23,w:30,h:33},
        {id:'lesson10-difference',word:'差别',x:36,y:64,w:24,h:22},
        {id:'lesson10-plant',word:'植物',x:80,y:59,w:13,h:30}
      ]
    }),
    11:Object.freeze({
      image:'lesson11-vocabulary', title:'Учебные инструменты',
      spots:[
        {id:'lesson11-video',word:'视频',x:2,y:18,w:22.4,h:70},
        {id:'lesson11-web',word:'网页',x:26.2,y:18,w:22.4,h:70},
        {id:'lesson11-notes',word:'记录',x:50.7,y:18,w:22.4,h:70},
        {id:'lesson11-numbers',word:'数字',x:75.2,y:18,w:22.4,h:70}
      ]
    })
  });
  const shuffle = values => {
    const copy = values.slice();
    for (let i=copy.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      const old=copy[i];copy[i]=copy[j];copy[j]=old;
    }
    return copy;
  };
  function sceneFor(lesson) {
    const newWords=new Set((lesson.words||[]).map(w=>w.hanzi));
    const curated=LESSON_ART[lesson.id];
    if (curated && curated.spots.every(p=>newWords.has(p.word))) return curated;
    const permitted=newWords;
    const possible=(lesson.quest?.steps||[])
      .filter(s=>s.type==='explore' && s.image && Array.isArray(s.spots)
        && (global.__offlineScenes?.[s.image] || ASSETS.has(s.image)))
      .map(s=>{
        const seen=new Set();
        const spots=s.spots.filter(p=>{
          const okay=p.word && permitted.has(p.word) && !seen.has(p.word) &&
            Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) &&
            Number(p.w)>0 && Number(p.h)>0;
          if(okay) seen.add(p.word);
          return okay;
        }).slice(0,6);
        return {image:s.image,title:s.title||lesson.topic,spots,
          score:spots.length+spots.filter(p=>newWords.has(p.word)).length/10};
      })
      .filter(s=>s.spots.length>=3)
      .sort((a,b)=>b.score-a.score);
    return possible[0]||null;
  }
  function sonyaRound(lesson, sceneIndex) {
    const scene=LESSON_ONE_ART[sceneIndex];
    if (!scene || lesson?.id !== 1) return null;
    const wordLookup=new Map((lesson.words||[]).map(w=>[w.hanzi,w.ru]));
    if (!scene.spots.every(spot=>wordLookup.has(spot.word))) return null;
    return {
      scene:scene.image, sceneTitle:scene.title, sceneIndex,
      sceneCount:LESSON_ONE_ART.length,
      pairs:scene.spots.map(p=>({...p,ru:wordLookup.get(p.word)})),
      order:shuffle(scene.spots.map(p=>p.word)),
      matched:[],chosenSpot:null,chosenWord:null,hintWord:null,zoom:false,
      notice:'Выбери рисунок и соответствующее китайское слово.'
    };
  }
  function init(lesson) {
    const firstRound=sonyaRound(lesson,0);
    if (firstRound) return firstRound;
    const scene=sceneFor(lesson);
    // Prefer no round over mis-teaching unrelated vocabulary.
    if (!scene) return null;
    const words=new Map((lesson.words||[]).map(w=>[w.hanzi,w.ru]));
    return {
      scene:scene.image,
      sceneTitle:scene.title,
      pairs:scene.spots.map(p=>({
        id:String(p.id),word:p.word,
        ru:words.get(p.word)||'',
        x:Number(p.x),y:Number(p.y),w:Number(p.w),h:Number(p.h)
      })),
      order:shuffle(scene.spots.map(p=>p.word)),
      matched:[], chosenSpot:null,chosenWord:null,
      hintWord:null,zoom:false,notice:'Выбери предмет на иллюстрации и его название по-китайски.'
    };
  }
  function render(lesson, game, helpers) {
    const esc=helpers.esc;
    if (!game||!Array.isArray(game.pairs)) return '<section class="panel-head"><div><div class="eyebrow">ВИЗУАЛЬНЫЙ СЛОВАРЬ</div><h3>НЕТ ПОДХОДЯЩЕЙ СЦЕНЫ</h3><p class="panel-desc">Для этого урока пока нет иллюстрации со словами из словаря урока.</p></div></section>';
    const total=game.pairs.length, done=game.matched.length;
    const isSonya=lesson.id===1 && Number.isInteger(game.sceneIndex) &&
      game.sceneCount===LESSON_ONE_ART.length;
    const finalScene=isSonya && game.sceneIndex===LESSON_ONE_ART.length-1;
    const nextScene=isSonya && !finalScene && done===total;
    const stage=isSonya?'<p class="scene-match-stage">СЦЕНА '+(game.sceneIndex+1)+' / '+
      game.sceneCount+' · '+esc(game.sceneTitle)+'</p>':'';
    const spots=game.pairs.map((p,i)=>{
      const matched=game.matched.includes(p.id);
      const active=game.chosenSpot===p.id;
      return '<button type="button" class="scene-match-spot'+
        (matched?' is-matched':'')+(active?' is-selected':'')+
        '" style="left:'+p.x+'%;top:'+p.y+'%;width:'+p.w+'%;height:'+p.h+
        '%" data-action="scene-spot" data-scene-id="'+esc(p.id)+
        '" aria-pressed="'+active+'" aria-label="'+
        (matched?'Уже найдено: '+esc(p.word):'Выбрать объект '+(i+1))+
        '" '+(matched?'disabled':'')+
        '><span class="scene-match-target" aria-hidden="true">'+(matched?'✓':'+')+'</span></button>';
    }).join('');
    const labels=game.order.map(word=>{
      const pair=game.pairs.find(p=>p.word===word);
      if (!pair) return '';
      const matched=game.matched.includes(pair.id);
      const active=game.chosenWord===word;
      return '<button type="button" class="scene-match-word'+
        (matched?' is-matched':'')+(active?' is-selected':'')+
        '" data-action="scene-word" data-scene-word="'+esc(word)+
        '" aria-pressed="'+active+'" '+(matched?'disabled':'')+
        '><span lang="zh-CN">'+esc(word)+'</span><span class="scene-match-speaker" aria-hidden="true">◖))</span></button>';
    }).join('');
    const hint=game.hintWord ? game.pairs.find(p=>p.word===game.hintWord):null;
    const finished=done===total;
    return '<div class="panel-head"><div><div class="eyebrow">'+esc(lesson.label.toUpperCase())+
      ' / ВИЗУАЛЬНЫЙ СЛОВАРЬ</div><h3>НАЙДИ И СОЕДИНИ</h3>'+
      '<p class="panel-desc">Найди предмет на картинке, затем выбери китайское слово. Перевод скрыт, пока не запросишь подсказку.</p></div>'+
      '<span class="chip">СОВПАДЕНИЙ '+done+' / '+total+'</span></div>'+stage+
      '<div class="exercise-resume-bar"><span>АВТОСОХРАНЕНИЕ ЗАДАНИЙ</span>'+
      '<button type="button" data-action="exercise-restart">НАЧАТЬ ЗАНОВО ↻</button></div>'+
      '<div class="progress-track"><div style="width:'+(100*done/total)+'%"></div></div>'+
      '<div class="scene-match-toolbar">'+
      '<button type="button" class="scene-match-zoom" data-action="scene-zoom" aria-pressed="'+
      Boolean(game.zoom)+'">'+(game.zoom?'УМЕНЬШИТЬ −':'ЕЩЁ КРУПНЕЕ +')+'</button>'+
      '<span class="scene-match-pan-hint">← ПРОКРУЧИВАЙ РИСУНОК В СТОРОНЫ →</span></div>'+
      '<div class="scene-match-board'+(game.zoom?' is-zoomed':'')+'" id="scene-match-board">'+
      '<div class="scene-match-picture" data-scene="'+esc(game.scene)+'">'+
      '<div class="scene-match-canvas"><img src="'+esc(helpers.sceneURL(game.scene))+
      '" alt="'+esc(game.sceneTitle)+'" draggable="false">'+spots+'</div></div>'+
      '<div class="scene-match-words"><p class="scene-match-caption">СОЕДИНИ СО СЛОВОМ</p>'+labels+'</div>'+
      '<svg class="scene-match-wires" aria-hidden="true" preserveAspectRatio="none"></svg></div>'+
      '<div class="scene-match-footer"><p class="scene-match-status" role="status">'+
      esc(finished?(nextScene?'Все четыре предмета найдены! Переходи к следующей сцене.':
        finalScene?'Все восемь рисунков найдены! Первый урок завершён.':
        'Все предметы найдены! Можно начать новый раунд.'):game.notice)+
      '</p><button type="button" class="action-btn secondary" data-action="scene-hint"'+
      (finished?' disabled':'')+'>ПЕРЕВОД ПО ПОДСКАЗКЕ</button></div>'+
      (nextScene?'<button type="button" class="action-btn" data-action="scene-next">СЛЕДУЮЩАЯ СЦЕНА →</button>':'')+
      (hint?'<p class="scene-match-hint"><span lang="zh-CN">'+esc(hint.word)+
        '</span> — '+esc(hint.ru||'Значение смотри в словаре урока')+'</p>':'')+
      (finished?'<div class="feedback is-success">'+
        (finalScene?'УРОК 01 · 8 РИСУНКОВ НАЙДЕНО':
          'РАУНД ЗАВЕРШЁН · '+total+' ПРЕДМЕТОВ НАЙДЕНО')+'</div>':'');
  }
  function paint(game) {
    const board=document.getElementById('scene-match-board');
    const svg=board?.querySelector('.scene-match-wires');
    if(!board||!svg||!game)return;
    const rect=board.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    svg.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);
    svg.replaceChildren();
    for(const id of game.matched) {
      const pair=game.pairs.find(p=>p.id===id);
      if(!pair)continue;
      const left=[...board.querySelectorAll('.scene-match-spot')].find(el=>el.dataset.sceneId===id);
      const right=[...board.querySelectorAll('.scene-match-word')].find(el=>el.dataset.sceneWord===pair.word);
      if(!left||!right)continue;
      const a=left.getBoundingClientRect(),b=right.getBoundingClientRect();
      const viewport=board.querySelector('.scene-match-picture')?.getBoundingClientRect();
      if(viewport && (a.right<=viewport.left || a.left>=viewport.right))continue;
      const x1=a.left+a.width/2-rect.left, y1=a.top+a.height/2-rect.top;
      const x2=b.left+b.width/2-rect.left, y2=b.top+b.height/2-rect.top;
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      for(const [key,value] of Object.entries({x1,y1,x2,y2}))line.setAttribute(key,value);
      svg.appendChild(line);
    }
  }
  function action(type, btn, game, helpers) {
    if(!game)return;
    if(type==='scene-zoom') {
      game.zoom=!game.zoom;
      helpers.render();
      return;
    }
    if(type==='scene-next') {
      if(!helpers.lesson || helpers.lesson.id!==1 ||
        !Number.isInteger(game.sceneIndex) ||
        game.matched.length!==game.pairs.length ||
        game.sceneIndex>=LESSON_ONE_ART.length-1)return;
      const next=sonyaRound(helpers.lesson,game.sceneIndex+1);
      if (!next) return;
      Object.assign(game,next);
      helpers.render();
      return;
    }
    if(game.matched.length===game.pairs.length)return;
    if(type==='scene-spot') {
      const id=btn.dataset.sceneId;
      if(!game.pairs.some(p=>p.id===id)||game.matched.includes(id))return;
      game.chosenSpot=id;
    } else if(type==='scene-word') {
      const word=btn.dataset.sceneWord;
      if(!game.pairs.some(p=>p.word===word)||game.matched.some(id=>game.pairs.find(p=>p.id===id)?.word===word))return;
      game.chosenWord=word;
      helpers.speech(word);
    } else if(type==='scene-hint') {
      game.hintWord=game.chosenWord||null;
      game.notice=game.chosenWord?'Перевод открыт. Найди соответствующий предмет.':'Сначала выбери китайское слово, затем нажми «Перевод по подсказке».';
    } else return;
    if(game.chosenSpot&&game.chosenWord) {
      const pair=game.pairs.find(p=>p.id===game.chosenSpot);
      if(pair.word===game.chosenWord) {
        game.matched.push(pair.id);
        game.notice='Верно! '+pair.word+' — '+pair.ru+'.';
        game.chosenSpot=null;game.chosenWord=null;game.hintWord=null;
        helpers.award(8,'ПРЕДМЕТ НАЙДЕН');
      } else {
        game.notice='Это другой предмет. Попробуй ещё раз.';
        game.chosenSpot=null;
        helpers.miss(game.chosenWord);
      }
    }
    helpers.render();
  }
  global.ChineseLabSceneMatch=Object.freeze({init,render,paint,action});
  global.addEventListener('resize',()=>global.ChineseLabSceneMatch.paint(global.__chineseLabSceneMatchGame));
})(window);
