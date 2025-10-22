let devices = [];
let chart;
let history = [];
let evolutionChart;

// 🔹 Cargar datos guardados al inicio
window.onload = () => {
  const savedDevices = localStorage.getItem("devices");
  const savedTariff = localStorage.getItem("tariff");
  const savedThreshold = localStorage.getItem("threshold");
  const savedResult = localStorage.getItem("resultText");
  const savedChart = localStorage.getItem("chartData");
  const savedHistory = localStorage.getItem("history");

  if(savedDevices){
    devices = JSON.parse(savedDevices);
    renderDevices();
  }
  if(savedTariff){
    document.getElementById("tariff").value = savedTariff;
  }
  if(savedThreshold){
    document.getElementById("threshold").value = savedThreshold;
  }
  if(savedResult){
    document.getElementById("result").innerText = savedResult;
  }
  if(savedChart){
    renderChart(JSON.parse(savedChart));
  }
  if(savedHistory){
    history = JSON.parse(savedHistory);
    renderHistory();
    renderEvolution();
  }

  // Dark mode persistente
  const savedMode = localStorage.getItem("theme");
  const toggleBtn = document.getElementById("toggleDarkMode");
  if(savedMode === "dark"){
    document.body.classList.add("dark-mode");
    toggleBtn.textContent = "☀️ Modo Claro";
  }
};

function addDevice() {
  const name = document.getElementById("name").value;
  const power = parseFloat(document.getElementById("power").value);
  const hours = parseFloat(document.getElementById("hours").value);
  if(name && power > 0 && hours > 0){
    devices.push({name, power, hours});
    saveDevices();
    renderDevices();
  }
}

function removeDevice(index){
  devices.splice(index,1);
  saveDevices();
  renderDevices();
}

function saveDevices(){
  localStorage.setItem("devices", JSON.stringify(devices));
}

function saveTariff(){
  const tariff = document.getElementById("tariff").value;
  localStorage.setItem("tariff", tariff);
}

function saveThreshold(){
  const threshold = document.getElementById("threshold").value;
  localStorage.setItem("threshold", threshold);
}

function renderDevices() {
  const div = document.getElementById("devices");
  div.innerHTML = "<h5>Dispositivos:</h5>" + devices.map((d,i) => 
    `<p>${d.name}: ${d.power}W x ${d.hours}h/día 
    <button class="btn btn-sm btn-danger" onclick="removeDevice(${i})">❌</button></p>`).join("");
}

function calculate() {
  const tariff = parseFloat(document.getElementById("tariff").value);
  const threshold = parseFloat(document.getElementById("threshold").value);
  let dailyKWh = devices.map(d => (d.power * d.hours) / 1000);
  let monthlyKWh = dailyKWh.map(v => v * 30);
  let total = monthlyKWh.reduce((a,b) => a+b, 0);
  let cost = total * tariff;

  const resultText = 
    `Consumo mensual: ${total.toFixed(2)} kWh | Costo: $${cost.toFixed(2)}`;
  document.getElementById("result").innerText = resultText;

  // Guardar resultados
  localStorage.setItem("resultText", resultText);
  localStorage.setItem("chartData", JSON.stringify(monthlyKWh));

  // 🔹 Guardar en historial
  const now = new Date().toLocaleString();
  history.push({date: now, kwh: total.toFixed(2), cost: cost.toFixed(2)});
  localStorage.setItem("history", JSON.stringify(history));
  renderHistory();
  renderEvolution();

  renderChart(monthlyKWh);

  // 🚨 Alerta si supera el umbral
  const alertBox = document.getElementById("alertBox");
  if(total > threshold){
    alertBox.innerHTML = `⚠️ Atención: tu consumo (${total.toFixed(2)} kWh) supera el umbral de ${threshold} kWh`;
    alertBox.style.color = "red";
  } else {
    alertBox.innerHTML = `✅ Tu consumo está dentro del umbral (${threshold} kWh)`;
    alertBox.style.color = "green";
  }

  // 🤖 Recomendación automática
  const recommendationBox = document.getElementById("recommendation");
  if(devices.length > 0){
    let consumos = devices.map(d => (d.power * d.hours * 30) / 1000);
    let maxIndex = consumos.indexOf(Math.max(...consumos));
    let topDevice = devices[maxIndex];
    let topConsumption = consumos[maxIndex];
    let percentage = ((topConsumption / total) * 100).toFixed(1);

    recommendationBox.innerHTML = 
      `💡 Recomendación: El dispositivo <b>${topDevice.name}</b> consume ${topConsumption.toFixed(2)} kWh/mes, lo que representa el ${percentage}% de tu consumo total. 
      Considera reducir sus horas de uso o mejorar su eficiencia.`;
    recommendationBox.style.color = "blue";
  } else {
    recommendationBox.innerHTML = "";
  }
}

function renderChart(data) {
  const ctx = document.getElementById("chart").getContext("2d");
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: devices.map(d => d.name),
      datasets: [{
        label: 'Consumo mensual (kWh)',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    }
  });
}

function renderHistory(){
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = history.map(h => 
    `<tr>
      <td>${h.date}</td>
      <td>${h.kwh}</td>
      <td>$${h.cost}</td>
    </tr>`).join("");
}

// 🔹 Exportar historial a CSV
function exportCSV(){
  if(history.length === 0){
    alert("No hay datos en el historial para exportar.");
    return;
  }
  let csv = "Fecha,Consumo (kWh),Costo ($)\n";
  history.forEach(h => {
    csv += `${h.date},${h.kwh},${h.cost}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "historial_consumo.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 🔹 Renderizar gráfico de evolución temporal con predicción punteada
function renderEvolution(){
  const ctx = document.getElementById("evolutionChart").getContext("2d");
  if(evolutionChart) evolutionChart.destroy();

  const labels = history.map(h => h.date);
  const consumo = history.map(h => parseFloat(h.kwh));
  const costo = history.map(h => parseFloat(h.cost));

  // 🔮 Predicción con promedio móvil (últimos 3 registros)
  let predictedKwh = null;
  let predictedCost = null;
  let labelsPred = [...labels];
  if(consumo.length >= 3){
    const last3 = consumo.slice(-3);
    predictedKwh = (last3.reduce((a,b)=>a+b,0) / last3.length).toFixed(2);

    const last3Cost = costo.slice(-3);
    predictedCost = (last3Cost.reduce((a,b)=>a+b,0) / last3Cost.length).toFixed(2);

    labelsPred.push("Predicción");
  }

  evolutionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsPred,
      datasets: [
        {
          label: 'Consumo (kWh)',
          data: consumo,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.2
        },
        {
          label: 'Costo ($)',
          data: costo,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.2
        },
        ...(predictedKwh ? [{
          label: 'Predicción Consumo (kWh)',
          data: [...Array(consumo.length).fill(null), predictedKwh],
          borderColor: 'rgba(54, 162, 235, 1)',
          borderDash: [5,5],
          fill: false,
          tension: 0.2
        }] : []),
        ...(predictedCost ? [{
          label: 'Predicción Costo ($)',
          data: [...Array(costo.length).fill(null), predictedCost],
          borderColor: 'rgba(255, 99, 132, 1)',
          borderDash: [5,5],
          fill: false,
          tension: 0.2
        }] : [])
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context){
              if(context.dataset.label.includes("Predicción")){
                return context.dataset.label + ": " + context.formattedValue + " (estimado)";
              }
              return context.dataset.label + ": " + context.formattedValue;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Fecha' } },
        y: { title: { display: true, text: 'Valor' } }
      }
    }
  });
}