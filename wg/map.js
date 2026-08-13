(() => {
  const NS='http://www.w3.org/2000/svg';
  const short=s=>{const p=String(s||'').split(',').map(x=>x.trim()).filter(Boolean);return (p[0]||'').slice(0,28)};
  class SchematicMap{
    constructor(el){this.el=el;this.routes=[];this.ro=new ResizeObserver(()=>this.render());this.ro.observe(el)}
    setRoutes(routes){this.routes=routes||[];this.render()}
    render(){
      const all=this.routes.flatMap(r=>(r.points||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)));
      this.el.innerHTML='';this.el.classList.add('scheme-map');
      if(!all.length){this.el.innerHTML='<div class="scheme-empty">Маршрут появится здесь после первой остановки.</div>';return}
      const w=Math.max(320,this.el.clientWidth||900),h=Math.max(380,this.el.clientHeight||560),pad=72;
      let minLon=Math.min(...all.map(p=>p.lon)),maxLon=Math.max(...all.map(p=>p.lon)),minLat=Math.min(...all.map(p=>p.lat)),maxLat=Math.max(...all.map(p=>p.lat));
      if(maxLon-minLon<.12){minLon-=.06;maxLon+=.06}if(maxLat-minLat<.08){minLat-=.04;maxLat+=.04}
      const pos=p=>({x:pad+(p.lon-minLon)/(maxLon-minLon)*(w-pad*2),y:pad+(maxLat-p.lat)/(maxLat-minLat)*(h-pad*2)});
      const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Схематичная карта маршрутов выставки');
      for(let x=pad;x<w-pad;x+=120){const l=document.createElementNS(NS,'line');l.setAttribute('x1',x);l.setAttribute('x2',x);l.setAttribute('y1',28);l.setAttribute('y2',h-28);l.setAttribute('class','scheme-grid');svg.appendChild(l)}
      for(let y=pad;y<h-pad;y+=100){const l=document.createElementNS(NS,'line');l.setAttribute('x1',28);l.setAttribute('x2',w-28);l.setAttribute('y1',y);l.setAttribute('y2',y);l.setAttribute('class','scheme-grid');svg.appendChild(l)}
      this.routes.forEach((route,ri)=>{
        const pts=(route.points||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));if(!pts.length)return;
        const xy=pts.map(pos);
        if(xy.length>1){const line=document.createElementNS(NS,'polyline');line.setAttribute('points',xy.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('class',`scheme-route scheme-route--${ri%4}`);svg.appendChild(line)}
        pts.forEach((p,i)=>{
          const q=xy[i],g=document.createElementNS(NS,'g');g.setAttribute('class','scheme-stop');
          const c=document.createElementNS(NS,'circle');c.setAttribute('cx',q.x);c.setAttribute('cy',q.y);c.setAttribute('r',16);c.setAttribute('class','scheme-dot');g.appendChild(c);
          const n=document.createElementNS(NS,'text');n.setAttribute('x',q.x);n.setAttribute('y',q.y+4);n.setAttribute('text-anchor','middle');n.setAttribute('class','scheme-num');n.textContent=p.markerLabel||String(i+1);g.appendChild(n);
          const label=document.createElementNS(NS,'text');label.setAttribute('x',q.x+23);label.setAttribute('y',q.y-8);label.setAttribute('class','scheme-label');label.textContent=short(p.locationLabel);g.appendChild(label);
          const date=document.createElementNS(NS,'text');date.setAttribute('x',q.x+23);date.setAttribute('y',q.y+10);date.setAttribute('class','scheme-date');date.textContent=p.createdAt?new Date(p.createdAt).toLocaleDateString('ru-RU'):'';g.appendChild(date);
          if(route.href){g.style.cursor='pointer';g.addEventListener('click',()=>location.href=route.href)}
          svg.appendChild(g)
        })
      });
      this.el.appendChild(svg)
    }
  }
  window.SchematicMap=SchematicMap;
})();
