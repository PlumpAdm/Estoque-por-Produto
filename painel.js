/* Estoque por Produto — painel dentro do UpSeller (PlumpAdm/Estoque-por-Produto) */
(function () {
  'use strict';
  var HOST_ID = 'plump-estoque-host';
  if (location.hostname !== 'app.upseller.com') {
    location.href = 'https://app.upseller.com/pt/inventory/list?warehouseId=';
    return;
  }
  var old = document.getElementById(HOST_ID);
  if (old) { old.remove(); return; }

  // ---------- leitura do título: "NOME (COR TAM)" ou "NOME - (Cor, Tam)" ----------
  var SIZE_ORDER = ['PP','P','P-M','M','M-G','G','GG','GGG','XG','XGG','EG','EGG','EXG','G1','G2','G3','G4','G5','G6','G7','U','UN','UNICO','ÚNICO'];
  function isSize(s) { var u = String(s).toUpperCase(); return SIZE_ORDER.indexOf(u) >= 0 || /^\d{2}$/.test(u); }
  function sizeRank(s) {
    var u = String(s).toUpperCase(), i = SIZE_ORDER.indexOf(u);
    if (i >= 0) return i;
    if (/^\d+$/.test(u)) return 100 + parseInt(u, 10);
    return 1000;
  }
  function titleCase(s) { return s.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function parseTitle(title, sku) {
    var t = String(title || '').trim();
    var m = t.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (!m) return { name: t || sku, color: '—', size: sku, noParen: true };
    var name = m[1].replace(/[\s\-–—:]+$/, '').trim();
    var parts = m[2].split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var color = '—', size = '—';
    if (parts.length >= 2) { color = parts.slice(0, -1).join(', '); size = parts[parts.length - 1]; }
    else if (parts.length === 1) {
      var p1 = parts[0], mm = p1.match(/^(.*?)[\s\/_-]+(\S+)$/);
      if (isSize(p1)) size = p1;
      else if (mm && isSize(mm[2])) { color = mm[1].trim(); size = mm[2]; }
      else color = p1;
    }
    return { name: name || sku, color: color === '—' ? color : titleCase(color), size: size.toUpperCase() };
  }

  var SKU_COR = {'002':'Preto','004':'Verde','005':'Azul','006':'Pink','007':'Areia','008':'Rosa','010':'Branco','011':'Laranja','013':'Lilás','014':'Vermelho','017':'Roxo','018':'Rosa','019':'Caqui','021':'Amarelo','025':'Linho','027':'Terra Cota','028':'Creme','029':'Bege','030':'Cinza','035':'Azul Marinho','037':'Marrom','045':'Marrom Claro','054':'Marrom Escuro','081':'Bege','084':'Marsala','085':'Grafite','114':'Salmão','116':'Pêssego','123':'Marrom','124':'Off','126':'Salmão','144':'Off-white','157':'Estan Azul','158':'Estan Vermelho','163':'Chocolate','169':'Verde Claro','170':'Verde Menta','199':'Azul Novo','251':'Azul Claro'};
  var SKU_TAM = {'44':'44','46':'46','48':'48','50':'50','52':'52','61':'P','62':'M','63':'G','64':'GG','66':'G1','67':'G2','68':'G3','69':'G4','70':'G5','71':'G6','72':'G7'};
  function decodeSku(sku) {
    if (!/^\d{10}$/.test(sku)) return { color: '—', size: sku };
    var c = sku.slice(5, 8), s = sku.slice(8, 10);
    return { color: SKU_COR[c] || ('Cor ' + c), size: SKU_TAM[s] || ('Tam. ' + s) };
  }
  function refineNoParen(recs, plen) {
    var SEP = /^[-–—:|\/,]+$/, by = {};
    recs.forEach(function (r) { if (r.noParen) { var k = r.sku.slice(0, plen); (by[k] = by[k] || []).push(r); } });
    Object.keys(by).forEach(function (k) {
      var list = by[k], n = 0;
      var words = list.map(function (r) { return String(r.title || '').trim().split(/\s+/); });
      if (list.length > 1) {
        var min = Math.min.apply(null, words.map(function (w) { return w.length; }));
        while (n < min && words.every(function (w) { return w[n].toUpperCase() === words[0][n].toUpperCase(); })) n++;
      }
      list.forEach(function (r, i) {
        var w = words[i], nameW, restW;
        if (list.length > 1) { nameW = w.slice(0, n); restW = w.slice(n); }
        else {
          var d = w.lastIndexOf('-');
          if (d > 0) { nameW = w.slice(0, d); restW = w.slice(d + 1); }
          else if (w.length > 1 && isSize(w[w.length - 1])) { nameW = w.slice(0, -1); restW = w.slice(-1); }
          else { nameW = w; restW = []; }
        }
        while (nameW.length && SEP.test(nameW[nameW.length - 1])) nameW.pop();
        var rest = restW.join(' ').replace(/^[-–—:|\/,\s]+|[-–—:|\/,\s]+$/g, '');
        var color = '—', size = '—', cp = rest.split(/\s*,\s*/);
        if (cp.length >= 2 && isSize(cp[cp.length - 1])) { size = cp.pop().toUpperCase(); color = titleCase(cp.join(', ')); }
        else {
          var rw = rest ? rest.split(/\s+/) : [];
          if (rw.length && isSize(rw[rw.length - 1])) size = rw.pop().toUpperCase();
          if (rw.length) color = titleCase(rw.join(' '));
        }
        if (color === '—' && size === '—') { var dk = decodeSku(r.sku); color = dk.color; size = dk.size; r.fromSku = true; }
        r.name = nameW.join(' ') || r.title || r.sku; r.color = color; r.size = size;
      });
    });
  }

  // ---------- UpSeller ----------
  function fetchAll(q) {
    var type = /^[\d\s]+$/.test(q) ? '1' : '2'; // 1 = SKU, 2 = nome do produto
    var out = [], page = 1;
    function next() {
      return fetch('/api/warehouse-sku/list', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
        body: JSON.stringify({ searchType: type, searchValue: type === '1' ? q.replace(/\s+/g, '').slice(0, 5) : q.replace(/\s+/g, ' '), vagueSearchType: 3, sortName: '0', sortValue: '0', pageNum: page, pageSize: 100 })
      }).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error('Sua sessão do UpSeller expirou. Faça login de novo e tente outra vez.');
        if (!r.ok) throw new Error('O UpSeller respondeu com erro ' + r.status + '. Tente de novo em instantes.');
        return r.json();
      }).then(function (j) {
        if (!j || j.code !== 0) throw new Error((j && j.msg) || 'O UpSeller não retornou o estoque. Recarregue a página e tente de novo.');
        var list = (j.data && j.data.list) || [], total = (j.data && j.data.total) || 0;
        out = out.concat(list);
        if (list.length && out.length < total && page < 40) { page++; return next(); }
        return { rows: out, total: total };
      });
    }
    return next();
  }

  function toRec(r) {
    var p = parseTitle(r.skuTitle, r.sku), custo = Number(r.costPrice) || 0, atual = Number(r.onhand) || 0;
    return { sku: r.sku, kit: r.isGroup === 1, wh: r.warehouseName || '', disp: Number(r.available) || 0, atual: atual,
      value: custo * atual, noCost: !custo && atual > 0, name: p.name, color: p.color, size: p.size, title: r.skuTitle || '', noParen: !!p.noParen };
  }

  function group(recs, metric) {
    var map = {}, order = [];
    recs.forEach(function (r) {
      var key = r.sku.slice(0, 5), g = map[key];
      if (!g) { g = map[key] = { code: key, names: {}, qty: 0, value: 0, vars: 0, zeros: 0, cells: {}, colors: [], sizes: [], noCost: [] }; order.push(key); }
      var q = r[metric];
      g.names[r.name] = (g.names[r.name] || 0) + 1;
      g.qty += q; g.value += r.value;
      var ck = r.color + '\u0001' + r.size;
      if (!(ck in g.cells)) { g.vars++; g.cells[ck] = 0; }
      g.cells[ck] += q;
      if (g.colors.indexOf(r.color) < 0) g.colors.push(r.color);
      if (g.sizes.indexOf(r.size) < 0) g.sizes.push(r.size);
      if (r.noCost) g.noCost.push(r.color + ' ' + r.size + ' (' + r.sku + ')');
    });
    return order.map(function (k) {
      var g = map[k];
      g.name = Object.keys(g.names).sort(function (a, b) { return g.names[b] - g.names[a]; })[0];
      g.zeros = Object.keys(g.cells).filter(function (c) { return g.cells[c] <= 0; }).length;
      g.sizes.sort(function (a, b) { return sizeRank(a) - sizeRank(b) || a.localeCompare(b, 'pt-BR'); });
      g.colors.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      return g;
    }).sort(function (a, b) { return b.qty - a.qty; });
  }

  // ---------- interface ----------
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmtInt = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  var fmtBRL = function (n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); };

  var host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;top:0;right:0;height:100vh;width:min(600px,100vw);z-index:2147483646;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' +
    ':host{all:initial}' +
    '.p{--bg:#15111a;--sf:#1e1923;--ink:#eee8f1;--mu:#a79dac;--ln:#352d3b;--pl:#d78fc6;--pls:#3a2436;--onp:#1b1219;--wa:#e8b456;--wab:#3a2b12;--ba:#f28a80;--bab:#3e1d1a;' +
    'box-sizing:border-box;height:100%;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:14px/1.45 "Segoe UI",system-ui,sans-serif;border-left:1px solid var(--ln);box-shadow:-12px 0 32px rgba(0,0,0,.35)}' +
    '.p *{box-sizing:border-box}' +
    '.hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 10px}' +
    'h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.01em}' +
    '.x{all:unset;cursor:pointer;color:var(--mu);font-size:22px;line-height:1;padding:4px 8px;border-radius:6px}.x:hover{background:var(--sf);color:var(--ink)}' +
    '.fm{display:flex;gap:8px;padding:0 18px}' +
    'input{flex:1;min-width:0;font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--ln);background:var(--sf);color:var(--ink)}' +
    'input:focus{outline:2px solid var(--pl);outline-offset:1px}' +
    '.go{font:inherit;font-weight:600;border:0;border-radius:8px;padding:10px 16px;background:var(--pl);color:var(--onp);cursor:pointer}' +
    '.tip{padding:6px 18px 0;color:var(--mu);font-size:12px}' +
    '.bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px;border-bottom:1px solid var(--ln)}' +
    '.seg{display:inline-flex;border:1px solid var(--ln);border-radius:8px;overflow:hidden}' +
    '.seg button{font:inherit;font-size:13px;border:0;padding:6px 10px;background:transparent;color:var(--ink);cursor:pointer}' +
    '.seg button[aria-pressed=true]{background:var(--pl);color:var(--onp);font-weight:600}' +
    '.st{color:var(--mu);font-size:12px;text-align:right}' +
    '.bd{flex:1;overflow:auto;padding:14px 18px 24px;display:flex;flex-direction:column;gap:12px}' +
    '.msg{color:var(--mu);padding:28px 4px;text-align:center}.err{color:var(--ba)}' +
    '.card{background:var(--sf);border:1px solid var(--ln);border-radius:10px;overflow:hidden}' +
    '.top{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:12px 14px;cursor:pointer}' +
    '.code{font:12px ui-monospace,Consolas,monospace;color:var(--mu)}' +
    '.nm{font-weight:600}' +
    '.tot{grid-row:span 2;align-self:center;text-align:right;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}' +
    '.tot small{display:block;font-size:11px;font-weight:500;color:var(--mu)}' +
    '.meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--mu)}' +
    '.pill{font-weight:600;padding:0 7px;border-radius:999px;background:var(--bab);color:var(--ba)}' +
    '.wm{color:var(--wa);font-weight:700;cursor:help}' +
    '.gw{padding:0 14px 14px;overflow-x:auto}' +
    'table{border-collapse:separate;border-spacing:3px;font-variant-numeric:tabular-nums}' +
    'th,td{padding:5px 9px;text-align:center;min-width:40px;font-size:13px}' +
    'th{font-size:11px;color:var(--mu);font-weight:600;letter-spacing:.04em}' +
    'th.r{text-align:left;font-size:13px;color:var(--ink);font-weight:500;letter-spacing:0}' +
    'td{background:var(--bg);border-radius:5px}' +
    'td.z{background:var(--bab);color:var(--ba)}td.lo{background:var(--wab);color:var(--wa)}td.na{background:transparent;color:var(--mu)}' +
    'td.t,th.t{font-weight:700;background:transparent;color:var(--ink)}' +
    '.nc{margin:8px 0 0;font-size:12px;color:var(--wa)}' +
    '.lg{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--mu)}' +
    '.lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}' +
    '</style>' +
    '<div class="p" role="dialog" aria-label="Estoque por Produto">' +
    '<div class="hd"><h2>Estoque por Produto</h2><button class="x" title="Fechar (Esc)" aria-label="Fechar">×</button></div>' +
    '<form class="fm"><input id="q" placeholder="SKU, código ou nome do produto" autocomplete="off"><button class="go" type="submit">Buscar</button></form>' +
    '<div class="tip">Ex.: 0327202964 · 03272 · vera modinha. Os números vêm direto da Lista de Estoque do UpSeller.</div>' +
    '<div class="bar"><div class="seg"><button type="button" data-m="disp" aria-pressed="true">Disponível</button><button type="button" data-m="atual" aria-pressed="false">Estoque atual</button></div><div class="st" id="st"></div></div>' +
    '<div class="bd" id="bd"><div class="msg">Digite um SKU, o código do produto ou parte do nome e aperte Enter.</div></div>' +
    '</div>';
  document.body.appendChild(host);

  var $ = function (s) { return root.querySelector(s); };
  var state = { metric: 'disp', recs: null, q: '', open: {}, kits: 0, when: null };
  try { state.metric = localStorage.getItem('plump-estoque-metric') === 'atual' ? 'atual' : 'disp'; } catch (e) {}

  function grid(p) {
    if (p.colors.length === 1 && p.colors[0] === '—' && p.sizes.every(function (s) { return /^\d{6,}$/.test(s); })) {
      return '<p class="nc" style="color:var(--mu);margin:0 0 6px">O título destas variações não traz cor e tamanho. Estoque por SKU:</p><table><tbody>' + p.sizes.map(function (s) { var v = p.cells['—\u0001' + s] || 0; return '<tr><th class="r">' + esc(s) + '</th><td class="' + (v <= 0 ? 'z' : v <= 2 ? 'lo' : '') + '">' + fmtInt(v) + '</td></tr>'; }).join('') + '<tr><th class="r t">Total</th><td class="t">' + fmtInt(p.qty) + '</td></tr></tbody></table>';
    }
    var h = '<table><thead><tr><th style="text-align:left">Cor \\ Tam.</th>' + p.sizes.map(function (s) { return '<th>' + esc(s) + '</th>'; }).join('') + '<th class="t">Total</th></tr></thead><tbody>';
    var colTot = {}; p.sizes.forEach(function (s) { colTot[s] = 0; });
    p.colors.forEach(function (c) {
      var rt = 0;
      h += '<tr><th class="r">' + esc(c) + '</th>';
      p.sizes.forEach(function (s) {
        var k = c + '\u0001' + s;
        if (!(k in p.cells)) { h += '<td class="na">·</td>'; return; }
        var v = p.cells[k]; rt += v; colTot[s] += v;
        h += '<td class="' + (v <= 0 ? 'z' : v <= 2 ? 'lo' : '') + '">' + fmtInt(v) + '</td>';
      });
      h += '<td class="t">' + fmtInt(rt) + '</td></tr>';
    });
    h += '<tr><th class="r t">Total</th>' + p.sizes.map(function (s) { return '<td class="t">' + fmtInt(colTot[s]) + '</td>'; }).join('') + '<td class="t">' + fmtInt(p.qty) + '</td></tr></tbody></table>';
    h += '<div class="lg"><span><i style="background:var(--bab)"></i>zerado</span><span><i style="background:var(--wab)"></i>1 a 2 peças</span><span>· combinação não existe</span></div>';
    if (p.noCost.length) h += '<p class="nc">Sem custo médio no UpSeller: ' + p.noCost.map(esc).join(', ') + '. O valor não inclui essas peças.</p>';
    return h;
  }

  function render() {
    root.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === state.metric)); });
    if (!state.recs) return;
    var prods = group(state.recs, state.metric), bd = $('#bd');
    var total = prods.reduce(function (a, p) { return a + p.qty; }, 0);
    $('#st').textContent = prods.length + (prods.length === 1 ? ' produto' : ' produtos') + ' · ' + fmtInt(total) + ' peças · ' + state.when;
    if (!prods.length) { bd.innerHTML = '<div class="msg">Nada encontrado para "' + esc(state.q) + '". Confira o SKU ou tente parte do nome.</div>'; return; }
    var autoOpen = prods.length <= 3;
    bd.innerHTML = prods.slice(0, 60).map(function (p) {
      var open = state.open[p.code] !== undefined ? state.open[p.code] : autoOpen;
      return '<div class="card"><div class="top" data-code="' + esc(p.code) + '" title="Mostrar ou esconder a grade">' +
        '<div><span class="code">' + esc(p.code) + '</span> <span class="nm">' + esc(p.name) + '</span></div>' +
        '<div class="tot">' + fmtInt(p.qty) + '<small>' + (state.metric === 'disp' ? 'disponível' : 'estoque atual') + '</small></div>' +
        '<div class="meta"><span>' + p.vars + ' variações</span>' + (p.zeros ? '<span class="pill">' + p.zeros + ' zerada' + (p.zeros > 1 ? 's' : '') + '</span>' : '') +
        '<span>' + fmtBRL(p.value) + (p.noCost.length ? ' <span class="wm" title="Variação com estoque sem custo médio">*</span>' : '') + '</span></div></div>' +
        (open ? '<div class="gw">' + grid(p) + '</div>' : '') + '</div>';
    }).join('') + (prods.length > 60 ? '<div class="msg">Mostrando 60 de ' + prods.length + ' produtos. Refine a busca.</div>' : '') +
      (state.kits ? '<div class="msg">' + state.kits + ' kit(s) ignorado(s): o estoque de kit é calculado a partir das peças.</div>' : '');
  }

  function search(q) {
    q = q.trim();
    if (!q) return;
    state.q = q; state.open = {};
    $('#bd').innerHTML = '<div class="msg">Buscando no UpSeller…</div>';
    $('#st').textContent = '';
    fetchAll(q).then(function (res) {
      var all = res.rows.map(toRec);
      state.kits = all.filter(function (r) { return r.kit; }).length;
      state.recs = all.filter(function (r) { return !r.kit; });
      refineNoParen(state.recs, 5);
      state.when = 'atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      render();
    }).catch(function (e) {
      $('#bd').innerHTML = '<div class="msg err">' + esc(e.message || e) + '</div>';
    });
  }

  $('.fm').addEventListener('submit', function (e) { e.preventDefault(); search($('#q').value); });
  $('.x').addEventListener('click', function () { host.remove(); });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape') host.remove(); });
  root.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.metric = b.dataset.m;
      try { localStorage.setItem('plump-estoque-metric', state.metric); } catch (e) {}
      render();
    });
  });
  $('#bd').addEventListener('click', function (e) {
    var t = e.target.closest('.top');
    if (!t) return;
    var c = t.dataset.code, cards = root.querySelectorAll('.top').length;
    var cur = state.open[c] !== undefined ? state.open[c] : cards <= 3;
    state.open[c] = !cur; render();
  });
  render();
  setTimeout(function () { $('#q').focus(); }, 50);
})();
