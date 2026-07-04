
const form = document.getElementById("form");

function generateOfficerId() {
    return "OFF-" + Date.now().toString(36).toUpperCase();
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
 
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const phone = document.getElementById("phonenumber").value.trim();
 
    if (!username || !email || !password || !phone) {
        alert("Please fill in all fields.");
        return;
    }
 
    const button = document.getElementById("createaccount");
    button.disabled = true;
    button.textContent = "CREATING...";

    const officerId = generateOfficerId();

    const { data, error } = await window.supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username,
                phone: phone,
                officer_id: officerId
            }
        }
    });
 
    button.disabled = false;
    button.textContent = "CREATE ACCOUNT";
 
    if (error) {
        console.log(error);
        alert(error.message);
        return;
    }
 
    alert("Account created successfully! Check your email to confirm your account.");
 
    window.location.href = "login.html";
});