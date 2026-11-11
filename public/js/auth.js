
"use strict";

// ==========================================
// PROFILEFORGE AUTHENTICATION CLIENT
// LOGIN + REGISTRATION
// ==========================================

const form = document.getElementById("authForm");
const submitButton = document.getElementById("authSubmit");
const errorBox = document.getElementById("authError");
const successBox = document.getElementById("authSuccess");

const mode = form.dataset.mode;

let csrfToken = null;

// ==========================================
// MESSAGE HELPERS
// ==========================================

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
    successBox.classList.remove("show");
}

function showSuccess(message) {
    successBox.textContent = message;
    successBox.classList.add("show");
    errorBox.classList.remove("show");
}

function clearMessages() {
    errorBox.textContent = "";
    errorBox.classList.remove("show");

    successBox.textContent = "";
    successBox.classList.remove("show");
}

// ==========================================
// BOOTSTRAP CSRF AND SESSION
// ==========================================

async function initializeAuthentication() {
    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.csrfToken) {
            throw new Error("Unable to initialize secure authentication.");
        }

        csrfToken = result.csrfToken;

        // Already authenticated users don't need the login page.
        if (result.authenticated) {
            window.location.replace("/");
        }

    } catch (error) {
        console.error("Authentication initialization error:", error);

        showError(
            "Unable to connect to the server. Please refresh this page."
        );

        submitButton.disabled = true;
    }
}

// ==========================================
// PASSWORD VISIBILITY
// ==========================================

document.querySelectorAll(".password-toggle").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(
            button.dataset.target
        );

        if (!input) return;

        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";
        button.textContent = isHidden ? "Hide" : "Show";
    });
});

// ==========================================
// RESPONSE PROCESSING
// ==========================================

async function parseResponse(response) {
    return response.json().catch(() => ({
        success: false,
        message: "The server returned an invalid response."
    }));
}

// ==========================================
// FORM SUBMISSION
// ==========================================

form.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessages();

    if (!csrfToken) {
        showError("Security session is not ready. Refresh the page.");
        return;
    }

    if (!form.reportValidity()) {
        return;
    }

    const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

    const password = document.getElementById("password").value;

    const body = { email, password };

    // Registration-specific validation.
    if (mode === "register") {
        const name = document.getElementById("name").value.trim();

        const confirmation = document
            .getElementById("confirmPassword")
            .value;

        if (!name || name.length > 60) {
            showError("Enter a valid name of up to 60 characters.");
            return;
        }

        if (password.length < 10 || new TextEncoder().encode(password).length > 72) {
            showError(
                "Password must contain at least 10 characters and no more than 72 UTF-8 bytes."
            );
            return;
        }

        if (password !== confirmation) {
            showError("Your passwords do not match.");
            return;
        }

        body.name = name;
    }

    const endpoint = mode === "register"
        ? "/api/auth/register"
        : "/api/auth/login";

    const originalButtonText = submitButton.textContent;

    try {
        submitButton.disabled = true;

        submitButton.textContent = mode === "register"
            ? "Creating account..."
            : "Signing in...";

        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify(body)
        });

        const result = await parseResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Authentication failed."
            );
        }

        showSuccess(
            mode === "register"
                ? "Account created successfully. Opening your workspace..."
                : "Welcome back. Opening your workspace..."
        );

        submitButton.textContent = "Success!";

        // The server has created a new authenticated session.
        setTimeout(() => {
            window.location.replace("/");
        }, 500);

    } catch (error) {
        console.error("Authentication error:", error);

        showError(
            error.message || "Unable to authenticate. Please try again."
        );

        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

// ==========================================
// INITIALIZE
// ==========================================

initializeAuthentication();

console.log("ProfileForge authentication client initialized.");
