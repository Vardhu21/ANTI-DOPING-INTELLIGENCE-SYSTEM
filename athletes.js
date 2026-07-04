function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function generateAthleteId() {
    return "ATH-" + Date.now().toString(36).toUpperCase();
}

function openAthleteModal() {
    document.getElementById("athleteModalOverlay").classList.add("open");
}

function closeAthleteModal() {
    document.getElementById("athleteModalOverlay").classList.remove("open");
    document.getElementById("athleteForm").reset();
}

async function loadAthletes() {
    const tbody = document.getElementById("athletesTableBody");

    const { data, error } = await window.supabaseClient
        .from("athletes")
        .select("*")
        .eq("registered_by", window.currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Could not load athletes: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No athletes registered yet. Click "Register Athlete" to add one.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(a => `
        <tr>
            <td>${escapeHtml(a.athlete_id)}</td>
            <td>${escapeHtml(a.athlete_name)}</td>
            <td>${escapeHtml(a.gender)}</td>
            <td>${escapeHtml(a.sport)}</td>
            <td>${escapeHtml(a.nationality || "—")}</td>
            <td>${escapeHtml(a.blood_group || "—")}</td>
            <td>${escapeHtml(a.email || a.phone || "—")}</td>
        </tr>
    `).join("");
}

document.addEventListener("adis:ready", () => {
    if (window.currentOfficer) {
        document.getElementById("sidebarOfficerId").textContent = window.currentOfficer.officer_id || "—";
        document.getElementById("sidebarOfficerName").textContent = window.currentOfficer.username || window.currentUser.email;
    }
    loadAthletes();
});

document.getElementById("athleteForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("athleteSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Registering...";

    const payload = {
        athlete_id: generateAthleteId(),
        athlete_name: document.getElementById("athleteName").value.trim(),
        gender: document.getElementById("athleteGender").value,
        date_of_birth: document.getElementById("athleteDob").value || null,
        nationality: document.getElementById("athleteNationality").value.trim() || null,
        sport: document.getElementById("athleteSport").value.trim(),
        email: document.getElementById("athleteEmail").value.trim() || null,
        phone: document.getElementById("athletePhone").value.trim() || null,
        blood_group: document.getElementById("athleteBloodGroup").value || null,
        weight: document.getElementById("athleteWeight").value || null,
        height: document.getElementById("athleteHeight").value || null,
        registered_by: window.currentUser.id
    };

    const { error } = await window.supabaseClient.from("athletes").insert(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = "Register Athlete";

    if (error) {
        alert("Could not register athlete: " + error.message);
        return;
    }

    closeAthleteModal();
    loadAthletes();
});
