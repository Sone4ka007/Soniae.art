const list=document.querySelector('#series-list');
const dialog=document.querySelector('#lightbox');
const dimg=dialog.querySelector('img');
const dtitle=dialog.querySelector('strong');
const dmeta=dialog.querySelector('span');

const chunkSets={};
const imageCache=new Map();

const seriesTranslations={
  'duck-stories':{title:'Duck Stories',description:''},
  'cats':{title:'Cats',description:''},
  'route':{title:'Creative Route',description:'A series about Moscow buildings as points along a personal route through the city.'},
  'white-on-black':{title:'White on Black',description:''},
  'black-on-white':{title:'Black on White',description:''},
  'paradox-city':{title:'Paradoxical City',description:''},
  'supermetal':{title:'Supermetal',description:''}
};

const workTitles={
  'duck-04':'Untitled','duck-05':'Untitled','duck-03':'Untitled','duck-01':'Untitled',
  'cats-02':'Handful of Cats','cats-01':'Cat',
  'route-01':'Tea House on Myasnitskaya Street','route-02':'Stakheev House','route-03':'Mosselprom House','route-04':'Lenin State Library','route-05':'ZIL Palace of Culture','route-06':'House with Mercuries',
  'whiteblack-02':'Timiryazev Biological Museum','whiteblack-03':'Observing Plants','whiteblack-04':'Friendship Park','whiteblack-01':'Timiryazev Biological Museum. Storage',
  'blackwhite-01':'Church in Tarakanovo','blackwhite-02':'Untitled','blackwhite-03':'Friendship Park','blackwhite-04':'Untitled','blackwhite-05':'Untitled','blackwhite-06':'Shakhmatovo','blackwhite-07':'Untitled',
  'paradox-06':'Coffee Van by the Pravda Publishing House','paradox-02':'Around Myasnitskaya Street','paradox-05':'Levoberezhny Beach, Moscow','paradox-03':'Portal by Dinamo Metro Station','paradox-04':'Winzavod','paradox-00':'Paradoxical City','paradox-01':'City Map',
  'supermetal-01':'Untitled','supermetal-02':'Untitled','supermetal-03':'Untitled'
};

const translateMaterials=value=>{
  const translations={
    'тушь, линер':'ink, fineliner',
    'чернила, карандаш':'ink, pencil',
    'трафаретная печать, карандаш, линер':'stencil print, pencil, fineliner',
    'тонированная бумага, белый карандаш, мел':'toned paper, white pencil, chalk',
    'смешанная техника':'mixed media',
    'гуашь, карандаш':'gouache, pencil',
    'аппликация, акриловый маркер, карандаш, линер':'collage, acrylic marker, pencil, fineliner'
  };
  return translations[value]||value;
};

const loadChunkedImage=id=>{
  if(!chunkSets[id]) return Promise.resolve(null);
  if(!imageCache.has(id)){
    imageCache.set(id,Promise.all(chunkSets[id].map(path=>fetch(`../${path}`).then(r=>{
      if(!r.ok) throw new Error(`Could not load ${path}`);
      return r.text();
    }))).then(parts=>`data:image/webp;base64,${parts.join('')}`));
  }
  return imageCache.get(id);
};

const resolveImage=work=>{
  if(work.id==='whiteblack-02') return '../assets/whiteblack-02-cropped.svg';
  if(work.id==='whiteblack-03') return '../assets/whiteblack-03-cropped.svg';
  return `../${work.image}`;
};

const setOrientation=img=>{
  img.closest('.work').classList.add(img.naturalWidth>img.naturalHeight?'landscape':'portrait');
};

fetch('../content/series.json')
  .then(r=>r.json())
  .then(series=>{
    series.forEach(s=>{
      const translatedSeries=seriesTranslations[s.id]||{title:s.title,description:s.description};
      const row=document.createElement('section');
      const visibleWorks=s.works.filter(w=>w.id!=='market-03');
      row.innerHTML=`<div class="series-row"><span class="number">${s.number}</span><h3>${translatedSeries.title}</h3><p>${translatedSeries.description||''}</p><span class="year">${s.year}<br>＋</span></div><div class="series-content"><div class="gallery">${visibleWorks.map(w=>{
        const image=resolveImage(w);
        const isChunked=Boolean(chunkSets[w.id]);
        const title=workTitles[w.id]||w.title;
        const meta=[w.year,translateMaterials(w.materials),w.size].filter(Boolean).join(' · ');
        const media=isChunked
          ? `<img data-chunk-id="${w.id}" alt="${title}" loading="lazy">`
          : `<img src="${image}" alt="${title}" loading="lazy">`;
        return `<article class="work"><button data-img="${isChunked?'':image}" data-chunk-id="${isChunked?w.id:''}" data-title="${title}" data-meta="${meta}">${media}</button><div class="caption"><span>${title}</span><span>${meta}</span></div></article>`;
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
            img.alt=`Could not load ${img.alt}`;
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