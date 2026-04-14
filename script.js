let model;

async function loadModel() {
    model = await tf.loadLayersModel('model/model.json');
}

loadModel();

async function predict() {
    const file = document.getElementById('imageUpload').files[0];
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
        let tensor = tf.browser.fromPixels(img)
            .resizeNearestNeighbor([224, 224])
            .toFloat()
            .expandDims();

        const prediction = await model.predict(tensor).data();

        const classes = ["Torno", "Prensa", "CNC"];
        let index = prediction.indexOf(Math.max(...prediction));
        let maquina = classes[index];

        mostrarResultado(maquina);
    }
}

function mostrarResultado(maquina) {
    let dados = {
        "Torno": {
            ano: "1990–2010",
            consumo: "5kW",
            eficiencia: "Baixa"
        },
        "Prensa": {
            ano: "1980–2005",
            consumo: "8kW",
            eficiencia: "Média"
        },
        "CNC": {
            ano: "2000–2020",
            consumo: "10kW",
            eficiencia: "Alta"
        }
    };

    let d = dados[maquina];

    document.getElementById("resultado").innerText = `Máquina: ${maquina}`;
    document.getElementById("info").innerText =
        `Ano: ${d.ano} | Consumo: ${d.consumo} | Eficiência: ${d.eficiencia}`;
}