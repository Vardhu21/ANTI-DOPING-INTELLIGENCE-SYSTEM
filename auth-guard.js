

window.currentUser = null;
window.currentOfficer = null;

(async function guard() {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();

    if (error || !session) {
        window.location.href = "login.html";
        return;
    }

    window.currentUser = session.user;

    const { data: officer, error: officerError } = await window.supabaseClient
        .from("officers")
        .select("*")
        .eq("id", session.user.id)
        .single();

    if (officerError) {
        console.log("Could not load officer profile:", officerError.message);
    } else {
        window.currentOfficer = officer;
    }

    document.dispatchEvent(new CustomEvent("adis:ready"));
})();

async function adisLogout() {
    await window.supabaseClient.auth.signOut();
    window.location.href = "login.html";
}
