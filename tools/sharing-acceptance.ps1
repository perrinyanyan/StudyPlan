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
function DeleteReq($path, $token) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  Invoke-RestMethod -Method Delete -Uri ($base + $path) -Headers $headers
}

# Health check
try {
  $health = GetJson '/health' $null
  Write-Host "Health: $($health.ok)" -ForegroundColor Green
} catch {
  Write-Host "服务器未运行: $($_.Exception.Message)" -ForegroundColor Red
  throw
}

# Test config (可修改)
$ownerEmail  = "pemo_ho@163.com"
$viewerEmail = "yqc_morning@hotmail.com"
$pass        = "Passw0rd2!"
$date        = (Get-Date).ToString('yyyy-MM-dd')

function Login([string]$email, [string]$password) {
  try { return (PostJson '/auth/login' @{ email=$email; password=$password } $null).token }
  catch { return $null }
}

function EnsureUser([string]$email, [string]$password, [string]$nickname) {
  $tok = Login $email $password
  if ($tok) { Write-Host "已登录: $email" -ForegroundColor Green; return $tok }

  Write-Host "尝试注册: $email" -ForegroundColor Yellow
  try {
    PostJson '/auth/signup' @{ email=$email; password=$password; nickname=$nickname } $null | Out-Null
    Write-Host "注册完成（如邮件发送失败属正常，开发模式使用控制台token）" -ForegroundColor Green
  } catch {
    Write-Host "注册可能已存在或失败: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Write-Host "请在服务端控制台查找 [dev] verify-email token for $email: <TOKEN>" -ForegroundColor Yellow
  $vt = Read-Host "粘贴 token"
  if (-not $vt) { throw "未提供验证 token" }
  PostJson '/auth/verify-email' @{ token=$vt } $null | Out-Null
  Write-Host "邮箱已验证: $email" -ForegroundColor Green

  $tok = Login $email $password
  if (-not $tok) { throw "登录失败: $email" }
  Write-Host "已登录: $email" -ForegroundColor Green
  return $tok
}

# Ensure accounts
$ownerToken  = EnsureUser $ownerEmail  $pass 'Owner'
$viewerToken = EnsureUser $viewerEmail $pass 'Viewer'

# Owner: create task and today's blocks
Write-Host "创建任务与时间块（Owner）" -ForegroundColor Cyan
$task = PostJson '/tasks' @{ title='Share Task A'; due_at=(Get-Date).AddDays(1).ToString('yyyy-MM-dd') } $ownerToken
$blk1 = PostJson '/blocks' @{ start_at=("${date}T09:00:00Z"); end_at=("${date}T10:00:00Z"); task_id=$task.id } $ownerToken
$blk2 = PostJson '/blocks' @{ start_at=("${date}T10:00:00Z"); end_at=("${date}T11:00:00Z") } $ownerToken

# Create shares
Write-Host "创建分享链接" -ForegroundColor Cyan
$shareBlocks = PostJson '/shares' @{ scope='blocks_only' } $ownerToken
$shareFull   = PostJson '/shares' @{ scope='full' }        $ownerToken
Write-Host ("blocks_only URL: {0}" -f $shareBlocks.url) -ForegroundColor Green
Write-Host ("full        URL: {0}" -f $shareFull.url)   -ForegroundColor Green

# View shares (by date)
Write-Host "查看共享内容（按日）" -ForegroundColor Cyan
$viewBlocks = GetJson ("/shared/$($shareBlocks.token)?date=$date") $null
$viewFull   = GetJson ("/shared/$($shareFull.token)?date=$date")   $null
$viewBlocks | ConvertTo-Json -Depth 10
$viewFull   | ConvertTo-Json -Depth 10

# Viewer copy from full share
Write-Host "Viewer 从 full 共享复制" -ForegroundColor Cyan
$copyRes = PostJson ("/shared/$($shareFull.token)/copy?date=$date") @{} $viewerToken
$copyRes | ConvertTo-Json -Depth 10

# Verify viewer daily blocks
Write-Host "验证 Viewer 当日时间块" -ForegroundColor Cyan
$viewerDaily = GetJson ("/blocks/daily?date=$date") $viewerToken
$viewerDaily | ConvertTo-Json -Depth 10

# Expired share check (expect 410)
Write-Host "过期共享校验（期望 410）" -ForegroundColor Cyan
$expired = PostJson '/shares' @{ scope='blocks_only'; expires_at=(Get-Date).AddMinutes(-1).ToString('o') } $ownerToken
try {
  GetJson ("/shared/$($expired.token)") $null | Out-Null
  Write-Host "Expected 410 but got success" -ForegroundColor Yellow
} catch {
  try { $status = $_.Exception.Response.StatusCode.value__ } catch { $status = "unknown" }
  Write-Host "Expired access status (expected 410): $status" -ForegroundColor Green
}

Write-Host "验收完成" -ForegroundColor Green
