/* Chinese Lab — illustrated object-to-word matching. */
(function (global) {
  'use strict';
  const BASE_RU = Object.freeze({
    '书':'книга', '手机':'мобильный телефон', '杯子':'чашка',
    '椅子':'стул', '电脑':'компьютер', '桌子':'стол',
    '包':'сумка', '老师':'преподаватель', '时间':'время'
  });
  const ASSETS = new Set([
    'cafeteria-search','campus-submit','family-room','family-shop',
    'festival-home','festival-zoo','fitness-gym','fitness-training',
    'gallery-friends','gallery-studio','internship-interview',
    'internship-notice','lesson14-shoes','lesson14-tea-shop',
    'park-rest','plans-desk','plans-office','rest-plan',
    'winter-plan','winter-station','word-search-room'
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

  // Seven new illustrations, matched exclusively to the published words of lesson 2.
  // 亮 means "bright"; the user's brightly lit stage illustrates the adjective.
  const LESSON_TWO_ART = Object.freeze([
    {
      image:'sonya-lesson2-apartment',
      title:'Осмотр квартиры',
      spots:[
        {id:'sonya-lesson2-kitchen',word:'厨房',x:9.35,y:2.26,w:31.20,h:45.81},
        {id:'sonya-lesson2-living',word:'客厅',x:56.39,y:2.42,w:36.76,h:48.39},
        {id:'sonya-lesson2-towel',word:'毛巾',x:17.50,y:49.84,w:19.07,h:47.10},
        {id:'sonya-lesson2-bright',word:'亮',x:59.26,y:49.35,w:30.74,h:47.74}
      ]
    },
    {
      image:'sonya-lesson2-details',
      title:'Вещи и повседневные дела',
      spots:[
        {id:'sonya-lesson2-price',word:'价格',x:7.59,y:2.10,w:31.94,h:60.48},
        {id:'sonya-lesson2-diary',word:'日记',x:53.43,y:3.06,w:38.15,h:48.71},
        {id:'sonya-lesson2-planting',word:'种',x:39.35,y:50.32,w:25.74,h:48.87}
      ]
    }
  ]);
  const AUTHOR_ART = Object.freeze({1:LESSON_ONE_ART,2:LESSON_TWO_ART});
  const FALLBACK = Object.freeze({
    image:'word-search-room', title:'Комната студента',
    spots:[
      {id:'book',word:'书',x:9,y:39,w:24,h:27},
      {id:'computer',word:'电脑',x:40,y:18,w:28,h:34},
      {id:'cup',word:'杯子',x:72,y:43,w:18,h:23},
      {id:'phone',word:'手机',x:48,y:58,w:15,h:19},
      {id:'chair',word:'椅子',x:13,y:66,w:23,h:29}
    ]
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
    const permitted=new Set([...newWords,...Object.keys(BASE_RU)]);
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
    return possible[0]||FALLBACK;
  }
  function sonyaRound(lesson, sceneIndex) {
    const scenes=AUTHOR_ART[lesson?.id] || [];
    const scene=scenes[sceneIndex];
    if (!scene) return null;
    const wordLookup=new Map((lesson.words||[]).map(w=>[w.hanzi,w.ru]));
    if (!scene.spots.every(spot=>wordLookup.has(spot.word))) return null;
    return {
      scene:scene.image, sceneTitle:scene.title, sceneIndex,
      sceneCount:scenes.length,
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
    const words=new Map((lesson.words||[]).map(w=>[w.hanzi,w.ru]));
    return {
      scene:scene.image,
      sceneTitle:scene.title,
      pairs:scene.spots.map(p=>({
        id:String(p.id),word:p.word,
        ru:words.get(p.word)||BASE_RU[p.word]||'',
        x:Number(p.x),y:Number(p.y),w:Number(p.w),h:Number(p.h)
      })),
      order:shuffle(scene.spots.map(p=>p.word)),
      matched:[], chosenSpot:null,chosenWord:null,
      hintWord:null,zoom:false,notice:'Выбери предмет на иллюстрации и его название по-китайски.'
    };
  }
  function render(lesson, game, helpers) {
    const esc=helpers.esc;
    if (!game||!Array.isArray(game.pairs)) return '';
    const total=game.pairs.length, done=game.matched.length;
    const authorScenes=AUTHOR_ART[lesson.id] || [];
    const isSonya=Number.isInteger(game.sceneIndex) &&
      game.sceneCount===authorScenes.length &&
      game.scene===authorScenes[game.sceneIndex]?.image;
    const finalScene=isSonya && game.sceneIndex===authorScenes.length-1;
    const totalArt=isSonya?authorScenes.reduce((sum,x)=>sum+x.spots.length,0):total;
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
        finalScene?'Все '+totalArt+' рисунков найдены! Урок завершён.':
        'Все предметы найдены! Можно начать новый раунд.'):game.notice)+
      '</p><button type="button" class="action-btn secondary" data-action="scene-hint"'+
      (finished?' disabled':'')+'>ПЕРЕВОД ПО ПОДСКАЗКЕ</button></div>'+
      (nextScene?'<button type="button" class="action-btn" data-action="scene-next">СЛЕДУЮЩАЯ СЦЕНА →</button>':'')+
      (hint?'<p class="scene-match-hint"><span lang="zh-CN">'+esc(hint.word)+
        '</span> — '+esc(hint.ru||'Значение смотри в словаре урока')+'</p>':'')+
      (finished?'<div class="feedback is-success">'+
        (finalScene?'УРОК '+String(lesson.id).padStart(2,'0')+' · '+totalArt+' РИСУНКОВ НАЙДЕНО':
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
      const scenes=AUTHOR_ART[helpers.lesson?.id] || [];
      if(!scenes.length || !Number.isInteger(game.sceneIndex) ||
        game.scene!==scenes[game.sceneIndex]?.image ||
        game.matched.length!==game.pairs.length ||
        game.sceneIndex>=scenes.length-1)return;
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
