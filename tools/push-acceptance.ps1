param(
  [string]$Base = $env:APP_BASE_URL
)
if (-not $Base) { $Base = "http://localhost:3000" }

function PostJson($path, $obj, $token) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $body = $obj | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Method Post -Uri ($Base + $path) -Headers $headers -Body $body
}
function GetJson($path, $token) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  Invoke-RestMethod -Method Get -Uri ($Base + $path) -Headers $headers
}

try { (GetJson '/health' $null) | Out-Null } catch { Write-Host ("Server not running: {0}" -f $_.Exception.Message) -ForegroundColor Red; throw }

$email = Read-Host 'Email'
if (-not $email) { throw 'Email required' }
$password = Read-Host 'Password'
if (-not $password) { throw 'Password required' }

function Login([string]$email, [string]$password) {
  try { return (PostJson '/auth/login' @{ email=$email; password=$password } $null).token } catch { return $null }
}

function EnsureUser([string]$email, [string]$password) {
  $tok = Login $email $password
  if ($tok) { Write-Host ("Logged in: {0}" -f $email) -ForegroundColor Green; return $tok }
  Write-Host ("Try signup: {0}" -f $email) -ForegroundColor Yellow
  try { PostJson '/auth/signup' @{ email=$email; password=$password; nickname='PushUser' } $null | Out-Null } catch { Write-Host $_.ErrorDetails.Message }
  Write-Host ("Check server console for [dev] verify-email token for {0}: <TOKEN>" -f $email) -ForegroundColor Yellow
  $vt = Read-Host 'Paste token'
  if (-not $vt) { throw 'Missing verify token' }
  PostJson '/auth/verify-email' @{ token=$vt } $null | Out-Null
  $tok = Login $email $password
  if (-not $tok) { throw ("Login failed: {0}" -f $email) }
  return $tok
}

$token = EnsureUser $email $password

$key = (GetJson '/push/public-key' $null).key
if (-not $key) { Write-Host 'Warning: VAPID_PUBLIC_KEY is empty. Configure VAPID_* env vars.' -ForegroundColor Yellow }
Write-Host ("Public key: {0}" -f $key)

$subscribeUrl = $Base + '/subscribe.html'
Write-Host ("Opening: {0}" -f $subscribeUrl)
Start-Process $subscribeUrl | Out-Null
Read-Host 'After the page shows OK for subscription, press Enter to continue'

Write-Host 'Trigger test notification...' -ForegroundColor Cyan
$result = PostJson '/notifications/test' @{} $token
Write-Host ("Results: {0}" -f ($result | ConvertTo-Json -Depth 10))
Write-Host 'Done.' -ForegroundColor Green
