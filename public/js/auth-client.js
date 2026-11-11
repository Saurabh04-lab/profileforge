
"use strict";

// ==========================================
// PROFILEFORGE DASHBOARD AUTHENTICATION
// ==========================================

const originalFetch = window.fetch.bind(window);

const authState = {
    csrfToken: null,
    user: null
};

// ==========================================
// INITIALIZE AUTHENTICATED SESSION
// ==========================================

const authReady = (async () => {
    const response = await originalFetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
    });

    const result = await response.json();

    if (
        !response.ok ||
        !result.success ||
        !result.authenticated ||
        !result.csrfToken
    ) {
        window.location.replace("/login.html");
        throw new Error("An authenticated session is required.");
    }

    authState.csrfToken = result.csrfToken;
    authState.user = result.user;

    updateAccountInterface();

    return authState;

})().catch(error => {
    console.error("Dashboard authentication failed:", error);
    throw error;
});

// ==========================================
// AUTOMATIC CSRF HEADER INJECTION
// ==========================================

window.fetch = async function (input, init = {}) {
    const requestUrl = input instanceof Request
        ? input.url
        : String(input);

    const url = new URL(requestUrl, window.location.href);

    const method = (
        init.method ||
        (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    const isApplicationApi =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/");

    const mutatingMethods = [
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ];

    if (isApplicationApi && mutatingMethods.includes(method)) {
        await authReady;

        const headers = new Headers(
            init.headers ||
            (input instanceof Request ? input.headers : undefined)
        );

        headers.set(
            "X-CSRF-Token",
            authState.csrfToken
        );

        return originalFetch(input, {
            ...init,
            headers,
            credentials: "same-origin"
        });
    }

    return originalFetch(input, init);
};

// ==========================================
// ADD ACCOUNT INFORMATION TO DASHBOARD
// ==========================================

function updateAccountInterface() {
    if (!authState.user) return;

    const user = authState.user;

    const sidebarUser = document.querySelector(".sidebar-user");

    if (sidebarUser) {
        const name = sidebarUser.querySelector("strong");
        const description = sidebarUser.querySelector("span:not(.user-menu)");
        const avatar = sidebarUser.querySelector(".user-avatar");

        if (name) {
            name.textContent = user.name;
        }

        if (description) {
            description.textContent = user.email;
        }

        if (avatar) {
            avatar.textContent = getUserInitials(user.name);
        }
    }

    const topbar = document.querySelector(".topbar-right");

    if (!topbar) return;

    const account = document.createElement("div");
    account.className = "account-session-controls";

    const accountInfo = document.createElement("div");
    accountInfo.className = "account-session-info";

    const accountName = document.createElement("strong");
    accountName.textContent = user.name;

    const accountEmail = document.createElement("span");
    accountEmail.textContent = user.email;

    accountInfo.append(accountName, accountEmail);

    const logoutButton = document.createElement("button");

    logoutButton.type = "button";
    logoutButton.className = "logout-button";
    logoutButton.textContent = "Sign out";

    logoutButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
            "Are you sure you want to sign out?"
        );

        if (!confirmed) return;

        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {
            const response = await window.fetch("/api/auth/logout", {
                method: "POST"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to sign out."
                );
            }

            window.location.replace("/login.html");

        } catch (error) {
            console.error("Logout error:", error);

            window.alert(error.message || "Unable to sign out.");

            logoutButton.disabled = false;
            logoutButton.textContent = "Sign out";
        }
    });

    account.append(accountInfo, logoutButton);
    topbar.appendChild(account);
}

// ==========================================
// USER INITIALS
// ==========================================

function getUserInitials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("") || "PF";
}

// ==========================================
// ACCOUNT UI STYLES
// ==========================================

const style = document.createElement("style");

style.textContent = `
.account-session-controls {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-left: 8px;
}

.account-session-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.account-session-info strong {
    color: #34364c;
    font-size: 11px;
    font-weight: 700;
}

.account-session-info span {
    color: #999bad;
    font-size: 9px;
    max-width: 165px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.logout-button {
    background: white;
    color: #6854c7;
    border: 1px solid #e6e1f8;
    border-radius: 7px;
    padding: 9px 12px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: .2s;
}

.logout-button:hover {
    background: #f6f3ff;
    border-color: #b8aaf1;
}

.logout-button:disabled {
    opacity: .6;
    cursor: wait;
}

@media (max-width: 760px) {
    .account-session-controls {
        gap: 8px;
    }

    .account-session-info {
        display: none;
    }

    .logout-button {
        padding: 8px 9px;
        font-size: 9px;
    }
}
`;

document.head.appendChild(style);

console.log("ProfileForge dashboard security layer loaded.");
