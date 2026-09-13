(() => {
  const NS='http://www.w3.org/2000/svg';
  const short=s=>{const p=String(s||'').split(',').map(x=>x.trim()).filter(Boolean);return (p[0]||'').slice(0,30)};
  const node=(name,attrs={},text='')=>{const el=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text)el.textContent=text;return el};
  class SchematicMap{
    constructor(el){this.el=el;this.routes=[];this.ro=new ResizeObserver(()=>this.render());this.ro.observe(el)}
    setRoutes(routes){this.routes=routes||[];this.render()}
    render(){
      const all=this.routes.flatMap(r=>r.points||[]);
      this.el.innerHTML='';this.el.classList.add('scheme-map');
      if(!all.length){this.el.innerHTML='<div class="scheme-empty">Маршрут появится здесь после первой остановки.</div>';return}
      const w=Math.max(280,this.el.clientWidth||900),mobile=w<620;
      const routeHeights=this.routes.map(r=>mobile?Math.max(210,(r.points||[]).length*118+86):190);
      const h=Math.max(mobile?320:420,routeHeights.reduce((a,b)=>a+b,0)+40);
      const svg=node('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'Схематичная карта маршрутов выставки'});
      for(let x=mobile?34:40;x<w;x+=mobile?88:120)svg.appendChild(node('line',{x1:x,x2:x,y1:20,y2:h-20,class:'scheme-grid'}));
      let laneTop=28;
      this.routes.forEach((route,ri)=>{
        const pts=route.points||[];if(!pts.length)return;
        const laneH=routeHeights[ri];
        let xy=[];
        if(mobile){
          const left=Math.max(54,Math.min(82,w*.22)),right=Math.min(w-54,Math.max(w-82,w*.78));
          xy=pts.map((p,i)=>({x:i%2?right:left,y:laneTop+72+i*112}));
        }else{
          const padX=88,usable=Math.max(120,w-padX*2),step=pts.length>1?usable/(pts.length-1):0,y0=laneTop+52;
          xy=pts.map((p,i)=>({x:pts.length===1?w/2:padX+i*step,y:y0+(i%2?48:0)}));
        }
        if(route.title)svg.appendChild(node('text',{x:mobile?24:70,y:laneTop+20,class:'scheme-route-title'},route.title));
        if(xy.length>1)svg.appendChild(node('polyline',{points:xy.map(p=>`${p.x},${p.y}`).join(' '),class:'scheme-route'}));
        pts.forEach((p,i)=>{
          const q=xy[i],g=node('g',{class:'scheme-stop'}),isRight=mobile&&q.x>w/2;
          g.appendChild(node('circle',{cx:q.x,cy:q.y,r:mobile?17:16,class:'scheme-dot'}));
          g.appendChild(node('text',{x:q.x,y:q.y+4,'text-anchor':'middle',class:'scheme-num'},p.markerLabel||String(i+1)));
          const labelX=mobile?(isRight?q.x-27:q.x+27):q.x;
          const anchor=mobile?(isRight?'end':'start'):'middle';
          const labelY=mobile?q.y-4:q.y+35;
          const dateY=mobile?q.y+15:q.y+52;
          g.appendChild(node('text',{x:labelX,y:labelY,'text-anchor':anchor,class:'scheme-label'},short(p.locationLabel)));
          g.appendChild(node('text',{x:labelX,y:dateY,'text-anchor':anchor,class:'scheme-date'},p.createdAt?new Date(p.createdAt).toLocaleDateString('ru-RU'):''));
          const target=p.mapUrl||route.href;if(target){g.style.cursor='pointer';g.addEventListener('click',()=>target.startsWith('http')?window.open(target,'_blank','noopener'):location.href=target)}
          svg.appendChild(g)
        });
        laneTop+=laneH;
      });
      this.el.appendChild(svg)
    }
  }
  window.SchematicMap=SchematicMap;
})();
