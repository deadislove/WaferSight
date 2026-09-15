@echo off
setlocal
chcp 65001 >nul

echo === Starting Electron Build Process ===

set "CERT_PASSWORD=your_certificate_password_here"

if not exist "%~dp0certs" (
    mkdir "%~dp0certs"
)

if not exist "%~dp0certs\cert.pfx" (
    echo Creating self-signed code signing certificate...
    
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $pwdStr = '%CERT_PASSWORD%'; $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=WaferSightDev' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyExportPolicy Exportable; $pwd = ConvertTo-SecureString -String $pwdStr -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath '%~dp0certs\cert.pfx' -Password $pwd | Out-Null; Remove-Item -Path ('Cert:\CurrentUser\My\' + $cert.Thumbprint);"
    
    if not exist "%~dp0certs\cert.pfx" (
        echo [ERROR] Certificate generation failed.
        goto :error
    )
    echo [SUCCESS] Certificate created successfully.
)

set WIN_CSC_LINK=%~dp0certs\cert.pfx
set WIN_CSC_KEY_PASSWORD=%CERT_PASSWORD%
set ELECTRON_BUILDER_TIMESTAMP_SERVER=http://globalsign.com

call npm run build

if %errorlevel% equ 0 (
    echo === Build Successful! Output in release folder ===
    goto :end
) else (
    goto :error
)

:error
echo === Build Failed! Please check errors above ===
endlocal
pause
exit /b 1

:end
endlocal
pause