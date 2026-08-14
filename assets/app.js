const list=document.querySelector('#series-list');
const dialog=document.querySelector('#lightbox');
const dimg=dialog.querySelector('img');
const dtitle=dialog.querySelector('strong');
const dmeta=dialog.querySelector('span');

const chunkSets={};
const imageCache=new Map();

const seriesDescriptions={
  'duck-stories':'У моих родителей как-то завелись на участке испанские слизни. Они боролись с ними много лет, но безуспешно, и в итоге решили перейти к радикальным мерам: завести стаю индийских бегунков. Это такая порода вертикальных уток.\n\nВертикальные утки очень забавные: живут дружно, всё делают вместе, а в случае опасности убегают, совершенно не глядя под ноги. Зато со слизнями справляются прекрасно!',
  'cats':'«Котики» появились из эксперимента с чернилами. При работе по сырому чернила растекаются, и контролировать их довольно сложно. То, что должно было стать стаей пегих лошадей, сначала превратилось в гепарда «Котика», а следующая попытка уже в целую «ГорстьКотов».\n\nЯ всё ещё не теряю надежды сделать картину с лошадьми, поэтому, скорее всего, серия с котами будет пополняться.',
  'route':'Работы из серии «Творческий маршрут» были сделаны специально для одноимённой выставки в Москве. Я с большим удовольствием работала с техникой трафарета и делала своеобразные портреты зданий. При этом в их окнах тоже появляется жизнь.\n\nСерия стала победителем конкурса «Творческий маршрут».',
  'white-on-black':'Серия «Белым по чёрному» появилась после пленэров с Димой Горелышевым. Мне так понравился этот способ рисования, что ещё несколько дней я практически только им и занималась. Здесь я показываю наиболее удачные работы, которые получились из этого эксперимента.',
  'black-on-white':'После работы по чёрной бумаге возвращение к белой оказалось неожиданно сильным ощущением: я буквально заново испытала удовольствие от контраста чёрной туши и белого листа.\n\nОтдельное удовольствие для меня, деревья, похожие на контурные карты. Некоторые работы серии появились в графической мастерской Димы Горелышева из задания собрать пейзаж из разных артефактов-сокровищ.',
  'paradox-city':'«Парадоксальный город» это серия на бумаге, тонированной гуашью. В этом городе повсюду что-то не так, хотя это далеко не всегда заметно с первого взгляда.',
  'supermetal':'Серия появилась по итогам пленэра с Алёшей Гельдом в пространстве «Суперметалл». Здесь я, кажется, впервые использую цветную бумагу именно как самостоятельный материал, экспериментирую с композицией и цветом и получаю огромное удовольствие от самого процесса.'
};

const loadChunkedImage=id=>{
  if(!chunkSets[id]) return Promise.resolve(null);
  if(!imageCache.has(id)){
    imageCache.set(id,Promise.all(chunkSets[id].map(path=>fetch(path).then(r=>{
      if(!r.ok) throw new Error(`Не удалось загрузить ${path}`);
      return r.text();
    }))).then(parts=>`data:image/webp;base64,${parts.join('')}`));
  }
  return imageCache.get(id);
};

const resolveImage=work=>{
  if(work.id==='whiteblack-02') return 'assets/whiteblack-02-cropped.svg';
  if(work.id==='whiteblack-03') return 'assets/whiteblack-03-cropped.svg';
  return work.image;
};

const setOrientation=img=>{
  img.closest('.work').classList.add(img.naturalWidth>img.naturalHeight?'landscape':'portrait');
};

fetch('content/series.json')
  .then(r=>r.json())
  .then(series=>{
    series.forEach(s=>{
      const row=document.createElement('section');
      const visibleWorks=s.works.filter(w=>w.id!=='market-03');
      const description=seriesDescriptions[s.id]||s.description||'';
      row.innerHTML=`<div class="series-row"><span class="number">${s.number}</span><h3>${s.title}</h3><p>${description}</p><span class="year">${s.year}<br>＋</span></div><div class="series-content"><div class="gallery">${visibleWorks.map(w=>{
        const image=resolveImage(w);
        const isChunked=Boolean(chunkSets[w.id]);
        const meta=[w.year,w.materials,w.size].filter(Boolean).join(' · ');
        const media=isChunked
          ? `<img data-chunk-id="${w.id}" alt="${w.title}" loading="lazy">`
          : `<img src="${image}" alt="${w.title}" loading="lazy">`;
        return `<article class="work"><button data-img="${isChunked?'':image}" data-chunk-id="${isChunked?w.id:''}" data-title="${w.title}" data-meta="${meta}">${media}</button><div class="caption"><span>${w.title}</span><span>${meta}</span></div></article>`;
      }).join('')}</div></div>`;
      list.appendChild(row);

      row.querySelectorAll('.work img:not([data-chunk-id])').forEach(img=>{
        img.complete?setOrientation(img):img.addEventListener('load',()=>setOrientation(img),{once:true});
      });
      row.querySelectorAll('img[data-chunk-id]').forEach(img=>{
        loadChunkedImage(img.dataset.chunkId)
          .then(src=>{
            img.addEventListener('load',()=>setOrientation(img),{once:true});
            img.src=src;
            if(img.complete&&img.naturalWidth) setOrientation(img);
          })
          .catch(error=>{
            console.error(error);
            img.alt=`Не удалось загрузить ${img.alt}`;
          });
      });

      row.querySelector('.series-row').addEventListener('click',()=>{
        row.querySelector('.series-content').classList.toggle('open');
        row.querySelector('.year').innerHTML=row.querySelector('.series-content').classList.contains('open')?`${s.year}<br>−`:`${s.year}<br>＋`;
      });
    });

    document.querySelectorAll('.work button').forEach(b=>b.addEventListener('click',async()=>{
      try{
        const src=b.dataset.img||await loadChunkedImage(b.dataset.chunkId);
        if(!src) return;
        dimg.src=src;
        dtitle.textContent=b.dataset.title;
        dmeta.textContent=b.dataset.meta;
        dialog.showModal();
      }catch(error){
        console.error(error);
      }
    }));
  });

dialog.querySelector('button').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
const mb=document.querySelector('.menu-button');
const nav=document.querySelector('.top nav');
mb.addEventListener('click',()=>{
  nav.classList.toggle('open');
  mb.setAttribute('aria-expanded',nav.classList.contains('open'));
});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));