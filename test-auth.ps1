
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3000"
$pointer = [IntPtr]::Zero
$plainPassword = $null
$securePassword = $null

try {
    Write-Host "`n=================================="
    Write-Host " PROFILEFORGE AUTHENTICATION TEST"
    Write-Host "=================================="

    # Get real credentials locally
    $email = (Read-Host "Enter your real email address").Trim().ToLowerInvariant()

    if ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
        throw "Please enter a valid email address."
    }

    $securePassword = Read-Host "Enter your password (hidden)" -AsSecureString

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $securePassword
    )

    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        $pointer
    )

    # 1. Initialize session
    Write-Host "`n1. Initializing session..."

    $bootstrap = Invoke-RestMethod `
        -Uri "$baseUrl/api/auth/me" `
        -Method Get `
        -SessionVariable pfSession

    $csrfToken = $bootstrap.csrfToken

    if (-not $csrfToken) {
        throw "Unable to initialize CSRF token."
    }

    Write-Host "Session initialized successfully."

    $headers = @{
        "X-CSRF-Token" = $csrfToken
    }

    # 2. Register account
    Write-Host "`n2. Registering account..."

    $registerBody = @{
        name = "Saurabh Mehta"
        email = $email
        password = $plainPassword
    } | ConvertTo-Json -Compress

    try {
        $authResult = Invoke-RestMethod `
            -Uri "$baseUrl/api/auth/register" `
            -Method Post `
            -WebSession $pfSession `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $registerBody

        Write-Host "New account registered successfully."
    }
    catch {
        $status = $null

        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }

        if ($status -eq 409) {
            Write-Host "Account already exists. Trying login..."

            $loginBody = @{
                email = $email
                password = $plainPassword
            } | ConvertTo-Json -Compress

            $authResult = Invoke-RestMethod `
                -Uri "$baseUrl/api/auth/login" `
                -Method Post `
                -WebSession $pfSession `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $loginBody

            Write-Host "Existing account login successful."
        }
        else {
            throw
        }
    }

    Write-Host "Account name: $($authResult.user.name)"
    Write-Host "Account ID: $($authResult.user.id)"

    # 3. Verify authenticated session
    Write-Host "`n3. Checking login session..."

    $currentUser = Invoke-RestMethod `
        -Uri "$baseUrl/api/auth/me" `
        -Method Get `
        -WebSession $pfSession

    if (-not $currentUser.authenticated) {
        throw "Authentication verification failed."
    }

    Write-Host "Authenticated: True"
    Write-Host "Logged-in user: $($currentUser.user.name)"

    # 4. Verify profile access
    Write-Host "`n4. Checking profile ownership..."

    $profiles = Invoke-RestMethod `
        -Uri "$baseUrl/api/profiles" `
        -Method Get `
        -WebSession $pfSession

    Write-Host "Profile access: $($profiles.success)"
    Write-Host "Accessible profiles: $($profiles.total)"

    # 5. Logout
    Write-Host "`n5. Testing logout..."

    $logoutHeaders = @{
        "X-CSRF-Token" = $currentUser.csrfToken
    }

    $logout = Invoke-RestMethod `
        -Uri "$baseUrl/api/auth/logout" `
        -Method Post `
        -WebSession $pfSession `
        -Headers $logoutHeaders

    Write-Host "Logout success: $($logout.success)"

    # 6. Check unauthorized access
    Write-Host "`n6. Testing unauthorized access..."

    $blocked = $false

    try {
        Invoke-RestMethod `
            -Uri "$baseUrl/api/profiles" `
            -Method Get `
            -WebSession $pfSession

    }
    catch {
        $status = $null

        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }

        if ($status -eq 401) {
            $blocked = $true
        }
        else {
            throw
        }
    }

    if (-not $blocked) {
        throw "Security test failed: unauthorized access was allowed."
    }

    Write-Host "Unauthorized access correctly blocked."
    Write-Host "HTTP Status: 401"

    Write-Host "`n=================================="
    Write-Host " AUTHENTICATION TEST SUCCESSFUL"
    Write-Host "=================================="
}
catch {
    Write-Host "`nTEST FAILED:"
    Write-Host $_.Exception.Message
}
finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }

    if ($securePassword) {
        $securePassword.Dispose()
    }

    $plainPassword = $null
    $registerBody = $null
}
