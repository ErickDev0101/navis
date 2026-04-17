// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCR4FZbNlEOHIPfjyRT8yBjdunVjzgsdNM",
  authDomain: "navis-c9fd5.firebaseapp.com",
  projectId: "navis-c9fd5",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================= VARIÁVEIS =================
let imagemCapturada;
let streamAtual;
let cameraAtiva = false;
let chart;

// ================= INIT =================
function init() {
  abrirAba("dashboard");

  chart = new Chart(grafico, {
    type: 'line',
    data: { labels: [], datasets: [{ label: "Temperatura", data: [] }] }
  });

  setInterval(simular, 2000);
  carregarMaquinas();
}

// ================= ABAS =================
function abrirAba(nome) {
  document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa"));
  document.getElementById(nome).classList.add("ativa");
  desligarCamera();
}

// ================= CAMERA =================
async function abrirCamera() {

  camera.style.display = "block";
  btnCapturar.style.display = "inline-block";

  streamAtual = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });

  camera.srcObject = streamAtual;
  cameraAtiva = true;
}

function desligarCamera() {
  if (streamAtual) {
    streamAtual.getTracks().forEach(t => t.stop());
    camera.srcObject = null;
  }

  camera.style.display = "none";
  btnCapturar.style.display = "none";
  cameraAtiva = false;
}

function capturar() {

  if (!cameraAtiva) return;

  const ctx = canvas.getContext("2d");

  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;

  ctx.drawImage(camera, 0, 0);

  const data = canvas.toDataURL("image/png");

  let img = new Image();

  img.onload = () => {
    imagemCapturada = img;
    preview.src = data;
    preview.style.display = "block";
  };

  img.src = data;

  desligarCamera();
}

// ================= UPLOAD =================
imageUpload.onchange = e => {

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = ev => {

    let img = new Image();

    img.onload = () => {
      imagemCapturada = img;
      preview.src = ev.target.result;
      preview.style.display = "block";
    };

    img.src = ev.target.result;
  };

  reader.readAsDataURL(file);
};

// ================= OCR =================
async function extrairTexto() {

  if (!imagemCapturada) {
    alert("Nenhuma imagem carregada");
    return "";
  }

  const result = await Tesseract.recognize(
    imagemCapturada,
    'eng',
    { logger: m => console.log(m) }
  );

  return result.data.text.toUpperCase();
}

// ================= IA =================
async function analisar() {

  if (!imagemCapturada) {
    alert("Envie ou capture uma imagem!");
    return;
  }

  ia.innerHTML = "Analisando...";
  acoes.innerHTML = "";

  let texto = await extrairTexto();

  let fabricante = "DESCONHECIDO";

  ["SIEMENS","WEG","ABB","BOSCH"].forEach(f=>{
    if(texto.includes(f)) fabricante = f;
  });

  let modelo = texto.split("\n").find(l => l.length > 5) || "Não identificado";

  let tipo = (
    texto.includes("ETHERNET") ||
    texto.includes("MODBUS") ||
    texto.includes("PROFINET")
  ) ? "NEW" : "LEGACY";

  ia.innerHTML = `
    <h3>${tipo}</h3>
    <p><b>${fabricante}</b></p>
    <p>${modelo}</p>
  `;

  // ================= FLUXO =================
  if (tipo === "LEGACY") {

    acoes.innerHTML = `
      <p>Máquina LEGACY. Deseja retrofit?</p>
      <button onclick="respostaLegacy(true,'${fabricante}','${modelo}')">SIM</button>
      <button onclick="respostaLegacy(false)">NÃO</button>
    `;

  } else {

    acoes.innerHTML = `
      <p>Máquina NEW. Já possui conectividade?</p>
      <button onclick="respostaNew(true,'${fabricante}','${modelo}')">SIM</button>
      <button onclick="respostaNew(false,'${fabricante}','${modelo}')">NÃO</button>
    `;
  }
}

// ================= RESPOSTAS =================
async function respostaLegacy(sim, fabricante, modelo) {

  if (!sim) {
    acoes.innerHTML = "<p>Operação cancelada.</p>";
    return;
  }

  await db.collection("maquinas").add({
    tipo: "LEGACY",
    status: "EM RETROFIT",
    fabricante,
    modelo,
    data: new Date()
  });

  gerarPDFCompleto("LEGACY", fabricante, modelo);

  acoes.innerHTML = "<p>Retrofit iniciado com sucesso.</p>";

  carregarMaquinas();
}

async function respostaNew(sim, fabricante, modelo) {

  if (!sim) {

    acoes.innerHTML = `
      <p>Máquina sem conectividade. Deseja retrofit?</p>
      <button onclick="respostaLegacy(true,'${fabricante}','${modelo}')">SIM</button>
    `;

    return;
  }

  await db.collection("maquinas").add({
    tipo: "NEW",
    status: "ATIVA",
    fabricante,
    modelo,
    data: new Date()
  });

  gerarPDFCompleto("NEW", fabricante, modelo);

  acoes.innerHTML = "<p>Máquina adicionada ao inventário.</p>";

  carregarMaquinas();
}

// ================= PDF =================
function gerarPDFCompleto(tipo, fabricante, modelo) {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 15;

  function linha(texto, espaco = 10) {
    doc.text(texto, 10, y);
    y += espaco;
  }

  function bloco(texto) {
    const linhas = doc.splitTextToSize(texto, 180);
    doc.text(linhas, 10, y);
    y += linhas.length * 7;
  }

  // ================= CABEÇALHO =================
  doc.setFontSize(18);
  linha("RELATÓRIO TÉCNICO NAVIS INDUSTRIAL");

  doc.setFontSize(11);
  linha("Data: " + new Date().toLocaleString());
  linha("Classificação: " + tipo);
  linha("Fabricante: " + fabricante);
  linha("Modelo: " + modelo);

  y += 5;

  // ================= ANÁLISE =================
  doc.setFontSize(13);
  linha("1. ANÁLISE DO EQUIPAMENTO");

  doc.setFontSize(11);

  if (tipo === "NEW") {
    bloco("Equipamento identificado com capacidade de comunicação industrial nativa, apto para integração direta em rede IoT/SCADA sem necessidade de retrofit.");
  } else {
    bloco("Equipamento classificado como legado, sem capacidade nativa de comunicação em rede, exigindo retrofit para integração com sistemas industriais modernos.");
  }

  y += 5;

  // ================= RETROFIT =================
  if (tipo === "LEGACY") {

    doc.setFontSize(13);
    linha("2. PLANO TÉCNICO DE RETROFIT");

    doc.setFontSize(11);

    // SENSOR TEMPERATURA
    linha("2.1 Sensor de Temperatura");
    bloco("Tipos: Termopar (K, J) ou RTD (PT100/PT1000).");
    bloco("Instalação: definir ponto de medição (mancais, motores ou fluidos).");
    bloco("Fixação: solda, rosca ou poço termométrico.");
    bloco("Ligação: PT100 (2, 3 ou 4 fios), Termopar com cabo compensado.");
    bloco("Saída: transmissor 4–20 mA ou Modbus.");
    bloco("Integração: entrada analógica do CLP.");

    y += 3;

    // SENSOR VIBRAÇÃO
    linha("2.2 Sensor de Vibração");
    bloco("Tipos: acelerômetro, velocidade ou deslocamento.");
    bloco("Instalação: mancais, carcaça do motor ou estrutura.");
    bloco("Fixação: parafuso (ideal), base magnética ou adesivo.");
    bloco("Orientação: eixos horizontal, vertical e axial.");
    bloco("Saída: 4–20 mA ou IEPE.");
    bloco("Aquisição: CLP ou módulo dedicado.");

    y += 3;

    // CLP
    linha("2.3 Controlador Lógico Programável (CLP)");
    bloco("Função: centralizar aquisição de dados e lógica de controle.");
    bloco("Módulos: entradas analógicas, digitais e comunicação.");
    bloco("Ligação: sensores → entradas analógicas.");
    bloco("Programação: IEC 61131-3 (Ladder ou Structured Text).");
    bloco("Lógica: alarmes e parada automática baseada em limites.");

    y += 3;

    // IOT
    linha("2.4 Integração IoT");
    bloco("Arquitetura: sensores → CLP → gateway → nuvem.");
    bloco("Protocolos industriais: Modbus RTU, TCP, OPC UA.");
    bloco("Protocolos IoT: MQTT ou HTTP.");
    bloco("Segurança: TLS/SSL e autenticação.");
    bloco("Destino: plataformas cloud ou dashboard SCADA.");
  }

  // ================= CONCLUSÃO =================
  y += 5;
  doc.setFontSize(13);
  linha("3. CONCLUSÃO");

  doc.setFontSize(11);

  if (tipo === "NEW") {
    bloco("Equipamento pronto para integração imediata com sistemas industriais digitais.");
  } else {
    bloco("Recomenda-se execução do plano de retrofit para viabilizar monitoramento, análise preditiva e integração ao ecossistema IoT industrial.");
  }

  // ================= SALVAR =================
  doc.save("NAVIS_RELATORIO_TECNICO.pdf");
}

// ================= SCADA =================
function simular() {

  let temp = 40 + Math.random()*40;
  tempEl.innerText = temp.toFixed(1);

  let status = temp > 70 ? "CRÍTICO" : "OK";
  statusEl.innerText = status;

  chart.data.labels.push("");
  chart.data.datasets[0].data.push(temp);

  if (chart.data.labels.length > 10) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }

  chart.update();
}

// ================= INVENTARIO =================
async function carregarMaquinas() {

  lista.innerHTML = "";

  let snap = await db.collection("maquinas").get();

  snap.forEach(doc=>{
    let li = document.createElement("li");
    let d = doc.data();

    li.innerText = `${d.tipo} - ${d.status || ""}`;
    lista.appendChild(li);
  });
}