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
  const TIME = new Set(['今天','明天','昨天','后天','现在','早上','上午','中午','下午','晚上','今晚','明早','明晚','周末','下周','下个月','明年','今年','去年']);
  const SUBJECT = new Set(['我','你','您','他','她','我们','你们','他们','她们','大家','老师','同学']);
  const INTENTION = new Set(['打算','想','准备','要']);
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
    const output=[];
    const clean=parts.map(pure);
    const pushOrder=order=>{
      // Keep punctuation attached to the last tile so the display stays tidy.
      const tokens=order.map(i=>parts[i]);
      if(!sameBag(parts,tokens))return;
      output.push(tokens);
    };
    if(clean.length<4)return output;
    // 今天我工作 / 我今天工作: moving a fronted time expression around
    // a simple subject is grammatical without changing the proposition.
    if(TIME.has(clean[0])&&SUBJECT.has(clean[1])){
      pushOrder([1,0,...clean.slice(2).map((_,i)=>i+2)]);
    } else if(SUBJECT.has(clean[0])&&TIME.has(clean[1])){
      pushOrder([1,0,...clean.slice(2).map((_,i)=>i+2)]);
      // 我明天打算下载... / 我打算明天下载... have the same intent.
      if(INTENTION.has(clean[2])&&clean.length>4)
        pushOrder([0,2,1,...clean.slice(3).map((_,i)=>i+3)]);
    } else if(SUBJECT.has(clean[0])&&INTENTION.has(clean[1])&&TIME.has(clean[2])){
      pushOrder([0,2,1,...clean.slice(3).map((_,i)=>i+3)]);
      pushOrder([2,0,1,...clean.slice(3).map((_,i)=>i+3)]);
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
    for(const variant of [...variants])for(const alternative of generatedTimeVariants(variant))add(alternative);
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
  global.ChineseLabSentenceCoach=Object.freeze({allowedWords,translations,segment,prepareQuestion,accepted,diagnose,hint,pure,normalize,generatedTimeVariants});
})(window);
