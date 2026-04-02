@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

start "World Weaver Web" cmd /k "npm run dev"
start "World Weaver Telegram Bot" cmd /k "npm run bot"

echo Web server and Telegram bot are starting in separate windows.
