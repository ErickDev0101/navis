// ================= CONFIGURAÇÕES =================
const firebaseConfig = {
  apiKey: "AIzaSyCR4FZbNlEOHIPfjyRT8yBjdunVjzgsdNM",
  authDomain: "navis-c9fd5.firebaseapp.com",
  projectId: "navis-c9fd5",
};

const URL_MODEL = "./model/"; 

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let modelIA = null; 
let imagemCapturada, streamAtual, cameraAtiva = false, chart;

// ================= INICIALIZAÇÃO =================
async function init() {
  abrirAba("dashboard");
  inicializarGrafico();
  setInterval(simularSensores, 2000);
  carregarMaquinas();
  
  try {
    modelIA = await tmImage.load(URL_MODEL + "model.json", URL_MODEL + "metadata.json");
  } catch (e) {
    console.warn("Modelo local não encontrado. Usando modo de simulação.");
  }
}

// ================= NAVEGAÇÃO E MÍDIA =================
function abrirAba(nome) {
  document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa"));
  const aba = document.getElementById(nome);
  if (aba) aba.classList.add("ativa");
  desligarCamera();
}

async function abrirCamera() {
  const camEl = document.getElementById("camera");
  const btnCap = document.getElementById("btnCapturar");
  if (camEl) camEl.style.display = "block";
  if (btnCap) btnCap.style.display = "inline-block";
  
  try {
    streamAtual = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    if (camEl) camEl.srcObject = streamAtual;
    cameraAtiva = true;
  } catch (err) { alert("Erro ao acessar câmera."); }
}

function desligarCamera() {
  if (streamAtual) streamAtual.getTracks().forEach(t => t.stop());
  const camEl = document.getElementById("camera");
  const btnCap = document.getElementById("btnCapturar");
  if (camEl) camEl.style.display = "none";
  if (btnCap) btnCap.style.display = "none";
  cameraAtiva = false;
}

function capturar() {
  const camEl = document.getElementById("camera");
  const canvasEl = document.getElementById("canvas");
  const previewEl = document.getElementById("preview");
  const ctx = canvasEl.getContext("2d");
  
  canvasEl.width = camEl.videoWidth;
  canvasEl.height = camEl.videoHeight;
  ctx.drawImage(camEl, 0, 0);
  const data = canvasEl.toDataURL("image/png");
  
  let img = new Image();
  img.onload = () => {
    imagemCapturada = img;
    previewEl.src = data;
    previewEl.style.display = "block";
  };
  img.src = data;
  desligarCamera();
}

// CORREÇÃO: Listener de Upload para restaurar o Preview
document.getElementById("imageUpload").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    let img = new Image();
    img.onload = () => {
      imagemCapturada = img;
      const previewEl = document.getElementById("preview");
      previewEl.src = ev.target.result;
      previewEl.style.display = "block";
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};

// ================= LÓGICA DE ANÁLISE =================
async function analisar() {
  if (!imagemCapturada) return alert("Capture ou envie uma imagem!");

  const resBox = document.getElementById("resultado-ia");
  const acoesBox = document.getElementById("acoes");
  resBox.innerHTML = "Analisando padrões...";
  acoesBox.innerHTML = "";

  try {
    let tipoSugerido = "LEGACY";
    let conf = 0;

    if (modelIA) {
      const prediction = await modelIA.predict(imagemCapturada);
      const top = prediction.sort((a, b) => b.probability - a.probability)[0];
      conf = (top.probability * 100).toFixed(1);
      tipoSugerido = (top.className.toUpperCase() === "MAQUINA 2") ? "NEW" : "LEGACY";
    }

    resBox.innerHTML = `
      <div class="resultado-header ${tipoSugerido.toLowerCase()}">
        <h3>Sugestão IA: ${tipoSugerido}</h3>
        <p>Confiança Visual: ${conf}%</p>
      </div>`;

    exibirPerguntaConectividade(tipoSugerido);
  } catch (e) { resBox.innerHTML = "Erro na análise."; }
}

// ================= FLUXO DE DECISÃO CORRIGIDO =================
function exibirPerguntaConectividade(tipoIA) {
  const acoesBox = document.getElementById("acoes");
  acoesBox.innerHTML = `
    <div class="pergunta-box">
      <p><b>A máquina possui conectividade com a rede?</b></p>
      <div class="botoes-fluxo">
        <button class="btn-sim" onclick="finalizarFluxo(true, '${tipoIA}')">SIM</button>
        <button class="btn-nao" onclick="finalizarFluxo(false, '${tipoIA}')">NÃO</button>
      </div>
    </div>`;
}

async function finalizarFluxo(conectada, tipoIA) {
  const acoesBox = document.getElementById("acoes");
  
  if (conectada) {
    // Se tem internet: Força como NEW (Validação Humana)
    await salvarMaquina("NEW", "ATIVO (Tempo Real)");
    acoesBox.innerHTML = "<div class='sucesso-box'>✅ Máquina NEW salva e conectada!</div>";
  } else {
    // Se NÃO tem internet: SEMPRE classifica como LEGACY e abre Retrofit
    acoesBox.innerHTML = `
      <div class="pergunta-box">
        <p>Sem rede: Máquina classificada como <b>LEGACY</b>.<br>Deseja iniciar o <b>Protocolo Retrofit</b>?</p>
        <div class="botoes-fluxo">
          <button class="btn-sim" onclick="fluxoRetrofit(true)">SIM</button>
          <button class="btn-nao" onclick="fluxoRetrofit(false)">NÃO</button>
        </div>
      </div>`;
  }
}

async function fluxoRetrofit(aceitou) {
  const acoesBox = document.getElementById("acoes");
  if (aceitou) {
    await salvarMaquina("LEGACY", "PROTOCOLO RETROFIT");
    gerarPDFRetrofit();
    acoesBox.innerHTML = "<div class='sucesso-box'>✅ Protocolo iniciado e PDF Gerado.</div>";
  } else {
    await salvarMaquina("LEGACY", "LEGACY (Manual)");
    acoesBox.innerHTML = "<div class='sucesso-box'>✅ Salva como LEGACY (Manual).</div>";
  }
}

// ================= GERAÇÃO DE PDF TÉCNICO =================
function gerarPDFRetrofit() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Configurações de Estilo
  const azulEscuro = "#1e3a8a";
  const cinzaClaro = "#f3f4f6";

  // Cabeçalho
  doc.setFillColor(azulEscuro);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("PROTOCOLO TÉCNICO DE RETROFIT", 15, 20);

  // 1. Componentes Essenciais
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text("1. Componentes Essenciais", 15, 45);
  
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  let texto1 = "Para conectar uma máquina legada, você precisará de três camadas de hardware:\n\n" +
               "• Camada de Sensoriamento: Instalação de sensores externos (TC tipo split-core, vibração e sensores fotoelétricos).\n" +
               "• Camada de Processamento: Gateway IoT (Siemens IOT2050, ESP32 ou Raspberry Pi) e conversores de protocolo.\n" +
               "• Camada de Conectividade: Roteador Industrial 4G/5G ou Wi-Fi.";
  doc.text(texto1, 15, 52, { maxWidth: 180 });

  // 2. Passo a Passo
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text("2. Passo a Passo do Retrofit", 15, 95);
  
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  let texto2 = "Passo 1: Auditoria de Sinais (Status, Produção e Saúde).\n" +
               "Passo 2: Instalação Física (Hardware e sensores na torre de luz).\n" +
               "Passo 3: Digitalização e Protocolos (Configuração OPC UA ou MQTT).\n" +
               "Passo 4: Centralização de Dados (Dashboards em Grafana ou Node-RED).";
  doc.text(texto2, 15, 102, { maxWidth: 180 });

  // 3. Tabela de Arquitetura
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text("3. Exemplo Prático de Arquitetura", 15, 135);

  // Desenho da Tabela
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 142, 180, 45, 'F');
  doc.setFontSize(10);
  doc.text("Componente", 20, 148);
  doc.text("Função", 80, 148);
  doc.line(15, 150, 195, 150);
  
  const linhas = [
    ["Sensor SCT-013", "Monitora se o motor está sob esforço ou vazio."],
    ["Contador de Pulsos", "Conectado à saída de ejeção de peças."],
    ["Gateway ESP32", "Coleta dados analógicos e envia via MQTT."],
    ["Broker Mosquitto", "Recebe e organiza as mensagens de dados."]
  ];

  let y = 158;
  linhas.forEach(linha => {
    doc.text(linha[0], 20, y);
    doc.text(linha[1], 80, y);
    y += 8;
  });

  // Rodapé
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado por NAVIS INDUSTRIAL em ${new Date().toLocaleString()}`, 15, 285);

  // Download automático
  doc.save("Protocolo_Retrofit_Navis.pdf");
}

// ================= INVENTÁRIO E ESTADOS =================
async function salvarMaquina(tipo, status) {
  try {
    await db.collection("maquinas").add({ tipo, status, timestamp: Date.now() });
    carregarMaquinas();
  } catch (e) { console.error(e); }
}

async function carregarMaquinas() {
  const lista = document.getElementById("lista");
  if (!lista) return;
  const snap = await db.collection("maquinas").orderBy("timestamp", "desc").limit(10).get();
  lista.innerHTML = "";
  snap.forEach(doc => {
    const d = doc.data();
    const id = doc.id;
    const li = document.createElement("li");
    li.className = `item-maquina ${d.tipo.toLowerCase()}`;
    li.innerHTML = `
      <div><strong>${d.tipo}</strong> - <span id="txt-${id}">${d.status}</span></div>
      <div class="controles-item">
        <select onchange="atualizarStatus('${id}', this.value)">
          <option value="">Alterar...</option>
          <option value="ATIVO">ATIVO</option>
          <option value="RETROFIT">RETROFIT</option>
          <option value="MANUTENÇÃO">MANUTENÇÃO</option>
        </select>
        <button onclick="excluirMaquina('${id}')">🗑️</button>
      </div>`;
    lista.appendChild(li);
  });
}

async function atualizarStatus(id, novo) {
  if (!novo) return;
  await db.collection("maquinas").doc(id).update({ status: novo });
  document.getElementById(`txt-${id}`).innerText = novo;
}

async function excluirMaquina(id) {
  if(confirm("Excluir?")) {
    await db.collection("maquinas").doc(id).delete();
    carregarMaquinas();
  }
}

// ================= SENSORES =================
function inicializarGrafico() {
  const ctx = document.getElementById('grafico').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: "Temp °C", data: [], borderColor: '#2563eb' }] },
    options: { responsive: true }
  });
}

function simularSensores() {
  const tempEl = document.getElementById("tempEl");
  if (!tempEl || !chart) return;
  const temp = (40 + Math.random() * 20).toFixed(1);
  tempEl.innerText = temp;
  chart.data.labels.push("");
  chart.data.datasets[0].data.push(temp);
  if (chart.data.labels.length > 10) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  chart.update('none');
}
