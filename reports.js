function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function generateReportId() {
    return "RPT-" + Date.now().toString(36).toUpperCase();
}

let athleteCache = [];

function openReportModal() {
    document.getElementById("reportModalOverlay").classList.add("open");
}

function closeReportModal() {
    document.getElementById("reportModalOverlay").classList.remove("open");
    document.getElementById("reportForm").reset();
    document.getElementById("reportSample").innerHTML = `<option value="">Select athlete first</option>`;
}

async function loadAthleteOptions() {
    const select = document.getElementById("reportAthlete");

    const { data, error } = await window.supabaseClient
        .from("athletes")
        .select("id, athlete_id, athlete_name")
        .eq("registered_by", window.currentUser.id)
        .order("athlete_name", { ascending: true });

    if (error || !data || data.length === 0) {
        select.innerHTML = `<option value="">No athletes registered yet</option>`;
        document.getElementById("generateBtn").disabled = true;
        return;
    }

    athleteCache = data;
    select.innerHTML = `<option value="">Select athlete</option>` + data.map(a =>
        `<option value="${a.id}">${escapeHtml(a.athlete_name)} (${escapeHtml(a.athlete_id)})</option>`
    ).join("");
}

document.getElementById("reportAthlete").addEventListener("change", async (e) => {
    const athleteId = e.target.value;
    const sampleSelect = document.getElementById("reportSample");

    if (!athleteId) {
        sampleSelect.innerHTML = `<option value="">Select athlete first</option>`;
        return;
    }

    sampleSelect.innerHTML = `<option value="">Loading samples...</option>`;

    const { data, error } = await window.supabaseClient
        .from("samples")
        .select("id, sample_id, sample_type, collection_date")
        .eq("athlete_id", athleteId)
        .eq("officer_id", window.currentUser.id)
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        sampleSelect.innerHTML = `<option value="">No samples for this athlete yet</option>`;
        return;
    }

    sampleSelect.innerHTML = `<option value="">Select sample</option>` + data.map(s =>
        `<option value="${s.id}">${escapeHtml(s.sample_id)} — ${escapeHtml(s.sample_type)} (${escapeHtml(s.collection_date)})</option>`
    ).join("");
});

async function loadReports() {
    const tbody = document.getElementById("reportsTableBody");

    const { data, error } = await window.supabaseClient
        .from("reports")
        .select("*, athletes(athlete_name, athlete_id), samples(sample_id, sample_type)")
        .eq("generated_by", window.currentUser.id)
        .order("generated_at", { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Could not load reports: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No reports generated yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${escapeHtml(r.report_id)}</td>
            <td>${escapeHtml(r.athletes ? r.athletes.athlete_name : "—")}</td>
            <td>${escapeHtml(r.samples ? r.samples.sample_id : "—")}</td>
            <td><span class="pill ${r.report_status === 'Finalized' ? 'pill-ok' : 'pill-neutral'}">${escapeHtml(r.report_status || "Draft")}</span></td>
            <td>${r.generated_at ? new Date(r.generated_at).toLocaleDateString() : "—"}</td>
            <td><button class="btn btn-ghost" onclick='viewReport(${JSON.stringify(r).replace(/'/g, "&apos;")})'>View</button></td>
        </tr>
    `).join("");
}

// Simplified OFF-score, modeled loosely on the real ABP formula (Hb in g/L - 60 * sqrt(Ret%)).
// This is an educational approximation only, not a clinical/regulatory calculation.
function calcOffScore(hemoglobinGdl, reticulocytePct) {
    if (hemoglobinGdl == null || reticulocytePct == null || reticulocytePct <= 0) return null;
    const hbGl = hemoglobinGdl * 10;
    return hbGl - 60 * Math.sqrt(reticulocytePct);
}

// Flags a sample as anomalous if a marker jumps beyond a simple fixed threshold
// vs. the athlete's own previous sample, or falls outside a broad reference range.
function flagSample(current, previous) {
    const reasons = [];

    if (current.hemoglobin != null) {
        if (current.hemoglobin < 12 || current.hemoglobin > 18) {
            reasons.push("Hemoglobin outside typical reference range");
        }
        if (previous && previous.hemoglobin != null) {
            const pctChange = Math.abs(current.hemoglobin - previous.hemoglobin) / previous.hemoglobin * 100;
            if (pctChange > 12) reasons.push(`Hemoglobin shifted ${pctChange.toFixed(1)}% since last sample`);
        }
    }

    if (current.reticulocyte_percentage != null) {
        if (current.reticulocyte_percentage < 0.4 || current.reticulocyte_percentage > 2.5) {
            reasons.push("Reticulocyte% outside typical reference range");
        }
        if (previous && previous.reticulocyte_percentage != null) {
            const pctChange = Math.abs(current.reticulocyte_percentage - previous.reticulocyte_percentage) / previous.reticulocyte_percentage * 100;
            if (pctChange > 50) reasons.push(`Reticulocyte% shifted ${pctChange.toFixed(1)}% since last sample`);
        }
    }

    if (current.offScore != null && previous && previous.offScore != null) {
        const diff = Math.abs(current.offScore - previous.offScore);
        if (diff > 20) reasons.push(`OFF-score shifted by ${diff.toFixed(1)} since last sample`);
    }

    return reasons;
}

function loadChartJsOnce() {
    if (window.__chartJsPromise) return window.__chartJsPromise;
    window.__chartJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js@4";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.__chartJsPromise;
}

async function viewReport(r) {
    const athleteName = r.athletes ? r.athletes.athlete_name : "—";
    const athleteIdText = r.athletes ? r.athletes.athlete_id : "—";
    const sampleIdText = r.samples ? r.samples.sample_id : "—";
    const sampleType = r.samples ? r.samples.sample_type : "—";

    // Pull the athlete's full sample history (marker values) to build the passport trend.
    const { data: history, error: historyError } = await window.supabaseClient
        .from("samples")
        .select("sample_id, collection_date, hemoglobin, hematocrit, reticulocyte_percentage")
        .eq("athlete_id", r.athlete_id)
        .eq("officer_id", window.currentUser.id)
        .order("collection_date", { ascending: true });

    const samples = (history || [])
        .filter(s => s.hemoglobin != null || s.hematocrit != null || s.reticulocyte_percentage != null)
        .map(s => ({
            ...s,
            hemoglobin: s.hemoglobin != null ? Number(s.hemoglobin) : null,
            hematocrit: s.hematocrit != null ? Number(s.hematocrit) : null,
            reticulocyte_percentage: s.reticulocyte_percentage != null ? Number(s.reticulocyte_percentage) : null
        }));

    samples.forEach(s => { s.offScore = calcOffScore(s.hemoglobin, s.reticulocyte_percentage); });

    const flaggedSamples = samples.map((s, i) => ({
        sample_id: s.sample_id,
        reasons: flagSample(s, i > 0 ? samples[i - 1] : null)
    })).filter(f => f.reasons.length > 0);

    const win = window.open("", "_blank");
    win.document.write(`
        <html>
        <head>
            <title>${escapeHtml(r.report_id)} — ADIS Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
                h1 { border-bottom: 4px solid rgb(216,188,28); padding-bottom: 10px; }
                h2 { margin-top: 36px; font-size: 1.1rem; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                td, th { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
                td:first-child { font-weight: bold; width: 220px; color: #555; }
                .chart-wrap { max-width: 800px; margin-top: 10px; }
                .flag-box { background: #fdecea; border: 1px solid #c0392b; border-radius: 6px; padding: 14px 18px; margin-top: 14px; }
                .flag-box h3 { color: #c0392b; margin-bottom: 8px; font-size: 0.95rem; }
                .flag-box ul { margin-left: 18px; }
                .ok-box { background: #eafaf1; border: 1px solid #3fa66a; border-radius: 6px; padding: 14px 18px; margin-top: 14px; color: #2c7a4b; }
                .disclaimer { margin-top: 40px; font-size: 0.78rem; color: #888; }
            </style>
        </head>
        <body>
            <h1>Anti-Doping Report — ${escapeHtml(r.report_id)}</h1>
            <table>
                <tr><td>Athlete</td><td>${escapeHtml(athleteName)} (${escapeHtml(athleteIdText)})</td></tr>
                <tr><td>Sample</td><td>${escapeHtml(sampleIdText)} — ${escapeHtml(sampleType)}</td></tr>
                <tr><td>Status</td><td>${escapeHtml(r.report_status || "Draft")}</td></tr>
                <tr><td>Generated</td><td>${r.generated_at ? new Date(r.generated_at).toLocaleString() : "—"}</td></tr>
            </table>

            <h2>Biological Passport Trend</h2>
            ${samples.length === 0
                ? `<p>No marker values (hemoglobin / hematocrit / reticulocyte%) recorded for this athlete yet.</p>`
                : `<div class="chart-wrap"><canvas id="passportChart" height="260"></canvas></div>`
            }

            ${flaggedSamples.length > 0 ? `
                <div class="flag-box">
                    <h3>⚠ Flagged for Review</h3>
                    <ul>
                        ${flaggedSamples.map(f => `<li><strong>${escapeHtml(f.sample_id)}:</strong> ${f.reasons.map(escapeHtml).join("; ")}</li>`).join("")}
                    </ul>
                </div>
            ` : samples.length > 0 ? `<div class="ok-box">No anomalies detected across the recorded sample history.</div>` : ``}

            <p class="disclaimer">Reference ranges and OFF-score are simplified for educational demonstration only and are not derived from validated ABP methodology or WADA guidelines.</p>
        </body>
        </html>
    `);
    win.document.close();

    if (samples.length === 0) return;

    // Inject Chart.js into the popup window and render the trend chart there.
    const chartScript = win.document.createElement("script");
    chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js@4";
    chartScript.onload = () => {
        const labels = samples.map(s => s.collection_date);
        const flaggedIds = new Set(flaggedSamples.map(f => f.sample_id));
        const pointColor = samples.map(s => flaggedIds.has(s.sample_id) ? "#c0392b" : "#2c7a4b");

        const ctx = win.document.getElementById("passportChart").getContext("2d");
        new win.Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Hemoglobin (g/dL)",
                        data: samples.map(s => s.hemoglobin),
                        borderColor: "#c0392b",
                        pointBackgroundColor: pointColor,
                        pointRadius: 5,
                        tension: 0.2
                    },
                    {
                        label: "Hematocrit (%)",
                        data: samples.map(s => s.hematocrit),
                        borderColor: "#d8bc1c",
                        pointBackgroundColor: pointColor,
                        pointRadius: 4,
                        tension: 0.2
                    },
                    {
                        label: "Reticulocyte (%)",
                        data: samples.map(s => s.reticulocyte_percentage),
                        borderColor: "#2c7a4b",
                        pointBackgroundColor: pointColor,
                        pointRadius: 4,
                        tension: 0.2,
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: "index", intersect: false },
                scales: {
                    y: { title: { display: true, text: "Hb / HCT" } },
                    y1: { position: "right", title: { display: true, text: "Ret%" }, grid: { drawOnChartArea: false } }
                }
            }
        });
    };
    win.document.body.appendChild(chartScript);
}

document.addEventListener("adis:ready", () => {
    if (window.currentOfficer) {
        document.getElementById("sidebarOfficerId").textContent = window.currentOfficer.officer_id || "—";
        document.getElementById("sidebarOfficerName").textContent = window.currentOfficer.username || window.currentUser.email;
    }
    loadAthleteOptions();
    loadReports();
});

document.getElementById("reportForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("reportSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Generating...";

    const payload = {
        report_id: generateReportId(),
        athlete_id: document.getElementById("reportAthlete").value,
        sample_id: document.getElementById("reportSample").value,
        generated_by: window.currentUser.id,
        report_status: document.getElementById("reportStatus").value
    };

    const { error } = await window.supabaseClient.from("reports").insert(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = "Generate Report";

    if (error) {
        alert("Could not generate report: " + error.message);
        return;
    }

    closeReportModal();
    loadReports();
});
