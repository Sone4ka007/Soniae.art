(() => {
  const TILE = 256;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function project(lat, lon, zoom) {
    const scale = TILE * Math.pow(2, zoom);
    const x = (lon + 180) / 360 * scale;
    const s = Math.sin(clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  function unproject(x, y, zoom) {
    const scale = TILE * Math.pow(2, zoom);
    const lon = x / scale * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / scale;
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lon };
  }

  class WalkingMap {
    constructor(el, options = {}) {
      this.el = el;
      this.center = options.center || [55.751244, 37.618423];
      this.zoom = options.zoom || 4;
      this.minZoom = 1;
      this.maxZoom = 18;
      this.routes = [];
      this.dragged = false;
      this._build();
      this._events();
      this.render();
      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(this.el);
    }

    _build() {
      this.el.classList.add('swg-map');
      this.tileLayer = document.createElement('div');
      this.tileLayer.className = 'swg-map__tiles';
      this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.overlay.classList.add('swg-map__overlay');
      this.markerLayer = document.createElement('div');
      this.markerLayer.className = 'swg-map__markers';
      this.controls = document.createElement('div');
      this.controls.className = 'swg-map__controls';
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Zoom in');
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Zoom out');
      plus.addEventListener('click', (e) => { e.stopPropagation(); this.setZoom(this.zoom + 1); });
      minus.addEventListener('click', (e) => { e.stopPropagation(); this.setZoom(this.zoom - 1); });
      this.controls.append(plus, minus);
      this.attrib = document.createElement('a');
      this.attrib.className = 'swg-map__attrib';
      this.attrib.href = 'https://www.openstreetmap.org/copyright';
      this.attrib.target = '_blank';
      this.attrib.rel = 'noopener';
      this.attrib.textContent = '© OpenStreetMap contributors';
      this.el.append(this.tileLayer, this.overlay, this.markerLayer, this.controls, this.attrib);
    }

    _events() {
      let start = null;
      this.el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button,a')) return;
        this.el.setPointerCapture?.(e.pointerId);
        const p = project(this.center[0], this.center[1], this.zoom);
        start = { x: e.clientX, y: e.clientY, cx: p.x, cy: p.y };
        this.dragged = false;
        this.el.classList.add('is-dragging');
      });
      this.el.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragged = true;
        const c = unproject(start.cx - dx, start.cy - dy, this.zoom);
        this.center = [clamp(c.lat, -85, 85), c.lon];
        this.render();
      });
      const stop = () => { start = null; this.el.classList.remove('is-dragging'); };
      this.el.addEventListener('pointerup', stop);
      this.el.addEventListener('pointercancel', stop);
      this.el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
      }, { passive: false });
    }

    setZoom(z) {
      this.zoom = clamp(Math.round(z), this.minZoom, this.maxZoom);
      this.render();
    }

    setRoutes(routes) {
      this.routes = routes || [];
      this.render();
    }

    fitPoints(points, padding = 70) {
      const valid = (points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      if (!valid.length) return;
      if (valid.length === 1) {
        this.center = [valid[0].lat, valid[0].lon];
        this.zoom = 13;
        this.render();
        return;
      }
      const w = Math.max(200, this.el.clientWidth - padding * 2);
      const h = Math.max(160, this.el.clientHeight - padding * 2);
      let chosen = 1;
      for (let z = 18; z >= 1; z--) {
        const ps = valid.map(p => project(p.lat, p.lon, z));
        const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
        if (Math.max(...xs) - Math.min(...xs) <= w && Math.max(...ys) - Math.min(...ys) <= h) { chosen = z; break; }
      }
      const ps = valid.map(p => project(p.lat, p.lon, chosen));
      const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
      const c = unproject((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, chosen);
      this.center = [c.lat, c.lon];
      this.zoom = chosen;
      this.render();
    }

    render() {
      this.renderTiles();
      this.renderOverlay();
      this.renderMarkers();
    }

    renderTiles() {
      const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
      const cp = project(this.center[0], this.center[1], this.zoom);
      const minX = Math.floor((cp.x - w / 2) / TILE), maxX = Math.floor((cp.x + w / 2) / TILE);
      const minY = Math.floor((cp.y - h / 2) / TILE), maxY = Math.floor((cp.y + h / 2) / TILE);
      const n = Math.pow(2, this.zoom);
      this.tileLayer.innerHTML = '';
      for (let ty = minY; ty <= maxY; ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = minX; tx <= maxX; tx++) {
          const wrapped = ((tx % n) + n) % n;
          const img = document.createElement('img');
          img.alt = '';
          img.draggable = false;
          img.loading = 'lazy';
          img.src = `https://tile.openstreetmap.org/${this.zoom}/${wrapped}/${ty}.png`;
          img.style.left = `${tx * TILE - cp.x + w / 2}px`;
          img.style.top = `${ty * TILE - cp.y + h / 2}px`;
          this.tileLayer.appendChild(img);
        }
      }
    }

    screenPoint(lat, lon) {
      const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
      const cp = project(this.center[0], this.center[1], this.zoom);
      const p = project(lat, lon, this.zoom);
      let dx = p.x - cp.x;
      const world = TILE * Math.pow(2, this.zoom);
      if (dx > world / 2) dx -= world;
      if (dx < -world / 2) dx += world;
      return { x: w / 2 + dx, y: h / 2 + (p.y - cp.y) };
    }

    renderOverlay() {
      const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
      this.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.overlay.innerHTML = '';
      this.routes.forEach((route, ri) => {
        const points = (route.points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map(p => this.screenPoint(p.lat, p.lon));
        if (points.length > 1) {
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          poly.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
          poly.setAttribute('class', `swg-route swg-route--${ri % 4}`);
          this.overlay.appendChild(poly);
        }
      });
    }

    renderMarkers() {
      this.markerLayer.innerHTML = '';
      this.routes.forEach((route) => {
        (route.points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).forEach((p, index) => {
          const pos = this.screenPoint(p.lat, p.lon);
          const marker = document.createElement(route.href ? 'a' : 'div');
          marker.className = 'swg-marker';
          marker.style.left = `${pos.x}px`;
          marker.style.top = `${pos.y}px`;
          marker.textContent = p.markerLabel || String(index + 1);
          marker.title = p.title || route.title || '';
          if (route.href) marker.href = route.href;
          this.markerLayer.appendChild(marker);
        });
      });
    }
  }

  window.WalkingMap = WalkingMap;
})();
