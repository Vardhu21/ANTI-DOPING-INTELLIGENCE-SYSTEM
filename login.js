const form = document.getElementById("form");

(async function redirectIfLoggedIn() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        window.location.href = "dashboard.html";
    }
})();

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    const button = document.getElementById("login");
    button.disabled = true;
    button.textContent = "LOGGING IN...";

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    button.disabled = false;
    button.textContent = "Login";

    if (error) {
        console.log(error);
        alert(error.message);
        return;
    }

    window.location.href = "dashboard.html";
});
