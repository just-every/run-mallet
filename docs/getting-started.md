Mallet runs on your own computer with one command, `rer dev`. You need no account anywhere, and nothing you type into Mallet leaves your machine.

## What you need

- macOS, Linux, or Windows with WSL2.
- Nothing else to install first. `rer` picks the exact Node version Mallet declares and fetches a checked copy if yours differs; it never changes your global Node.
- Git, to get the code.

## Get Mallet and start it

These are the two lines the [Run page](https://run-mallet.com/run) shows. First install `rer`, the Run Edit Run command that installs, starts and stops Mallet. It brings its own Node when you have no Node 22 or later:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

If the installer ends with a line to run, run it: it puts `rer` on your PATH. Then get Mallet and start it:

```sh
rer dev just-every/run-mallet
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-mallet` does both steps in one line.

`rer dev` clones Mallet into a `run-mallet` folder, installs everything it needs, makes you the owner and starts the app. To start it again later, run `cd run-mallet && rer dev`. The first launch takes a few minutes. If it is interrupted, run the same command again: it carries on from where it stopped.

When it is ready it prints three lines:

| Line | What it is |
| --- | --- |
| `RER_READY` | The address the app listens on, on this computer only. |
| `RER_SIGNED_IN` | The owner it signed you in as. |
| `RER_OPEN` | A link that opens Mallet signed in as you. |

**The `RER_OPEN` link is a key to your workshop.** Open it on this computer and keep it to yourself.

## Finish setup

The first time you open Mallet it shows **Finish setup**: your name and email as the owner. Tick **I confirm this owner account is ready to use.** and press **Finish setup**. Mallet opens the **Workshop**, where every repair starts.

From here, [Complete a repair](/docs/complete-a-repair) walks through your first job end to end.

## Stop and start again

Stop Mallet with `rer dev --stop` (or Ctrl-C in the window where it runs). Start it again with `rer dev` from the same folder. Your workshop is kept between runs.

Mallet keeps its data inside the `run-mallet` folder, in files Git ignores. To move it to another computer, or to keep a copy, read [Back up, restore and erase](/docs/backup-and-restore).

## Sign in later

When you come back without the `RER_OPEN` link, open the address from `RER_READY`. Mallet shows **Sign in**. On this computer you can also run `rer signin` from the `run-mallet` folder to get a fresh signed-in link.

Mallet does not send email while it runs on your computer, so a sign-in link by email only works once Mallet runs in your own account with mail configured; see [Run it in your own Cloudflare account](/docs/deploy).
