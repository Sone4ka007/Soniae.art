(() => {
  const NS='http://www.w3.org/2000/svg';
  const short=s=>{const p=String(s||'').split(',').map(x=>x.trim()).filter(Boolean);return (p[0]||'').slice(0,30)};
  class SchematicMap{
    constructor(el){this.el=el;this.routes=[];this.ro=new ResizeObserver(()=>this.render());this.ro.observe(el)}
    setRoutes(routes){this.routes=routes||[];this.render()}
    render(){
      const all=this.routes.flatMap(r=>r.points||[]);
      this.el.innerHTML='';this.el.classList.add('scheme-map');
      if(!all.length){this.el.innerHTML='<div class="scheme-empty">Маршрут появится здесь после первой остановки.</div>';return}
      const w=Math.max(320,this.el.clientWidth||900),laneH=190,h=Math.max(420,this.routes.length*laneH+80),padX=70;
      const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Схематичная карта маршрутов выставки');
      for(let x=40;x<w;x+=120){const l=document.createElementNS(NS,'line');l.setAttribute('x1',x);l.setAttribute('x2',x);l.setAttribute('y1',20);l.setAttribute('y2',h-20);l.setAttribute('class','scheme-grid');svg.appendChild(l)}
      this.routes.forEach((route,ri)=>{
        const pts=route.points||[];if(!pts.length)return;
        const y0=70+ri*laneH,usable=Math.max(120,w-padX*2),step=pts.length>1?usable/(pts.length-1):0;
        const xy=pts.map((p,i)=>({x:pts.length===1?w/2:padX+i*step,y:y0+(i%2?52:0)}));
        if(xy.length>1){const line=document.createElementNS(NS,'polyline');line.setAttribute('points',xy.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('class','scheme-route');svg.appendChild(line)}
        if(route.title){const title=document.createElementNS(NS,'text');title.setAttribute('x',padX);title.setAttribute('y',y0-34);title.setAttribute('class','scheme-route-title');title.textContent=route.title;svg.appendChild(title)}
        pts.forEach((p,i)=>{
          const q=xy[i],g=document.createElementNS(NS,'g');g.setAttribute('class','scheme-stop');
          const c=document.createElementNS(NS,'circle');c.setAttribute('cx',q.x);c.setAttribute('cy',q.y);c.setAttribute('r',16);c.setAttribute('class','scheme-dot');g.appendChild(c);
          const n=document.createElementNS(NS,'text');n.setAttribute('x',q.x);n.setAttribute('y',q.y+4);n.setAttribute('text-anchor','middle');n.setAttribute('class','scheme-num');n.textContent=p.markerLabel||String(i+1);g.appendChild(n);
          const label=document.createElementNS(NS,'text');label.setAttribute('x',q.x);label.setAttribute('y',q.y+35);label.setAttribute('text-anchor','middle');label.setAttribute('class','scheme-label');label.textContent=short(p.locationLabel);g.appendChild(label);
          const date=document.createElementNS(NS,'text');date.setAttribute('x',q.x);date.setAttribute('y',q.y+52);date.setAttribute('text-anchor','middle');date.setAttribute('class','scheme-date');date.textContent=p.createdAt?new Date(p.createdAt).toLocaleDateString('ru-RU'):'';g.appendChild(date);
          const target=p.mapUrl||route.href;if(target){g.style.cursor='pointer';g.addEventListener('click',()=>target.startsWith('http')?window.open(target,'_blank','noopener'):location.href=target)}
          svg.appendChild(g)
        })
      });
      this.el.appendChild(svg)
    }
  }
  window.SchematicMap=SchematicMap;
})();
