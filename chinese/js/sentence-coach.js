/* Sentence practice: level-safe vocabulary, tested word order, and useful feedback.
 * The course content is NOT rewritten; unsuitable questions are excluded at runtime.
 */
(function (global) {
  'use strict';
  const HAN = /[\u3400-\u9fff]/u;
  const pure = text => String(text??'').replace(/[^\u3400-\u9fff]/gu,'');
  const normalize = parts => (Array.isArray(parts)?parts.join(''):String(parts??'')).replace(/[^\u3400-\u9fff]/gu,'');
  const sameBag = (a,b) => a.length===b.length &&
    a.map(pure).sort().join('\u0000')===b.map(pure).sort().join('\u0000');
  const TIME = new Set(['今天','明天','昨天','后天','现在','早上','上午','中午','下午','晚上','今晚','明早','明晚','周末','下周','下个月','明年','今年','去年','最近','以前','以后','刚才','每天','平时','星期一','星期二','星期三','星期四','星期五','星期六','星期日','星期天','下星期','上星期','这星期','上周','明天','今天','工作日']);
  const DAY = new Set(['今天','明天','昨天','后天','这星期','上星期','下星期','工作日','周末']);
  const PERIOD = new Set(['早上','上午','中午','下午','晚上','夜里']);
  const SUBJECT = new Set(['我','你','您','他','她','我们','你们','他们','她们','大家','老师','同学','安娜','小林','房东','学校','经理','医生','客人','朋友','爸爸','妈妈','姐姐','弟弟','学生','商家','地铁','司机','店员','服务员','快递员','老板','同事']);
  const KIN = new Set(['奶奶','爷爷','爸爸','妈妈','姐姐','妹妹','弟弟','哥哥','朋友']);
  const INTENTION = new Set(['打算','想','准备','要']);
  function timeLength(words,i) {
    if(!TIME.has(words[i]))return 0;
    return DAY.has(words[i]) && PERIOD.has(words[i+1]) ? 2 : 1;
  }
  function subjectLength(words,i) {
    if(SUBJECT.has(words[i])) {
      if(['我','你','他','她','我们'].includes(words[i])&&KIN.has(words[i+1]))return 2;
      return 1;
    }
    // Fixed nominal subjects. Never infer subject boundaries in arbitrary prose.
    if(['这','那'].includes(words[i]) && ['条','家'].includes(words[i+1]) &&
       ['街','店'].includes(words[i+2])) return 3;
    return 0;
  }
  function allowedWords(base,lessons,lessonId) {
    const known=new Set(Array.isArray(base)?base:[]);
    // 没 and 得 are standard HSK1–3 grammar forms, though the supplied base
    // may list only 没有 or compounds. These are not advanced vocabulary.
    known.add('没');known.add('得');
    for(const lesson of lessons||[]) if(lesson.id<=lessonId)
      for(const w of lesson.words||[]) known.add(w.hanzi);
    return known;
  }
  function translations(lessons,extra,context) {
    const map=new Map();
    for(const list of [...(lessons||[]).map(l=>l.words||[]),extra||[],context||[]]){
      for(const word of list)if(word?.hanzi && word?.ru && !map.get(word.hanzi)?.ru)map.set(word.hanzi,word);
    }
    return map;
  }
  function divideWord(token,known) {
    if(!token)return null;
    if(known.has(token))return [token];
    const dp=Array(token.length+1).fill(null);
    dp[token.length]=[];
    for(let i=token.length-1;i>=0;i--) {
      for(let j=token.length;j>i;j--){
        const word=token.slice(i,j);
        if(!known.has(word)||!dp[j])continue;
        const option=[word,...dp[j]];
        if(!dp[i]||option.length<dp[i].length)dp[i]=option;
      }
    }
    return dp[0];
  }
  function splitPart(part,known) {
    const m=String(part??'').match(/^([^\u3400-\u9fff]*)([\u3400-\u9fff]+)([^\u3400-\u9fff]*)$/u);
    if(!m)return null;
    const words=divideWord(m[2],known);
    if(!words)return null;
    return words.map((word,i)=>(i===0?m[1]:'')+word+(i===words.length-1?m[3]:''));
  }
  function segment(parts,known) {
    if(!Array.isArray(parts)||parts.length<2)return null;
    const result=[];
    for(const part of parts) {
      const pieces=splitPart(part,known);
      if(!pieces)return null;
      result.push(...pieces);
    }
    return result.length>=2?result:null;
  }
  function generatedTimeVariants(parts) {
    const words=parts.map(pure),output=[];
    // A comma belongs to its phrase and cannot be moved without editing
    // punctuation. Do not produce invalid variants by carrying it elsewhere.
    const safeMove=ids=>ids.every((original,newIndex)=>original===newIndex || !/[,，。！？!?:；;]/u.test(parts[original]||''));
    const push=indices=>{
      if(indices.length!==parts.length||!safeMove(indices))return;
      const next=indices.map(i=>parts[i]);
      if(sameBag(parts,next)&&normalize(parts)!==normalize(next))output.push(next);
    };
    if(words.length<4)return output;
    const tail=(from)=>Array.from({length:words.length-from},(_,i)=>i+from);
    const range=(from,count)=>Array.from({length:count},(_,i)=>from+i);
    const timeFirst=timeLength(words,0);
    if(timeFirst) {
      const subject=subjectLength(words,timeFirst);
      if(subject) {
        const end=timeFirst+subject;
        push([...range(timeFirst,subject),...range(0,timeFirst),...tail(end)]);
        if(INTENTION.has(words[end])&&end+1<words.length-1)
          push([...range(timeFirst,subject),end,...range(0,timeFirst),...tail(end+1)]);
      }
    }
    const subjectFirst=subjectLength(words,0);
    if(subjectFirst) {
      const timeAfterSubject=timeLength(words,subjectFirst);
      if(timeAfterSubject) {
        const end=subjectFirst+timeAfterSubject;
        push([...range(subjectFirst,timeAfterSubject),...range(0,subjectFirst),...tail(end)]);
        if(INTENTION.has(words[end])&&end+1<words.length-1)
          push([...range(0,subjectFirst),end,...range(subjectFirst,timeAfterSubject),...tail(end+1)]);
      }
      const intentionAt=subjectFirst;
      if(INTENTION.has(words[intentionAt])) {
        const afterIntention=timeLength(words,intentionAt+1);
        if(afterIntention && intentionAt+afterIntention+1<words.length-1) {
          const end=intentionAt+1+afterIntention;
          push([...range(0,subjectFirst),...range(intentionAt+1,afterIntention),intentionAt,...tail(end)]);
          push([...range(intentionAt+1,afterIntention),...range(0,subjectFirst),intentionAt,...tail(end)]);
        }
      }
    }
    return output;
  }
  function prepareQuestion(q,known,gloss) {
    if(!q?.ru||!q.zh)return null;
    const parts=segment(q.parts,known);
    if(!parts||normalize(parts)!==normalize(q.zh))return null;
    if(!parts.every(part=>{const word=pure(part);return known.has(word)&&!!gloss.get(word)?.ru;}))return null;
    const variants=[];const seen=new Set();
    const add=parts=>{
      if(!parts||!sameBag(parts,segment(q.parts,known)))return;
      const key=normalize(parts);
      if(!seen.has(key)){seen.add(key);variants.push(parts);}
    };
    add(parts);
    for(const original of q.variants||[])add(segment(original,known));
    // Generate only two tightly bounded, grammar-tested time patterns,
    // never arbitrary permutations. Other alternatives must be curated.
    // Closure over tightly constrained, reversible movements of time phrases.
    // New variants can enable an additional safe move: 明天我打算 -> 我打算明天.
    for(let i=0;i<variants.length && variants.length<32;i++)
      for(const alternative of generatedTimeVariants(variants[i]))add(alternative);
    return {...q,parts,variants};
  }
  function accepted(q,selected) {
    const attempt=normalize(selected);
    return (q.variants||[q.parts]).some(v=>normalize(v)===attempt);
  }
  function diagnose(q,selected) {
    const got=selected.map(pure);
    let winner=q.parts.map(pure),prefix=-1;
    for(const v of q.variants||[q.parts]) {
      const expected=v.map(pure);
      let correct=0;while(correct<expected.length && got[correct]===expected[correct])correct++;
      if(correct>prefix){prefix=correct;winner=expected;}
    }
    if(got.includes('会')&&got.includes('用')&&got.indexOf('会')>got.indexOf('用')&&winner.indexOf('会')<winner.indexOf('用'))
      return 'Здесь 会 — модальный глагол. Он должен стоять перед действием 用: «会用…». Попробуй передвинуть 会.';
    const next=winner[Math.max(0,prefix)];
    if(next) return (prefix?'Первые '+prefix+' слов(а) стоят верно. ':'')+
      'На позиции '+(prefix+1)+' попробуй поставить «'+next+'» вместо «'+(got[prefix]||'…')+'».';
    return 'Проверь порядок частей предложения. Можно открыть образец ответа или пропустить задание.';
  }
  function hint(q,selected,level) {
    const expected=q.parts.map(pure);
    const first=expected[0], second=expected[1];
    if(level===1)return 'Начни с «'+first+'». Затем «'+second+'». Не обязательно угадывать всё сразу.';
    if(level===2) {
      const n=Math.min(4,expected.length);
      return 'Первые '+n+' блока: '+expected.slice(0,n).join(' → ')+'. Остальное попробуй собрать самостоятельно.';
    }
    return 'Один правильный вариант: '+q.zh+' Можно прослушать его и перейти к следующему заданию.';
  }
  function noteCandidate(progress,lessonId,question,selected) {
    const answer=normalize(selected);
    if(!answer||!question?.zh||normalize(question.zh)===answer)return false;
    if(!progress || typeof progress!=='object')return false;
    const prior=Array.isArray(progress.sentenceSuggestions)?progress.sentenceSuggestions:[];
    if(prior.some(r=>r.lessonId===lessonId&&r.source===question.zh&&r.answer===answer))return false;
    progress.sentenceSuggestions=[...prior.slice(-49),{
      lessonId,source:question.zh,translation:question.ru||'',answer,
      at:new Date().toISOString(),status:'unverified'
    }];
    return true;
  }
  global.ChineseLabSentenceCoach=Object.freeze({allowedWords,translations,segment,prepareQuestion,accepted,diagnose,hint,pure,normalize,generatedTimeVariants,noteCandidate});
})(window);
