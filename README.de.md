# DayZ PAA Creative Bridge

Öffnet eine lokale DayZ-`.paa`-Textur direkt aus [DayZ PAA Preview](https://marketplace.visualstudio.com/items?itemName=chrisczopnik.dayz-paa-preview) in Adobe Photoshop.

Diese Companion-Extension ergänzt die PAA-Vorschauleiste zwischen Export und TexView um **In Adobe Photoshop öffnen**. Dieselbe Aktion steht im Explorer-Kontextmenü und in der Befehlspalette zur Verfügung.

## Voraussetzungen

- 64-Bit-Windows (x64)
- Visual Studio Code 1.85 oder neuer
- `chrisczopnik.dayz-paa-preview` als separat installierte Extension-Abhängigkeit
- separat installiertes Adobe Photoshop
- ein separat installiertes und eingerichtetes, kompatibles PAA-Format-Plug-in eines Drittanbieters für Adobe Photoshop

Adobe Photoshop unterstützt DayZ-PAA-Dateien nicht garantiert von Haus aus. Diese Extension übergibt lediglich den Pfad der ausgewählten lokalen `.paa` an Photoshop. Sie liefert weder Adobe-Software noch ein PAA-Format-Plug-in mit und installiert, konfiguriert, lizenziert oder unterstützt diese auch nicht.

## Verwendung

1. DayZ PAA Preview und diese Companion-Extension installieren.
2. Eine lokale `.paa` mit **DayZ PAA Preview** öffnen.
3. In der Vorschauleiste **In Adobe Photoshop öffnen** auswählen.

Alternativ im VS-Code-Explorer eine `.paa` mit der rechten Maustaste anklicken und **PAA: In Adobe Photoshop öffnen** auswählen.

Die PAA-Quelldatei wird direkt an das gefundene Photoshop-Programm übergeben. Dabei wird kein temporärer PNG-Export erstellt und die Quelldatei von der Extension nicht verändert.

## Photoshop-Erkennung

Für die automatische Erkennung `dayzPaaCreativeBridge.photoshopPath` leer lassen. Wird nicht die gewünschte Installation gefunden, **PAA: Adobe-Photoshop-Programm auswählen** ausführen und `Photoshop.exe` auswählen. Die Einstellung gilt computerweit, da sie auf eine lokal installierte Anwendung verweist.

## Befehle

- `PAA: In Adobe Photoshop öffnen`
- `PAA: Adobe-Photoshop-Programm auswählen`

Manifest-Befehle und Einstellungen sind auf Deutsch und Englisch lokalisiert.

## Datenschutz und Sicherheit

- Keine Telemetrie und keine Netzwerkanfragen.
- PAA-Daten verlassen durch diese Extension nicht den Rechner.
- Photoshop wird ohne Kommando-Shell gestartet; der PAA-Pfad wird als separates Argument übergeben.
- Es werden ausschließlich lokale `file:`-Ressourcen angenommen.
- Virtuelle, entfernte und nicht vertrauenswürdige Workspaces werden in Version 1 absichtlich nicht unterstützt.

Adobe Photoshop und das installierte PAA-Plug-in eines Drittanbieters laufen außerhalb dieser Extension und unterliegen eigenen Sicherheits-, Datenschutz- und Lizenzbedingungen.

## Marken und Zugehörigkeit

Die Extension nutzt ein neutrales Bildbearbeitungs-Symbol und liefert das Adobe-Photoshop-Produkticon nicht mit. Adobe und Photoshop sind Marken oder eingetragene Marken von Adobe in den USA und/oder anderen Ländern.

Dies ist eine inoffizielle Community-Extension. Sie ist weder mit Adobe, Bohemia Interactive oder dem Autor eines PAA-Plug-ins eines Drittanbieters verbunden noch von diesen gesponsert oder empfohlen.

## Entwicklung

```powershell
npm install
npm test
npm run package
```

Weitere Hinweise stehen in `CONTRIBUTING.md`, `PUBLISHING.md` und `SECURITY.md`.

## Lizenz

MIT. Es sind keine Programme oder Assets von Adobe, Bohemia Interactive oder einem PAA-Plug-in eines Drittanbieters enthalten.
