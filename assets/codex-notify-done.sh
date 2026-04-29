#!/usr/bin/env bash
set -euo pipefail

payload="${1:-}"
settings_file="${CODEX_NOTIFY_SETTINGS:-$HOME/.codex/codex-notify.env}"

min_seconds="${CODEX_NOTIFY_MIN_SECONDS:-1}"
popup="${CODEX_NOTIFY_POPUP:-1}"
sound="${CODEX_NOTIFY_SOUND:-1}"
sound_name="${CODEX_NOTIFY_SOUND_NAME:-Ping}"
title="${CODEX_NOTIFY_TITLE:-Codex}"

if [ -f "$settings_file" ]; then
  while IFS='=' read -r key value; do
    key="${key//[[:space:]]/}"
    value="${value%%#*}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value%\"}"
    value="${value#\"}"

    case "$key" in
      MIN_SECONDS) min_seconds="$value" ;;
      POPUP) popup="$value" ;;
      SOUND) sound="$value" ;;
      SOUND_NAME) sound_name="$value" ;;
      TITLE) title="$value" ;;
      ""|\#*) ;;
    esac
  done < "$settings_file"
fi

case "$min_seconds" in
  ""|*[!0-9]*) min_seconds=1 ;;
esac

case "$payload" in
  *'"agent-turn-complete"'*|"")
    ;;
  *)
    exit 0
    ;;
esac

elapsed_seconds=""
turn_id="$(printf '%s' "$payload" | sed -nE 's/.*"turn-id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p')"

if [ -n "$turn_id" ] && [ "$min_seconds" -gt 0 ]; then
  turn_hex="$(printf '%s' "$turn_id" | tr -d '-' | cut -c 1-12)"
  if [[ "$turn_hex" =~ ^[0-9A-Fa-f]{12}$ ]]; then
    turn_ms="$((16#$turn_hex))"
    turn_s="$((turn_ms / 1000))"
    now_s="$(date +%s)"
    elapsed_seconds="$((now_s - turn_s))"

    if [ "$elapsed_seconds" -ge 0 ] && [ "$elapsed_seconds" -lt "$min_seconds" ]; then
      exit 0
    fi
  fi
fi

message="Codex finished responding."
if [ -n "$elapsed_seconds" ] && [ "$elapsed_seconds" -ge 0 ]; then
  message="Codex finished after ${elapsed_seconds}s."
fi

escape_applescript() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

play_macos_sound() {
  local candidate="/System/Library/Sounds/${sound_name}.aiff"
  if [ -f "$candidate" ]; then
    /usr/bin/afplay "$candidate" || true
  else
    /usr/bin/afplay /System/Library/Sounds/Ping.aiff || true
  fi
}

send_macos_popup() {
  local safe_title
  local safe_message
  safe_title="$(escape_applescript "$title")"
  safe_message="$(escape_applescript "$message")"
  /usr/bin/osascript -e "display notification \"$safe_message\" with title \"$safe_title\"" || true
}

send_linux_popup() {
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "$title" "$message" || true
  fi
}

play_linux_sound() {
  if command -v paplay >/dev/null 2>&1; then
    paplay /usr/share/sounds/freedesktop/stereo/complete.oga || true
  elif command -v aplay >/dev/null 2>&1; then
    aplay /usr/share/sounds/alsa/Front_Center.wav || true
  else
    printf '\a' >/dev/tty 2>/dev/null || true
  fi
}

(
  case "$(uname -s)" in
    Darwin)
      [ "$popup" = "1" ] && send_macos_popup
      [ "$sound" = "1" ] && play_macos_sound
      ;;
    Linux)
      [ "$popup" = "1" ] && send_linux_popup
      [ "$sound" = "1" ] && play_linux_sound
      ;;
    *)
      [ "$sound" = "1" ] && printf '\a' >/dev/tty 2>/dev/null || true
      ;;
  esac
) >/dev/null 2>&1 &

exit 0
