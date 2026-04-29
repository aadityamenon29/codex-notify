# codex-notify

Small completion notifications for the Codex CLI.

It installs a Codex `notify` hook that plays a sound and shows a desktop notification when a Codex turn finishes. By default, it only notifies for turns that ran at least 1 second, so instant replies do not ping.

## Install

Requires Node/npm so `npx` can download and run the installer.

```sh
npx --yes github:aadityamenon29/codex-notify install
```

Then restart any already-open Codex sessions.

## Test

Test the hook directly:

```sh
npx --yes github:aadityamenon29/codex-notify test
```

Test it through Codex:

```sh
codex exec "Say exactly: notification test done"
```

## Options

Change the minimum duration:

```sh
npx --yes github:aadityamenon29/codex-notify install --threshold 10
```

Use `0` to notify for every completed turn:

```sh
npx --yes github:aadityamenon29/codex-notify install --threshold 0
```

Check the installed state:

```sh
npx --yes github:aadityamenon29/codex-notify status
```

Uninstall:

```sh
npx --yes github:aadityamenon29/codex-notify uninstall --purge
```

## What It Changes

The installer creates:

```text
~/.codex/bin/codex-notify-done.sh
~/.codex/codex-notify.env
```

It also adds this line to `~/.codex/config.toml`:

```toml
notify = ["/Users/you/.codex/bin/codex-notify-done.sh"]
```

Your existing `config.toml` is backed up before changes.

## Caveats

- Existing Codex sessions usually need to be restarted. To keep a conversation, exit and run `codex resume <session-id>`.
- macOS may ask for notification permission for Terminal, iTerm, or Codex. Allow it in System Settings if popups do not appear.
- If sound works but popups do not, macOS notification permissions are the likely issue.
- If popups work but sound does not, check system volume and Focus mode.
- Codex currently supports one `notify` command. This installer will not overwrite an existing custom notify command unless you pass `--force`.
- The 1-second threshold is calculated from the Codex turn ID timestamp. If Codex changes that payload shape, the hook falls back to notifying rather than dropping completions.
- macOS is the primary target. Linux has best-effort support through `notify-send`, `paplay`, or `aplay`.

## Security

This does not ask for secrets and does not send data anywhere. The hook receives Codex's local completion payload and uses it only to decide whether to notify.
