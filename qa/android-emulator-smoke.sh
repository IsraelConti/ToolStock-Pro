#!/usr/bin/env bash
set -euo pipefail
mkdir -p emulator-report
APK="qa-apk/MaintenPro-Uptodown-signed.apk"
test -s "$APK" || { echo "::error::Falta APK firmado exactamente de run 44244101280"; exit 1; }
echo "==== ANDROID EMULATOR ===="
adb shell getprop ro.build.version.release | tee emulator-report/android-version.txt
adb shell getprop ro.product.model | tee emulator-report/emulator-model.txt
echo "==== INSTALACION DE VERSION 16 (MISMO RELEASE FIRMADO) ===="
adb install -r "$APK" | tee emulator-report/installation.txt
adb shell dumpsys package com.icapps.maintenpro > emulator-report/package.txt
grep -E "versionCode=16\b" emulator-report/package.txt || { echo "::error::Paquete instalado NO es versionCode 16"; exit 1; }
grep -E "versionName=1.2.9.4" emulator-report/package.txt || { echo "::error::Version inesperada"; exit 1; }
echo "==== PERMISO AD_ID EN INSTALACION RELEASE ===="
if grep -q "com.google.android.gms.permission.AD_ID" emulator-report/package.txt; then
  echo "AD_ID: aparece en el manifiesto del paquete instalado" | tee emulator-report/adid-result.txt
else
  echo "AD_ID: AUSENTE del paquete firmado! REVISAR ANTES DE PRODUCCION" | tee emulator-report/adid-result.txt
fi
adb shell logcat -c || true
echo "==== PRIMER ARRANQUE ===="
adb shell am start -W -n com.icapps.maintenpro/.MainActivity | tee emulator-report/start-first.txt
sleep 30
adb shell pidof com.icapps.maintenpro | tee emulator-report/pid-first.txt
adb shell dumpsys activity activities > emulator-report/activities-first.txt
adb exec-out screencap -p > emulator-report/first-start.png
adb shell uiautomator dump /sdcard/maintenpro-first.xml >/dev/null 2>&1 || true
adb pull /sdcard/maintenpro-first.xml emulator-report/ui-first.xml >/dev/null 2>&1 || true
adb logcat -d -t 6000 -v time > emulator-report/logcat-first.txt || true
if grep -A18 'FATAL EXCEPTION' emulator-report/logcat-first.txt | grep -q 'Process: com.icapps.maintenpro'; then
  echo "::error::FATAL EXCEPTION en primer arranque"; exit 1
fi
echo "==== SEGUNDO ARRANQUE / PERSISTENCIA ===="
adb shell am force-stop com.icapps.maintenpro
adb shell am start -W -n com.icapps.maintenpro/.MainActivity | tee emulator-report/start-second.txt
sleep 12
adb shell pidof com.icapps.maintenpro | tee emulator-report/pid-second.txt
adb exec-out screencap -p > emulator-report/second-start.png
adb shell uiautomator dump /sdcard/maintenpro-second.xml >/dev/null 2>&1 || true
adb pull /sdcard/maintenpro-second.xml emulator-report/ui-second.xml >/dev/null 2>&1 || true
adb logcat -d -t 7000 -v time > emulator-report/logcat-second.txt || true
if grep -A18 'FATAL EXCEPTION' emulator-report/logcat-second.txt | grep -q 'Process: com.icapps.maintenpro'; then
  echo "::error::FATAL EXCEPTION en segundo arranque"; exit 1
fi
echo "==== RESULTADO ===="
echo "PASS: release APK firmado code 16 instalado, arrancado 2 veces y proceso vivo." | tee emulator-report/summary.txt
echo "IMPORTANT: esto NO acredita compras de Google Play, consentimientos reales, sync Drive, el dia 8 ni 15/16 equipos." | tee -a emulator-report/summary.txt
