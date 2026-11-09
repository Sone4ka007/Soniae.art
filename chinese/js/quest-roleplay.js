(function(global){
  'use strict';
  // A rule-based local conversation trainer. No external AI service or invented
  // "free understanding" claims: feedback checks meaningful Chinese phrases.
  const missions=[
    {id:'purpose',title:'ЗАЧЕМ ТЫ ПРИШЛА?',goal:'Объясни, что хочешь подать заявку на стипендию.',
      teacher:'你好！你需要什么帮助？',teacherRu:'Здравствуйте! Чем могу помочь?',
      sample:'我想申请奖学金。',tiles:['我','想','申请','奖学金','。'],
      require:[['奖学金'],['申请','想要','获得','需要','想拿']],
      problem:'Преподавательница ждёт, что ты назовёшь стипендию и объяснишь, что хочешь её получить или оформить.',
      reply:'好的，申请奖学金需要一些材料。',replyRu:'Хорошо. Для подачи заявления на стипендию понадобятся некоторые документы.',
      keywords:['申请','奖学金','材料']},
    {id:'major',title:'РАССКАЖИ ОБ УЧЁБЕ',goal:'Скажи, что твоя специальность — международная торговля.',
      teacher:'你是什么专业的？',teacherRu:'Какая у тебя специальность?',
      sample:'我的专业是国际贸易。',tiles:['我','的','专业','是','国际贸易','。'],
      require:[['国际贸易']],
      problem:'Назови направление 国际贸易 (международная торговля). Можно говорить своими словами.',
      reply:'你是国际贸易专业的硕士研究生。欢迎你来我们学校！',replyRu:'Значит, ты магистрантка по международной торговле. Добро пожаловать в наш университет!',
      keywords:['专业','国际','贸易','研究生','硕士']},
    {id:'reason',title:'ОБЪЯСНИ ПРИЧИНУ',goal:'Объясни, что стипендия поможет уменьшить финансовую нагрузку на семью.',
      teacher:'你为什么想申请奖学金？',teacherRu:'Почему ты хочешь получить стипендию?',
      sample:'我想减轻家里的经济压力。',tiles:['我','想','减轻','家里','的','经济','压力','。'],
      require:[['压力'],['经济','减轻','家里','家庭']],
      problem:'Поясни финансовую нагрузку: используй 压力 и хотя бы одно из слов 经济 / 减轻 / 家里.',
      reply:'我明白了。奖学金可以减轻经济压力。加油！',replyRu:'Понимаю. Стипендия может облегчить финансовое давление. Удачи!',
      keywords:['经济','压力','减轻','加油','奖学金']},
    {id:'papers',title:'ОБЪЯСНИ ПРОБЛЕМУ',goal:'Скажи, что не можешь найти университетский документ.',
      teacher:'你的材料准备好了吗？签证和学校给你的证件呢？',teacherRu:'Документы готовы? Ты принесла визу и удостоверение, которое выдал университет?',
      sample:'我的证件找不到了。',tiles:['我','的','证件','找不到','了','。'],
      require:[['证件','证'],['找不到','不见','丢','没找到','没有','忘带','忘记']],
      problem:'Назови 证件 (удостоверение) и объясни, что его нет: 找不到 / 不见 / 没有.',
      reply:'先别着急。你再找找吧！证件和入学通知都很重要。',replyRu:'Не волнуйся. Поищи ещё! Удостоверение и уведомление о зачислении очень важны.',
      keywords:['证件','证','材料','通知','入学','签证']},
    {id:'deadline',title:'УЗНАЙ СРОК',goal:'Самостоятельно спроси, до какого времени сегодня принимают документы.',
      teacher:'还有什么问题吗？',teacherRu:'У тебя остались вопросы?',
      sample:'请问，今天几点以前要把材料给您？',tiles:['请问','今天','几点','以前','要','交','材料','？'],
      require:[['几点','什么时候','时间','多久','截止','到几点'],['材料','申请','奖学金','交','结束','可以']],
      problem:'Спроси о времени: используй 几点 / 什么时候 / 时间 и уточни, о какой подаче идёт речь.',
      reply:'今天下午五点以前，要把材料给我。现在是两点半。',replyRu:'Нужно принести документы сегодня до 17:00. Сейчас 14:30.',
      keywords:['材料','申请','奖学金','时间']}
  ];
  const byId=Object.fromEntries(missions.map(m=>[m.id,m]));
  function normalize(s){return String(s||'').normalize('NFKC').replace(/[\s\u3000，,。？！?!；;：:、\"“”‘’'（）()]/g,'');}
  function evaluate(id,response){
    const m=byId[id];if(!m)return {ok:false,reason:'Неизвестная ситуация.'};
    const text=normalize(response);
    if(text.length<3)return {ok:false,reason:'Составь китайскую реплику и попробуй снова.'};
    // Asking for repetition or slower speech is successful communication,
    // not a wrong answer and not a completed scholarship application.
    if(/再说一遍|再讲一遍|重复一遍|没听懂|不太明白|说慢一点|慢一点说/.test(text)){
      const slow=/慢一点/.test(text);
      return {ok:false,clarified:true,
        reply:(slow?'好的，我说慢一点。':'没问题，我再说一次。')+m.teacher,
        replyRu:(slow?'Хорошо, скажу медленнее: ':'Конечно, повторю: ')+m.teacherRu,
        reason:'Ты попросила повторить или уточнить вопрос. Теперь можешь ответить.'};
    }
    if(m.id==='purpose'&&/不想申请|不申请|不要申请|不需要奖学金/.test(text)){
      return {ok:false,reply:'你不想申请奖学金吗？那你想问什么？',
        replyRu:'Вы не хотите подавать заявку на стипендию? Тогда какой у вас вопрос?',
        reason:'Это отрицание — преподавательница поняла, что ты не собираешься подавать заявку. Уточни намерение.'};
    }
    const hit=m.require.every(group=>group.some(token=>text.includes(token)));
    const negatives={
      purpose:[/不想申请奖学金/,/不申请奖学金/,/不要奖学金/,/不需要奖学金/],
      major:[/不是.{0,3}国际贸易/,/不学国际贸易/],
      reason:[/没有经济压力/,/不想减轻.{0,4}压力/],
      papers:[/证件找到了/,/证件在这里/,/证件带来了/]
    };
    const contradicted=(negatives[id]||[]).some(re=>re.test(text));
    return hit&&!contradicted?{ok:true,reply:m.reply,replyRu:m.replyRu,keywords:m.keywords}:
      {ok:false,reply:'不好意思，我没听懂。你可以再说一次吗？',replyRu:'Извини, я не поняла. Можешь сказать ещё раз?',reason:m.problem};
  }

  // A separate conversation for lesson 2. Keep lesson 1's established
  // scholarship conversation unchanged.
  const rentalMissions=[
    {id:'purpose',title:'ЗАЧЕМ ТЫ ПРИШЛА?',goal:'Скажи хозяйке, что хочешь посмотреть квартиру и, возможно, снять её.',
      teacher:'你好！你来看房子吗？',teacherRu:'Здравствуйте! Пришли посмотреть квартиру?',
      sample:'你好，我想看看这个房子。',tiles:['你好，','我','想','看看','这个','房子','。'],
      require:[['房子','房'],['看','租']],problem:'Назови жильё и скажи, что хочешь его посмотреть или арендовать.',
      reply:'好的，请进来看看吧。客厅很亮。',replyRu:'Хорошо, проходи и осматривайся. В гостиной светло.',
      keywords:['租','房东','客厅','亮']},
    {id:'price',title:'СПРОСИ О ЦЕНЕ',goal:'Самостоятельно спроси, сколько стоит аренда в месяц.',
      teacher:'你觉得这个房子怎么样？',teacherRu:'Как тебе квартира?',
      sample:'请问，房租每个月多少钱？',tiles:['请问，','房租','每个月','多少钱','？'],
      require:[['房租','价格'],['多少','多少钱','三千']],problem:'Спроси о стоимости: 房租 или 价格, затем 多少.',
      reply:'房租每个月三千元。',replyRu:'Аренда — 3000 юаней в месяц.',
      keywords:['房租','价格','出租']},
    {id:'quiet',title:'УЗНАЙ О ВЕЧЕРНЕМ ШУМЕ',goal:'Спроси, насколько здесь шумно по вечерам. Это важно для учёбы.',
      teacher:'你平常晚上做什么？',teacherRu:'Что ты обычно делаешь по вечерам?',
      sample:'我平常晚上学习。请问，这里晚上热闹吗？',
      tiles:['我','平常','晚上','学习','。','请问，','这里','晚上','热闹','吗？'],
      require:[['晚上'],['热闹','安静']],problem:'Спроси, бывает ли по вечерам шумно: 晚上 + 热闹 / 安静.',
      reply:'晚上有时候很热闹。你可以晚上再来看看。',
      replyRu:'Иногда здесь оживлённо по вечерам. Можешь прийти и проверить вечером.',
      keywords:['平常','热闹','课程','周围']},
    {id:'move',title:'УТОЧНИ ЗАСЕЛЕНИЕ',goal:'Спроси хозяйку, когда можно въехать в квартиру.',
      teacher:'还有什么问题吗？',teacherRu:'Есть ещё вопросы?',
      sample:'请问，什么时候可以入住？',tiles:['请问，','什么时候','可以','入住','？'],
      require:[['入住'],['什么时候','下个星期','可以','哪天']],problem:'Спроси именно о заселении, используя 入住 и вопрос о времени.',
      reply:'下个星期就可以入住。不过你先想一想。',
      replyRu:'Заселиться можно на следующей неделе. Но сначала подумай, подходит ли тебе жильё.',
      keywords:['入住','建议','顺利']}
  ];
  const rentalById=Object.fromEntries(rentalMissions.map(m=>[m.id,m]));
  function evaluateRental(id,response){
    const m=rentalById[id];
    if(!m)return {ok:false,reason:'Неизвестная ситуация.'};
    const t=normalize(response);
    if(t.length<3)return {ok:false,reason:'Скажи что-нибудь по-китайски или открой подсказку.'};
    if(/再说一遍|再讲一遍|重复一遍|没听懂|不太明白|说慢一点|慢一点说/.test(t))
      return {ok:false,clarified:true,reply:'好的，我再说一次。'+m.teacher,
        replyRu:'Конечно, повторю: '+m.teacherRu,reason:'Ты попросила повторить вопрос. Теперь можешь на него ответить.'};
    if((id==='purpose'&&/不想(租|看)|不租|不看房/.test(t))||
       (id==='move'&&/不想入住|不能入住/.test(t)))
      return {ok:false,reply:'不好意思，你想问什么？',replyRu:'Извините, тогда что бы вы хотели узнать?',reason:'Сейчас ответ означает отказ. Сформулируй нужный вопрос.'};
    const ok=m.require.every(group=>group.some(word=>t.includes(word)));
    return ok?{ok:true,reply:m.reply,replyRu:m.replyRu,keywords:m.keywords}:
      {ok:false,reply:'不好意思，我没听懂。你可以再说一次吗？',
        replyRu:'Извините, я не поняла. Можете сказать иначе?',reason:m.problem};
  }
  const rentalEngine=Object.freeze({
    missions:Object.freeze(rentalMissions.map(m=>Object.freeze(m))),
    byId:(id)=>rentalById[id]||null,normalize,evaluate:evaluateRental
  });
  global.ChineseLabRoleplay=Object.freeze({
    missions:Object.freeze(missions.map(m=>Object.freeze(m))),
    byId:(id)=>byId[id]||null,
    normalize,evaluate,
    forLesson:(id)=>Number(id)===2?rentalEngine:(global.ChineseLabExtraRoleplay?.forLesson(id)||global.ChineseLabRoleplay)
  });
})(typeof window!=='undefined'?window:globalThis);
