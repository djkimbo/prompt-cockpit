# Prompt Cockpit

Eine Leiste direkt über dem Eingabefeld von Claude: dein Nutzungslimit auf einen Blick, ein Knopf, der Diktate in saubere Prompts verwandelt, und 5 Fußball-Minispiele für die Wartezeit.

```
5-Std-Limit ██░░░░░░░░ 15 % Reset 12:30 Uhr | Woche 14 % | HF 1.095     [🎮 GAME G] [🧠 Brain B]
```

[English version below](#english)

## Was drin ist

| Mod | Was er macht |
|---|---|
| `limit-band` | Zeigt das 5-Stunden-Limit als Balken mit Prozent und Reset-Uhrzeit, daneben das Wochenlimit. Ab 70 % wird der Balken gelb, ab 90 % rot. Wer Higgsfield verbunden hat, sieht zusätzlich `HF` mit dem Credit-Stand. |
| `brain` | Der Knopf 🧠 Brain nimmt den Text im Eingabefeld (zum Beispiel ein Diktat), korrigiert Erkennungsfehler, streicht Füllwörter und baut daraus einen gegliederten Prompt. ↩ Rückgängig holt den Originaltext zurück. Geht auch als Befehl: `/brain` oder `/brain dein Text`. |
| `game` | Der Knopf 🎮 GAME öffnet ein Fußball-Minispiel im Browser, bei jedem Klick das nächste. |
| `prompt-cockpit` | Installiert die drei Mods oben in einem Schritt. |

### Die 5 Spiele

- **Aufstieg:** Schiebe-Puzzle. Zwei gleiche Vereine zusammenschieben, dann steigen sie eine Liga auf.
- **Durch die Mauer:** Jeder Tipp schickt den Ball nach oben, durch die Lücken der Verteidiger-Mauern.
- **Elfmeter-Duell:** 5 Schüsse gegen einen Torwart, der sich deine Ecken merkt.
- **Fußball-Runner:** Bälle sammeln, Verteidigern ausweichen.
- **Kopf an Kopf:** Zwei Karten, eine Frage: mehr oder weniger? Mit echten Zahlen zu Spielern und Vereinen, jede Zahl mit Quelle.

Die Spiele laufen ohne Internet, jedes ist eine einzelne HTML-Datei. Highscores bleiben in deinem Browser. Texte gibt es auf Deutsch und Englisch.

## Installieren

**In der Claude-App (Desktop):**

1. Klick auf das **+** neben dem Eingabefeld, dann auf **Plugins**.
2. **Add marketplace** wählen und `djkimbo/prompt-cockpit` eintragen.
3. Bei **Add plugin** `prompt-cockpit` wählen.
4. Neue Sitzung öffnen.

**Im Terminal (Claude Code):**

```
/plugin install prompt-cockpit --marketplace djkimbo/prompt-cockpit
```

Die Frage `Add marketplace?` mit `y` bestätigen, dann den Bereich `user` mit Enter wählen.

**Aus der Shell:**

```bash
claude plugin install prompt-cockpit --marketplace djkimbo/prompt-cockpit
```

Du willst nur einen Teil? Statt `prompt-cockpit` einzeln `limit-band`, `brain` oder `game` installieren. `game` braucht `brain`, weil der GAME-Knopf neben dem Brain-Knopf sitzt.

## Gut zu wissen

- **Limits:** Die Werte meldet Claude bei Anmeldung mit einem Claude-Abo. Ohne gemeldete Werte bleibt der Limit-Teil leer.
- **Brain:** Nutzt Claude Sonnet über dein eigenes Konto. Jeder Klick zählt zu deinem Verbrauch. Ein Diktat unter 40 Wörtern mit einem einzigen Anliegen bleibt Fließtext.
- **Higgsfield:** Der Mod erkennt einen verbundenen Higgsfield-Konnektor selbst und fragt den Stand beim Sitzungsstart und nach jedem Credit-verbrauchenden Aufruf ab. Ohne Higgsfield erscheint kein HF-Feld.
- **Sprache:** Folgt der Systemsprache: Deutsch auf deutschen Systemen, sonst Englisch. Erzwingen kannst du sie in `~/.claude/settings.json` mit `"env": { "PROMPT_COCKPIT_LANG": "de" }` (oder `"en"`).
- **Tastenkürzel:** Im Terminal die Leiste mit `Ctrl+X` `Tab` fokussieren, dann `G` für GAME oder `B` für Brain.
- **Getestet** mit Claude Code 2.1.326 auf macOS.

## Deine Daten

- **Brain** schickt den Text aus dem Eingabefeld an Claude, über dein Konto, wie eine normale Nachricht.
- **limit-band** fragt bei Higgsfield nur den Kontostand ab, über deinen eigenen Konnektor.
- **Die Spiele** laden nichts nach und senden nichts. In "Kopf an Kopf" öffnen nur die Quellen-Links eine Seite, wenn du sie anklickst.

## Entfernen

```bash
claude plugin uninstall prompt-cockpit
claude plugin uninstall limit-band
claude plugin uninstall brain
claude plugin uninstall game
```

## Lizenz

MIT, siehe [LICENSE](LICENSE). Prompt Cockpit ist ein privates Projekt und kein Produkt von Anthropic.

---

<a id="english"></a>

# Prompt Cockpit (English)

A bar right above the Claude prompt: your usage limit at a glance, a button that turns dictation into a clean prompt, and 5 football mini games for the waiting time.

```
5h limit ██░░░░░░░░ 15 % resets 12:30 | Week 14 % | HF 1,095     [🎮 GAME G] [🧠 Brain B]
```

## What's inside

| Mod | What it does |
|---|---|
| `limit-band` | Shows the 5-hour limit as a bar with percent and reset time, plus the weekly limit. The bar turns yellow at 70 % and red at 90 %. If you have Higgsfield connected, you also see `HF` with your credit balance. |
| `brain` | The 🧠 Brain button takes the text in the prompt box (a dictation, for example), fixes recognition errors, drops filler words and builds a structured prompt from it. ↩ Undo brings the original back. Also works as a command: `/brain` or `/brain your text`. |
| `game` | The 🎮 GAME button opens a football mini game in your browser, the next one on every click. |
| `prompt-cockpit` | Installs the three mods above in one step. |

### The 5 games

- **Aufstieg (Promotion):** Sliding puzzle. Slide two equal clubs together and they move up a league.
- **Durch die Mauer (Through the Wall):** Every tap sends the ball up, through the gaps in the defensive walls.
- **Elfmeter-Duell (Penalty Duel):** 5 shots against a keeper who remembers your corners.
- **Fußball-Runner (Football Runner):** Collect balls, dodge defenders.
- **Kopf an Kopf (Head to Head):** Two cards, one question: more or less? Real numbers about players and clubs, each with a source.

The games run offline, each one is a single HTML file. High scores stay in your browser. Texts come in German and English.

## Install

**In the Claude app (desktop):**

1. Click **+** next to the prompt box, then **Plugins**.
2. Choose **Add marketplace** and enter `djkimbo/prompt-cockpit`.
3. Under **Add plugin**, choose `prompt-cockpit`.
4. Open a new session.

**In the terminal (Claude Code):**

```
/plugin install prompt-cockpit --marketplace djkimbo/prompt-cockpit
```

Answer `Add marketplace?` with `y`, then pick the `user` scope with Enter.

**From a shell:**

```bash
claude plugin install prompt-cockpit --marketplace djkimbo/prompt-cockpit
```

Only want part of it? Install `limit-band`, `brain` or `game` on their own instead of `prompt-cockpit`. `game` needs `brain`, because the GAME button sits next to the Brain button.

## Good to know

- **Limits:** Claude reports these values when you sign in with a Claude subscription. Without reported values the limit part stays empty.
- **Brain:** Uses Claude Sonnet through your own account. Every click counts towards your usage. A dictation under 40 words with a single request stays plain text.
- **Higgsfield:** The mod finds a connected Higgsfield connector by itself and checks the balance at session start and after every call that spends credits. Without Higgsfield there is no HF field.
- **Language:** Follows your system language: German on German systems, English everywhere else. To force one, add `"env": { "PROMPT_COCKPIT_LANG": "en" }` (or `"de"`) to `~/.claude/settings.json`.
- **Shortcuts:** In the terminal, focus the bar with `Ctrl+X` `Tab`, then press `G` for GAME or `B` for Brain.
- **Tested** with Claude Code 2.1.326 on macOS.

## Your data

- **Brain** sends the text from the prompt box to Claude, through your account, like a normal message.
- **limit-band** only asks Higgsfield for your balance, through your own connector.
- **The games** load nothing and send nothing. In "Kopf an Kopf", only the source links open a page, and only when you click them.

## Remove

```bash
claude plugin uninstall prompt-cockpit
claude plugin uninstall limit-band
claude plugin uninstall brain
claude plugin uninstall game
```

## License

MIT, see [LICENSE](LICENSE). Prompt Cockpit is a private project and not a product of Anthropic.
