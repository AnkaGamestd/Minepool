# Fix profile.html auth redirects
$file = "www\profile.html"
$content = Get-Content $file -Raw

# Replace all login redirects with localStorage fallback check
# Pattern: Check if we have stored user before redirecting

# Simple approach: wrap the redirect in a localStorage check
$content = $content -replace "window\.location\.href = '/login\.html';", @"
{
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = '/login.html';
    } else {
        // Use stored user data instead of redirecting
        console.log('Using localStorage user for profile');
        window.currentUser = JSON.parse(storedUser);
        if (typeof loadProfileData === 'function') loadProfileData();
    }
}
"@

Set-Content $file -Value $content -NoNewline
Write-Host "Fixed profile.html"

# Fix settings.html auth redirects
$file = "www\settings.html"
$content = Get-Content $file -Raw

$content = $content -replace "window\.location\.href = '/login\.html';", @"
{
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = '/login.html';
    } else {
        console.log('Using localStorage user for settings');
        window.currentUser = JSON.parse(storedUser);
    }
}
"@

Set-Content $file -Value $content -NoNewline
Write-Host "Fixed settings.html"

Write-Host "All auth pages fixed with localStorage fallback"
