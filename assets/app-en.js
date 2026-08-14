const list=document.querySelector('#series-list');
const dialog=document.querySelector('#lightbox');
const dimg=dialog.querySelector('img');
const dtitle=dialog.querySelector('strong');
const dmeta=dialog.querySelector('span');

const chunkSets={};
const imageCache=new Map();

const seriesTranslations={
  'duck-stories':{title:'Duck Stories',description:'Spanish slugs once appeared in my parents’ garden. They tried to get rid of them for years without much success, and eventually decided on a more radical solution: a flock of Indian Runner ducks, a breed known for its distinctive upright posture.\n\nThe ducks are incredibly funny. They live closely together, do everything as a group, and when startled, they run off without paying much attention to where they are going. They are, however, very good at dealing with slugs.'},
  'cats':{title:'Cats',description:'The Cats series grew out of an experiment with ink. When applied to wet paper, ink spreads unpredictably and becomes difficult to control. What was supposed to become a herd of piebald horses first turned into a cheetah, Cat, and the next attempt became an entire Handful of Cats.\n\nI still haven’t given up on making a painting with horses, so the cat series will most likely continue to grow.'},
  'route':{title:'Creative Route',description:'The works in the Creative Route series were created specifically for an exhibition of the same name in Moscow. I really enjoyed working with stencils and treating the buildings almost like portraits. At the same time, small signs of life begin to appear in their windows.\n\nThe series won the Creative Route competition.'},
  'white-on-black':{title:'White on Black',description:'The White on Black series began after a series of plein-air sessions with Dima Gorelyshev. I enjoyed this way of drawing so much that for several days afterwards I worked almost exclusively in this technique.\n\nHere I present the works I consider the most successful results of that experiment.'},
  'black-on-white':{title:'Black on White',description:'After working on black paper, returning to white paper felt unexpectedly intense. I rediscovered the pleasure of the contrast between black ink and a white sheet.\n\nI am particularly drawn to trees that resemble contour maps. Some of the works in this series were created in Dima Gorelyshev’s graphic workshop, as part of an exercise in constructing a landscape from different collected artefacts and treasures.'},
  'paradox-city':{title:'Paradoxical City',description:'Paradoxical City is a series made on paper tinted with gouache. In this city, something is always slightly wrong, although it is not always noticeable at first glance.'},
  'supermetal':{title:'Supermetal',description:'This series emerged from a plein-air session with Alyosha Geld at the Supermetal space. Here, I think, I used coloured paper as an independent material for the first time, experimenting with composition and colour and taking enormous pleasure in the process itself.'}
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