// Reproducible Chinese word segmentation: words, not arbitrary sentence chunks.
// Use Node 20+ (Intl.Segmenter), with protected lesson vocabulary and compound nouns.
// This source is used to generate all sentence parts and quest compose tokens.
const EXTRA_WORDS=[
  "安全感",
  "垃圾桶",
  "留学生",
  "感兴趣",
  "有意思",
  "幽默感",
  "复印件",
  "二维码",
  "学生证",
  "工作日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期天",
  "星期日",
  "星期几",
  "卫生间",
  "一次性",
  "有点儿",
  "租房",
  "有的是",
  "没关系",
  "对不起",
  "什么时候",
  "越来越",
  "这样",
  "那样",
  "这些",
  "那些",
  "这个",
  "那个",
  "这里",
  "那里",
  "哪儿",
  "那儿",
  "哪个",
  "哪些",
  "这儿",
  "一下子",
  "一点儿",
  "一会儿",
  "一起",
  "安娜",
  "小林",
  "李文",
  "北京",
  "上海",
  "广州",
  "哈尔滨",
  "阳光",
  "可爱",
  "明白",
  "觉得",
  "天气",
  "周日",
  "学生",
  "朋友",
  "学校",
  "周围",
  "家里",
  "正在",
  "屋里",
  "网上",
  "今天",
  "明天",
  "昨天",
  "上周",
  "下周",
  "最近",
  "现在",
  "以后",
  "以前",
  "之前",
  "之后",
  "时候",
  "早上",
  "晚上",
  "中午",
  "下午",
  "上午",
  "平时",
  "平常",
  "大家",
  "他们",
  "我们",
  "你们",
  "她们",
  "一直",
  "已经",
  "还是",
  "可能",
  "从来",
  "后来",
  "刚才",
  "原来",
  "其实",
  "当然",
  "没有",
  "不要",
  "不用",
  "不会",
  "不能",
  "不太",
  "没事",
  "一样",
  "工作",
  "生活",
  "感觉",
  "路上",
  "开始",
  "应该",
  "这么",
  "那么",
  "很多",
  "每天",
  "每年",
  "自己",
  "收到",
  "但是",
  "因为",
  "所以",
  "如果",
  "虽然",
  "尽管",
  "任何",
  "知道",
  "了解",
  "真的",
  "需要",
  "喜欢",
  "回来",
  "出去",
  "一下",
  "来得及",
  "好像",
  "那时候",
  "首先",
  "请问",
  "小伙子",
  "休息",
  "放松",
  "失去",
  "遇到",
  "遇见",
  "情况",
  "认识",
  "坚持",
  "完成",
  "等等",
  "进去",
  "出来",
  "很好",
  "也许",
  "这样一来",
  "看起来",
  "没错",
  "还好",
  "做事",
  "可以",
  "学习",
  "跑步",
  "喝水",
  "吃饭",
  "写字",
  "读书",
  "买菜",
  "骑车",
  "玩玩",
  "画画",
  "说说",
  "看看",
  "想想",
  "尝尝",
  "问问",
  "走走",
  "课程表",
  "水电费",
  "购物车",
  "小心",
  "交换",
  "互相",
  "比较",
  "较低",
  "用完",
  "陌生人",
  "注意",
  "生长",
  "因此",
  "零下",
  "十字路口",
  "流行性感冒",
  "父母",
  "保护",
  "开会",
  "有时",
  "关心",
  "感谢",
  "头疼",
  "睡觉",
  "电话",
  "号码",
  "一次",
  "校园",
  "新鲜",
  "各种各样",
  "风景",
  "练习",
  "不好意思",
  "服务员",
  "快递员",
  "工作人员",
  "人员",
  "教学楼",
  "办公室",
  "用品",
  "其他",
  "名字",
  "有名",
  "链接",
  "记得",
  "公交车",
  "遮阳帽",
  "客人",
  "座位卡",
  "入座",
  "招呼",
  "安全性",
  "传染性",
  "负责人",
  "服务台",
  "收银员",
  "国际部",
  "电话号码",
  "手机号码",
  "书包",
  "热心",
  "意思",
  "来历",
  "不明",
  "昨晚",
  "孩子",
  "这边",
  "多少",
  "鞋子",
  "天气预报",
  "研究生",
  "老师",
  "差不多",
  "商店",
  "包裹",
  "新家",
  "路口",
  "快递",
  "送货",
  "一定",
  "身份证",
  "终于",
  "中国",
  "晴天",
  "交通费",
  "午餐",
  "介绍",
  "道理",
  "年长",
  "讲座",
  "什么",
  "为什么",
  "怎么",
  "怎么样",
  "哪里",
  "休息室",
  "爱好",
  "故事",
  "衣服",
  "餐厅"
];
const SPLIT_MAP={
  "觉得很": [
    "觉得",
    "很"
  ],
  "聚在一起": [
    "聚",
    "在",
    "一起"
  ],
  "出示证件": [
    "出示",
    "证件"
  ],
  "有些人": [
    "有些",
    "人"
  ],
  "一本书": [
    "一",
    "本",
    "书"
  ],
  "原来是": [
    "原来",
    "是"
  ],
  "不太好": [
    "不",
    "太",
    "好"
  ],
  "一道菜": [
    "一",
    "道",
    "菜"
  ],
  "这点儿": [
    "这",
    "点儿"
  ],
  "两道菜": [
    "两",
    "道",
    "菜"
  ],
  "各付各的": [
    "各",
    "付",
    "各",
    "的"
  ],
  "尤其是": [
    "尤其",
    "是"
  ],
  "才回来": [
    "才",
    "回来"
  ],
  "改一改": [
    "改",
    "一",
    "改"
  ],
  "越来越好": [
    "越来越",
    "好"
  ],
  "想出去": [
    "想",
    "出去"
  ],
  "只要能": [
    "只要",
    "能"
  ],
  "好主意": [
    "好",
    "主意"
  ],
  "一路上": [
    "一路",
    "上"
  ],
  "最好能": [
    "最好",
    "能"
  ],
  "好朋友": [
    "好",
    "朋友"
  ],
  "从来没": [
    "从来",
    "没"
  ],
  "我想去": [
    "我",
    "想",
    "去"
  ],
  "真受不了": [
    "真",
    "受不了"
  ],
  "吃不完": [
    "吃",
    "不",
    "完"
  ],
  "节约用水": [
    "节约",
    "用水"
  ],
  "日常生活": [
    "日常",
    "生活"
  ],
  "一部分": [
    "一",
    "部分"
  ],
  "住在": [
    "住",
    "在"
  ],
  "打电话": [
    "打",
    "电话"
  ],
  "走到": [
    "走",
    "到"
  ],
  "一下子": [
    "一下子"
  ],
  "一个": [
    "一",
    "个"
  ],
  "我想": [
    "我",
    "想"
  ],
  "都会": [
    "都",
    "会"
  ],
  "带我": [
    "带",
    "我"
  ],
  "今天的": [
    "今天",
    "的"
  ],
  "夜里的": [
    "夜里",
    "的"
  ],
  "很有": [
    "很",
    "有"
  ],
  "放在": [
    "放",
    "在"
  ],
  "改得": [
    "改",
    "得"
  ],
  "他们要": [
    "他们",
    "要"
  ],
  "看到": [
    "看",
    "到"
  ],
  "想到": [
    "想",
    "到"
  ],
  "把我": [
    "把",
    "我"
  ],
  "开始做": [
    "开始",
    "做"
  ],
  "事情办": [
    "事情",
    "办"
  ],
  "老师说": [
    "老师",
    "说"
  ],
  "那天": [
    "那",
    "天"
  ],
  "这天": [
    "这",
    "天"
  ],
  "一天": [
    "一",
    "天"
  ],
  "想去": [
    "想",
    "去"
  ],
  "我来": [
    "我",
    "来"
  ],
  "他来": [
    "他",
    "来"
  ],
  "再来": [
    "再",
    "来"
  ],
  "套房": [
    "套",
    "房"
  ],
  "寄给": [
    "寄",
    "给"
  ],
  "管好": [
    "管",
    "好"
  ],
  "快到": [
    "快",
    "到"
  ],
  "降到": [
    "降",
    "到"
  ],
  "多忙": [
    "多",
    "忙"
  ],
  "又有": [
    "又",
    "有"
  ],
  "但有": [
    "但",
    "有"
  ],
  "想说": [
    "想",
    "说"
  ],
  "我们要": [
    "我们",
    "要"
  ],
  "我觉得": [
    "我",
    "觉得"
  ],
  "那就": [
    "那",
    "就"
  ],
  "我还": [
    "我",
    "还"
  ]
};
const PREFIX_CHARS="我你他她它这那有没别只都也还就再先要能会很太最更真一两三四五六七八九十不给和跟在从向往是被把得了到来去才请以想看听说却";
const SUFFIX_CHARS="我你他她它得了着在";
function makeTokenizer(dictionaryWords) {
 const names=new Set([...dictionaryWords.filter(w=>w.length>=2),...EXTRA_WORDS]);
 const byChar=new Map();
 for(const word of names){
  if(!/^[\p{Script=Han}]+$/u.test(word))continue;
  const initial=word[0];
  if(!byChar.has(initial))byChar.set(initial,[]);
  byChar.get(initial).push(word);
 }
 for(const choices of byChar.values())choices.sort((a,b)=>b.length-a.length || a.localeCompare(b));
 const seg=new Intl.Segmenter("zh-Hans",{granularity:"word"});
 const prefix=new Set([...PREFIX_CHARS]),suffix=new Set([...SUFFIX_CHARS]);
 function repair(word,depth=0) {
  if(!word||depth>12)return [word];
  if(SPLIT_MAP[word])return SPLIT_MAP[word];
  if(names.has(word)||word.length===1)return [word];
  if(word.length===2) return (prefix.has(word[0])||suffix.has(word[1]))?[...word]:[word];
  const items=[];let rest=word;
  while(rest){
   const candidate=(byChar.get(rest[0])||[]).find(w=>rest.startsWith(w)&&w.length<rest.length)||rest[0];
   items.push(candidate);rest=rest.slice(candidate.length);
  }
  return items.length===1?[word]:items.flatMap(w=>repair(w,depth+1));
 }
 return function tokenize(sentence) {
  const raw=[];let buffer="";
  const flush=()=>{
   if(!buffer)return;
   for(const item of seg.segment(buffer)){
    const token=item.segment;
    raw.push(...(/^[\p{Script=Han}]+$/u.test(token)?repair(token):[token]));
   }
   buffer="";
  };
  for(let at=0;at<sentence.length;){
   const protect=(byChar.get(sentence[at])||[]).find(w=>sentence.startsWith(w,at));
   if(protect){flush();raw.push(protect);at+=protect.length;}
   else{buffer+=sentence[at];at++;}
  }
  flush();
  const out=[];let leading="";
  for(const token of raw){
   if(!token)continue;
   if(/^[^\p{Script=Han}\p{Letter}\p{Number}]+$/u.test(token)){
    if(/[“‘（《【「『(\[]/.test(token)||!out.length)leading+=token;
    else out[out.length-1]+=token;
   }else{out.push(leading+token);leading="";}
  }
  if(leading)out.length?out[out.length-1]+=leading:out.push(leading);
  return out;
 };
}
function rewriteLesson(lesson, tokenizer) {
 const problems=[],audits={changedSentenceParts:0,oldParts:0,newParts:0,extraVariantsPreserved:0,composeSteps:0,oldComposeTokens:0,newComposeTokens:0};
 const sameTokens=(a,b)=>a.length===b.length && JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
 const ending=(s)=>(s.match(/[。！？?!]+$/u)||[])[0]||"";
 const clean=s=>String(s).replace(/[^\p{Script=Han}\p{Letter}\p{Number}]/gu,"");
 for(const [j,s] of lesson.sentences.entries()){
  const oldParts=s.parts,oldVariants=s.variants||[oldParts],newParts=tokenizer(s.zh);
  if(newParts.join("")!==s.zh)problems.push(`L${lesson.id} S${j+1}: reconstruction failure`);
  if(newParts.length>1)audits.changedSentenceParts += JSON.stringify(newParts)!==JSON.stringify(oldParts)?1:0;
  audits.oldParts+=oldParts.length;audits.newParts+=newParts.length;
  const variants=[newParts];
  for(const old of oldVariants){
   let alt=old.join("");
   if(clean(alt)===clean(s.zh))continue; // Ignore obsolete variants differing only in punctuation.
   if(ending(s.zh)&&!/[。！？?!]$/u.test(alt))alt+=ending(s.zh);
   const candidate=tokenizer(alt);
   if(!sameTokens(newParts,candidate)){
    problems.push(`L${lesson.id} S${j+1} alternative tile mismatch: ${JSON.stringify(candidate)} vs ${JSON.stringify(newParts)}`);
   }else if(!variants.some(v=>v.join("")===candidate.join(""))){
    variants.push(candidate);audits.extraVariantsPreserved++;
   }
  }
  s.parts=newParts;s.variants=variants;
 }
 for(const [j,step] of lesson.quest.steps.entries())if(step.type==="compose"){
  audits.composeSteps++;audits.oldComposeTokens+=step.tokens.length;
  const oldAnswers=step.answers||[step.tokens];
  const principal=tokenizer(step.tokens.join(""));
  if(principal.join("")!==step.tokens.join(""))problems.push(`L${lesson.id} compose ${j+1}: original reconstruction`);
  const rewritten=[];
  for(const original of oldAnswers){
   const candidate=tokenizer(original.join(""));
   if(!sameTokens(principal,candidate)) problems.push(`L${lesson.id} compose ${j+1}: alternative tile mismatch`);
   else if(!rewritten.some(x=>x.join("")===candidate.join("")))rewritten.push(candidate);
  }
  step.tokens=principal;step.answers=rewritten;
  audits.newComposeTokens+=principal.length;
 }
 return {lesson,audits,problems};
}
export {makeTokenizer,rewriteLesson};
