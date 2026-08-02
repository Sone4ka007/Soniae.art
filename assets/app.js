const list=document.querySelector('#series-list');
const dialog=document.querySelector('#lightbox');
const dimg=dialog.querySelector('img');
const dtitle=dialog.querySelector('strong');
const dmeta=dialog.querySelector('span');

const chunkSets={
  'cats-02':[
    'assets/site_optimized_for_github (1)/cats-handful.part1.txt',
    'assets/site_optimized_for_github (1)/cats-handful.part2.txt',
    'assets/site_optimized_for_github (1)/cats-handful.part3.txt',
    'assets/site_optimized_for_github (1)/cats-handful.part4.txt'
  ],
  'cats-01':[
    'assets/site_optimized_for_github (1)/cat.part1.txt',
    'assets/site_optimized_for_github (1)/cat.part2.txt',
    'assets/site_optimized_for_github (1)/cat.part3.txt',
    'assets/site_optimized_for_github (1)/cat.part4.txt'
  ]
};
const imageCache=new Map();

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
      row.innerHTML=`<div class="series-row"><span class="number">${s.number}</span><h3>${s.title}</h3><p>${s.description}</p><span class="year">${s.year}<br>＋</span></div><div class="series-content"><div class="gallery">${visibleWorks.map(w=>{
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