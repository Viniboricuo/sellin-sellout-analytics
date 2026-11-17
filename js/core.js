/*
 * Núcleo compartilhado pelo site (app.js) e pelo Modo TV (tv.js):
 * formatos pt-BR, medidas (sell-in, sell-out, sell-through, estoque), avaliação,
 * série mensal, curva por semana e a arte geométrica que substitui fotos de produto.
 */
(function (root) {
  "use strict";

  const CUSTO_ATACADO = 0.48;   // sell-in em R$ = peças x preço de venda x 0,48 (preço de atacado fictício)
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
    "outubro", "novembro", "dezembro"];

  const nInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const vazio = v => v == null || !isFinite(v);

  const fmt = {
    int: v => vazio(v) ? "–" : nInt.format(Math.round(v)),
    pct: (v, casas = 1) => vazio(v) ? "–" : (v * 100).toLocaleString("pt-BR",
      { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%",
    pp: v => vazio(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1.format(Math.abs(v * 100))} p.p.`,
    compacto: v => {
      if (vazio(v)) return "–";
      const a = Math.abs(v);
      if (a >= 1e6) return n1.format(v / 1e6) + " mi";
      if (a >= 1e4) return n1.format(v / 1e3) + " mil";
      return nInt.format(Math.round(v));
    },
    brl: v => vazio(v) ? "–" : "R$ " + fmt.compacto(v),
    brlCheio: v => vazio(v) ? "–" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    data: iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–",
    mes: chave => `${MESES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}`,
    mesLongo: (ano, mes) => `${MESES_LONGOS[mes - 1]} de ${ano}`,
  };

  const AVALIACOES = [
    { id: "otimo", nome: "Ótimo", cor: "--av-1" },
    { id: "bom", nome: "Bom", cor: "--av-2" },
    { id: "regular", nome: "Regular", cor: "--av-3" },
    { id: "ruim", nome: "Ruim", cor: "--av-4" },
    { id: "mat", nome: "Em maturação", cor: "--av-mat" },
    { id: "pre", nome: "Pré-venda", cor: "--av-pre" },
  ];
  const AV_POR_ID = Object.fromEntries(AVALIACOES.map(a => [a.id, a]));

  /** Liga as tabelas entre si e soma os totais de cada fato (uma vez só). */
  function preparar(D) {
    D.catPorId = Object.fromEntries(D.categorias.map(c => [c.id, c]));
    D.colPorId = Object.fromEntries(D.colecoes.map(c => [c.id, c]));
    D.canalPorId = Object.fromEntries(D.canais.map(c => [c.id, c]));
    D.skuPorCodigo = Object.fromEntries(D.skus.map(s => [s.codigo, s]));
    D.lojaPorId = Object.fromEntries(D.lojas.map(l => [l.id, l]));
    D.franqPorNome = Object.fromEntries(D.franqueados.map(f => [f.nome, f]));
    D.mesRef = D.dataRef.slice(0, 7);
    D.anoRef = Number(D.dataRef.slice(0, 4));
    for (const f of D.fatos) {
      f.la = D.skus[f.k].lanc;
      f.si = f.i0 + f.r1 + f.r2;
      f.so = f.b[0] + f.b[1] + f.b[2] + f.b[3] + f.b[4] + f.b[5];
    }
    return D;
  }

  function novoAcc() { return { si: 0, so: 0, si4: 0, so4: 0, rso: 0, rsi: 0, n: 0 }; }

  function somar(acc, f, D) {
    const la = D.lancamentos[f.la];
    acc.si += f.si;
    acc.so += f.so;
    acc.rso += f.so * la.preco;
    acc.rsi += f.si * la.preco * CUSTO_ATACADO;
    if (la.semanas >= 4) { acc.si4 += f.i0; acc.so4 += f.b[0]; }
    acc.n++;
    return acc;
  }

  function total(fatos, D) {
    const a = novoAcc();
    for (const f of fatos) somar(a, f, D);
    return a;
  }

  /** Agrupa os fatos por uma chave. Devolve Map chave -> acumulado (com .chave). */
  function agrupar(fatos, chaveDe, D) {
    const m = new Map();
    for (const f of fatos) {
      const k = chaveDe(f);
      if (k == null) continue;
      let a = m.get(k);
      if (!a) { a = novoAcc(); a.chave = k; m.set(k, a); }
      somar(a, f, D);
    }
    return m;
  }

  const st = a => a && a.si ? a.so / a.si : null;
  const st4 = a => a && a.si4 ? a.so4 / a.si4 : null;
  const estoque = a => a ? a.si - a.so : null;

  /** Avaliação de um lançamento pelo Sell-through 4S e a régua da categoria. */
  function avaliar(la, acc, D) {
    if (la.semanas < 0) return "pre";
    if (la.semanas < 4) return "mat";
    const v = st4(acc);
    if (v == null) return "mat";
    const r = D.catPorId[la.categoria].regua;
    const p = v * 100;
    return p >= r[0] ? "otimo" : p >= r[1] ? "bom" : p >= r[2] ? "regular" : "ruim";
  }

  /** Avaliação de um conjunto: régua média ponderada pelo sell-in 4S de cada categoria. */
  function avaliarConjunto(fatos, D) {
    const porCat = agrupar(fatos, f => D.lancamentos[f.la].categoria, D);
    let peso = 0;
    const r = [0, 0, 0];
    let tot = novoAcc();
    for (const [cat, a] of porCat) {
      if (!a.si4) continue;
      peso += a.si4;
      D.catPorId[cat].regua.forEach((v, i) => { r[i] += v * a.si4; });
      tot.si4 += a.si4; tot.so4 += a.so4;
    }
    if (!peso) return { id: fatos.length ? "mat" : null, regua: null };
    const regua = r.map(v => v / peso);
    const p = st4(tot) * 100;
    return { id: p >= regua[0] ? "otimo" : p >= regua[1] ? "bom" : p >= regua[2] ? "regular" : "ruim", regua };
  }

  /** Série mensal: remessa e reposições entram como sell-in; os blocos de 4 semanas, como sell-out. */
  function serieMensal(fatos, D) {
    const m = new Map();
    const pegar = k => { let x = m.get(k); if (!x) { x = { mes: k, si: 0, so: 0 }; m.set(k, x); } return x; };
    for (const f of fatos) {
      const la = D.lancamentos[f.la];
      pegar(la.mesRemessa).si += f.i0;
      if (f.r1) pegar(la.mesRepo1).si += f.r1;
      if (f.r2) pegar(la.mesRepo2).si += f.r2;
      for (let b = 0; b < 6; b++) if (f.b[b]) pegar(la.mesBloco[b]).so += f.b[b];
    }
    return [...m.values()].filter(x => x.mes <= D.mesRef).sort((a, b) => a.mes < b.mes ? -1 : 1);
  }

  /**
   * Curva do sell-through acumulado em 4, 8 … 24 semanas. Em cada ponto só entram os lançamentos
   * que já completaram aquelas semanas (para não misturar lançamento novo com antigo).
   * grupoDe(f) opcional: devolve a série do fato (ex.: categoria). Retorna Map grupo -> [6 valores].
   */
  function curva(fatos, D, grupoDe = () => "Total") {
    const acc = new Map();
    for (const f of fatos) {
      const la = D.lancamentos[f.la];
      const g = grupoDe(f);
      let a = acc.get(g);
      if (!a) { a = Array.from({ length: 6 }, () => ({ si: 0, so: 0 })); acc.set(g, a); }
      let so = 0;
      for (let c = 0; c < 6; c++) {
        const sem = (c + 1) * 4;
        so += f.b[c];
        if (la.semanas < sem) break;
        a[c].si += f.i0 + (sem >= 7 ? f.r1 : 0) + (sem >= 15 ? f.r2 : 0);
        a[c].so += so;
      }
    }
    const out = new Map();
    for (const [g, a] of acc) out.set(g, a.map(x => x.si ? x.so / x.si : null));
    return out;
  }

  /* ---------- arte geométrica (no lugar de fotos de produto) ---------- */
  function hash(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** SVG simples por categoria (caneca, caderno, fone, mochila, squeeze, frasco), na cor do SKU. */
  function arte(la, cor = "#5d6168") {
    const h = hash(la.codigo);
    const matiz = h % 360;
    const fundo = `hsl(${matiz} 40% 94%)`;
    const traco = cor;
    let forma;
    switch (la.categoria) {
      case "CAS":   // caneca
        forma = `<rect x="44" y="20" width="30" height="38" rx="5" fill="${traco}"/>
          <path d="M74 28h6a8 8 0 0 1 0 16h-6" fill="none" stroke="${traco}" stroke-width="4"/>
          <path d="M50 14q3-4 0-8M58 14q3-4 0-8M66 14q3-4 0-8" fill="none" stroke="${traco}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`;
        break;
      case "PAP":   // caderno e caneta
        forma = `<rect x="34" y="14" width="40" height="50" rx="4" fill="${traco}"/>
          <path d="M42 26h24M42 34h24M42 42h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
          <rect x="80" y="16" width="7" height="44" rx="3" fill="${traco}" opacity=".6" transform="rotate(12 83 38)"/>`;
        break;
      case "ELE":   // fone de ouvido
        forma = `<path d="M40 46v-8a20 20 0 0 1 40 0v8" fill="none" stroke="${traco}" stroke-width="5" stroke-linecap="round"/>
          <rect x="33" y="42" width="13" height="20" rx="5" fill="${traco}"/><rect x="74" y="42" width="13" height="20" rx="5" fill="${traco}"/>`;
        break;
      case "ACE":   // mochila
        forma = `<path d="M50 20a10 10 0 0 1 20 0" fill="none" stroke="${traco}" stroke-width="4"/>
          <rect x="40" y="20" width="40" height="46" rx="10" fill="${traco}"/>
          <rect x="47" y="44" width="26" height="14" rx="4" fill="#fff" opacity=".35"/>`;
        break;
      case "ESP":   // squeeze
        forma = `<rect x="52" y="8" width="16" height="8" rx="2" fill="${traco}" opacity=".6"/>
          <rect x="46" y="16" width="28" height="52" rx="9" fill="${traco}"/>
          <path d="M46 34h28M46 50h28" stroke="#fff" stroke-width="2" opacity=".45"/>`;
        break;
      case "BEL":   // frasco com válvula
        forma = `<rect x="56" y="10" width="8" height="10" rx="2" fill="${traco}" opacity=".6"/>
          <path d="M64 13h10" stroke="${traco}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
          <rect x="44" y="20" width="32" height="46" rx="8" fill="${traco}"/>
          <rect x="50" y="34" width="20" height="16" rx="3" fill="#fff" opacity=".4"/>`;
        break;
      default:      // caixa
        forma = `<rect x="38" y="20" width="44" height="40" rx="6" fill="${traco}"/>
          <path d="M38 32h44M60 20v12" stroke="#fff" stroke-width="2" opacity=".5"/>`;
    }
    return `<svg viewBox="0 0 120 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="120" height="76" fill="${fundo}"/>
      <circle cx="${20 + (h % 80)}" cy="${(h >> 8) % 76}" r="26" fill="hsl(${(matiz + 40) % 360} 45% 88%)"/>
      ${forma}</svg>`;
  }

  root.SS = {
    fmt, MESES, MESES_LONGOS, AVALIACOES, AV_POR_ID, CUSTO_ATACADO,
    preparar, novoAcc, somar, total, agrupar, st, st4, estoque, avaliar, avaliarConjunto, serieMensal, curva, arte, hash,
  };
})(typeof window !== "undefined" ? window : globalThis);
