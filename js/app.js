/*
 * Sellin e Sellout · Demo Retail Co. (site estático, dados sintéticos)
 * Páginas: Visão geral, Lançamentos, Por loja, Por franqueado.
 * Tudo é calculado no navegador a partir de data.js (gerador) e core.js (medidas).
 */
(function () {
  "use strict";

  const { fmt, AVALIACOES, AV_POR_ID } = SS;

  /* ================= dados ================= */
  const parametros = new URLSearchParams(location.search);
  const semente = Number(parametros.get("seed")) || DemoData.SEMENTE_PADRAO;
  const D = SS.preparar(DemoData.gerar(semente));
  const ANO_MIN = 2025;
  const MES_REF = Number(D.mesRef.slice(5, 7));

  /* ================= utilitários ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const lerLocal = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem lembrar */ } };

  const ICN = {
    clique: '<svg class="icn" viewBox="0 0 24 24"><path d="M9 9l11 4-5 2-2 5z"/><path d="M5 3v3M3 5h3M14 4l-1.5 1.5M4 14l1.5-1.5"/></svg>',
    excel: '<svg class="icn" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8.5 8l7 8M15.5 8l-7 8"/></svg>',
    esq: '<svg class="icn" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    dir: '<svg class="icn" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    fechar: '<svg class="icn" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    filtro: '<svg class="icn" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  };

  /* ================= estado ================= */
  const CHAVES = ["canal", "regiao", "loja", "categoria", "colecao", "sku", "avaliacao"];
  const FILTROS = {
    canal: { rot: "Canal" },
    regiao: { rot: "Região", pais: "canal" },
    loja: { rot: "Loja", pais: "canal e região" },
    categoria: { rot: "Categoria" },
    colecao: { rot: "Coleção", pais: "categoria" },
    sku: { rot: "SKU", pais: "categoria e coleção" },
    avaliacao: { rot: "Avaliação" },
  };
  const PAGINAS = {
    geral: "Visão geral",
    lancamentos: "Lançamentos",
    lojas: "Por loja",
    franqueados: "Por franqueado",
  };

  const estado = {
    pagina: "geral",
    modo: "ano",
    ano: D.anoRef,
    mes: MES_REF,
    f: Object.fromEntries(CHAVES.map(k => [k, []])),
    vistaLanc: "lanc",
    busca: { lanc: "", lojas: "" },
    ordens: {},
    paginas: {},
  };

  /* ================= período ================= */
  const noPeriodo = la => estado.modo === "ano" ? la.ano === estado.ano : la.ano === estado.ano && la.mes === estado.mes;
  const textoPeriodo = () => estado.modo === "ano" ? String(estado.ano) : fmt.mesLongo(estado.ano, estado.mes);
  const periodoArquivo = () => estado.modo === "ano" ? String(estado.ano) : `${estado.ano}-${String(estado.mes).padStart(2, "0")}`;

  /* ================= filtros em cascata ================= */
  function lojasPermitidas(ate) {
    const F = estado.f;
    return D.lojas.filter(l => (!F.canal.length || F.canal.includes(l.canal)) &&
      (ate === "regiao" || !F.regiao.length || F.regiao.includes(l.regiao)));
  }

  /** Opções de cada filtro: as de baixo dependem do que está escolhido acima. */
  function opcoes(k) {
    const F = estado.f;
    switch (k) {
      case "canal":
        return D.canais.map(c => ({ v: c.id, t: c.nome, s: `${D.lojas.filter(l => l.canal === c.id).length} lojas` }));
      case "regiao": {
        const ls = lojasPermitidas("regiao");
        return D.regioes.map(r => ({ v: r, t: r, n: ls.filter(l => l.regiao === r).length }))
          .filter(o => o.n).map(o => ({ v: o.v, t: o.t, s: `${o.n} ${o.n === 1 ? "loja" : "lojas"}` }));
      }
      case "loja":
        return lojasPermitidas("loja").slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          .map(l => ({ v: l.id, t: l.nome, s: `${D.canalPorId[l.canal].curto} · ${l.uf}` }));
      case "categoria":
        return D.categorias.map(c => ({ v: c.id, t: c.nome }));
      case "colecao":
        return D.colecoes.filter(c => !F.categoria.length || F.categoria.includes(c.categoria))
          .map(c => ({ v: c.id, t: c.nome, s: D.catPorId[c.categoria].nome }));
      case "sku": {
        const out = [];
        for (const la of D.lancamentos) {
          if (!noPeriodo(la)) continue;
          if (F.categoria.length && !F.categoria.includes(la.categoria)) continue;
          if (F.colecao.length && !F.colecao.includes(la.colecao)) continue;
          for (const si of la.skus) { const s = D.skus[si]; out.push({ v: s.codigo, t: s.codigo, s: `${la.nome} · ${s.cor}` }); }
        }
        return out;
      }
      case "avaliacao":
        return AVALIACOES.map(a => ({ v: a.id, t: a.nome }));
    }
    return [];
  }

  function rotulo(k, v) {
    switch (k) {
      case "canal": return D.canalPorId[v] ? D.canalPorId[v].nome : v;
      case "loja": return D.lojaPorId[v] ? D.lojaPorId[v].nome : v;
      case "categoria": return D.catPorId[v] ? D.catPorId[v].nome : v;
      case "colecao": return D.colPorId[v] ? D.colPorId[v].nome : v;
      case "avaliacao": return AV_POR_ID[v] ? AV_POR_ID[v].nome : v;
      default: return v;
    }
  }

  /** Tira das seleções de baixo o que deixou de existir depois de mudar um filtro de cima (ou o período). */
  function podar() {
    for (const k of ["regiao", "loja", "colecao", "sku"]) {
      if (!estado.f[k].length) continue;
      const ok = new Set(opcoes(k).map(o => o.v));
      estado.f[k] = estado.f[k].filter(v => ok.has(v));
    }
  }

  const nFiltros = () => CHAVES.reduce((s, k) => s + estado.f[k].length, 0);

  /* ================= fatos filtrados (com cache por desenho) ================= */
  let memo = new Map();
  function filtrar(ignorar = []) {
    const chave = ignorar.join(",");
    if (memo.has(chave)) return memo.get(chave);
    const F = estado.f;
    const conj = k => F[k].length && !ignorar.includes(k) ? new Set(F[k]) : null;
    const sCanal = conj("canal"), sReg = conj("regiao"), sLoja = conj("loja");
    const sCat = conj("categoria"), sCol = conj("colecao"), sSku = conj("sku"), sAv = conj("avaliacao");
    const lancOk = D.lancamentos.map(la => noPeriodo(la) && (!sCat || sCat.has(la.categoria)) && (!sCol || sCol.has(la.colecao)));
    const lojaOk = D.lojas.map(l => (!sCanal || sCanal.has(l.canal)) && (!sReg || sReg.has(l.regiao)) && (!sLoja || sLoja.has(l.id)));
    let fatos = D.fatos.filter(f => lancOk[f.la] && lojaOk[f.l] && (!sSku || sSku.has(D.skus[f.k].codigo)));
    const porLanc = SS.agrupar(fatos, f => f.la, D);
    const av = new Map();
    for (const [i, a] of porLanc) av.set(i, SS.avaliar(D.lancamentos[i], a, D));
    if (sAv) {
      fatos = fatos.filter(f => sAv.has(av.get(f.la)));
      for (const i of [...porLanc.keys()]) if (!sAv.has(av.get(i))) porLanc.delete(i);
    }
    const r = { fatos, porLanc, av, total: SS.total(fatos, D) };
    memo.set(chave, r);
    return r;
  }

  function contarDistintos(fatos, chaveDe, valorDe) {
    const m = new Map();
    for (const f of fatos) {
      const k = chaveDe(f);
      let s = m.get(k);
      if (!s) { s = new Set(); m.set(k, s); }
      s.add(valorDe(f));
    }
    return m;
  }

  /* ================= pedaços de HTML ================= */
  const dif = (v, m) => v == null || m == null ? null : v - m;

  function calor(v, media) {
    if (v == null || media == null) return "transparent";
    const d = v - media;
    const forca = Math.min(1, Math.abs(d) / 0.15);
    return `color-mix(in srgb, var(${d >= 0 ? "--good" : "--bad"}) ${Math.round(8 + forca * 30)}%, transparent)`;
  }

  function delta(v, media) {
    const d = dif(v, media);
    if (d == null) return '<span class="delta">–</span>';
    return `<span class="delta ${d > 0.004 ? "pos" : d < -0.004 ? "neg" : ""}">${fmt.pp(d)}</span>`;
  }

  const pill = id => {
    const a = AV_POR_ID[id];
    return a ? `<span class="rating" style="--c:var(${a.cor})"><i></i>${a.nome}</span>` : "–";
  };

  const barraPct = v => `<span class="pct">${fmt.pct(v)}<span class="trk"><i style="width:${Math.max(0, Math.min(1, v || 0)) * 100}%"></i></span></span>`;

  function cab(titulo, sub, ferramentas = "") {
    return `<div class="card-head"><div class="t"><h2>${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div>` +
      (ferramentas ? `<div class="card-tools">${ferramentas}</div>` : "") + "</div>";
  }
  const dica = (txt = "clique filtra") => `<span class="click-hint" title="Ctrl+clique soma itens">${ICN.clique}${txt}</span>`;
  const botaoXl = id => `<button class="btn small btn-xl" id="${id}" type="button" title="Baixar Excel (CSV com ; e BOM UTF-8)">${ICN.excel}<span>Baixar Excel</span></button>`;

  function kpi(titulo, valor, rodape = "", medidor = null) {
    return `<div class="kpi"><h3>${titulo}</h3><div class="value">${valor}</div>` +
      (medidor != null ? `<div class="meter"><i style="width:${Math.max(0, Math.min(1, medidor)) * 100}%"></i></div>` : "") +
      (rodape ? `<div class="foot">${rodape}</div>` : "") + "</div>";
  }

  const legenda = itens => `<div class="legend">${itens.map(([t, cor, linha]) =>
    `<span><i class="${linha ? "line" : ""}" style="background:${cor}"></i>${t}</span>`).join("")}</div>`;

  const swatches = (codigos, max = 5) => {
    const lista = codigos.slice(0, max).map(i => D.skus[i]);
    return `<span class="sws">${lista.map(s => `<i class="sw" style="--c:${s.hex}" title="${esc(s.cor)}"></i>`).join("")}` +
      (codigos.length > max ? `<small>+${codigos.length - max}</small>` : "") + "</span>";
  };

  const thumb = la => `<span class="thumb">${SS.arte(la, D.skus[la.skus[0]].hex)}</span>`;

  function barraSelecao() {
    const itens = CHAVES.flatMap(k => estado.f[k].map(v =>
      `<button class="sel-chip" type="button" data-k="${k}" data-v="${esc(v)}" title="Tirar este filtro"><small>${FILTROS[k].rot}</small>${esc(rotulo(k, v))}<span>✕</span></button>`));
    if (!itens.length) return "";
    return `<div class="card sel-bar"><div class="sel-items"><span class="sel-lbl">Seleção</span>${itens.join("")}</div>` +
      '<button class="btn small" type="button" data-a="limpar-sel">Limpar tudo</button></div>';
  }

  /* ================= tabela genérica (ordena, pagina, clica, exporta) ================= */
  function tabela(box, cfg) {
    const ord = estado.ordens[cfg.id] || cfg.ordem || null;
    const linhas = cfg.linhas.slice();
    if (ord) {
      const col = cfg.colunas.find(c => c.k === ord.k);
      if (col && col.val) {
        const s = ord.dir === "asc" ? 1 : -1;
        linhas.sort((x, y) => {
          const a = col.val(x), b = col.val(y);
          if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
          return (typeof a === "string" ? a.localeCompare(b, "pt-BR") : a - b) * s;
        });
      }
    }
    cfg.ordenadas = linhas;
    const por = cfg.porPagina || Math.max(1, linhas.length);
    const total = Math.max(1, Math.ceil(linhas.length / por));
    const pg = Math.min(estado.paginas[cfg.id] || 0, total - 1);
    estado.paginas[cfg.id] = pg;
    const ini = pg * por;
    const vis = linhas.slice(ini, ini + por);
    const cls = c => (c.r ? "r " : "") + (c.cls || "");
    const vcols = cfg.colunas.filter(c => !c.soCsv);
    box.innerHTML = `<div class="scroll ${cfg.alta ? "tall" : ""}"><table class="tbl"><thead><tr>${vcols.map(c =>
      `<th class="${c.r ? "r " : ""}${c.val ? "sort " : ""}${ord && ord.k === c.k ? ord.dir : ""}" data-k="${c.k}">${c.rot}</th>`).join("")}</tr></thead><tbody>` +
      (vis.length ? vis.map((l, j) => `<tr data-i="${ini + j}" class="${cfg.aoClicar ? "clickable" : ""} ${cfg.sel && cfg.sel(l) ? "sel" : ""}">${vcols.map(c =>
        `<td class="${cls(c)}">${c.html(l, ini + j)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${vcols.length}" class="muted">Nada encontrado com os filtros escolhidos.</td></tr>`) +
      "</tbody></table></div>" +
      (cfg.porPagina && total > 1 ? `<div class="pager"><span>${fmt.int(ini + 1)}–${fmt.int(Math.min(ini + por, linhas.length))} de ${fmt.int(linhas.length)}</span>
        <div><button class="btn small" data-pg="-1" ${pg ? "" : "disabled"}>${ICN.esq}Anterior</button><button class="btn small" data-pg="1" ${pg < total - 1 ? "" : "disabled"}>Próxima${ICN.dir}</button></div></div>` : "");

    $$("th.sort", box).forEach(th => th.addEventListener("click", () => {
      const k = th.dataset.k;
      const atual = estado.ordens[cfg.id] || cfg.ordem;
      const col = cfg.colunas.find(c => c.k === k);
      estado.ordens[cfg.id] = { k, dir: atual && atual.k === k ? (atual.dir === "asc" ? "desc" : "asc") : (col.dir || "desc") };
      estado.paginas[cfg.id] = 0;
      tabela(box, cfg);
    }));
    if (cfg.aoClicar) $$("tbody tr[data-i]", box).forEach(tr => tr.addEventListener("click", () => cfg.aoClicar(linhas[+tr.dataset.i])));
    $$("[data-pg]", box).forEach(b => b.addEventListener("click", () => {
      estado.paginas[cfg.id] = pg + Number(b.dataset.pg);
      tabela(box, cfg);
      box.querySelector(".scroll").scrollTop = 0;
    }));
    return cfg;
  }

  function baixarCsv(nome, cabecalho, linhas) {
    const cel = v => {
      if (v == null) return "";
      if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 10000) / 10000).replace(".", ",") : "";
      const s = String(v);
      return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const texto = "﻿" + [cabecalho, ...linhas].map(l => l.map(cel).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}_${periodoArquivo()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function exportar(cfg, nome) {
    const cols = cfg.colunas.filter(c => c.csv);
    baixarCsv(nome, cols.map(c => c.csvRot || c.rot), (cfg.ordenadas || cfg.linhas).map(l => cols.map(c => c.csv(l))));
  }

  function ligarXl(raiz, id, fn) { const b = $("#" + id, raiz); if (b) b.addEventListener("click", fn); }

  /** Colunas de medidas comuns às tabelas. Cada linha tem .a (acumulado). */
  function colsMedidas(linhas, media, { receita = false, estoque = true } = {}) {
    const maxSi = Math.max(1, ...linhas.map(l => l.a.si));
    const cols = [
      { k: "si", rot: "Sell-in", r: true, val: l => l.a.si, csv: l => l.a.si,
        html: l => `<span class="vol">${fmt.int(l.a.si)}<i style="width:${Math.max(2, l.a.si / maxSi * 64)}px"></i></span>` },
      { k: "so", rot: "Sell-out", r: true, val: l => l.a.so, csv: l => l.a.so, html: l => fmt.int(l.a.so) },
      { k: "st", rot: "Sell-through", r: true, val: l => SS.st(l.a), csv: l => SS.st(l.a), html: l => barraPct(SS.st(l.a)) },
      { k: "st4", rot: "ST 4S", r: true, cls: "heat", val: l => SS.st4(l.a), csv: l => SS.st4(l.a), csvRot: "Sell-through 4S",
        html: l => `<span style="--heat:${calor(SS.st4(l.a), media)}">${fmt.pct(SS.st4(l.a))}</span>` },
      { k: "vs", rot: "vs média", r: true, val: l => dif(SS.st4(l.a), media), csv: l => dif(SS.st4(l.a), media),
        csvRot: "vs média (ST 4S)", html: l => delta(SS.st4(l.a), media) },
    ];
    if (estoque) cols.push({ k: "est", rot: "Estoque", r: true, val: l => SS.estoque(l.a), csv: l => SS.estoque(l.a), html: l => fmt.int(SS.estoque(l.a)) });
    if (receita) cols.push({ k: "rso", rot: "Receita", r: true, val: l => l.a.rso, csv: l => Math.round(l.a.rso * 100) / 100, csvRot: "Receita sell-out (R$)", html: l => fmt.brl(l.a.rso) });
    return cols;
  }

  const colRank = (titulo, nomeDe, subDe, extra) => ({
    k: "nome", rot: titulo, cls: "name", dir: "asc", val: l => nomeDe(l), csv: l => nomeDe(l),
    html: (l, i) => `<span class="cellx"><span class="rk ${i < 3 ? "top" : ""}">${i + 1}</span>${extra ? extra(l) : ""}<span class="nm"><b>${esc(nomeDe(l))}</b>${subDe ? `<small>${esc(subDe(l))}</small>` : ""}</span></span>`,
  });

  /* ================= gráficos ================= */
  let graficos = [];
  let graficosGaveta = [];
  function limparGraficos(lista) { while (lista.length) lista.pop().destroy(); }

  function novoGrafico(canvas, cfg, lista = graficos) {
    if (!canvas) return null;
    if (!window.Chart) {
      canvas.parentElement.innerHTML = '<div class="chart-fallback">Gráfico indisponível: a biblioteca Chart.js não carregou (sem internet?).</div>';
      return null;
    }
    Chart.defaults.font.family = "Geist, ui-sans-serif, system-ui, sans-serif";
    Chart.defaults.color = cssVar("--text-2");
    Chart.defaults.borderColor = cssVar("--grid");
    const g = new Chart(canvas, cfg);
    lista.push(g);
    return g;
  }

  const tooltipBase = () => ({
    backgroundColor: cssVar("--surface"), titleColor: cssVar("--text"), bodyColor: cssVar("--text-2"),
    borderColor: cssVar("--line"), borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
  });

  function grafMensal(canvas, fatos) {
    const serie = SS.serieMensal(fatos, D);
    let acSi = 0, acSo = 0;
    const acum = serie.map(x => { acSi += x.si; acSo += x.so; return acSi ? acSo / acSi : null; });
    novoGrafico(canvas, {
      type: "bar",
      data: {
        labels: serie.map(x => fmt.mes(x.mes)),
        datasets: [
          { label: "Sell-in", data: serie.map(x => x.si), backgroundColor: cssVar("--s-in"), borderRadius: 4, yAxisID: "y", order: 2 },
          { label: "Sell-out", data: serie.map(x => x.so), backgroundColor: cssVar("--s-out"), borderRadius: 4, yAxisID: "y", order: 2 },
          { label: "Sell-through acumulado", type: "line", data: acum, yAxisID: "y2", order: 1, borderColor: cssVar("--mod-accent"),
            backgroundColor: cssVar("--mod-accent"), borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.35 },
        ],
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase(), callbacks: {
          label: c => c.dataset.yAxisID === "y2" ? ` ${c.dataset.label}: ${fmt.pct(c.raw)}` : ` ${c.dataset.label}: ${fmt.int(c.raw)} peças` } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: v => fmt.compacto(v) } },
          y2: { position: "right", min: 0, max: 1, grid: { display: false }, ticks: { callback: v => fmt.pct(v, 0) } },
        },
      },
    });
  }

  const COR_CAT = ["--s-out", "--mod-accent", "--av-3", "--av-2", "--av-pre", "--s-in"];
  const ROTULOS_SEMANA = ["4S", "8S", "12S", "16S", "20S", "24S"];

  function grafCurva(canvas, legendaBox, fatos) {
    const total = SS.curva(fatos, D).get("Total") || [];
    const porCat = SS.curva(fatos, D, f => D.lancamentos[f.la].categoria);
    const series = D.categorias.map((c, i) => ({ c, i, v: porCat.get(c.id) })).filter(x => x.v && x.v.some(v => v != null));
    if (legendaBox) legendaBox.innerHTML = legenda([...series.map(x => [x.c.nome, cssVar(COR_CAT[x.i]), true]), ["Total", cssVar("--text"), true]]);
    novoGrafico(canvas, {
      type: "line",
      data: {
        labels: ROTULOS_SEMANA,
        datasets: [
          ...series.map(x => ({ label: x.c.nome, data: x.v, borderColor: cssVar(COR_CAT[x.i]), backgroundColor: cssVar(COR_CAT[x.i]),
            borderWidth: 2, pointRadius: 3, tension: 0.3, spanGaps: true })),
          { label: "Total", data: total, borderColor: cssVar("--text"), backgroundColor: cssVar("--text"), borderDash: [5, 4],
            borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true },
        ],
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase(), callbacks: { label: c => ` ${c.dataset.label}: ${fmt.pct(c.raw)}` } } },
        scales: { x: { grid: { display: false } }, y: { min: 0, ticks: { callback: v => fmt.pct(v, 0) } } },
      },
    });
  }

  /** Barras horizontais de sell-through com traço na média. linhas: [{chave, nome, a}] */
  function barrasH(box, linhas, { media = null, sel = [], aoClicar = null } = {}) {
    if (!linhas.length) { box.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
    const max = Math.max(0.0001, media || 0, ...linhas.map(l => SS.st(l.a) || 0)) * 1.05;
    box.innerHTML = `<div class="hbars">${linhas.map((l, i) => {
      const v = SS.st(l.a) || 0;
      const marcado = sel.length && sel.includes(l.chave);
      return `<div class="hbar ${aoClicar ? "clickable" : ""} ${marcado ? "sel" : ""} ${sel.length && !marcado ? "dim" : ""}" data-i="${i}"
        title="${esc(l.nome)} · sell-in ${fmt.int(l.a.si)} · sell-out ${fmt.int(l.a.so)} · estoque ${fmt.int(SS.estoque(l.a))}">
        <span>${esc(l.nome)}</span><span class="track"><i style="width:${v / max * 100}%"></i>${media != null ? `<u style="left:${media / max * 100}%"></u>` : ""}</span>
        <b>${fmt.pct(SS.st(l.a))}</b><small>${fmt.compacto(l.a.so)} pç</small></div>`;
    }).join("")}</div>`;
    if (aoClicar) $$(".hbar", box).forEach(el => el.addEventListener("click", ev => aoClicar(linhas[+el.dataset.i], ev)));
  }

  /* ================= cliques que filtram ================= */
  function alternar(chave, valor, ev) {
    const lista = estado.f[chave];
    if (ev && (ev.ctrlKey || ev.metaKey)) {
      estado.f[chave] = lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];
    } else {
      estado.f[chave] = lista.length === 1 && lista[0] === valor ? [] : [valor];
    }
    aplicar();
  }

  /* ================= Visão geral ================= */
  function paginaGeral(el) {
    const r = filtrar();
    const a = r.total;
    if (!r.fatos.length) {
      el.innerHTML = `${barraSelecao()}<div class="card empty">Nenhum lançamento com os filtros escolhidos em ${textoPeriodo()}.</div>${comoCalculamos()}`;
      return;
    }
    const nSkus = new Set(r.fatos.map(f => f.k)).size;
    const nLojas = new Set(r.fatos.map(f => f.l)).size;
    const est = SS.estoque(a);
    const geral = SS.avaliarConjunto(r.fatos, D);
    const anoModo = estado.modo === "ano";
    const media4 = SS.st4(a);

    el.innerHTML = `
      <div class="kpi-band k8">
        ${kpi("Lançamentos", fmt.int(r.porLanc.size), `<b>${fmt.int(nSkus)}</b> SKUs em <b>${fmt.int(nLojas)}</b> lojas`)}
        ${kpi("Sell-in", `${fmt.int(a.si)} <small>peças</small>`, `<b>${fmt.brl(a.rsi)}</b> a preço de atacado`)}
        ${kpi("Sell-out", `${fmt.int(a.so)} <small>peças</small>`, `<b>${fmt.brl(a.rso)}</b> vendidos ao consumidor`)}
        ${kpi("Estoque nas lojas", `${fmt.int(est)} <small>peças</small>`, `<b>${fmt.pct(a.si ? est / a.si : null)}</b> do sell-in ainda na loja`)}
        ${kpi("Sell-through", fmt.pct(SS.st(a)), "sell-out ÷ sell-in até hoje", SS.st(a))}
        ${kpi("Sell-through 4S", fmt.pct(media4), "4 primeiras semanas do lançamento", media4)}
        ${kpi("Ticket médio", fmt.brlCheio(a.so ? a.rso / a.so : null), "receita do sell-out ÷ peças")}
        ${kpi("Avaliação geral", geral.id ? pill(geral.id) : "–", geral.regua ? `régua média <b>${geral.regua.map(v => v.toFixed(0)).join(" / ")}%</b>` : "lançamentos ainda sem 4 semanas")}
      </div>
      ${barraSelecao()}
      <div class="grid2">
        <div class="card">${cab("Avaliação dos lançamentos", "Quantos lançamentos caem em cada faixa da régua do Sell-through 4S", dica())}<div id="vg-av"></div></div>
        <div class="card">${cab("Sell-in x Sell-out por mês", "Peças enviadas às lojas e vendidas ao consumidor, mês a mês · a linha é o sell-through acumulado")}
          ${legenda([["Sell-in", cssVar("--s-in")], ["Sell-out", cssVar("--s-out")], ["Sell-through acumulado", cssVar("--mod-accent"), true]])}
          <div class="chart"><canvas id="vg-mensal" role="img" aria-label="Sell-in e sell-out por mês"></canvas></div></div>
      </div>
      <div class="grid2">
        <div class="card">${cab("Por canal", "Sell-through de cada canal · o traço é a média da seleção", botaoXl("xl-canal") + dica())}<div id="vg-canal"></div></div>
        <div class="card">${cab("Por região", "Região da loja (o e-commerce aparece como Online)", botaoXl("xl-reg") + dica())}<div id="vg-reg"></div></div>
      </div>
      <div class="grid2">
        <div class="card">${cab("Curva do sell-through", "Sell-out acumulado ÷ sell-in acumulado a cada 4 semanas do lançamento, por categoria")}
          <div id="vg-curva-leg"></div><div class="chart"><canvas id="vg-curva" role="img" aria-label="Curva do sell-through"></canvas></div></div>
        <div class="card">${anoModo
          ? cab("Lançamentos por mês", `Modelos lançados em cada mês de ${estado.ano} · a cor compara o Sell-through 4S do mês com o do ano`, dica("clique abre o mês"))
          : cab("Por categoria", `Lançamentos de ${textoPeriodo()} por categoria`, dica())}<div id="vg-mes"></div></div>
      </div>
      <div class="card block">${cab("Por coleção", "Coleções da seleção, com a categoria · clique filtra a coleção", botaoXl("xl-col"))}<div id="vg-col"></div></div>
      <div class="card block">${cab("Maiores lançamentos", "Os 15 de maior sell-in · clique abre o detalhe",
        botaoXl("xl-top") + `<a class="btn small" href="#lancamentos">Ver todos os ${fmt.int(r.porLanc.size)}</a>`)}<div id="vg-top"></div></div>
      ${comoCalculamos()}`;

    cartaoAvaliacao($("#vg-av", el));
    grafMensal($("#vg-mensal", el), r.fatos);

    // por canal e por região: ignoram o próprio filtro, para mostrar os outros apagados
    const rc = filtrar(["canal"]);
    const canais = [...SS.agrupar(rc.fatos, f => D.lojas[f.l].canal, D)].map(([k, x]) => ({ chave: k, nome: D.canalPorId[k].nome, a: x }))
      .sort((x, y) => y.a.si - x.a.si);
    barrasH($("#vg-canal", el), canais, { media: SS.st(rc.total), sel: estado.f.canal, aoClicar: (l, ev) => alternar("canal", l.chave, ev) });
    const rr = filtrar(["regiao"]);
    const regioes = [...SS.agrupar(rr.fatos, f => D.lojas[f.l].regiao, D)].map(([k, x]) => ({ chave: k, nome: k, a: x }))
      .sort((x, y) => y.a.si - x.a.si);
    barrasH($("#vg-reg", el), regioes, { media: SS.st(rr.total), sel: estado.f.regiao, aoClicar: (l, ev) => alternar("regiao", l.chave, ev) });
    const colsSimples = [
      { k: "nome", rot: "Nome", csv: l => l.nome },
      { k: "si", rot: "Sell-in", csv: l => l.a.si }, { k: "so", rot: "Sell-out", csv: l => l.a.so },
      { k: "st", rot: "Sell-through", csv: l => SS.st(l.a) }, { k: "st4", rot: "Sell-through 4S", csv: l => SS.st4(l.a) },
      { k: "est", rot: "Estoque", csv: l => SS.estoque(l.a) }, { k: "rso", rot: "Receita sell-out (R$)", csv: l => Math.round(l.a.rso * 100) / 100 },
    ];
    ligarXl(el, "xl-canal", () => exportar({ colunas: colsSimples, linhas: canais }, "por_canal"));
    ligarXl(el, "xl-reg", () => exportar({ colunas: colsSimples, linhas: regioes }, "por_regiao"));

    grafCurva($("#vg-curva", el), $("#vg-curva-leg", el), r.fatos);

    if (anoModo) blocoMeses($("#vg-mes", el));
    else {
      const rk = filtrar(["categoria"]);
      const cats = [...SS.agrupar(rk.fatos, f => D.lancamentos[f.la].categoria, D)].map(([k, x]) => ({ chave: k, nome: D.catPorId[k].nome, a: x }))
        .sort((x, y) => y.a.si - x.a.si);
      barrasH($("#vg-mes", el), cats, { media: SS.st(rk.total), sel: estado.f.categoria, aoClicar: (l, ev) => alternar("categoria", l.chave, ev) });
    }

    // por coleção
    const nLancCol = contarDistintos(r.fatos, f => D.lancamentos[f.la].colecao, f => f.la);
    const cols = [...SS.agrupar(r.fatos, f => D.lancamentos[f.la].colecao, D)].map(([k, x]) => ({
      chave: k, nome: D.colPorId[k].nome, cat: D.catPorId[D.colPorId[k].categoria].nome, a: x, n: nLancCol.get(k).size }));
    const cfgCol = tabela($("#vg-col", el), {
      id: "vg-col", linhas: cols, ordem: { k: "si", dir: "desc" },
      sel: l => estado.f.colecao.includes(l.chave),
      colunas: [
        colRank("Coleção", l => l.nome, l => l.cat),
        { k: "cat", rot: "Categoria", val: l => l.cat, csv: l => l.cat, html: l => esc(l.cat), dir: "asc", cls: "muted" },
        { k: "n", rot: "Lançamentos", r: true, val: l => l.n, csv: l => l.n, html: l => fmt.int(l.n) },
        ...colsMedidas(cols, media4, { receita: true }),
      ],
      aoClicar: l => { estado.f.categoria = [D.colPorId[l.chave].categoria]; estado.f.colecao = [l.chave]; aplicar(); },
    });
    ligarXl(el, "xl-col", () => exportar(cfgCol, "por_colecao"));

    // maiores lançamentos
    const top = linhasLancamentos(r).sort((x, y) => y.a.si - x.a.si).slice(0, 15);
    const cfgTop = tabela($("#vg-top", el), {
      id: "vg-top", linhas: top, colunas: colunasLancamentos(top, media4),
      aoClicar: l => abrirLancamento(l.la.i),
    });
    ligarXl(el, "xl-top", () => exportar(cfgTop, "maiores_lancamentos"));
  }

  function cartaoAvaliacao(box) {
    const r = filtrar(["avaliacao"]);
    const sel = estado.f.avaliacao;
    const por = new Map(AVALIACOES.map(a => [a.id, { n: 0, si: 0 }]));
    for (const [i, a] of r.porLanc) { const p = por.get(r.av.get(i)); p.n++; p.si += a.si; }
    const total = r.porLanc.size || 1;
    const visiveis = AVALIACOES.filter(a => por.get(a.id).n || sel.includes(a.id));
    box.innerHTML = `<div class="rating-bar">${visiveis.filter(a => por.get(a.id).n).map(a =>
      `<span style="--c:var(${a.cor}); flex:${por.get(a.id).n}" title="${a.nome}: ${por.get(a.id).n}"></span>`).join("")}</div>
      <div class="rating-cards">${visiveis.map(a => {
        const p = por.get(a.id);
        return `<button type="button" class="rating-card ${sel.includes(a.id) ? "sel" : ""} ${sel.length && !sel.includes(a.id) ? "dim" : ""}" data-av="${a.id}" style="--c:var(${a.cor})">
          <span class="t"><i></i>${a.nome}</span><strong>${fmt.int(p.n)}</strong><small>${fmt.pct(p.n / total, 0)} dos lançamentos · ${fmt.compacto(p.si)} pç</small></button>`;
      }).join("")}</div>
      <p class="rating-rule">Régua do Sell-through 4S (Ótimo / Bom / Regular): ${D.categorias.map(c => `<b>${c.nome}</b> ${c.regua.join(" / ")}%`).join(" · ")}.
        Abaixo do último degrau, Ruim. Menos de 4 semanas: Em maturação.</p>`;
    $$(".rating-card", box).forEach(b => b.addEventListener("click", ev => alternar("avaliacao", b.dataset.av, ev)));
  }

  function blocoMeses(box) {
    const r = filtrar();
    const media = SS.st4(r.total);
    const porMes = SS.agrupar(r.fatos, f => D.lancamentos[f.la].mes, D);
    const nLanc = contarDistintos(r.fatos, f => D.lancamentos[f.la].mes, f => f.la);
    const maxSi = Math.max(1, ...[...porMes.values()].map(a => a.si));
    box.innerHTML = `<div class="months">${SS.MESES.map((nome, i) => {
      const m = i + 1, a = porMes.get(m), n = nLanc.get(m) ? nLanc.get(m).size : 0;
      const v = a ? SS.st4(a) : null;
      return `<button type="button" class="month" data-m="${m}" ${n ? "" : "disabled"} style="--heat:${calor(v, media)}"
        title="${n ? `${n} lançamentos · sell-in ${fmt.int(a.si)} · sell-out ${fmt.int(a.so)}` : "Sem lançamentos"}">
        <span class="mn">${nome}</span><b>${n || "–"}</b><span class="vbar"><i style="height:${a ? a.si / maxSi * 100 : 0}%"></i></span>
        <small>${n === 1 ? "lançamento" : "lançamentos"}</small><span class="ms">${v != null ? `ST 4S ${fmt.pct(v, 0)}` : n ? "em maturação" : ""}</span></button>`;
    }).join("")}</div>
    <p class="note">A barrinha é o sell-in do mês em relação ao maior mês. Verde: Sell-through 4S acima do ano; vermelho: abaixo.</p>`;
    $$(".month:not(:disabled)", box).forEach(b => b.addEventListener("click", () => {
      estado.modo = "mes";
      estado.mes = Number(b.dataset.m);
      aplicar(true);
    }));
  }

  /* ================= Lançamentos ================= */
  function linhasLancamentos(r) {
    const lojas = contarDistintos(r.fatos, f => f.la, f => f.l);
    const skus = contarDistintos(r.fatos, f => f.la, f => f.k);
    return [...r.porLanc].map(([i, a]) => ({ la: D.lancamentos[i], a, av: r.av.get(i), lojas: lojas.get(i).size, skus: [...skus.get(i)] }));
  }

  function colunasLancamentos(linhas, media) {
    return [
      { k: "nome", rot: "Lançamento", cls: "name", dir: "asc", val: l => l.la.nome, csv: l => l.la.nome,
        html: (l, i) => `<span class="cellx"><span class="rk ${i < 3 ? "top" : ""}">${i + 1}</span>${thumb(l.la)}<span class="nm"><b>${esc(l.la.nome)}</b><small>${l.la.codigo} · ${esc(D.catPorId[l.la.categoria].nome)} · ${esc(D.colPorId[l.la.colecao].nome)}</small></span></span>` },
      { k: "cod", rot: "Código", csv: l => l.la.codigo, soCsv: true },
      { k: "data", rot: "Lançado em", val: l => l.la.data, csv: l => l.la.data, html: l => fmt.data(l.la.data) },
      { k: "cores", rot: "Cores", val: l => l.skus.length, csv: l => l.skus.map(i => D.skus[i].cor).join(", "), html: l => swatches(l.skus) },
      { k: "lojas", rot: "Lojas", r: true, val: l => l.lojas, csv: l => l.lojas, html: l => fmt.int(l.lojas) },
      ...colsMedidas(linhas, media),
      { k: "av", rot: "Avaliação", val: l => AVALIACOES.findIndex(a => a.id === l.av), dir: "asc", csv: l => AV_POR_ID[l.av].nome, html: l => pill(l.av) },
    ];
  }

  function paginaLancamentos(el) {
    const r = filtrar();
    const a = r.total;
    const media = SS.st4(a);
    el.innerHTML = `
      <div class="kpi-band k4">
        ${kpi("Lançamentos", fmt.int(r.porLanc.size), `<b>${fmt.int(new Set(r.fatos.map(f => f.k)).size)}</b> SKUs (variações de cor)`)}
        ${kpi("Sell-in / Sell-out", `${fmt.compacto(a.si)} <small>/ ${fmt.compacto(a.so)} peças</small>`, `estoque nas lojas <b>${fmt.int(SS.estoque(a))}</b>`)}
        ${kpi("Sell-through", fmt.pct(SS.st(a)), "sell-out ÷ sell-in até hoje", SS.st(a))}
        ${kpi("Sell-through 4S", fmt.pct(media), "média da seleção (base do “vs média”)", media)}
      </div>
      ${barraSelecao()}
      <div class="card block">
        <div class="toolbar">
          <div class="l">
            <input type="search" id="busca-lanc" placeholder="Buscar por nome, código, coleção ou cor…" value="${esc(estado.busca.lanc)}" aria-label="Buscar">
            <div class="seg" role="group" aria-label="Ver por"><button type="button" data-v="lanc" class="${estado.vistaLanc === "lanc" ? "on" : ""}">Lançamentos</button><button type="button" data-v="sku" class="${estado.vistaLanc === "sku" ? "on" : ""}">SKUs</button></div>
            <span class="info" id="info-lanc"></span>
          </div>
          <div class="r">${botaoXl("xl-lanc")}</div>
        </div>
        <div id="tab-lanc"></div>
      </div>
      ${comoCalculamos()}`;

    let cfg = null;
    const desenhar = () => {
      const termo = estado.busca.lanc.trim().toLowerCase();
      const casa = (la, extra = "") => !termo || `${la.nome} ${la.codigo} ${D.colPorId[la.colecao].nome} ${D.catPorId[la.categoria].nome} ${extra}`.toLowerCase().includes(termo);
      if (estado.vistaLanc === "lanc") {
        const linhas = linhasLancamentos(r).filter(l => casa(l.la, l.skus.map(i => `${D.skus[i].cor} ${D.skus[i].codigo}`).join(" ")));
        cfg = tabela($("#tab-lanc", el), {
          id: "lanc", linhas, porPagina: 50, alta: true, ordem: { k: "si", dir: "desc" },
          colunas: colunasLancamentos(linhas, media), aoClicar: l => abrirLancamento(l.la.i),
        });
        $("#info-lanc", el).textContent = `${fmt.int(linhas.length)} lançamentos`;
      } else {
        const lojas = contarDistintos(r.fatos, f => f.k, f => f.l);
        const linhas = [...SS.agrupar(r.fatos, f => f.k, D)].map(([k, x]) => ({ sku: D.skus[k], la: D.lancamentos[D.skus[k].lanc], a: x, lojas: lojas.get(k).size }))
          .filter(l => casa(l.la, `${l.sku.cor} ${l.sku.codigo}`));
        cfg = tabela($("#tab-lanc", el), {
          id: "sku", linhas, porPagina: 50, alta: true, ordem: { k: "si", dir: "desc" },
          colunas: [
            { k: "nome", rot: "SKU", cls: "name", dir: "asc", val: l => l.sku.codigo, csv: l => l.sku.codigo,
              html: (l, i) => `<span class="cellx"><span class="rk ${i < 3 ? "top" : ""}">${i + 1}</span><i class="sw" style="--c:${l.sku.hex}; margin-right:8px"></i><span class="nm"><b>${l.sku.codigo}</b><small>${esc(l.la.nome)} · ${esc(l.sku.cor)}</small></span></span>` },
            { k: "lanc", rot: "Lançamento", dir: "asc", val: l => l.la.nome, csv: l => l.la.nome, html: l => esc(l.la.nome) },
            { k: "cor", rot: "Cor", dir: "asc", val: l => l.sku.cor, csv: l => l.sku.cor, html: l => esc(l.sku.cor), cls: "muted" },
            { k: "data", rot: "Lançado em", val: l => l.la.data, csv: l => l.la.data, html: l => fmt.data(l.la.data) },
            { k: "lojas", rot: "Lojas", r: true, val: l => l.lojas, csv: l => l.lojas, html: l => fmt.int(l.lojas) },
            ...colsMedidas(linhas, media),
          ],
          aoClicar: l => abrirLancamento(l.la.i, l.sku.i),
        });
        $("#info-lanc", el).textContent = `${fmt.int(linhas.length)} SKUs`;
      }
    };
    desenhar();
    const busca = $("#busca-lanc", el);
    let espera = null;
    busca.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(() => { estado.busca.lanc = busca.value; estado.paginas.lanc = estado.paginas.sku = 0; desenhar(); }, 160);
    });
    $$(".seg button", el).forEach(b => b.addEventListener("click", () => {
      estado.vistaLanc = b.dataset.v;
      $$(".seg button", el).forEach(x => x.classList.toggle("on", x === b));
      desenhar();
    }));
    ligarXl(el, "xl-lanc", () => exportar(cfg, estado.vistaLanc === "lanc" ? "lancamentos" : "skus"));
  }

  /* ================= Por loja e Por franqueado ================= */
  function paginaPorLoja(el, por) {
    const r = filtrar();
    const fr = por === "franqueado";
    const fatos = fr ? r.fatos.filter(f => D.lojas[f.l].franqueado) : r.fatos;
    const tot = SS.total(fatos, D);
    const usa4 = tot.si4 > 0;
    const met = a => usa4 ? SS.st4(a) : SS.st(a);
    const nomeMet = usa4 ? "Sell-through 4S" : "Sell-through";
    const media = met(tot);
    const grupos = SS.agrupar(fatos, fr ? f => D.lojas[f.l].franqueado : f => f.l, D);
    const nLanc = contarDistintos(fatos, fr ? f => D.lojas[f.l].franqueado : f => f.l, f => f.la);
    const nLojasFr = fr ? contarDistintos(fatos, f => D.lojas[f.l].franqueado, f => f.l) : null;
    const linhas = [...grupos].map(([k, a]) => {
      if (fr) {
        const f = D.franqPorNome[k];
        const ls = f.lojas.map(i => D.lojas[i]);
        return { chave: k, nome: k, fr: f, a, lancs: nLanc.get(k).size, nLojas: nLojasFr.get(k).size, totalLojas: ls.length,
          ufs: [...new Set(ls.map(l => l.uf))].join(", "), regioes: [...new Set(ls.map(l => l.regiao))].join(", "),
          sub: `${ls.length} ${ls.length === 1 ? "loja" : "lojas"} · ${[...new Set(ls.map(l => l.uf))].join(", ")}` };
      }
      const l = D.lojas[k];
      return { chave: l.id, nome: l.nome, loja: l, a, lancs: nLanc.get(k).size, sub: `${D.canalPorId[l.canal].curto} · ${l.regiao} · ${l.uf}` };
    });
    const nomeEnt = fr ? "franqueados" : "lojas";

    el.innerHTML = `
      <div class="kpi-band k4">
        ${kpi(fr ? "Franqueados" : "Lojas", fmt.int(linhas.length), fr ? `<b>${fmt.int(new Set(fatos.map(f => f.l)).size)}</b> lojas franqueadas` : `em <b>${fmt.int(new Set(linhas.map(l => l.loja.canal)).size)}</b> canais`)}
        ${kpi("Sell-in", `${fmt.int(tot.si)} <small>peças</small>`, `<b>${fmt.int(linhas.length ? tot.si / linhas.length : 0)}</b> por ${fr ? "franqueado" : "loja"}`)}
        ${kpi("Sell-out", `${fmt.int(tot.so)} <small>peças</small>`, `<b>${fmt.brl(tot.rso)}</b> · estoque ${fmt.int(SS.estoque(tot))}`)}
        ${kpi(nomeMet, fmt.pct(media), `sell-through total <b>${fmt.pct(SS.st(tot))}</b>`, media)}
      </div>
      ${barraSelecao()}
      ${!linhas.length ? `<div class="card empty">Nenhum ${fr ? "franqueado" : "loja"} com os filtros escolhidos.</div>` : `
      <div class="grid2">
        <div class="card">${cab("Vendendo melhor", `${nomeMet} mais alto entre ${nomeEnt} com volume relevante (sell-in acima da mediana)`)}<div id="pl-bons"></div></div>
        <div class="card">${cab("Pedem atenção", `${nomeMet} mais baixo, mesmo critério de volume · o traço é a média`)}<div id="pl-ruins"></div></div>
      </div>
      <div class="card block">${cab(fr ? "Um quadrado por franqueado" : "Um quadrado por loja",
        fr ? "Agrupados pelo número de lojas · a cor compara com a média · clique abre o detalhe" : "Agrupadas por região · a cor compara com a média · clique abre o detalhe",
        `<span class="sq-legend">abaixo<span class="scale">${[-0.15, -0.07, 0, 0.07, 0.15].map(d => `<span style="background:${calor((media || 0) + d, media)}"></span>`).join("")}</span>acima</span>`)}
        <div id="pl-quad"></div></div>
      <div class="card block">
        <div class="toolbar"><div class="l"><input type="search" id="busca-pl" placeholder="Buscar ${fr ? "franqueado" : "loja, canal, região ou UF"}…" value="${esc(estado.busca.lojas)}" aria-label="Buscar"><span class="info" id="info-pl"></span></div>
          <div class="r">${botaoXl("xl-pl")}</div></div>
        <div id="tab-pl"></div></div>`}
      ${comoCalculamos()}`;
    if (!linhas.length) return;

    // destaques
    const vols = linhas.map(l => usa4 ? l.a.si4 : l.a.si).sort((x, y) => x - y);
    const mediana = vols[Math.floor(vols.length / 2)] || 0;
    const elegiveis = linhas.filter(l => (usa4 ? l.a.si4 : l.a.si) >= Math.max(10, mediana) && met(l.a) != null);
    const ordenados = elegiveis.slice().sort((x, y) => met(y.a) - met(x.a));
    const abrir = l => fr ? abrirFranqueado(l.chave) : abrirLoja(l.loja.i);
    const lista = (box, itens, cor) => {
      if (!itens.length) { box.innerHTML = '<div class="empty">Sem volume suficiente para comparar.</div>'; return; }
      const max = Math.max(media || 0, ...itens.map(l => met(l.a))) * 1.05 || 1;
      box.innerHTML = `<div class="leaders">${itens.map((l, i) => `<div class="leader" data-i="${i}" title="Abrir ${esc(l.nome)}">
        <span class="medal ${cor === "--good" && i < 3 ? "m" + (i + 1) : ""}">${i + 1}</span>
        <span class="nm"><b>${esc(l.nome)}</b><small>${esc(l.sub)}</small></span>
        <span class="track" style="--c:var(${cor})"><i style="width:${met(l.a) / max * 100}%"></i><u style="left:${(media || 0) / max * 100}%"></u></span>
        <b>${fmt.pct(met(l.a))}</b></div>`).join("")}</div>`;
      $$(".leader", box).forEach(d => d.addEventListener("click", () => abrir(itens[+d.dataset.i])));
    };
    const n = Math.min(5, Math.floor(ordenados.length / 2));
    lista($("#pl-bons", el), ordenados.slice(0, n), "--good");
    lista($("#pl-ruins", el), ordenados.slice(-n).reverse(), "--bad");

    // quadrados
    const grupos2 = fr
      ? [["1 loja", l => l.totalLojas === 1], ["2 a 3 lojas", l => l.totalLojas >= 2 && l.totalLojas <= 3], ["4 lojas ou mais", l => l.totalLojas >= 4]]
      : D.regioes.map(rg => [rg, l => l.loja.regiao === rg]);
    $("#pl-quad", el).innerHTML = `<div class="squares-wrap">${grupos2.map(([nome, ok]) => {
      const itens = linhas.filter(ok).sort((x, y) => (met(y.a) || 0) - (met(x.a) || 0));
      if (!itens.length) return "";
      return `<div class="sq-group"><h4>${esc(nome)}<small>${itens.length} ${itens.length === 1 ? (fr ? "franqueado" : "loja") : nomeEnt}</small></h4><div class="squares">${itens.map(l =>
        `<button type="button" class="sq" data-k="${esc(l.chave)}" style="--heat:${calor(met(l.a), media)}" title="${esc(l.nome)} · ${nomeMet} ${fmt.pct(met(l.a))} · sell-in ${fmt.int(l.a.si)}" aria-label="${esc(l.nome)}"></button>`).join("")}</div></div>`;
    }).join("")}</div>`;
    $$(".sq", el).forEach(b => b.addEventListener("click", () => abrir(linhas.find(l => String(l.chave) === b.dataset.k))));

    // tabela
    let cfg = null;
    const desenhar = () => {
      const termo = estado.busca.lojas.trim().toLowerCase();
      const vis = linhas.filter(l => !termo || `${l.nome} ${l.sub} ${fr ? l.regioes : l.loja.tipo}`.toLowerCase().includes(termo));
      const colunas = fr ? [
        colRank("Franqueado", l => l.nome, l => l.sub),
        { k: "nl", rot: "Lojas", r: true, val: l => l.totalLojas, csv: l => l.totalLojas, html: l => fmt.int(l.totalLojas) },
        { k: "uf", rot: "UF", dir: "asc", val: l => l.ufs, csv: l => l.ufs, html: l => esc(l.ufs), cls: "muted" },
        { k: "rg", rot: "Região", dir: "asc", val: l => l.regioes, csv: l => l.regioes, html: l => esc(l.regioes), cls: "muted" },
      ] : [
        colRank("Loja", l => l.nome, l => l.sub),
        { k: "id", rot: "Código", csv: l => l.loja.id, soCsv: true },
        { k: "canal", rot: "Canal", dir: "asc", val: l => D.canalPorId[l.loja.canal].nome, csv: l => D.canalPorId[l.loja.canal].nome, html: l => esc(D.canalPorId[l.loja.canal].nome) },
        { k: "rg", rot: "Região", csv: l => l.loja.regiao, soCsv: true },
        { k: "uf", rot: "UF", csv: l => l.loja.uf, soCsv: true },
        { k: "fr", rot: "Franqueado", dir: "asc", val: l => l.loja.franqueado || "", csv: l => l.loja.franqueado || "", html: l => esc(l.loja.franqueado || "–"), cls: "muted" },
      ];
      colunas.push({ k: "lancs", rot: "Lançamentos", r: true, val: l => l.lancs, csv: l => l.lancs, html: l => fmt.int(l.lancs) });
      colunas.push(...colsMedidas(vis, SS.st4(tot), { receita: true }));
      cfg = tabela($("#tab-pl", el), { id: "pl-" + por, linhas: vis, alta: true, ordem: { k: "si", dir: "desc" }, colunas, aoClicar: abrir,
        sel: l => fr ? false : estado.f.loja.includes(l.loja.id) });
      $("#info-pl", el).textContent = `${fmt.int(vis.length)} ${nomeEnt}`;
    };
    desenhar();
    const busca = $("#busca-pl", el);
    let espera = null;
    busca.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(() => { estado.busca.lojas = busca.value; desenhar(); }, 160); });
    ligarXl(el, "xl-pl", () => exportar(cfg, fr ? "por_franqueado" : "por_loja"));
  }

  /* ================= gaveta de detalhe ================= */
  function abrirGaveta(html, montar) {
    fecharGaveta();
    const fundo = document.createElement("div");
    fundo.className = "drawer-bg";
    fundo.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`;
    document.body.appendChild(fundo);
    document.body.style.overflow = "hidden";
    fundo.addEventListener("click", e => { if (e.target === fundo || e.target.closest("[data-a='fechar-gaveta']")) fecharGaveta(); });
    const g = $(".drawer", fundo);
    montar(g);
    const x = $("[data-a='fechar-gaveta']", g);
    if (x) x.focus();
  }

  function fecharGaveta() {
    limparGraficos(graficosGaveta);
    const g = $(".drawer-bg");
    if (g) g.remove();
    document.body.style.overflow = "";
  }

  const botaoFechar = `<button class="btn icon x" type="button" data-a="fechar-gaveta" aria-label="Fechar" title="Fechar (Esc)">${ICN.fechar}</button>`;
  const stats = itens => `<div class="stats">${itens.map(([t, v, s]) => `<div><span>${t}</span><b>${v}</b><small>${s || "&nbsp;"}</small></div>`).join("")}</div>`;

  function abrirLancamento(i, skuEscolhido) {
    const la = D.lancamentos[i];
    let fatos = filtrar(["avaliacao", "sku"]).fatos.filter(f => f.la === i);
    if (!fatos.length) fatos = D.fatos.filter(f => f.la === i);
    const a = SS.total(fatos, D);
    const av = SS.avaliar(la, a, D);
    const media = SS.st4(filtrar().total);
    const cat = D.catPorId[la.categoria];
    const sku0 = D.skus[skuEscolhido != null ? skuEscolhido : la.skus[0]];
    const sem = la.semanas < 0 ? "ainda não lançado" : `${la.semanas} ${la.semanas === 1 ? "semana" : "semanas"} desde o lançamento`;
    const nLojas = new Set(fatos.map(f => f.l)).size;

    abrirGaveta(`
      <div class="drawer-top">
        <div class="art">${SS.arte(la, sku0.hex)}</div>
        <div>
          <p class="eyebrow"><i class="dot"></i>${esc(cat.nome)} · ${esc(D.colPorId[la.colecao].nome)}</p>
          <h2>${esc(la.nome)}</h2>
          <p class="meta">${la.codigo} · lançado em ${fmt.data(la.data)} · ${fmt.brlCheio(la.preco)} · ${la.status} · ${sem}</p>
          <div class="actions">${pill(av)}<button class="btn small" type="button" data-a="filtrar">Filtrar o site por este lançamento</button></div>
        </div>
        ${botaoFechar}
      </div>
      ${stats([
        ["Sell-in", fmt.int(a.si), `${fmt.int(fatos.reduce((s, f) => s + f.i0, 0))} na remessa inicial`],
        ["Sell-out", fmt.int(a.so), fmt.brl(a.rso)],
        ["Sell-through", fmt.pct(SS.st(a)), "até hoje"],
        ["Sell-through 4S", fmt.pct(SS.st4(a)), SS.st4(a) != null ? `${fmt.pp(dif(SS.st4(a), media))} vs média` : "4 semanas incompletas"],
        ["Estoque nas lojas", fmt.int(SS.estoque(a)), "peças"],
        ["Lojas", fmt.int(nLojas), `${la.skus.length} ${la.skus.length === 1 ? "cor" : "cores"}`],
        ["Régua da categoria", cat.regua.join(" / ") + "%", "Ótimo / Bom / Regular"],
        ["Preço", fmt.brlCheio(la.preco), "preço de venda sugerido"],
      ])}
      <div class="card">${cab("Sell-out a cada 4 semanas", "Peças vendidas em cada bloco de 4 semanas · a linha é o sell-through acumulado")}
        ${legenda([["Sell-out do bloco", cssVar("--s-out")], ["Sell-through acumulado", cssVar("--mod-accent"), true]])}
        <div class="chart short"><canvas id="gv-curva" role="img" aria-label="Sell-out por bloco de 4 semanas"></canvas></div></div>
      <div class="card">${cab("Variações de cor (SKUs)", "Cada cor do modelo nas lojas da seleção", botaoXl("xl-gv-sku"))}<div id="gv-skus"></div></div>
      <div class="grid2">
        <div class="card">${cab("Por canal", "")}<div id="gv-canal"></div></div>
        <div class="card">${cab("Por região", "")}<div id="gv-reg"></div></div>
      </div>
      <div class="card">${cab("Lojas", "Lojas que receberam o lançamento", botaoXl("xl-gv-lojas"))}<div id="gv-lojas"></div></div>`,
    g => {
      // curva por blocos
      const blocos = Math.max(0, Math.min(6, Math.ceil(Math.max(0, la.semanas) / 4)));
      const so = [], acum = [];
      let siAc = 0, soAc = 0;
      for (let b = 0; b < blocos; b++) {
        const fim = (b + 1) * 4;
        const v = fatos.reduce((s, f) => s + f.b[b], 0);
        soAc += v;
        siAc = fatos.reduce((s, f) => s + f.i0 + (fim >= 7 ? f.r1 : 0) + (fim >= 15 ? f.r2 : 0), 0);
        so.push(v);
        acum.push(siAc ? soAc / siAc : null);
      }
      if (!blocos) $("#gv-curva", g).parentElement.innerHTML = '<div class="chart-fallback">Ainda sem vendas: o lançamento está em pré-venda.</div>';
      else novoGrafico($("#gv-curva", g), {
        type: "bar",
        data: { labels: so.map((_, b) => `sem. ${b * 4 + 1}–${b * 4 + 4}`), datasets: [
          { label: "Sell-out", data: so, backgroundColor: cssVar("--s-out"), borderRadius: 4, yAxisID: "y", order: 2 },
          { label: "Sell-through acumulado", type: "line", data: acum, yAxisID: "y2", order: 1, borderColor: cssVar("--mod-accent"),
            backgroundColor: cssVar("--mod-accent"), borderWidth: 2.5, pointRadius: 3, tension: 0.3 }] },
        options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { ...tooltipBase(), callbacks: { label: c => c.dataset.yAxisID === "y2" ? ` ${fmt.pct(c.raw)}` : ` ${fmt.int(c.raw)} peças` } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true }, y2: { position: "right", min: 0, max: 1, grid: { display: false }, ticks: { callback: v => fmt.pct(v, 0) } } } },
      }, graficosGaveta);

      // SKUs
      const lojasSku = contarDistintos(fatos, f => f.k, f => f.l);
      const linhasSku = [...SS.agrupar(fatos, f => f.k, D)].map(([k, x]) => ({ sku: D.skus[k], a: x, lojas: lojasSku.get(k).size }));
      const cfgSku = tabela($("#gv-skus", g), {
        id: "gv-sku", linhas: linhasSku, ordem: { k: "si", dir: "desc" }, sel: l => skuEscolhido != null && l.sku.i === skuEscolhido,
        colunas: [
          { k: "nome", rot: "SKU", cls: "name", dir: "asc", val: l => l.sku.codigo, csv: l => l.sku.codigo,
            html: l => `<span class="cellx"><i class="sw" style="--c:${l.sku.hex}; margin-right:8px"></i><span class="nm"><b>${l.sku.codigo}</b><small>${esc(l.sku.cor)}</small></span></span>` },
          { k: "cor", rot: "Cor", csv: l => l.sku.cor, html: l => esc(l.sku.cor), cls: "muted" },
          { k: "lojas", rot: "Lojas", r: true, val: l => l.lojas, csv: l => l.lojas, html: l => fmt.int(l.lojas) },
          { k: "part", rot: "Participação", r: true, val: l => l.a.si / (a.si || 1), csv: l => l.a.si / (a.si || 1), html: l => fmt.pct(l.a.si / (a.si || 1), 0) },
          ...colsMedidas(linhasSku, SS.st4(a)),
        ],
      });
      ligarXl(g, "xl-gv-sku", () => exportar(cfgSku, `skus_${la.codigo}`));

      const canais = [...SS.agrupar(fatos, f => D.lojas[f.l].canal, D)].map(([k, x]) => ({ chave: k, nome: D.canalPorId[k].nome, a: x })).sort((p, q) => q.a.si - p.a.si);
      barrasH($("#gv-canal", g), canais, { media: SS.st(a) });
      const regs = [...SS.agrupar(fatos, f => D.lojas[f.l].regiao, D)].map(([k, x]) => ({ chave: k, nome: k, a: x })).sort((p, q) => q.a.si - p.a.si);
      barrasH($("#gv-reg", g), regs, { media: SS.st(a) });

      const linhasLoja = [...SS.agrupar(fatos, f => f.l, D)].map(([k, x]) => ({ loja: D.lojas[k], a: x }));
      const cfgLoja = tabela($("#gv-lojas", g), {
        id: "gv-lojas", linhas: linhasLoja, ordem: { k: "si", dir: "desc" },
        colunas: [
          colRank("Loja", l => l.loja.nome, l => `${D.canalPorId[l.loja.canal].curto} · ${l.loja.regiao} · ${l.loja.uf}`),
          { k: "canal", rot: "Canal", csv: l => D.canalPorId[l.loja.canal].nome, soCsv: true },
          ...colsMedidas(linhasLoja, SS.st4(a)),
        ],
        aoClicar: l => abrirLoja(l.loja.i),
      });
      ligarXl(g, "xl-gv-lojas", () => exportar(cfgLoja, `lojas_${la.codigo}`));

      $("[data-a='filtrar']", g).addEventListener("click", () => {
        estado.f.categoria = [la.categoria];
        estado.f.colecao = [la.colecao];
        estado.f.sku = la.skus.map(k => D.skus[k].codigo);
        fecharGaveta();
        aplicar();
      });
    });
  }

  function gavetaEntidade({ titulo, eyebrow, meta, fatos, botao, aoFiltrar, extraCartao, montarExtra }) {
    const a = SS.total(fatos, D);
    const media = SS.st4(filtrar().total);
    const r = { fatos, porLanc: SS.agrupar(fatos, f => f.la, D), av: new Map() };
    for (const [i, x] of r.porLanc) r.av.set(i, SS.avaliar(D.lancamentos[i], x, D));
    const geral = SS.avaliarConjunto(fatos, D);
    abrirGaveta(`
      <div class="drawer-top">
        <div class="art" style="display:grid;place-items:center;background:var(--mod);color:var(--mod-fg);font-size:28px;font-weight:700">${esc(titulo.split(" ").map(p => p[0]).slice(0, 2).join(""))}</div>
        <div>
          <p class="eyebrow"><i class="dot"></i>${esc(eyebrow)}</p>
          <h2>${esc(titulo)}</h2>
          <p class="meta">${esc(meta)}</p>
          <div class="actions">${geral.id ? pill(geral.id) : ""}<button class="btn small" type="button" data-a="filtrar">${botao}</button></div>
        </div>
        ${botaoFechar}
      </div>
      ${stats([
        ["Sell-in", fmt.int(a.si), fmt.brl(a.rsi)],
        ["Sell-out", fmt.int(a.so), fmt.brl(a.rso)],
        ["Sell-through", fmt.pct(SS.st(a)), "até hoje"],
        ["Sell-through 4S", fmt.pct(SS.st4(a)), SS.st4(a) != null ? `${fmt.pp(dif(SS.st4(a), media))} vs média` : "–"],
      ])}
      ${extraCartao || ""}
      <div class="card">${cab("Lançamentos", `Lançamentos de ${textoPeriodo()} que chegaram aqui · clique abre o detalhe`, botaoXl("xl-gv-lanc"))}<div id="gv-lanc"></div></div>`,
    g => {
      const linhas = linhasLancamentos(r);
      const cfg = tabela($("#gv-lanc", g), { id: "gv-lanc", linhas, ordem: { k: "si", dir: "desc" }, colunas: colunasLancamentos(linhas, media),
        aoClicar: l => abrirLancamento(l.la.i) });
      ligarXl(g, "xl-gv-lanc", () => exportar(cfg, `lancamentos_${titulo.replace(/\s+/g, "_").toLowerCase()}`));
      if (montarExtra) montarExtra(g, media);
      $("[data-a='filtrar']", g).addEventListener("click", () => { aoFiltrar(); fecharGaveta(); aplicar(); });
    });
  }

  function abrirLoja(i) {
    const l = D.lojas[i];
    const fatos = filtrar(["loja"]).fatos.filter(f => f.l === i);
    gavetaEntidade({
      titulo: l.nome, eyebrow: `${D.canalPorId[l.canal].nome} · ${l.tipo}`,
      meta: `${l.id} · ${l.regiao} · ${l.uf}${l.franqueado ? ` · ${l.franqueado}` : ""}`,
      fatos, botao: "Filtrar o site por esta loja",
      aoFiltrar: () => { estado.f.loja = [l.id]; },
    });
  }

  function abrirFranqueado(nome) {
    const fr = D.franqPorNome[nome];
    const ids = new Set(fr.lojas);
    const fatos = filtrar(["loja"]).fatos.filter(f => ids.has(f.l));
    const ls = fr.lojas.map(i => D.lojas[i]);
    gavetaEntidade({
      titulo: fr.nome, eyebrow: "Franquias",
      meta: `${ls.length} ${ls.length === 1 ? "loja" : "lojas"} · ${[...new Set(ls.map(l => l.regiao))].join(", ")} · ${[...new Set(ls.map(l => l.uf))].join(", ")}`,
      fatos, botao: "Filtrar o site por este franqueado",
      aoFiltrar: () => { estado.f.loja = ls.map(l => l.id); },
      extraCartao: `<div class="card">${cab("Lojas do franqueado", "Clique abre a loja", botaoXl("xl-gv-fl"))}<div id="gv-fl"></div></div>`,
      montarExtra: (g, media) => {
        const linhas = [...SS.agrupar(fatos, f => f.l, D)].map(([k, x]) => ({ loja: D.lojas[k], a: x }));
        const cfg = tabela($("#gv-fl", g), { id: "gv-fl", linhas, ordem: { k: "si", dir: "desc" },
          colunas: [colRank("Loja", l => l.loja.nome, l => `${l.loja.regiao} · ${l.loja.uf} · ${l.loja.tipo}`), ...colsMedidas(linhas, media)],
          aoClicar: l => abrirLoja(l.loja.i) });
        ligarXl(g, "xl-gv-fl", () => exportar(cfg, `lojas_${fr.nome.replace(/\s+/g, "_").toLowerCase()}`));
      },
    });
  }

  /* ================= "Como calculamos" ================= */
  function comoCalculamos() {
    const regras = [
      "<b>Sell-in</b>: peças enviadas pela marca às lojas (remessa inicial, uma semana antes do lançamento, mais as reposições).",
      "<b>Sell-out</b>: peças vendidas pela loja ao consumidor final.",
      "<b>Sell-through</b> = sell-out ÷ sell-in, acumulado até a data dos dados.",
      "<b>Sell-through 4S</b> = vendas das 4 primeiras semanas ÷ remessa inicial; só entram lançamentos com as 4 semanas completas.",
      "<b>Estoque nas lojas</b> = sell-in − sell-out (o que ainda está na loja).",
      "<b>Receita</b>: sell-out × preço de venda. Sell-in em R$: peças × preço × 0,48 (preço de atacado fictício).",
      "<b>Avaliação</b>: Sell-through 4S do lançamento contra a régua da categoria. Menos de 4 semanas: Em maturação; data futura: Pré-venda.",
      "<b>Período</b>: é o mês ou ano do lançamento. Os movimentos desses lançamentos (inclusive os de meses seguintes) entram no cálculo.",
      "<b>Filtros em cascata</b>: canal → região → loja e categoria → coleção → SKU. Cada filtro limita as opções do próximo; ao mudar um filtro de cima, as escolhas de baixo que deixaram de existir saem sozinhas.",
      "<b>Cliques</b>: barras, cartões e linhas filtram o site; Ctrl+clique soma itens; clicar de novo tira o filtro.",
      `<b>Dados</b>: sintéticos, gerados no navegador (semente ${semente}). Marca, lojas, franqueados e produtos são fictícios.`,
    ];
    return `<details class="how"><summary><span>+</span>Como calculamos</summary><ul>${regras.map(r => `<li>${r}</li>`).join("")}</ul></details>
      <p class="disclaimer">Projeto de portfólio. Marca, dados e código fictícios, gerados sinteticamente; não contém código, dados, fotos ou logos de nenhuma empresa.</p>`;
  }

  /* ================= topo: chips, painel de filtros e período ================= */
  function desenharChips() {
    const F = estado.f;
    $("#chips").innerHTML = [
      `<button type="button" class="chip canal ${F.canal.length ? "" : "on"}" data-canal="">Todos os canais</button>`,
      ...D.canais.map(c => `<button type="button" class="chip canal ${F.canal.includes(c.id) ? "on" : ""}" data-canal="${c.id}" title="${c.nome} · Ctrl+clique soma canais">${c.curto}</button>`),
      '<i class="chip-sep" aria-hidden="true"></i>',
      ...D.categorias.map(c => `<button type="button" class="chip ${F.categoria.includes(c.id) ? "on" : ""}" data-cat="${c.id}" title="${c.nome} · Ctrl+clique soma categorias">${c.curto || c.nome}</button>`),
    ].join("");
    const n = nFiltros();
    const cont = $("#contador");
    cont.hidden = !n;
    cont.textContent = n;
  }

  let painelAberto = false;
  function botaoFiltro(k) {
    const sel = estado.f[k];
    const n = opcoes(k).length;
    const val = !sel.length ? `Todos (${n})` : sel.length === 1 ? rotulo(k, sel[0]) : `${sel.length} selecionados`;
    return `<div class="flt ${sel.length ? "on" : ""}" data-k="${k}"><button type="button" aria-haspopup="listbox">
      <span><span class="lbl">${FILTROS[k].rot}${FILTROS[k].pais ? ` <i>· conforme ${FILTROS[k].pais}</i>` : ""}</span><span class="val">${esc(val)}</span></span>
      <span class="car" aria-hidden="true">▼</span></button></div>`;
  }

  function desenharPainel() {
    const p = $("#painel");
    if (!painelAberto) { p.hidden = true; return; }
    const n = nFiltros();
    p.hidden = false;
    p.innerHTML = `
      <div class="panel-head"><b>Filtros</b><span>${n ? `${n} ${n === 1 ? "escolha ativa" : "escolhas ativas"}` : "nenhum filtro ativo"} · lançamentos de ${textoPeriodo()}</span>
        <button class="panel-close" type="button" data-a="fechar" aria-label="Fechar filtros">✕</button></div>
      <p class="panel-sec">Loja<small>canal → região → loja: cada um limita as opções do próximo</small></p>
      <div class="panel-grid">${["canal", "regiao", "loja"].map(botaoFiltro).join("")}</div>
      <p class="panel-sec">Produto<small>categoria → coleção → SKU</small></p>
      <div class="panel-grid">${["categoria", "colecao", "sku"].map(botaoFiltro).join("")}</div>
      <p class="panel-sec">Desempenho</p>
      <div class="panel-grid">${botaoFiltro("avaliacao")}</div>
      <div class="panel-foot"><button class="btn small" type="button" data-a="limpar">Limpar filtros</button><button class="btn small dark" type="button" data-a="fechar">Pronto</button></div>`;
  }

  function abrirPainel(abrir = !painelAberto) {
    painelAberto = abrir;
    $("#btn-filtros").setAttribute("aria-expanded", String(abrir));
    desenharPainel();
  }

  function abrirPop(flt) {
    const aberto = $(".pop", flt);
    $$(".pop").forEach(p => p.remove());
    if (aberto) return;
    const k = flt.dataset.k;
    const ops = opcoes(k);
    const sel = new Set(estado.f[k]);
    const pop = document.createElement("div");
    pop.className = "pop";
    pop.innerHTML = `<input type="search" placeholder="Buscar ${FILTROS[k].rot.toLowerCase()}…" aria-label="Buscar opção">
      <div class="list" role="listbox" aria-multiselectable="true">${ops.length ? ops.map(o =>
        `<label data-t="${esc((o.t + " " + (o.s || "")).toLowerCase())}"><input type="checkbox" value="${esc(o.v)}" ${sel.has(o.v) ? "checked" : ""}>${esc(o.t)}${o.s ? `<small>${esc(o.s)}</small>` : ""}</label>`).join("")
        : '<div class="none">Nenhuma opção com os filtros de cima.</div>'}</div>
      <div class="pop-foot"><button type="button" data-a="nada">Limpar</button><button type="button" class="ok" data-a="ok">Aplicar</button></div>`;
    flt.appendChild(pop);
    const busca = $("input[type=search]", pop);
    busca.focus();
    busca.addEventListener("input", () => {
      const t = busca.value.trim().toLowerCase();
      $$("label", pop).forEach(l => { l.hidden = t && !l.dataset.t.includes(t); });
    });
    pop.addEventListener("click", e => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "nada") $$("input[type=checkbox]", pop).forEach(c => { c.checked = false; });
      if (a.dataset.a === "ok") {
        estado.f[k] = $$("input[type=checkbox]:checked", pop).map(c => c.value);
        aplicar();
      }
    });
    busca.addEventListener("keydown", e => {
      if (e.key === "Enter") { estado.f[k] = $$("input[type=checkbox]:checked", pop).map(c => c.value); aplicar(); }
    });
  }

  function desenharPeriodo() {
    const idx = estado.ano * 12 + estado.mes - 1;
    const min = ANO_MIN * 12, max = D.anoRef * 12 + MES_REF - 1;
    const ano = estado.modo === "ano";
    const voltar = ano ? estado.ano > ANO_MIN : idx > min;
    const avancar = ano ? estado.ano < D.anoRef : idx < max;
    const rot = ano ? String(estado.ano) : fmt.mes(`${estado.ano}-${String(estado.mes).padStart(2, "0")}`);
    $("#periodo").innerHTML = `<div class="seg" role="group" aria-label="Ano ou mês">
        <button type="button" data-m="ano" class="${ano ? "on" : ""}">Ano</button><button type="button" data-m="mes" class="${ano ? "" : "on"}">Mês</button></div>
      <div class="stepper"><button type="button" data-p="-1" ${voltar ? "" : "disabled"} aria-label="Período anterior">${ICN.esq}</button>
        <b aria-live="polite">${rot}</b><button type="button" data-p="1" ${avancar ? "" : "disabled"} aria-label="Próximo período">${ICN.dir}</button></div>`;
  }

  function moverPeriodo(passo) {
    if (estado.modo === "ano") {
      estado.ano = Math.max(ANO_MIN, Math.min(D.anoRef, estado.ano + passo));
    } else {
      const max = D.anoRef * 12 + MES_REF - 1;
      const idx = Math.max(ANO_MIN * 12, Math.min(max, estado.ano * 12 + estado.mes - 1 + passo));
      estado.ano = Math.floor(idx / 12);
      estado.mes = idx % 12 + 1;
    }
    aplicar(true);
  }

  /* ================= desenho geral ================= */
  function desenharPagina() {
    limparGraficos(graficos);
    const el = $("#conteudo");
    $("#titulo").textContent = PAGINAS[estado.pagina];
    document.title = `${PAGINAS[estado.pagina]} · Sellin e Sellout · Demo Retail Co.`;
    const r = filtrar();
    $("#subtitulo").textContent = `${fmt.int(r.porLanc.size)} lançamentos de ${textoPeriodo()} · ${fmt.int(new Set(r.fatos.map(f => f.l)).size)} lojas · dados até ${fmt.data(D.dataRef)}`;
    $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.page === estado.pagina));
    if (estado.pagina === "lancamentos") paginaLancamentos(el);
    else if (estado.pagina === "lojas") paginaPorLoja(el, "loja");
    else if (estado.pagina === "franqueados") paginaPorLoja(el, "franqueado");
    else paginaGeral(el);
  }

  function aplicar(mudouPeriodo = false) {
    memo = new Map();
    podar();
    if (mudouPeriodo) estado.paginas = {};
    desenharChips();
    desenharPeriodo();
    desenharPainel();
    desenharPagina();
  }

  function lerHash() {
    const h = location.hash.replace("#", "");
    estado.pagina = PAGINAS[h] ? h : "geral";
  }

  /* ================= tema e menu ================= */
  function temaEscuro() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function ligarEventos() {
    window.addEventListener("hashchange", () => { lerHash(); fecharGaveta(); desenharPagina(); window.scrollTo(0, 0); });

    $("#chips").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.canal !== undefined) {
        if (!b.dataset.canal) { estado.f.canal = []; aplicar(); } else alternar("canal", b.dataset.canal, e);
      } else if (b.dataset.cat) alternar("categoria", b.dataset.cat, e);
    });

    $("#btn-filtros").addEventListener("click", e => { e.stopPropagation(); abrirPainel(); });
    $("#painel").addEventListener("click", e => {
      e.stopPropagation();
      const a = e.target.closest("[data-a]");
      if (a && !a.closest(".pop")) {
        if (a.dataset.a === "fechar") abrirPainel(false);
        if (a.dataset.a === "limpar") { CHAVES.forEach(k => { estado.f[k] = []; }); aplicar(); }
        return;
      }
      const botao = e.target.closest(".flt > button");
      if (botao) abrirPop(botao.parentElement);
    });
    document.addEventListener("click", e => {
      if (painelAberto && !e.target.closest("#painel") && !e.target.closest("#btn-filtros")) abrirPainel(false);
    });

    $("#periodo").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.m && b.dataset.m !== estado.modo) {
        estado.modo = b.dataset.m;
        if (estado.modo === "mes") {
          // abre no último mês com lançamentos completos do ano escolhido
          estado.mes = estado.ano === D.anoRef ? Math.max(1, MES_REF - 1) : 12;
        }
        aplicar(true);
      } else if (b.dataset.p) moverPeriodo(Number(b.dataset.p));
    });

    $("#conteudo").addEventListener("click", e => {
      const chip = e.target.closest(".sel-chip");
      if (chip) { estado.f[chip.dataset.k] = estado.f[chip.dataset.k].filter(v => v !== chip.dataset.v); aplicar(); return; }
      if (e.target.closest("[data-a='limpar-sel']")) { CHAVES.forEach(k => { estado.f[k] = []; }); aplicar(); }
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if ($(".pop")) { $$(".pop").forEach(p => p.remove()); return; }
      if ($(".drawer-bg")) { fecharGaveta(); return; }
      if (painelAberto) abrirPainel(false);
    });

    $("#btn-tema").addEventListener("click", () => {
      const novo = temaEscuro() ? "light" : "dark";
      document.documentElement.dataset.theme = novo;
      gravarLocal("ss-tema", novo);
      desenharPagina();
    });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.dataset.theme) desenharPagina(); });

    const shell = $("#shell"), mini = $("#btn-mini");
    const aplicarMini = m => {
      shell.classList.toggle("mini", m);
      mini.setAttribute("aria-expanded", String(!m));
      mini.title = m ? "Expandir menu" : "Recolher menu";
      mini.setAttribute("aria-label", mini.title);
    };
    aplicarMini(lerLocal("ss-menu") === "mini");
    mini.addEventListener("click", () => {
      const m = !shell.classList.contains("mini");
      aplicarMini(m);
      gravarLocal("ss-menu", m ? "mini" : "");
      setTimeout(() => graficos.forEach(g => g.resize()), 220);
    });

    $("#btn-semente").addEventListener("click", () => {
      const nova = 1 + Math.floor(Math.random() * 999999);
      const u = new URL(location.href);
      u.searchParams.set("seed", String(nova));
      location.href = u.toString();
    });
    // o Modo TV abre com a mesma semente
    if (parametros.get("seed")) $("#btn-tv").href = `tv.html?seed=${encodeURIComponent(semente)}`;
  }

  function iniciar() {
    $("#data-info").innerHTML = `<b><i aria-hidden="true"></i>Dados sintéticos</b><span>Semente ${semente} · até ${fmt.data(D.dataRef)}</span>
      <span>${fmt.int(D.fatos.length)} registros SKU × loja</span>`;
    lerHash();
    ligarEventos();
    aplicar();
  }

  iniciar();
})();
