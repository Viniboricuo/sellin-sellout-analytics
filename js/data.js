/*
 * Demo Retail Co. · gerador de dados sintéticos
 * ------------------------------------------------------------
 * Tudo aqui é inventado: marca, canais, lojas, franqueados, produtos e números.
 * O gerador é determinístico: a mesma semente produz sempre os mesmos dados.
 *
 * Modelo
 *   lançamento (modelo) -> SKUs (variações de cor)
 *   fato = SKU x loja: remessa inicial (sell-in), reposições e vendas ao consumidor
 *          (sell-out) somadas em blocos de 4 semanas, até 24 semanas após o lançamento.
 *   A venda nunca passa do estoque da loja, então o sell-out sempre vem depois do sell-in.
 */
(function (root) {
  "use strict";

  const DIA = 86400000;
  const SEMANA = 7 * DIA;
  // "hoje" dos dados: fixo, para a demo ser reproduzível
  const DATA_REF = Date.UTC(2026, 10, 16);
  const SEMENTE_PADRAO = 20261116;

  // gerador pseudoaleatório pequeno (32 bits), suficiente para dados de demonstração
  function criarSorteio(semente) {
    let estado = (semente >>> 0) || 1;
    return function () {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let x = estado;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const REGIOES = [
    { nome: "Sudeste", ufs: ["SP", "RJ", "MG", "ES"], peso: 0.44 },
    { nome: "Sul", ufs: ["PR", "SC", "RS"], peso: 0.17 },
    { nome: "Nordeste", ufs: ["BA", "PE", "CE", "RN"], peso: 0.2 },
    { nome: "Centro-Oeste", ufs: ["DF", "GO", "MT"], peso: 0.11 },
    { nome: "Norte", ufs: ["AM", "PA"], peso: 0.08 },
  ];
  const REGIAO_ONLINE = "Online";

  // cobertura = chance de a loja receber um lançamento; ritmo = força de venda; porte = tamanho médio da remessa
  const CANAIS = [
    { id: "propria", nome: "Lojas próprias", curto: "Próprias", qtd: 18, cobertura: 0.78, ritmo: 1.0, porte: 1.0 },
    { id: "franquia", nome: "Franquias", curto: "Franquias", qtd: 32, cobertura: 0.62, ritmo: 0.94, porte: 0.85 },
    { id: "ecommerce", nome: "E-commerce", curto: "E-commerce", qtd: 2, cobertura: 1, ritmo: 1.06, porte: 5.2 },
    { id: "multimarcas", nome: "Multimarcas", curto: "Multimarcas", qtd: 14, cobertura: 0.34, ritmo: 0.8, porte: 0.6 },
  ];

  const LOCAIS = ["Centro", "Shopping Norte", "Shopping Sul", "Avenida", "Galeria", "Parque", "Estação",
    "Boulevard", "Praça Nova", "Aeroporto", "Orla", "Jardins", "Shopping Leste", "Mercado"];

  const FRANQUEADOS = ["Alfa", "Beta", "Gama", "Delta", "Épsilon", "Zeta", "Sigma", "Kappa", "Lambda", "Ômega", "Teta"];
  // quantas lojas cada franqueado tem (soma = lojas do canal Franquias)
  const LOJAS_POR_FRANQUEADO = [6, 5, 4, 3, 3, 3, 2, 2, 2, 1, 1];

  // varejo geral, categorias variadas. tipos = produtos da categoria (entram no nome do lançamento).
  // regua = Sell-through 4S mínimo (%) para Ótimo, Bom e Regular; abaixo disso, Ruim
  const CATEGORIAS = [
    { id: "CAS", nome: "Casa & Cozinha", curto: "Casa", peso: 0.2, preco: [29, 189], skus: [2, 4], volume: 5.5, demanda: 1.18,
      regua: [50, 38, 28], colecoes: ["Cozinha Viva", "Mesa Posta", "Térmicos", "Essenciais da Casa"],
      tipos: ["Garrafa térmica", "Caneca", "Pote hermético", "Jogo americano", "Copo"] },
    { id: "PAP", nome: "Papelaria", curto: "Papelaria", peso: 0.17, preco: [9, 89], skus: [2, 4], volume: 8.5, demanda: 1.32,
      regua: [54, 42, 31], colecoes: ["Volta às Aulas", "Escritório", "Criativa"],
      tipos: ["Caderno", "Caneta", "Agenda", "Estojo", "Kit marca-texto"] },
    { id: "ELE", nome: "Eletrônicos", curto: "Eletrônicos", peso: 0.14, preco: [49, 399], skus: [1, 3], volume: 3.0, demanda: 0.92,
      regua: [35, 26, 18], colecoes: ["Conecta", "Som", "Energia"],
      tipos: ["Fone sem fio", "Carregador", "Caixa de som", "Cabo USB-C", "Bateria portátil"] },
    { id: "ACE", nome: "Acessórios", curto: "Acessórios", peso: 0.18, preco: [59, 349], skus: [2, 3], volume: 3.8, demanda: 1.0,
      regua: [37, 28, 20], colecoes: ["Urbana", "Viagem", "Clássica", "Cápsula Neon"],
      tipos: ["Mochila", "Relógio", "Carteira", "Bolsa transversal", "Boné"] },
    { id: "ESP", nome: "Esporte", curto: "Esporte", peso: 0.14, preco: [19, 169], skus: [1, 3], volume: 5.0, demanda: 1.1,
      regua: [45, 34, 24], colecoes: ["Treino", "Ar Livre", "Performance"],
      tipos: ["Squeeze", "Toalha esportiva", "Tapete de yoga", "Faixa elástica", "Corda de pular"] },
    { id: "BEL", nome: "Beleza", curto: "Beleza", peso: 0.17, preco: [25, 229], skus: [1, 3], volume: 5.5, demanda: 1.15,
      regua: [48, 36, 26], colecoes: ["Botânica", "Fragrâncias", "Cuidado Diário"],
      tipos: ["Hidratante", "Perfume", "Sabonete líquido", "Body splash", "Creme para mãos"] },
  ];

  const CORES = [
    ["Preto", "#1d1d1f"], ["Areia", "#cdb48c"], ["Dourado", "#c9a227"], ["Prata", "#b8bcc2"],
    ["Azul", "#2f6fd0"], ["Verde", "#2f8f5b"], ["Rosé", "#e0a3a0"], ["Grafite", "#5d6168"],
    ["Marrom", "#6b4630"], ["Gelo", "#dfe6ea"], ["Vermelho", "#c8372d"], ["Branco", "#f4f4f2"],
    ["Lilás", "#9b84c9"], ["Mel", "#d79a3e"],
  ];

  const PALAVRAS = ["Aurora", "Brisa", "Cometa", "Duna", "Eclipse", "Farol", "Granito", "Horizonte", "Íris", "Jade",
    "Lume", "Maré", "Nébula", "Órbita", "Prisma", "Quartzo", "Rota", "Safira", "Trilha", "Vértice", "Zênite",
    "Atlas", "Bússola", "Cais", "Coral", "Estrela", "Falésia", "Geada", "Ilha", "Lagoa", "Mirante", "Neblina",
    "Oásis", "Pólen", "Recife", "Savana", "Tundra", "Vento", "Âmbar", "Cobre", "Cristal", "Delírio", "Seixo"];
  const SUFIXOS = ["", " II", " III", " Slim", " Max", " IV", " Mini"];

  // peso de cada semana na demanda: a 1ª semana é um pouco menor e depois a procura cai devagar
  const PESO_SEMANA = (function () {
    const p = [];
    for (let k = 1; k <= 24; k++) p.push((k === 1 ? 0.75 : 1) * Math.exp(-(k - 1) / 9));
    const t = p.reduce((a, b) => a + b, 0);
    return p.map(x => x / t);
  })();

  const pad2 = n => String(n).padStart(2, "0");
  const iso = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
  const chaveMes = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; };

  function gerar(semente) {
    semente = Number(semente) || SEMENTE_PADRAO;
    const sorteio = criarSorteio(semente);
    const entre = (a, b) => a + (b - a) * sorteio();
    const inteiro = (a, b) => Math.floor(entre(a, b + 1));
    const escolher = lista => lista[Math.floor(sorteio() * lista.length)];
    const normal = () => { let s = 0; for (let i = 0; i < 6; i++) s += sorteio(); return (s - 3) / Math.SQRT1_2; };
    const lognormal = sigma => Math.exp(normal() * sigma - sigma * sigma / 2);
    const ponderado = (lista, pesoDe) => {
      const total = lista.reduce((s, x) => s + pesoDe(x), 0);
      let alvo = sorteio() * total;
      for (const x of lista) { alvo -= pesoDe(x); if (alvo <= 0) return x; }
      return lista[lista.length - 1];
    };

    /* ---------- lojas e franqueados ---------- */
    const lojas = [];
    let numero = 0;
    function novaLoja(canal, regiao, franqueado) {
      numero++;
      const nn = pad2(numero);
      let nome, tipo, uf;
      if (canal.id === "ecommerce") {
        nome = numero % 2 ? `E-commerce Site ${nn}` : `E-commerce Marketplace ${nn}`;
        tipo = "Digital"; uf = "BR";
      } else if (canal.id === "multimarcas") {
        nome = `Multimarcas Parceiro ${nn}`; tipo = "Multimarcas"; uf = escolher(regiao.ufs);
      } else {
        const local = escolher(LOCAIS);
        nome = `Loja ${local} ${nn}`;
        tipo = local.startsWith("Shopping") ? "Shopping" : local === "Aeroporto" ? "Aeroporto" : "Rua";
        uf = escolher(regiao.ufs);
      }
      const loja = {
        i: lojas.length, id: `L${String(numero).padStart(3, "0")}`, nome, canal: canal.id, canalNome: canal.nome,
        regiao: regiao ? regiao.nome : REGIAO_ONLINE, uf, tipo, franqueado: franqueado ? franqueado.nome : null,
        porte: lognormal(0.35), qualidade: lognormal(0.16),
      };
      lojas.push(loja);
      return loja;
    }

    for (let i = 0; i < CANAIS[0].qtd; i++) novaLoja(CANAIS[0], ponderado(REGIOES, r => r.peso));
    const franqueados = FRANQUEADOS.map((n, i) => ({ i, id: `F${pad2(i + 1)}`, nome: `Franqueado ${n}`,
      regiaoBase: ponderado(REGIOES, r => r.peso).nome, lojas: [] }));
    franqueados.forEach((f, i) => {
      for (let k = 0; k < LOJAS_POR_FRANQUEADO[i]; k++) {
        const regiao = sorteio() < 0.85 ? REGIOES.find(r => r.nome === f.regiaoBase) : ponderado(REGIOES, r => r.peso);
        f.lojas.push(novaLoja(CANAIS[1], regiao, f).i);
      }
    });
    for (let i = 0; i < CANAIS[2].qtd; i++) novaLoja(CANAIS[2], null);
    for (let i = 0; i < CANAIS[3].qtd; i++) novaLoja(CANAIS[3], ponderado(REGIOES, r => r.peso));

    /* ---------- categorias e coleções ---------- */
    const categorias = CATEGORIAS.map(c => ({ id: c.id, nome: c.nome, curto: c.curto, regua: c.regua.slice() }));
    const colecoes = [];
    CATEGORIAS.forEach(c => c.colecoes.forEach(n => colecoes.push({ id: `${c.id}:${n}`, nome: n, categoria: c.id })));

    /* ---------- lançamentos, SKUs e fatos ---------- */
    const lancamentos = [], skus = [], fatos = [];
    const usos = {};
    const canalDe = id => CANAIS.find(c => c.id === id);

    // nome = produto da categoria + linha inventada (ex.: "Caneca Aurora II")
    function nomeModelo(cat) {
      const tipo = escolher(cat.tipos);
      for (let t = 0; t < 200; t++) {
        const p = escolher(PALAVRAS);
        const n = usos[p] || 0;
        if (n < SUFIXOS.length) { usos[p] = n + 1; return `${tipo} ${p}${SUFIXOS[n]}`; }
      }
      return `${tipo} ${lancamentos.length + 1}`;
    }

    for (let ano = 2025, mes = 0; ano * 12 + mes <= 2026 * 12 + 10; mes === 11 ? (ano++, mes = 0) : mes++) {
      const qtd = inteiro(5, 8);
      for (let q = 0; q < qtd; q++) {
        const ultimo = ano === 2026 && mes === 10;
        const dia = ultimo ? inteiro(1, 21) : inteiro(1, 28);
        const data = Date.UTC(ano, mes, dia);
        const cat = ponderado(CATEGORIAS, c => c.peso);
        const colecao = escolher(cat.colecoes);
        // esporte vende um pouco mais no verão; papelaria, na volta às aulas (jan-fev)
        const sazonal = cat.id === "ESP" ? 1 + 0.12 * Math.cos(((mes + 1) / 12) * 2 * Math.PI)
          : cat.id === "PAP" && mes <= 1 ? 1.15 : 1;
        const lanc = {
          i: lancamentos.length,
          codigo: `${cat.id}-${1001 + lancamentos.length}`,
          nome: nomeModelo(cat),
          data: iso(data), ms: data, ano, mes: mes + 1,
          semanas: Math.floor((DATA_REF - data) / SEMANA),
          categoria: cat.id, colecao: `${cat.id}:${colecao}`,
          preco: Math.round(entre(cat.preco[0], cat.preco[1]) / 10) * 10 - 0.1,
          status: sorteio() < 0.14 ? "Relançamento" : "Lançamento",
          skus: [],
          // em que mês cai cada movimento (para a série mensal)
          mesRemessa: chaveMes(data - SEMANA),
          mesRepo1: chaveMes(data + 6 * SEMANA),
          mesRepo2: chaveMes(data + 14 * SEMANA),
          mesBloco: [0, 1, 2, 3, 4, 5].map(b => chaveMes(data + (4 * b + 2) * SEMANA)),
        };
        lancamentos.push(lanc);
        const forca = lognormal(0.3) * sazonal;      // quanto o modelo agrada
        const tamanho = lognormal(0.42);           // tamanho da grade lançada

        const nSkus = inteiro(cat.skus[0], cat.skus[1]);
        const cores = CORES.slice();
        for (let s = 0; s < nSkus; s++) {
          const [cor, hex] = cores.splice(Math.floor(sorteio() * cores.length), 1)[0];
          const sku = { i: skus.length, codigo: `${lanc.codigo}-${pad2(s + 1)}`, lanc: lanc.i, cor, hex,
            peso: entre(0.6, 1.4), apelo: lognormal(0.2) };
          skus.push(sku);
          lanc.skus.push(sku.i);
        }

        const ate = Math.min(lanc.semanas, 24);
        for (const loja of lojas) {
          const canal = canalDe(loja.canal);
          const chance = canal.cobertura * (tamanho > 1 ? 1 : 0.82);
          if (sorteio() > chance) continue;
          let algum = false;
          lanc.skus.forEach((si, idx) => {
            const ultimoSku = idx === lanc.skus.length - 1;
            if (sorteio() > 0.8 && !(ultimoSku && !algum)) return;
            algum = true;
            const sku = skus[si];
            const remessa = Math.max(1, Math.round(canal.porte * loja.porte * tamanho * cat.volume * sku.peso * entre(0.8, 1.2)));
            const demanda = remessa * cat.demanda * forca * loja.qualidade * canal.ritmo * sku.apelo * lognormal(0.15);
            let estoque = remessa, vendido = 0, repo1 = 0, repo2 = 0;
            const blocos = [0, 0, 0, 0, 0, 0];
            for (let k = 1; k <= ate; k++) {
              if (k === 7 && vendido > 0.5 * remessa) {
                repo1 = Math.max(1, Math.round(remessa * entre(0.4, 0.8)));
                estoque += repo1;
              }
              if (k === 15 && estoque < 0.3 * (remessa + repo1) && vendido > 0.6 * (remessa + repo1)) {
                repo2 = Math.max(1, Math.round(remessa * entre(0.3, 0.6)));
                estoque += repo2;
              }
              let v = Math.floor(demanda * PESO_SEMANA[k - 1] * entre(0.7, 1.3) + sorteio());
              if (v > estoque) v = estoque;
              estoque -= v;
              vendido += v;
              blocos[(k - 1) >> 2] += v;
            }
            fatos.push({ k: si, l: loja.i, i0: remessa, r1: repo1, r2: repo2, b: blocos });
          });
        }
      }
    }

    return {
      marca: "Demo Retail Co.",
      semente,
      dataRef: iso(DATA_REF),
      geradoEm: iso(DATA_REF),
      canais: CANAIS.map(c => ({ id: c.id, nome: c.nome, curto: c.curto })),
      regioes: REGIOES.map(r => r.nome).concat(REGIAO_ONLINE),
      lojas, franqueados, categorias, colecoes, lancamentos, skus, fatos,
    };
  }

  root.DemoData = { gerar, SEMENTE_PADRAO, DATA_REF: iso(DATA_REF) };
})(typeof window !== "undefined" ? window : globalThis);
