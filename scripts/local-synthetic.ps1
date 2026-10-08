param([Parameter(Mandatory=$true)][ValidateSet('Stack','PracticeLoop','ResourceStudio','Stop')][string]$Action)
$ErrorActionPreference = 'Stop'
$plRoot = Split-Path $PSScriptRoot -Parent
$plRuntime = Join-Path $env:LOCALAPPDATA 'PracticeLoopSyntheticCLI'
$rsRoot = 'C:\Users\chris\OneDrive\Documents\Resource Studio'
$rsRuntime = Join-Path $env:LOCALAPPDATA 'Temp\resource-studio-synthetic-cli'
$docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
$cli = Join-Path $env:LOCALAPPDATA 'PracticeLoopTooling\supabase-cli-2.117.0\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$projects = @('practice-loop-synthetic-cli','resource-studio-synthetic-cli')
$containers = foreach ($project in $projects) {
    foreach ($service in @('db','kong','auth','rest')) { "supabase_${service}_${project}" }
}
if ($Action -eq 'Stack') {
    $ErrorActionPreference='Continue'
    & $docker info *> $null
    $dockerReady=$LASTEXITCODE -eq 0
    $ErrorActionPreference='Stop'
    if (!$dockerReady) {
        Start-Process (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe') -WindowStyle Hidden
        $ready = $false
        for ($attempt=0; $attempt -lt 60; $attempt++) {
            Start-Sleep -Seconds 2
            $ErrorActionPreference='Continue'
            & $docker info *> $null
            $dockerReady=$LASTEXITCODE -eq 0
            $ErrorActionPreference='Stop'
            if ($dockerReady) { $ready=$true; break }
        }
        if (!$ready) { throw 'Docker Desktop did not become ready.' }
    }
    # Refuse to create replacements if any original container is missing.
    foreach ($name in $containers) {
        $raw = & $docker inspect $name 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Existing container missing: $name. Stop and investigate." }
        $item = ($raw | ConvertFrom-Json)[0]
        if ($item.Config.Labels.'com.supabase.cli.project' -notin $projects) { throw "Unexpected project: $name" }
    }
    & $docker start @containers
    if ($LASTEXITCODE -ne 0) { throw 'Could not start existing containers.' }
    return
}
if ($Action -eq 'Stop') {
    # Stop the foreground app terminals with Ctrl+C first. Containers and volumes remain.
    & $docker stop @containers
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop existing containers.' }
    return
}
$values = @{}
if ($Action -eq 'PracticeLoop') {
    $runtime = Get-Content (Join-Path $plRuntime 'app-runtime-private.json') -Raw | ConvertFrom-Json
    foreach ($property in $runtime.PSObject.Properties) { $values[$property.Name] = [string]$property.Value }
    # Windows PowerShell treats the CLI's harmless stopped-service stderr as an error.
    $savedPreference=$ErrorActionPreference
    try { $ErrorActionPreference='Continue'; $raw = & $cli status --workdir $plRuntime -o json 2>$null }
    finally { $ErrorActionPreference=$savedPreference }
    if ($LASTEXITCODE -ne 0) { throw 'Existing synthetic CLI status failed. Start Stack first.' }
    $status = $raw | ConvertFrom-Json
    if ($status.API_URL -ne 'http://127.0.0.1:56321') { throw 'Unexpected PL API URL.' }
    if (!$status.ANON_KEY -or !$status.SERVICE_ROLE_KEY) { throw 'Local credentials unavailable.' }
    $values.NEXT_PUBLIC_SUPABASE_URL = $status.API_URL
    $values.NEXT_PUBLIC_SUPABASE_ANON_KEY = $status.ANON_KEY
    $values.SUPABASE_SERVICE_ROLE_KEY = $status.SERVICE_ROLE_KEY
    $values.RESOURCE_STUDIO_BASE_URL = 'http://127.0.0.1:3101'
    $root=$plRoot; $port=3100
} else {
    foreach ($line in Get-Content (Join-Path $rsRuntime 'app\.env.local')) {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
            $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    if ($values.NEXT_PUBLIC_SUPABASE_URL -ne 'http://127.0.0.1:57321') { throw 'Unexpected RS API URL.' }
    $root=$rsRoot; $port=3101
}
$values.NODE_ENV='development'
$values.NEXT_TELEMETRY_DISABLED='1'
$previous = @{}
try {
    foreach ($name in $values.Keys) {
        $previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
        [Environment]::SetEnvironmentVariable($name,$values[$name],'Process')
    }
    Push-Location $root
    try { & 'C:\Program Files\nodejs\node.exe' 'node_modules\next\dist\bin\next' dev --hostname 127.0.0.1 --port $port }
    finally { Pop-Location }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
