(function(global){
 'use strict';
 // Scenario-specific rule-based conversation. No claim of free AI understanding:
 // accept meaningful Chinese patterns, reject contradictory or unrelated input.
 const sets={
  3:[
   {id:'purpose',title:'ЗАКАЖИ КОФЕ',goal:'Самостоятельно скажи, что хочешь купить кофе.',
    teacher:'你好！你想买什么？',teacherRu:'Здравствуйте! Что хотите купить?',
    sample:'你好，我想买咖啡。',tiles:['你好，','我','想','买','咖啡','。'],
    require:[['咖啡'],['买','想','要']],problem:'Назови кофе и намерение купить или заказать его.',
    reply:'好的。你还想买什么？',replyRu:'Хорошо. Хотите ещё что-нибудь?',
    keywords:['购物','买','咖啡']},
   {id:'price',title:'УТОЧНИ СУММУ',goal:'Спроси, сколько всего нужно заплатить за покупку.',
    teacher:'你想现在结账吗？',teacherRu:'Хотите сейчас оплатить?',
    sample:'请问，一共多少钱？',tiles:['请问，','一共','多少钱','？'],
    require:[['多少','价格','钱'],['一共','咖啡','结账','多少']],
    problem:'Спроси итоговую стоимость: 一共多少钱？',
    reply:'一共三十八元。',replyRu:'Всего 38 юаней.',
    keywords:['结账','支付','现金']},
   {id:'payment',title:'ВЫБЕРИ СПОСОБ ОПЛАТЫ',goal:'Узнай, можно ли оплатить через WeChat, Alipay или наличными.',
    teacher:'一共三十八元。你想怎么支付？',teacherRu:'Всего 38 юаней. Как хотите платить?',
    sample:'请问，可以用支付宝支付吗？',
    tiles:['请问，','可以','用','支付宝','支付','吗？'],
    require:[['支付宝','微信','现金'],['支付','结账','付款','用']],
    problem:'Назови способ оплаты: 支付宝 / 微信 / 现金, и уточни, можно ли так платить.',
    reply:'可以。微信、支付宝、现金都可以。',
    replyRu:'Да. WeChat, Alipay и наличные подходят.',
    keywords:['支付宝','微信','现金','支付']},
   {id:'check',title:'ПРОВЕРЬ QR-КОД',goal:'Уточни у сотрудника, можно ли сканировать код для оплаты.',
    teacher:'这里可以扫码支付。',teacherRu:'Здесь можно платить через QR-код.',
    sample:'请问，这里可以扫码支付吗？',
    tiles:['请问，','这里','可以','扫码','支付','吗？'],
    require:[['扫码'],['支付','结账'],['可以','能','吗']],
    problem:'Задай вопрос о QR-оплате: 可以 + 扫码支付 + 吗？',
    reply:'可以。不过，先看看价格，再扫码。',
    replyRu:'Можно. Но сначала проверьте сумму, затем сканируйте код.',
    keywords:['扫码','技术','支付']}
  ],
  4:[
   {id:'purpose',title:'ОБЪЯСНИ, КУДА ЕДЕШЬ',goal:'Скажи пассажирке, что хочешь в университет, но пока не можешь купить билет.',
    teacher:'你好！你需要帮助吗？',teacherRu:'Здравствуйте! Вам нужна помощь?',
    sample:'我想去学校，但是我没有车票。',
    tiles:['我','想','去','学校','，','但是','我','没有','车票','。'],
    require:[['学校','地铁','车票'],['去','买','没有','想']],
    problem:'Назови поездку в университет или проблему с билетом.',
    reply:'你想买票吗？',replyRu:'Вам нужно купить билет?',
    keywords:['出行','乘客','购买']},
   {id:'phone',title:'ОБЪЯСНИ ПРОБЛЕМУ С ТЕЛЕФОНОМ',goal:'Расскажи, что в телефоне нет связи и у тебя нет наличных.',
    teacher:'你为什么不买票？',teacherRu:'Почему вы не покупаете билет?',
    sample:'我的手机没有信号，也没有现金。',
    tiles:['我','的','手机','没有','信号','，','也','没有','现金','。'],
    require:[['手机'],['没有','不能'],['信号','现金','费']],
    problem:'Скажи, что телефон не работает (手机没有信号) или что нет денег (没有现金).',
    reply:'我明白了。你可以先看看那边。',
    replyRu:'Понимаю. Сначала посмотрите в ту сторону.',
    keywords:['信号','费','停']},
   {id:'help',title:'ПОПРОСИ ПОМОЧЬ С БИЛЕТОМ',goal:'Попроси пассажирку объяснить покупку или помочь купить билет.',
    teacher:'我可以帮你。你需要什么？',teacherRu:'Я могу помочь. Что вам нужно?',
    sample:'请问，您能帮我买票吗？',
    tiles:['请问，','您','能','帮','我','买票','吗？'],
    require:[['帮','帮助'],['买票','车票','购买']],
    problem:'Попроси помочь именно с билетом: 帮我买票.',
    reply:'好的，我们先看看怎么买票。',replyRu:'Хорошо, сначала посмотрим, как приобрести билет.',
    keywords:['帮助','购买','车票']},
   {id:'thanks',title:'ПОБЛАГОДАРИ',goal:'Поблагодари женщину за помощь с билетом.',
    teacher:'你还有什么问题吗？',teacherRu:'У вас остались вопросы?',
    sample:'非常感谢您的帮助！',
    tiles:['非常','感谢','您','的','帮助','！'],
    require:[['谢谢','感谢'],['您','你','帮','帮助']],
    problem:'Скажи спасибо за помощь, например 非常感谢您的帮助！',
    reply:'别客气！希望你来得及上车。',
    replyRu:'Не за что! Надеюсь, вы успеете на поезд.',
    keywords:['感谢','客气','来得及']}
  ]
 };
 function make(id){
  const missions=sets[id],byId=Object.fromEntries(missions.map(m=>[m.id,m]));
  function normalize(s){return String(s||'').normalize('NFKC').replace(/[\s\u3000，,。？！?!；;：:、"“”‘’'（）()]/g,'');}
  function evaluate(id,response){
   const m=byId[id];if(!m)return {ok:false,reason:'Неизвестная ситуация.'};
   const t=normalize(response);
   if(t.length<3)return {ok:false,reason:'Составь реплику по-китайски или открой подсказку.'};
   if(/再说一遍|再讲一遍|重复一遍|没听懂|不太明白|说慢一点|慢一点说/.test(t))
    return {ok:false,clarified:true,reply:'好的，我再说一次。'+m.teacher,
     replyRu:'Повторю: '+m.teacherRu,reason:'Ты попросила повторить. Теперь можешь ответить.'};
   const negative3=id==='purpose'&&/不想买咖啡|不要咖啡|不买咖啡/.test(t);
   const negative4=(id==='phone'&&/(?:^|[^没])有信号|(?:^|[^没])有现金|手机可以用/.test(t))||
       (id==='help'&&/不需要帮助|不用帮|不要买票/.test(t));
   const ok=m.require.every(group=>group.some(token=>t.includes(token)));
   if(ok&&!negative3&&!negative4)
    return {ok:true,reply:m.reply,replyRu:m.replyRu,keywords:m.keywords};
   return {ok:false,reply:'不好意思，我没听懂。你可以再说一次吗？',
    replyRu:'Извините, не поняла. Можете сказать иначе?',reason:m.problem};
  }
  return Object.freeze({
   missions:Object.freeze(missions.map(m=>Object.freeze(m))),
   byId:(id)=>byId[id]||null,normalize,evaluate
  });
 }
 const engines=Object.freeze({3:make(3),4:make(4)});
 global.ChineseLabExtraRoleplay=Object.freeze({forLesson:id=>engines[id]||null});
})(typeof window!=='undefined'?window:globalThis);