const URL_MODEL = "./model/";
let model;

// O dicionário agora está mapeado para as suas labels reais
const maquinaDicionario = {
    "maquina 1": {
        titulo: "SISTEMA INDUSTRIAL - MAQUINA 1",
        desc: "Equipamento de processamento detectado via telemetria visual.",
        recomendacao: "Manutenção preventiva padrão: Verificar lubrificação dos eixos."
    },
    "maquina 2": {
        titulo: "SISTEMA INDUSTRIAL - MAQUINA 2",
        desc: "Módulo de automação detectado. Operação em regime nominal.",
        recomendacao: "Protocolo: Realizar limpeza técnica dos sensores ópticos."
    }
};

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if (target) target.style.display = 'block';
}

async function init() {
    const aiText = document.getElementById('ai-text');
    const btn = document.getElementById('predictBtn');

    try {
        model = await tmImage.load(URL_MODEL + "model.json", URL_MODEL + "metadata.json");
        const labels = model.getClassLabels();

        btn.disabled = false;
        btn.innerText = "RUN DIAGNOSTIC";
        aiText.innerText = "SISTEMA ONLINE. Pronto para analisar: " + labels.join(", ");
    } catch (e) {
        aiText.innerHTML = "<b style='color:red'>ERRO: Falha ao carregar modelo em /model/</b>";
    }
}

async function predict() {
    const img = document.getElementById('imagePreview');
    const aiText = document.getElementById('ai-text');

    if (!img.src || img.src === "" || img.src === window.location.href) {
        alert("Carregue uma imagem primeiro.");
        return;
    }

    try {
        const prediction = await model.predict(img);
        let bestMatch = "";
        let highestProb = 0;

        prediction.forEach(p => {
            if (p.probability > highestProb) {
                highestProb = p.probability;
                bestMatch = p.className.toLowerCase().trim(); // Converte "MAQUINA 1" para "maquina 1"
            }
        });

        // Busca no dicionário usando o nome convertido
        const info = maquinaDicionario[bestMatch] || {
            titulo: `ATIVO NÃO IDENTIFICADO: [${bestMatch}]`,
            desc: `A IA reconheceu como "${bestMatch}", mas este nome precisa estar no dicionário.`,
            recomendacao: "Verifique a ortografia no objeto maquinaDicionario."
        };

        aiText.innerHTML = `
            <div class="result-header">
                <h4>${info.titulo}</h4>
                <span class="confidence">${(highestProb * 100).toFixed(2)}% CONFIDENCE</span>
            </div>
            <div class="result-body">
                <p><strong>Notas de Inspeção:</strong> ${info.desc}</p>
                <div class="action-item"><strong>Protocolo:</strong> ${info.recomendacao}</div>
            </div>
        `;
    } catch (err) {
        aiText.innerText = "Erro no processamento visual.";
    }
}

// Handlers de interface
document.getElementById('imageUpload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        const img = document.getElementById('imagePreview');
        img.src = ev.target.result;
        img.style.display = 'block';
        document.getElementById('ai-text').innerText = "Imagem carregada. Clique em RUN DIAGNOSTIC.";
    }
    reader.readAsDataURL(file);
});

document.getElementById('predictBtn').addEventListener('click', predict);

init();