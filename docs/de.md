# Solar-Log

Verfolge deine Solaranlage in Gladys mit einem **Solar-Log**-Datenlogger (Solar-Log 200, 250,
300, 500, 1000, 1200, 1900, 2000, Solar-Log Base…): Erzeugung, Verbrauch, Überschuss, Erträge,
Wechselrichter und Batterie. Die Integration liest den Solar-Log **in deinem lokalen Netzwerk**
über seine offene JSON-Schnittstelle: kein Cloud-Konto, keine Daten verlassen dein Zuhause.

## Was du bekommst

- Ein Gerät **Solar-Log**: Erzeugungsleistung, DC-Leistung, AC- und DC-Spannung, Gesamtertrag
  (Zählerstand in kWh) und — wenn ein Verbrauchszähler am Solar-Log angeschlossen ist —
  Verbrauchsleistung, Gesamtverbrauch, Überschuss (Erzeugung minus Verbrauch) und
  Eigenverbrauchsquote.
- Ein Gerät **pro Wechselrichter** mit seiner aktuellen Leistung (optional).
- Ein Gerät **Batterie** (Ladestand, Lade- und Entladeleistung), wenn der Solar-Log eine verwaltet.
- **Szenen-Auslöser**: Erzeugung gestartet / beendet, Solarüberschuss verfügbar / beendet,
  Solar-Log nicht erreichbar / wieder erreichbar.
- **Szenen-Aktionen**: Solarwerte lesen, Solarüberschuss prüfen, Ertrag eines Zeitraums abrufen.
- Zwei **Dashboard-Widgets**: „Solarerzeugung“ und „Solarerträge“.

Der Gesamtertrag wird als Zählerstand veröffentlicht: Das Energie-Monitoring von Gladys berechnet
daraus die Erzeugung jedes Tages, Monats oder Jahres.

## Bevor du beginnst

1. Gib dem Solar-Log in deinem Router eine **feste IP-Adresse** (DHCP-Reservierung).
2. Öffne die Weboberfläche des Solar-Log im Browser (seine IP-Adresse).
3. Gehe zu **Konfiguration > System > Zugangskontrolle** und aktiviere **Offene
   JSON-Schnittstelle**. Speichern. Ohne sie antwortet der Solar-Log der Integration nicht.
4. Optional: Wenn die Zugriffsebene „Benutzer“ durch ein Passwort geschützt ist, notiere es. Es
   wird nur für die Daten pro Wechselrichter und der Batterie benötigt.

## Konfiguration

Öffne in Gladys **Integrationen > Solar-Log > Konfiguration**:

| Feld                         | Was eingeben                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Adresse des Solar-Log        | IP-Adresse oder Hostname, z. B. `192.168.1.20` (`http://` wird ergänzt).        |
| Benutzerpasswort             | Nur wenn die Ebene „Benutzer“ ein Passwort hat. Wird als Geheimnis gespeichert. |
| Aktualisierungsintervall (s) | Wie oft der Solar-Log gelesen wird. Standard 60 s, mindestens 30 s.             |
| Erzeugungsschwelle           | Erzeugung (W), die „Solarerzeugung gestartet“ auslöst. Standard 50 W.           |
| Überschussschwelle           | Überschuss (W), der „Solarüberschuss verfügbar“ auslöst. Standard 1000 W.       |
| Überschuss-Spanne            | „Überschuss beendet“ löst bei Schwelle minus Spanne aus. Standard 200 W.        |
| Ein Gerät pro Wechselrichter | Erstellt zusätzlich ein Gerät pro Wechselrichter. Standardmäßig an.             |

Klicke dann auf **Verbindung testen**: Die Antwort zeigt die aktuelle Erzeugung und den Ertrag
des Tages. Öffne den Reiter **Erkennung** und füge die gewünschten Geräte hinzu. **Wechselrichter
erneut suchen** liest Wechselrichter und Batterie nach einer Änderung am Solar-Log neu ein.

## Szenen-Auslöser

| Auslöser                    | Wann                                                          | Variablen                                    |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Solarerzeugung gestartet    | Die Erzeugung überschreitet die Erzeugungsschwelle (morgens). | `production_w`                               |
| Solarerzeugung beendet      | Die Erzeugung fällt unter die Hälfte der Schwelle (abends).   | `yield_today_kwh`                            |
| Solarüberschuss verfügbar   | Erzeugung minus Verbrauch erreicht die Überschussschwelle.    | `surplus_w`, `production_w`, `consumption_w` |
| Solarüberschuss beendet     | Der Überschuss fällt unter Schwelle minus Spanne.             | `surplus_w`, `production_w`, `consumption_w` |
| Solar-Log nicht erreichbar  | Drei Lesevorgänge hintereinander sind fehlgeschlagen.         | `reason`                                     |
| Solar-Log wieder erreichbar | Der Solar-Log antwortet wieder.                               |                                              |

Jeder Auslöser löst **einmal pro Änderung** aus, nie bei jedem Lesen und nicht beim Neustart der
Integration. Die Überschuss-Auslöser benötigen einen Verbrauchszähler am Solar-Log.

## Szenen-Aktionen

- **Solarwerte lesen**: liest den Solar-Log jetzt. Ausgaben: `reachable`, `production_w`,
  `consumption_w`, `surplus_w`, `yield_today_kwh`, `self_consumption_percent`.
- **Solarüberschuss prüfen**: Erreicht der Überschuss das gewählte Minimum? Ausgaben: `available`
  (nie wahr, wenn der Solar-Log nicht antwortet), `surplus_w`.
- **Solarertrag abrufen**: Erzeugung und Verbrauch in kWh für heute, gestern, diesen Monat,
  dieses Jahr oder seit der Installation.

Beispiel: „Wenn Solarüberschuss verfügbar ist, zwischen 10:00 und 16:00 Uhr die Steckdose des
Warmwasserbereiters einschalten; wenn der Überschuss endet, ausschalten.“

## Dashboard-Widgets

- **Solarerzeugung**: Erzeugung, Verbrauch und Überschuss live, Anteil an der Spitzenleistung,
  24-Stunden-Kurve, Tagesertrag, Verbindungsstatus und Schaltfläche **Aktualisieren**.
- **Solarerträge**: Erzeugung und Verbrauch heute, gestern, diesen Monat, dieses Jahr und
  gesamt, dazu der aktuelle Eigenverbrauch.

## Fehlerbehebung

- **„Die offene JSON-Schnittstelle ist deaktiviert“**: Aktiviere sie (siehe „Bevor du beginnst“).
- **„Der Solar-Log antwortet nicht“**: Prüfe die Adresse, ob Gladys und der Solar-Log im selben
  Netzwerk sind und ob keine Firewall Port 80 blockiert.
- **„Der Solar-Log hat das Passwort abgelehnt“**: Prüfe das Passwort der Ebene „Benutzer“. Die
  Anlagenübersicht funktioniert auch ohne; nur Wechselrichter und Batterie brauchen es.
- **Werte bei 0 direkt nach einem Neustart des Solar-Log**: Die Integration ignoriert sie
  absichtlich, bis der Solar-Log fertig gestartet ist.
- **Kein Wechselrichter-Gerät**: Die Daten pro Wechselrichter können das Passwort erfordern;
  klicke nach der Eingabe auf **Wechselrichter erneut suchen**.

## Datenschutz

Alles bleibt in deinem Netzwerk: Die Integration spricht nur mit deinem Solar-Log. Das Passwort
wird als Gladys-Geheimnis gespeichert und nie in die Logs geschrieben.
