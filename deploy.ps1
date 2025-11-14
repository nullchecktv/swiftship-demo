# SwiftShip Deployment Script
# Deploys the backend and updates the frontend environment variable
#
# Usage:
#   .\deploy.ps1                                    # Deploy without Momento (limited A2A features)
#   .\deploy.ps1 -MomentoApiKey "your-key"         # Deploy with Momento (full features)
#
# Get a free Momento API key at: https://console.gomomento.com

param(
    [string]$MomentoApiKey = ""
)

Write-Host "Starting SwiftShip deployment..." -ForegroundColor Cyan
Write-Host ""

# Prompt for Momento API key if not provided
if (-not $MomentoApiKey) {
    Write-Host "Momento API Key Setup (Optional)" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Momento enables real-time A2A event streaming and agent visualization." -ForegroundColor White
    Write-Host "Without it, agents will still work but you won't see live updates in the UI." -ForegroundColor White
    Write-Host ""
    Write-Host "Get a free API key at: https://console.gomomento.com" -ForegroundColor Cyan
    Write-Host ""

    $response = Read-Host "Do you have a Momento API key to add? (y/N)"

    if ($response -eq "y" -or $response -eq "Y") {
        $MomentoApiKey = Read-Host "Enter your Momento API key"
        if ([string]::IsNullOrWhiteSpace($MomentoApiKey)) {
            Write-Host "No key entered. Continuing without Momento..." -ForegroundColor Yellow
            $MomentoApiKey = ""
        } else {
            Write-Host "Momento API key will be included in deployment." -ForegroundColor Green
        }
    } else {
        Write-Host "Continuing without Momento API key..." -ForegroundColor Yellow
    }
    Write-Host ""
}

# Change to API directory
Push-Location api

try {
    # Build and deploy the SAM application
    Write-Host "`nBuilding SAM application..." -ForegroundColor Yellow
    sam build

    if ($LASTEXITCODE -ne 0) {
        throw "SAM build failed"
    }

    Write-Host "`nDeploying to AWS..." -ForegroundColor Yellow

    if ($MomentoApiKey) {
        sam deploy --parameter-overrides "MomentoApiKey=$MomentoApiKey"
    } else {
        sam deploy
    }

    if ($LASTEXITCODE -ne 0) {
        throw "SAM deploy failed"
    }

    # Get the API URL from CloudFormation outputs
    Write-Host "`nRetrieving API endpoint..." -ForegroundColor Yellow
    $stackName = "swiftship-demo"

    $outputs = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" --output json | ConvertFrom-Json

    $apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "SwiftShipApi" }).OutputValue

    if (-not $apiUrl) {
        throw "Could not retrieve SwiftShipApi output from CloudFormation"
    }

    Write-Host "API URL: $apiUrl" -ForegroundColor Green

    # Update the .env file
    Pop-Location

    Write-Host "`nUpdating .env file..." -ForegroundColor Yellow

    $envContent = "VITE_API_BASE_URL=$apiUrl"

    if ($MomentoApiKey) {
        $envContent += "`nVITE_MOMENTO_API_KEY=$MomentoApiKey"
    }

    $envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline

    Write-Host "Updated .env with API URL" -ForegroundColor Green

    Write-Host "`nDeployment complete!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Run 'npm install' (if you haven't already)" -ForegroundColor White
    Write-Host "  2. Run 'npm run dev' to start the frontend" -ForegroundColor White
    Write-Host "`nAPI Base URL: $apiUrl" -ForegroundColor White

    if (-not $MomentoApiKey) {
        Write-Host "`nNote: Deployed without Momento API key" -ForegroundColor Yellow
        Write-Host "Real-time A2A event streaming will be limited." -ForegroundColor Yellow
        Write-Host "Get a free key at: https://console.gomomento.com" -ForegroundColor Yellow
    }

} catch {
    Write-Host "`nDeployment failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
