function statusPillClass(status) {
    if (!status) return "pill-neutral";
    const s = status.toLowerCase();
    if (s.includes("complete") || s.includes("received")) return "pill-ok";
    if (s.includes("flag") || s.includes("fail") || s.includes("positive")) return "pill-alert";
    return "pill-neutral";
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

document.addEventListener("adis:ready", async () => {

    if (window.currentOfficer) {
        document.getElementById("sidebarOfficerId").textContent = window.currentOfficer.officer_id || "—";
        document.getElementById("sidebarOfficerName").textContent = window.currentOfficer.username || window.currentUser.email;
    }

    const officerId = window.currentUser.id;

    const [athletesRes, samplesRes, reportsRes] = await Promise.all([
        window.supabaseClient
            .from("athletes")
            .select("*")
            .eq("registered_by", officerId)
            .order("created_at", { ascending: false }),
        window.supabaseClient
            .from("samples")
            .select("*, athletes(athlete_name)")
            .eq("officer_id", officerId)
            .order("created_at", { ascending: false }),
        window.supabaseClient
            .from("reports")
            .select("id", { count: "exact", head: true })
            .eq("generated_by", officerId)
    ]);

    const athletes = athletesRes.data || [];
    const samples = samplesRes.data || [];
    const reportCount = reportsRes.count || 0;

    document.getElementById("statAthletes").textContent = athletes.length;
    document.getElementById("statSamples").textContent = samples.length;
    document.getElementById("statPending").textContent = samples.filter(s =>
        (s.sample_status || "").toLowerCase() !== "completed"
    ).length;
    document.getElementById("statReports").textContent = reportCount;

    const athletesBody = document.getElementById("athletesTableBody");
    if (athletes.length === 0) {
        athletesBody.innerHTML = `<tr class="empty-row"><td colspan="4">No athletes registered yet. <a href="athletes.html" style="color: var(--gold);">Register one</a>.</td></tr>`;
    } else {
        athletesBody.innerHTML = athletes.slice(0, 5).map(a => `
            <tr>
                <td>${escapeHtml(a.athlete_id)}</td>
                <td>${escapeHtml(a.athlete_name)}</td>
                <td>${escapeHtml(a.sport)}</td>
                <td>${escapeHtml(a.nationality || "—")}</td>
            </tr>
        `).join("");
    }

    const samplesBody = document.getElementById("samplesTableBody");
    if (samples.length === 0) {
        samplesBody.innerHTML = `<tr class="empty-row"><td colspan="5">No samples collected yet. <a href="samples.html" style="color: var(--gold);">Collect one</a>.</td></tr>`;
    } else {
        samplesBody.innerHTML = samples.slice(0, 5).map(s => `
            <tr>
                <td>${escapeHtml(s.sample_id)}</td>
                <td>${escapeHtml(s.athletes ? s.athletes.athlete_name : "—")}</td>
                <td>${escapeHtml(s.sample_type)}</td>
                <td>${escapeHtml(s.collection_date)}</td>
                <td><span class="pill ${statusPillClass(s.sample_status)}">${escapeHtml(s.sample_status || "Pending")}</span></td>
            </tr>
        `).join("");
    }
});
