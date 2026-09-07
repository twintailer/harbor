# iPhone: Wiedergabe- und Performance-Überarbeitung

Stand: 7. September 2026. Version 0.9.91 erfolgreich als unsignierte iPhone-IPA gebaut und heruntergeladen.

- Build: [34125539282](https://github.com/twintailer/harbor/actions/runs/34125539282), erfolgreich nach 9 Minuten 38 Sekunden.
- Quellcode: `44e2445a51e3cf048b33b25ba35af4041ae3705e`.
- Datei: `artifacts/ios-0.9.91/Harbor_0.9.91_unsigned.ipa` (145.903.105 Bytes).
- Geprüft: ZIP-Integrität, Version 0.9.91, `app.harbor`, iPhoneOS/ARM64, 27 Frameworks, alle 17 Shader inklusive der kleinen Mobilnetze. Keine App-Signatur und kein Provisioning-Profil; vor Installation mit eigener Apple-ID signieren.
- SHA-256: `fdbd79c88ba1e4df5f173fceedafd7835c7537eff9205b4fea51a131104e7dc3`.

## Behobene Ursachen

- Die mobile Zeitleiste las `snap.positionSec`. Der Player unterdrückt absichtlich globale React-Updates bei reinen Zeitänderungen. Eine separate `MobileTimeline` abonniert jetzt die echte Wiedergabeuhr und meldet sich bei ausgeblendeten Bedienelementen ab. Kein zusätzlicher Animationstimer. Scrubbing hält die Bedienleiste offen, wird nicht von Zeitupdates überschrieben und behandelt Abbruch sowie Tastaturbedienung.
- Versteckte zentrale Buttons konnten durch `pointer-events:auto` weiterhin Berührungen abfangen. Die ausgeblendete Leiste ist jetzt inert, mit zusätzlicher CSS-Absicherung. Hintergrundbereiche des geöffneten Menüs sind ebenfalls inert.
- Zeitereignisse der nativen Bridge setzten den Pufferstatus unabhängig vom Decoder zurück. Jetzt ändern sie ausschließlich Zeitwerte. Unveränderte Ton-/Untertitelspuren behalten ihre Objektidentität. Verspätete Listener-Registrierungen und veraltete Quellen-Ladevorgänge werden abgefangen.
- Verborgene Ansichten liefen hinter dem Video weiter. Auf Mobilgeräten stoppt eine React-Activity-Grenze ihre Effects und erhält dabei ihren Zustand. Diese Funktion ist seit React 19.2 verfügbar; die Mindestversion wurde entsprechend angehoben, ohne die aufgelösten Paketversionen zu wechseln. [React Activity](https://react.dev/reference/react/Activity)
- Nicht sichtbare Desktop-Kataloge werden auf dem mobilen Home nicht mehr abgerufen. Metadata-Kataloge laden in geordneten Vierergruppen und zeigen frühe Ergebnisse. Beim Wechsel zum Player werden keine weiteren Gruppen gestartet. Bereits laufende native `harbor_fetch`-Anfragen können noch auslaufen, da dieser Transport das AbortSignal nicht durchgängig unterstützt.
- Desktop-Fensterreparatur, Hover-Vorschauen, nutzlose native DOM-Screenshotversuche und der Desktop-Wiederverbindungstimer entfallen auf Mobilgeräten. Der mobile Hero rotiert nicht mehr automatisch und mountet beim Wischen nicht mehr alle Slides.

## Bildverarbeitung und bewusste Kompromisse

- Die native Renderfläche wird schon beim Erstellen auf höchstens 1920 × 1080 Pixel innerhalb des Bildschirm-Seitenverhältnisses begrenzt. Die Web-Oberfläche behält ihre Geräteauflösung. Das spart Renderpixel, bedeutet aber weniger Bildauflösung als das bisherige native Display-Rendering; es reduziert nicht die Auflösung des Decoders.
- Anime4K nutzt kleine S-Netze, höchstens eine Hochskalierung, keine doppelten Restore-Ketten. Quellen oberhalb von 1080p werden nicht zusätzlich hochskaliert. Desktop-Shaderketten bleiben unverändert.
- Der native Schutz pausiert Anime4K bei erhöhter Temperatur bereits ab `fair`, im Stromsparmodus, bei Software-Dekodierung und oberhalb von ungefähr 30 effektiven Bildern pro Sekunde einschließlich Abspielgeschwindigkeit. Der Temperaturschutz bleibt für das aktuelle Video eingerastet, um ein ständiges Ein-/Ausschalten der Shader zu vermeiden. Das Video läuft weiter, der Grund steht im Anime4K-Menü. Die gespeicherte Auswahl bleibt erhalten. [Apple Thermal State](https://developer.apple.com/documentation/foundation/processinfo/thermalstate-swift.property)
- Der tatsächliche Decoder wird über `hwdec-current` ermittelt. Bei Software-Dekodierung erscheint ein Hinweis auf eine alternative Quelle. [mpv-Property-Dokumentation](https://mpv.io/manual/stable/#properties)
- Beim Sperren/Hintergrundwechsel pausiert die native Wiedergabe jetzt. Es gibt in dieser Shell derzeit kein PiP; unbeobachtetes Dekodieren soll nicht weiterlaufen. Die bestehende exit-sichere VideoToolbox-Copy-Ausgabe und die wiederverwendete mpv-Instanz werden beibehalten.

## Oberfläche

Größere Zeitleisten-Touchfläche, sichtbarer Fortschritt, klare Audio-/Untertitelbeschriftungen, Quellenwechsel direkt in der Leiste, erreichbare nächste Folge, sofort schließende Auswahlmenüs und scrollbare Menüs mit Fokusführung. Keine laufenden Backdrop-Blur-Effekte in der mobilen Player-Leiste. Home behält beim Zurückkehren seine bisherigen Kataloge, bietet einen leeren Zustand mit Aktualisierung und weitere Kataloge nach den ersten zwölf Reihen.

## Verifikation

- `pnpm build`: TypeScript und Produktions-Frontend erfolgreich; bestehende Chunkgrößen-/Importwarnungen bleiben.
- `pnpm test:player-bridge`: native Bridge mit simulierten Plugin-Ereignissen, Listener-Lebensdauer, Shaderauswahl, Katalogparallelität, Reihenfolge und Abbruch erfolgreich.
- `pnpm test:player-mobile`: tatsächliche React-Player-Komponente im Headless-Edge-Browser erfolgreich getestet: unabhängige Zeitleiste, Scrubbing, ausgeblendete Trefferflächen, Zurück/nächste Folge/Quelle, Sprachauswahl, letzte Menüoption und Activity-Zustand. Screenshots unter `artifacts/mobile-player-review/`.
- Der Browser-Test benötigt Playwright und Edge. `PLAYWRIGHT_MODULE_PATH` kann auf eine bereits installierte `playwright/index.mjs` zeigen. Optional `HARBOR_TEST_BROWSER=webkit`; der lokale Windows-WebKit-Prozess ließ sich hier nicht starten. Kein Safari/iPhone-Test behauptet.
- Der Swift-Policytest wurde im macOS-Build erfolgreich ausgeführt; auch die vollständige native iOS-Kompilierung ist erfolgreich. Auf einem Mac lässt sich der Policytest separat wiederholen:

```sh
test_dir="$(mktemp -d)"
swiftc src-tauri/tauri-plugin-native-player/ios/Sources/NativePlayer/PlaybackBudget.swift tests/native-playback-budget.swift -o "$test_dir/playback-budget"
"$test_dir/playback-budget"
```

## Noch auf einem iPhone zu prüfen

Die native iOS-Kompilierung ist abgeschlossen; echte Temperatur-/Energie-Messungen stehen weiterhin aus. Nach ausdrücklicher Freigabe wurde Version 0.9.91 auf dem Standard-Runner `macos-latest` im bereits öffentlichen Repository gebaut. Das verbraucht kein privates Actions-Minutenkontingent. Der Workflow läuft nur bei öffentlicher Repository-Sichtbarkeit. [GitHub-Runnerabrechnung](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

Nach einem Mac-Build: jeweils mindestens 10–15 Minuten dieselbe 1080p-Quelle ohne/mit Anime4K vergleichen; danach 4K, 2×-Geschwindigkeit, Stromsparmodus, App-Sperre, Quellenwechsel, nächste Folge und mehrfaches Verlassen während laufender Wiedergabe testen. Ausgangstemperatur, Helligkeit und Ladezustand vergleichbar halten. Reale Temperaturverbesserung und Crashfreiheit können erst damit bestätigt werden.
