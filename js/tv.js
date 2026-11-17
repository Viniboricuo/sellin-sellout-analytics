/*
 * Modo TV · Sellin e Sellout (Demo Retail Co.)
 * Quatro painéis grandes que giram sozinhos (Resumo, Canais, Vitrine, Curva) e uma fita com o sell-through.
 * Teclas: ← → trocam o painel, espaço pausa. ?s=20 muda o tempo de cada painel (segundos); ?p=3 abre no 3º painel; ?seed= troca os dados.
 */
(function () {
  "use strict";

  const { fmt } = SS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const parametros = new URLSearchParams(location.search);
  const semente = Number(parametros.get("seed")) || DemoData.SEMENTE_PADRAO;
  const D = SS.preparar(DemoData.gerar(semente));
  const ANO = D.anoRef;
  const DURACAO = Math.max(6, Number(parametros.get("s")) || 15) * 1000;
  document.documentElement.style.setProperty("--dur", DURACAO / 1000 + "s");

  const COR = { in: "#8fb3cf", out: "#ff7a4f", acc: "#74b9ec", pos: "#5fd3a2", neg: "#ff8a78", warn: "#f2c14e",
    cats: ["#ff7a4f", "#74b9ec", "#f2c14e", "#5fd3a2", "#b6a8ee", "#e0a3a0"], canais: ["#74b9ec", "#ff7a4f", "#5fd3a2", "#f2c14e"] };
  const COR_AV = { otimo: "#2fa877", bom: "#7cc685", regular: "#e8b04d", ruim: "#ff6e5a", mat: "#8dc6f2", pre: "#b6a8ee" };

  // lançamentos do ano dos dados; no começo do ano junta o ano anterior para a tela não ficar vazia
  const anos = new Set([ANO]);
  if (Number(D.mesRef.slice(5)) <= 3) anos.add(ANO - 1);
  const fatos = D.fatos.filter(f => anos.has(D.lancamentos[f.la].ano));
  const tot = SS.total(fatos, D);
  const media4 = SS.st4(tot);
  const textoAno = [...anos].sort().join("–");

  /* ---------- utilitários de tela ---------- */
  const formatos = { int: fmt.int, pct: v => fmt.pct(v, 1), comp: fmt.compacto };
  const num = (v, f = "int") => `<span class="count" data-v="${v == null ? "" : v}" data-f="${f}">${formatos[f](v)}</span>`;
  function contar(raiz) {
    $$(".count", raiz).forEach(el => {
      const alvo = Number(el.dataset.v);
      if (el.dataset.v === "" || !isFinite(alvo)) return;
      const f = formatos[el.dataset.f];
      const t0 = performance.now();
      const passo = agora => {
        const p = Math.max(0, Math.min(1, (agora - t0) / 1400));
        el.textContent = f(alvo * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }
  const seta = d => d == null ? "" : d >= 0 ? `<span class="up">▲ ${fmt.pp(d)}</span>` : `<span class="down">▼ ${fmt.pp(d)}</span>`;
  const largura = (v, max) => `${Math.max(0, Math.min(1, (v || 0) / (max || 1))) * 100}%`;

  let graficos = [];
  function grafico(canvas, cfg) {
    if (!window.Chart) { canvas.parentElement.innerHTML = '<div class="chart-off">Gráfico indisponível sem internet</div>'; return; }
    Chart.defaults.font.family = "Geist, ui-sans-serif, system-ui, sans-serif";
    Chart.defaults.color = "rgba(255,255,255,.6)";
    Chart.defaults.borderColor = "rgba(255,255,255,.07)";
    Chart.defaults.font.size = Math.round(Math.max(11, Math.min(18, innerWidth / 110)));
    graficos.push(new Chart(canvas, cfg));
  }

  /* ---------- painel 1: resumo ---------- */
  function painelResumo(el) {
    const est = SS.estoque(tot);
    const porLanc = SS.agrupar(fatos, f => f.la, D);
    const contagem = {};
    for (const [i, a] of porLanc) { const av = SS.avaliar(D.lancamentos[i], a, D); contagem[av] = (contagem[av] || 0) + 1; }
    const maxAv = Math.max(1, ...Object.values(contagem));
    el.innerHTML = `
      <div class="row4">
        <div class="tv-box hero"><p class="tv-label">Sell-through 4S</p><div class="big">${num(media4, "pct")}</div>
          <div class="bar"><i style="--w:${largura(media4, 1)}"></i></div>
          <div class="sub swap"><span class="on">4 primeiras semanas ÷ remessa inicial</span><span>${fmt.int(tot.so4)} vendidas de ${fmt.int(tot.si4)} enviadas</span></div></div>
        <div class="tv-box"><p class="tv-label">Sell-out</p><div class="big">${num(tot.so, "comp")}<small>peças</small></div>
          <div class="sub swap"><span class="on">receita <b>${fmt.brl(tot.rso)}</b></span><span>ticket médio <b>${fmt.brlCheio(tot.so ? tot.rso / tot.so : null)}</b></span></div></div>
        <div class="tv-box"><p class="tv-label">Sell-in</p><div class="big">${num(tot.si, "comp")}<small>peças</small></div>
          <div class="sub swap"><span class="on">estoque nas lojas <b>${fmt.compacto(est)}</b></span><span><b>${fmt.int(porLanc.size)}</b> lançamentos em ${textoAno}</span></div></div>
        <div class="tv-box"><p class="tv-label">Sell-through</p><div class="big">${num(SS.st(tot), "pct")}</div>
          <div class="bar"><i style="--w:${largura(SS.st(tot), 1)}"></i></div>
          <div class="sub">sell-out ÷ sell-in até hoje</div></div>
      </div>
      <div class="split">
        <div class="tv-box"><p class="tv-label">Sell-in x Sell-out por mês · lançamentos de ${textoAno}</p>
          <div class="tv-legend"><span><i style="background:${COR.in}"></i>Sell-in</span><span><i style="background:${COR.out}"></i>Sell-out</span><span><i class="ln" style="background:${COR.acc}"></i>Sell-through acumulado</span></div>
          <div class="chart-box"><canvas id="tv-mensal"></canvas></div></div>
        <div class="tv-box"><p class="tv-label">Avaliação dos lançamentos</p><div class="rows">${SS.AVALIACOES.filter(a => contagem[a.id]).map(a =>
          `<div class="rowx"><span><i class="dotc" style="--dc:${COR_AV[a.id]}"></i>${a.nome}</span><span class="trk"><i style="--dc:${COR_AV[a.id]};--w:${largura(contagem[a.id], maxAv)}"></i></span><b>${contagem[a.id]}</b></div>`).join("")}</div></div>
      </div>`;
    const serie = SS.serieMensal(fatos, D);
    let si = 0, so = 0;
    const acum = serie.map(x => { si += x.si; so += x.so; return si ? so / si : null; });
    grafico($("#tv-mensal", el), {
      type: "bar",
      data: { labels: serie.map(x => fmt.mes(x.mes)), datasets: [
        { data: serie.map(x => x.si), backgroundColor: COR.in, borderRadius: 5, yAxisID: "y", order: 2 },
        { data: serie.map(x => x.so), backgroundColor: COR.out, borderRadius: 5, yAxisID: "y", order: 2 },
        { type: "line", data: acum, borderColor: COR.acc, borderWidth: 3, pointRadius: 0, tension: .35, yAxisID: "y2", order: 1 }] },
      options: { maintainAspectRatio: false, animation: { duration: 1200 }, plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => fmt.compacto(v) } },
          y2: { position: "right", min: 0, max: 1, grid: { display: false }, ticks: { callback: v => fmt.pct(v, 0) } } } },
    });
  }

  /* ---------- painel 2: canais ---------- */
  function painelCanais(el) {
    const porCanal = SS.agrupar(fatos, f => D.lojas[f.l].canal, D);
    const porRegiao = [...SS.agrupar(fatos, f => D.lojas[f.l].regiao, D)].sort((a, b) => (SS.st4(b[1]) || 0) - (SS.st4(a[1]) || 0));
    const porLoja = [...SS.agrupar(fatos, f => f.l, D)];
    const vols = porLoja.map(([, a]) => a.si4).sort((a, b) => a - b);
    const corte = vols[Math.floor(vols.length / 2)] || 0;
    const top = porLoja.filter(([, a]) => a.si4 >= Math.max(10, corte)).sort((a, b) => SS.st4(b[1]) - SS.st4(a[1])).slice(0, 7);
    const maxTop = Math.max(...top.map(([, a]) => SS.st4(a)), 0.01);
    el.innerHTML = `
      <div class="row4 even">${D.canais.map((c, i) => {
        const a = porCanal.get(c.id) || SS.novoAcc();
        const v = SS.st4(a);
        return `<div class="tv-box ch" style="--c:${COR.canais[i]}"><p class="name"><i></i>${c.nome}</p><div class="big">${num(v, "pct")}</div>
          <div class="bar"><i style="--w:${largura(v, 1)}"></i></div>
          <div class="sub swap"><span class="on">${seta(v != null && media4 != null ? v - media4 : null)} vs média</span><span>sell-out <b>${fmt.compacto(a.so)}</b> · sell-in <b>${fmt.compacto(a.si)}</b></span></div></div>`;
      }).join("")}</div>
      <div class="split half">
        <div class="tv-box"><p class="tv-label">Sell-through 4S por região · o traço é a média (${fmt.pct(media4)})</p>
          <div class="rows">${porRegiao.map(([r, a]) => `<div class="rowx"><span>${esc(r)}<small>${fmt.compacto(a.so)} pç</small></span>
            <span class="trk"><i style="--dc:${SS.st4(a) >= media4 ? COR.pos : COR.neg};--w:${largura(SS.st4(a), 0.8)}"></i></span><b>${fmt.pct(SS.st4(a))}</b></div>`).join("")}</div></div>
        <div class="tv-box"><p class="tv-label">Lojas que mais vendem · Sell-through 4S, com volume acima da mediana</p>
          <div class="rows">${top.map(([l, a], i) => `<div class="rowx"><span><i class="rank ${i < 3 ? "m" + (i + 1) : ""}">${i + 1}</i>${esc(D.lojas[l].nome)}<small>${esc(D.canalPorId[D.lojas[l].canal].curto)} · ${D.lojas[l].uf}</small></span>
            <span class="trk"><i style="--dc:${COR.acc};--w:${largura(SS.st4(a), maxTop)}"></i></span><b>${fmt.pct(SS.st4(a))}</b></div>`).join("")}</div></div>
      </div>`;
  }

  /* ---------- painel 3: vitrine ---------- */
  function painelVitrine(el) {
    const porLanc = [...SS.agrupar(fatos, f => f.la, D)]
      .filter(([i]) => D.lancamentos[i].semanas >= 4)
      .sort((a, b) => b[1].si - a[1].si).slice(0, 30)
      .sort((a, b) => SS.st4(b[1]) - SS.st4(a[1]));
    const n = Math.min(6, Math.floor(porLanc.length / 2));
    const max = Math.max(0.01, ...porLanc.map(([, a]) => SS.st4(a)));
    const cartoes = (lista, cor, medalhas) => lista.map(([i, a], k) => {
      const la = D.lancamentos[i];
      return `<div class="vt-card" style="--i:${k};--vc:${cor}"><div class="vt-art">${SS.arte(la, D.skus[la.skus[0]].hex)}
          <span class="vt-pos ${medalhas && k < 3 ? "m" + (k + 1) : ""}">${k + 1}</span><span class="vt-date">${fmt.data(la.data).slice(0, 5)}</span></div>
        <div class="vt-body"><span class="vt-name">${esc(la.nome)}</span><span class="vt-l2">${esc(D.catPorId[la.categoria].nome)} · ${esc(D.colPorId[la.colecao].nome)}</span>
          <span class="vt-val"><strong>${fmt.pct(SS.st4(a), 0)}</strong><small>ST 4S · ${fmt.compacto(a.si)} pç</small></span>
          <span class="vt-trk"><i style="--w:${largura(SS.st4(a), max)}"></i></span></div></div>`;
    }).join("");
    el.innerHTML = `
      <section class="vt" style="--vc:${COR.pos}"><div class="vt-head"><i></i><h3>Vendendo melhor</h3><span>entre os 30 lançamentos de maior volume, com 4 semanas completas</span></div>
        <div class="vt-cards">${cartoes(porLanc.slice(0, n), COR.pos, true)}</div></section>
      <section class="vt" style="--vc:${COR.neg}"><div class="vt-head"><i></i><h3>Pedem atenção</h3><span>menor Sell-through 4S no mesmo grupo</span></div>
        <div class="vt-cards">${cartoes(porLanc.slice(-n).reverse(), COR.neg, false)}</div></section>`;
  }

  /* ---------- painel 4: curva por categoria ---------- */
  function painelCurva(el) {
    const curva = SS.curva(fatos, D, f => D.lancamentos[f.la].categoria);
    const total = SS.curva(fatos, D).get("Total") || [];
    const porCat = SS.agrupar(fatos, f => D.lancamentos[f.la].categoria, D);
    el.innerHTML = `
      <div class="tv-box"><p class="tv-label">Curva do sell-through · sell-out acumulado ÷ sell-in acumulado a cada 4 semanas</p>
        <div class="tv-legend">${D.categorias.map((c, i) => `<span><i class="ln" style="background:${COR.cats[i]}"></i>${c.nome}</span>`).join("")}<span><i class="ln" style="background:#fff"></i>Total</span></div>
        <div class="chart-box"><canvas id="tv-curva"></canvas></div></div>
      <div class="cats">${D.categorias.map((c, i) => {
        const a = porCat.get(c.id) || SS.novoAcc();
        const v = SS.st4(a);
        return `<div class="tv-box" style="--c:${COR.cats[i]}"><p class="tv-label">${c.nome}</p><div class="big">${num(v, "pct")}</div>
          <div class="sub">ST total <b>${fmt.pct(SS.st(a))}</b> · régua ${c.regua.join("/")}%</div></div>`;
      }).join("")}</div>`;
    grafico($("#tv-curva", el), {
      type: "line",
      data: { labels: ["4S", "8S", "12S", "16S", "20S", "24S"], datasets: [
        ...D.categorias.map((c, i) => ({ data: curva.get(c.id) || [], borderColor: COR.cats[i], backgroundColor: COR.cats[i], borderWidth: 3, pointRadius: 4, tension: .3, spanGaps: true })),
        { data: total, borderColor: "#fff", borderDash: [6, 5], borderWidth: 2.5, pointRadius: 0, tension: .3, spanGaps: true }] },
      options: { maintainAspectRatio: false, animation: { duration: 1400 }, plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { grid: { display: false } }, y: { min: 0, ticks: { callback: v => fmt.pct(v, 0) } } } },
    });
  }

  const PAINEIS = [
    { id: "resumo", nome: "Resumo", titulo: `Sellin e Sellout · lançamentos de ${textoAno}`, montar: painelResumo },
    { id: "canais", nome: "Canais", titulo: "Canais, regiões e lojas", montar: painelCanais },
    { id: "vitrine", nome: "Vitrine", titulo: "Vitrine de lançamentos", montar: painelVitrine },
    { id: "curva", nome: "Curva", titulo: "Curva do sell-through por categoria", montar: painelCurva },
  ];

  /* ---------- giro dos painéis ---------- */
  const palco = $("#tv-palco");
  palco.innerHTML = PAINEIS.map(p => `<section class="tv-panel p-${p.id}" id="p-${p.id}" aria-label="${p.nome}"></section>`).join("");
  $("#tv-dots").innerHTML = PAINEIS.map((p, i) => `<button type="button" data-i="${i}">${p.nome}</button>`).join("");
  let atual = -1, relogioGiro = null, relogioTroca = null, relogioFoco = null, pausado = false;

  function mostrar(i) {
    atual = (i + PAINEIS.length) % PAINEIS.length;
    const p = PAINEIS[atual];
    while (graficos.length) graficos.pop().destroy();
    PAINEIS.forEach((q, k) => {
      const el = $("#p-" + q.id);
      if (k === atual) { q.montar(el); contar(el); }
      el.classList.toggle("on", k === atual);
    });
    $$("#tv-dots button").forEach((b, k) => b.classList.toggle("on", k === atual));
    $("#tv-titulo").textContent = p.titulo;
    const barra = $("#tv-barra");
    barra.classList.remove("run");
    void barra.offsetWidth;
    barra.classList.add("run");
    // limpa os painéis escondidos depois da transição (libera memória e animações)
    setTimeout(() => PAINEIS.forEach((q, k) => { if (k !== atual) $("#p-" + q.id).innerHTML = ""; }), 700);
    agendar();
    focoVitrine();
  }

  function agendar() {
    clearTimeout(relogioGiro);
    if (!pausado) relogioGiro = setTimeout(() => mostrar(atual + 1), DURACAO);
  }

  function pausar(p = !pausado) {
    pausado = p;
    document.body.classList.toggle("paused", p);
    $("#tv-pausa").innerHTML = p ? '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
    if (p) clearTimeout(relogioGiro);
    else mostrar(atual);
  }

  // o detalhe embaixo de alguns números alterna a cada 5 s
  relogioTroca = setInterval(() => {
    $$(".tv-panel.on .swap").forEach(s => {
      const itens = $$("span", s).filter(x => x.parentElement === s);
      const k = itens.findIndex(x => x.classList.contains("on"));
      itens.forEach((x, j) => x.classList.toggle("on", j === (k + 1) % itens.length));
    });
  }, 5000);

  // destaque que passeia pelos cartões da vitrine
  function focoVitrine() {
    clearInterval(relogioFoco);
    if (PAINEIS[atual].id !== "vitrine") return;
    let k = 0;
    relogioFoco = setInterval(() => {
      const cards = $$(".tv-panel.on .vt-card");
      cards.forEach((c, j) => c.classList.toggle("focus", j === k % cards.length));
      k++;
    }, 2200);
  }

  /* ---------- fita ---------- */
  function montarFita() {
    const itens = [];
    const item = (tag, nome, a) => {
      const v = SS.st4(a);
      if (v == null) return;
      const d = media4 != null ? v - media4 : null;
      itens.push(`<span class="tk"><em>${tag}</em><b>${esc(nome)}</b><strong class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${fmt.pct(v)}</strong><small>${fmt.pp(d)}</small></span>`);
    };
    for (const [k, a] of SS.agrupar(fatos, f => D.lojas[f.l].canal, D)) item("Canal", D.canalPorId[k].nome, a);
    const lancs = [...SS.agrupar(fatos, f => f.la, D)].filter(([i]) => D.lancamentos[i].semanas >= 4).sort((a, b) => b[1].si - a[1].si).slice(0, 10);
    const regs = [...SS.agrupar(fatos, f => D.lojas[f.l].regiao, D)];
    const cats = [...SS.agrupar(fatos, f => D.lancamentos[f.la].categoria, D)];
    // intercala para a fita variar
    const fila = [];
    for (let k = 0; k < Math.max(lancs.length, regs.length, cats.length); k++) {
      if (lancs[k]) fila.push(["Lançamento", D.lancamentos[lancs[k][0]].nome, lancs[k][1]]);
      if (regs[k]) fila.push(["Região", regs[k][0], regs[k][1]]);
      if (cats[k]) fila.push(["Categoria", D.catPorId[cats[k][0]].nome, cats[k][1]]);
    }
    fila.forEach(x => item(...x));
    const fita = $("#tv-fita");
    fita.innerHTML = itens.join("") + itens.join("");
    requestAnimationFrame(() => fita.style.setProperty("--t", Math.max(30, fita.scrollWidth / 2 / 70) + "s"));
  }

  /* ---------- cabeçalho, relógio, controles ---------- */
  function relogio() {
    const d = new Date();
    $("#tv-relogio").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function iniciar() {
    $("#tv-dados").textContent = `dados até ${fmt.data(D.dataRef)} · semente ${semente}`;
    if (parametros.get("seed")) $("#tv-site").href = `index.html?seed=${encodeURIComponent(semente)}`;
    relogio();
    setInterval(relogio, 10000);
    montarFita();
    // ?p=3 abre direto no 3º painel
    mostrar(Math.max(0, (Number(parametros.get("p")) || 1) - 1));

    $("#tv-dots").addEventListener("click", e => { const b = e.target.closest("button"); if (b) mostrar(Number(b.dataset.i)); });
    $("#tv-pausa").addEventListener("click", () => pausar());
    $("#tv-cheia").addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    });
    document.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") mostrar(atual + 1);
      else if (e.key === "ArrowLeft") mostrar(atual - 1);
      else if (e.key === " ") { e.preventDefault(); pausar(); }
    });
    // o cursor some depois de 3 s parado
    let parado = null;
    const mexeu = () => {
      document.body.classList.remove("no-cursor");
      clearTimeout(parado);
      parado = setTimeout(() => document.body.classList.add("no-cursor"), 3000);
    };
    document.addEventListener("mousemove", mexeu);
    mexeu();
    // ao mudar o tamanho da janela, redesenha o painel atual (as fontes dos gráficos acompanham)
    let espera = null;
    window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(() => mostrar(atual), 300); });
  }

  iniciar();
})();
