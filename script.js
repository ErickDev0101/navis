const URL_MODEL = "./model/";
let model;

async function init() {
    try {
        model = await tmImage.load(URL_MODEL + "model.json", URL_MODEL + "metadata.json");
        document.getElementById('predictBtn').disabled = false;
        carregarInventario();
    } catch (e) { console.error("Erro IA."); }
}

document.getElementById('imageUpload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview = document.getElementById('imagePreview');
        preview.src = ev.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

async function predict() {
    const img = document.getElementById('imagePreview');
    if (!img.src || img.src === "") return;
    const prediction = await model.predict(img);
    let topClass = ""; let topProb = 0;
    prediction.forEach(p => { if (p.probability > topProb) { topProb = p.probability; topClass = p.className.toUpperCase().trim(); } });

    document.getElementById('ai-confidence-percent').innerText = (topProb * 100).toFixed(0) + "%";
    const isNew = topClass.includes("NEW") || topClass.includes("MAQUINA 2");

    document.getElementById('ai-diagnostics').innerHTML = `
        <div class="panel" style="border-left: 4px solid ${isNew ? '#0ea5e9' : '#ffc107'}">
            <h3 style="color:${isNew ? '#0ea5e9' : '#ffc107'}">${isNew ? 'Máquina NEW' : 'LEGACY DETECTADO'}</h3>
            <p>Ativo: <strong>${topClass}</strong></p>
            <button class="btn-primary" style="width:100%; margin-top:10px" onclick="processarAtivo('${topClass}', '${isNew ? 'NEW' : 'LEGACY'}')">SALVAR E GERAR PDF</button>
        </div>`;
}

function processarAtivo(nome, tipo) {
    const dataR = new Date().toLocaleString('pt-BR');
    const maquina = { nome, tipo, data: dataR };
    let inv = JSON.parse(localStorage.getItem('navis_inv')) || [];
    inv.push(maquina);
    localStorage.setItem('navis_inv', JSON.stringify(inv));

    carregarInventario();
    gerarPDFCompleto(nome, tipo, dataR);
}

function carregarInventario() {
    const lista = document.getElementById('lista-inventario');
    const inv = JSON.parse(localStorage.getItem('navis_inv')) || [];
    lista.innerHTML = inv.map(i => `
        <tr style="border-bottom: 1px solid #222">
            <td style="padding:12px">${i.nome}</td>
            <td>${i.tipo === 'NEW' ? 'new' : 'Analógica'}</td>
            <td>${i.data}</td>
        </tr>`).join('');
}

function gerarPDFCompleto(nome, tipo, data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Estilo do Relatório
    doc.setFillColor(33, 37, 41); doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 193, 7); doc.setFontSize(26); doc.text("NAVIS", 15, 25);
    doc.setTextColor(255, 255, 255); doc.setFontSize(10);
    doc.text("RELATÓRIO TÉCNICO DE ENGENHARIA", 15, 35);
    doc.text(`RESPONSÁVEL: Eng. Thiago Erick`, 130, 20);
    doc.text(`DATA: ${data}`, 130, 26);

    doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("1. IDENTIFICAÇÃO DO ATIVO", 15, 60);
    doc.line(15, 62, 195, 62);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text(`NOME: ${nome}`, 20, 70);
    doc.text(`CATEGORIA: ${tipo === 'NEW' ? 'Digital 4.0' : 'Unidade Analógica'}`, 20, 78);

    doc.setFont("helvetica", "bold"); doc.text("2. ESPECIFICAÇÕES TÉCNICAS E INSTALAÇÃO", 15, 95);
    doc.line(15, 97, 195, 97);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");

    if (tipo === 'LEGACY') {
        doc.text("INTERFACE SUGERIDA: IOT (Gateway NAVIS)", 20, 105);
        doc.text("SENSORES PARA MONITORAMENTO:", 20, 113);
        doc.text("- Transformador de Corrente SCT-013 (Monitoramento de Carga)", 25, 121);
        doc.text("- Sensor Piezoelétrico (Análise de Vibração Preditiva)", 25, 129);
        doc.text("NOTA: Fixar Piezoelétrico próximo ao mancal principal.", 20, 140);
    } else {
        doc.text("PROTOCOLOS: Modbus TCP / MQTT Nativo", 20, 105);
        doc.text("CONEXÃO: Interface Ethernet RJ45 (Cabo Blindado)", 20, 113);
    }

    doc.text("Documento gerado eletronicamente pelo sistema NAVIS.", 15, 280);
    doc.save(`NAVIS_Relatorio_${nome.replace(/\s/g, '_')}.pdf`);
}

function limparInventario() {
    if (confirm("Limpar base de dados?")) { localStorage.removeItem('navis_inv'); carregarInventario(); }
}

function showPage(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('page-' + id).style.display = (id === 'scan' ? 'grid' : 'block');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + id).classList.add('active');
}

document.getElementById('predictBtn').onclick = predict;