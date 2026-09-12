$ErrorActionPreference = "Stop"
$credential = Get-Credential -UserName "admin" -Message "Enter your website ADMIN_KEY as the password"
$headers = @{Authorization = "Bearer " + $credential.GetNetworkCredential().Password}
$status = Invoke-RestMethod "https://panjabiaagayeoye.com/api/sources"
foreach ($source in $status.availableSources) {
  if ($source -eq "seatgeek" -and !$status.seatGeekConfigured) { continue }
  Write-Host "Starting $source"
  Invoke-RestMethod -Method Post -Uri ("https://panjabiaagayeoye.com/api/admin/refresh?source=" + $source) -Headers $headers
}
Write-Host "Refreshes started. Check /api/sources for results after a few minutes."
