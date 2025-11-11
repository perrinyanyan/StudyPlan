$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"

function PostJson($path, $obj, $token) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $body = $obj | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Method Post -Uri ($base + $path) -Headers $headers -Body $body
}
function GetJson($path, $token) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  Invoke-RestMethod -Method Get -Uri ($base + $path) -Headers $headers
}

# Health check
try { (GetJson '/health' $null) | Out-Null } catch { Write-Host ("Server not running: {0}" -f $_.Exception.Message) -ForegroundColor Red; throw }

# Config (可改)
$adminEmail   = "test1@163.com"
$studentEmail = "test2@163.com"
$pass         = "Passw0rd2!"

function Login([string]$email, [string]$password) {
  try { return (PostJson '/auth/login' @{ email=$email; password=$password } $null).token }
  catch { return $null }
}
function EnsureUser([string]$email, [string]$password, [string]$nickname) {
  $tok = Login $email $password
  if ($tok) { Write-Host ("Logged in: {0}" -f $email) -ForegroundColor Green; return $tok }
  Write-Host ("Try signup: {0}" -f $email) -ForegroundColor Yellow
  try { PostJson '/auth/signup' @{ email=$email; password=$password; nickname=$nickname } $null | Out-Null } catch { Write-Host $_.ErrorDetails.Message }
  Write-Host ("Check server console for [dev] verify-email token for {0}: <TOKEN>" -f $email) -ForegroundColor Yellow
  $vt = Read-Host "Paste token"
  if (-not $vt) { throw "Missing verify token" }
  PostJson '/auth/verify-email' @{ token=$vt } $null | Out-Null
  $tok = Login $email $password
  if (-not $tok) { throw ("Login failed: {0}" -f $email) }
  return $tok
}

# Ensure accounts
$adminToken   = EnsureUser $adminEmail   $pass 'ClassAdmin'
$studentToken = EnsureUser $studentEmail $pass 'Student'

# Dev bootstrap a school/class and grant class_admin to adminEmail
if ($env:NODE_ENV -eq 'production') { throw "dev/bootstrap only available in development" }
$schoolName = "DemoSchool " + (Get-Date -Format 'yyyyMMdd-HHmmss')
$className  = "DemoClass "  + (Get-Date -Format 'HHmmss')
$joinCode   = "CLS" + (Get-Random -Minimum 100000 -Maximum 999999)

Write-Host "Bootstrap school/class with join_code=$joinCode" -ForegroundColor Cyan
$boot = PostJson '/dev/bootstrap-class' @{ admin_email=$adminEmail; school_name=$schoolName; class_name=$className; join_code=$joinCode } $null
$schoolId = $boot.school_id; $classId = $boot.class_id
Write-Host ("School: {0}  Class: {1}" -f $schoolId, $classId) -ForegroundColor Green

# Student creates join request
Write-Host "Student submits class join request" -ForegroundColor Cyan
$jr = PostJson '/classes/join-requests' @{ invite_code=$joinCode } $studentToken
$jr | ConvertTo-Json -Depth 10

# Admin lists pending
Write-Host "Admin lists pending join requests" -ForegroundColor Cyan
$pending = GetJson ("/classes/$classId/join-requests?status=pending") $adminToken
$pending | ConvertTo-Json -Depth 10
$reqId = $pending.items[0].id

# Admin approve
Write-Host "Admin approves request" -ForegroundColor Cyan
$appr = PostJson ("/classes/$classId/join-requests/$reqId/approve") @{} $adminToken
$appr | ConvertTo-Json -Depth 10

# Student lists members
Write-Host "Student lists class members (should include self)" -ForegroundColor Cyan
$members = GetJson ("/classes/$classId/members") $studentToken
$members | ConvertTo-Json -Depth 10

Write-Host "Classes acceptance completed" -ForegroundColor Green
