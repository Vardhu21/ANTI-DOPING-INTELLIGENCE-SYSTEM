function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function generateSampleId() {
    return "SMP-" + Date.now().toString(36).toUpperCase();
}

function statusPillClass(status) {
    if (!status) return "pill-neutral";
    const s = status.toLowerCase();
    if (s.includes("complete") || s.includes("received")) return "pill-ok";
    if (s.includes("flag") || s.includes("fail")) return "pill-alert";
    return "pill-neutral";
}

function openSampleModal() {
    document.getElementById("sampleModalOverlay").classList.add("open");
}

function closeSampleModal() {
    document.getElementById("sampleModalOverlay").classList.remove("open");
    document.getElementById("sampleForm").reset();
}

async function loadAthleteOptions() {
    const select = document.getElementById("sampleAthlete");

    const { data, error } = await window.supabaseClient
        .from("athletes")
        .select("id, athlete_id, athlete_name")
        .eq("registered_by", window.currentUser.id)
        .order("athlete_name", { ascending: true });

    if (error || !data || data.length === 0) {
        select.innerHTML = `<option value="">No athletes registered yet</option>`;
        document.getElementById("collectBtn").disabled = true;
        document.getElementById("collectBtn").title = "Register an athlete first";
        return;
    }

    select.innerHTML = `<option value="">Select athlete</option>` + data.map(a =>
        `<option value="${a.id}">${escapeHtml(a.athlete_name)} (${escapeHtml(a.athlete_id)})</option>`
    ).join("");
}

async function loadSamples() {
    const tbody = document.getElementById("samplesTableBody");

    const { data, error } = await window.supabaseClient
        .from("samples")
        .select("*, athletes(athlete_name, athlete_id)")
        .eq("officer_id", window.currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Could not load samples: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No samples collected yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(s => `
        <tr>
            <td>${escapeHtml(s.sample_id)}</td>
            <td>${escapeHtml(s.athletes ? s.athletes.athlete_name : "—")}</td>
            <td>${escapeHtml(s.sample_type)}</td>
            <td>${escapeHtml(s.collection_date)}</td>
            <td>${escapeHtml(s.collection_location || "—")}</td>
            <td>${s.hemoglobin ?? "—"}</td>
            <td>${s.hematocrit ?? "—"}</td>
            <td>${s.reticulocyte_percentage ?? "—"}</td>
            <td><span class="pill ${statusPillClass(s.sample_status)}">${escapeHtml(s.sample_status || "Pending")}</span></td>
        </tr>
    `).join("");
}

document.addEventListener("adis:ready", () => {
    if (window.currentOfficer) {
        document.getElementById("sidebarOfficerId").textContent = window.currentOfficer.officer_id || "—";
        document.getElementById("sidebarOfficerName").textContent = window.currentOfficer.username || window.currentUser.email;
    }
    loadAthleteOptions();
    loadSamples();
});

document.getElementById("sampleForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("sampleSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const payload = {
        sample_id: generateSampleId(),
        athlete_id: document.getElementById("sampleAthlete").value,
        officer_id: window.currentUser.id,
        sample_type: document.getElementById("sampleType").value,
        collection_date: document.getElementById("sampleDate").value,
        collection_location: document.getElementById("sampleLocation").value.trim() || null,
        hemoglobin: document.getElementById("sampleHemoglobin").value || null,
        hematocrit: document.getElementById("sampleHematocrit").value || null,
        reticulocyte_percentage: document.getElementById("sampleReticulocyte").value || null,
        sample_status: document.getElementById("sampleStatus").value,
        remarks: document.getElementById("sampleRemarks").value.trim() || null
    };

    const { error } = await window.supabaseClient.from("samples").insert(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = "Save Sample";

    if (error) {
        alert("Could not save sample: " + error.message);
        return;
    }

    closeSampleModal();
    loadSamples();
});
