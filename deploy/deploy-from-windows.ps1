# Windows PC에서 서버로 Roomfit을 올리고 실행한다.
# 사용: C:\home\roomfit\서버배포.bat 더블클릭 (또는 PowerShell에서 이 파일 실행)
# 필요: Windows 10/11 기본 OpenSSH (ssh, scp, tar)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cfgFile = Join-Path $PSScriptRoot "server.txt"

function Ask($label, $default) {
  $v = Read-Host "$label$(if ($default) { " [$default]" })"
  if ([string]::IsNullOrWhiteSpace($v)) { return $default } else { return $v.Trim() }
}

$cfg = @{}
if (Test-Path $cfgFile) {
  Get-Content $cfgFile | ForEach-Object { if ($_ -match '^(\w+)=(.*)$') { $cfg[$matches[1]] = $matches[2] } }
}

Write-Host "=== Roomfit 서버 배포 ===" -ForegroundColor Cyan
$server = Ask "서버 주소 (예: 123.45.67.89)" $cfg.server
$user   = Ask "SSH 사용자 이름 (예: ubuntu, root)" $cfg.user
$sshPort = Ask "SSH 포트" ($(if ($cfg.sshport) { $cfg.sshport } else { "22" }))
$appPort = Ask "Roomfit 실행 포트" ($(if ($cfg.appport) { $cfg.appport } else { "3100" }))
if (-not $server -or -not $user) { Write-Host "서버 주소와 사용자 이름이 필요합니다." -ForegroundColor Red; exit 1 }

"server=$server`nuser=$user`nsshport=$sshPort`nappport=$appPort" | Set-Content $cfgFile -Encoding UTF8
$target = "$user@$server"

Write-Host "`n▶ 프로젝트 압축" -ForegroundColor Cyan
$tgz = Join-Path $env:TEMP "roomfit-deploy.tgz"
if (Test-Path $tgz) { Remove-Item $tgz }
Push-Location $root
tar -czf $tgz --exclude=node_modules --exclude=.next --exclude=demo/dist --exclude=deploy/server.txt --exclude=data .
Pop-Location
if ($LASTEXITCODE -ne 0) { throw "압축 실패" }

Write-Host "▶ 서버로 업로드 ($target)  - 비밀번호를 물으면 입력하세요" -ForegroundColor Cyan
scp -P $sshPort $tgz "${target}:~/roomfit-deploy.tgz"
if ($LASTEXITCODE -ne 0) { throw "업로드 실패: 주소, 사용자, 비밀번호/키를 확인하세요" }

Write-Host "▶ 서버에서 설치·빌드·실행  - 몇 분 걸립니다" -ForegroundColor Cyan
$remote = "set -e; mkdir -p ~/roomfit && tar -xzf ~/roomfit-deploy.tgz -C ~/roomfit && rm ~/roomfit-deploy.tgz && cd ~/roomfit && sed -i 's/\r$//' deploy/deploy.sh && ROOMFIT_PORT=$appPort bash deploy/deploy.sh"
ssh -t -p $sshPort $target $remote
if ($LASTEXITCODE -ne 0) { Write-Host "`n✗ 서버 배포 중 오류가 났습니다. 위 메시지를 확인하세요." -ForegroundColor Red; exit 1 }

Write-Host "`n✓ 완료: http://${server}:$appPort" -ForegroundColor Green
Write-Host "  안 열리면 서버 방화벽/클라우드 보안그룹에서 $appPort 포트를 여세요."
