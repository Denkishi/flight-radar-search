# ✈️ FlightRadar24 Historical Search

Un'applicazione web moderna, reattiva e serverless per esplorare lo storico dei voli commerciali tramite le API ufficiali di **FlightRadar24**.

Costruita in puro HTML, JS e TailwindCSS, l'app aggira elegantemente le limitazioni temporali dell'API dividendo automaticamente le richieste più lunghe e offrendo un'interfaccia molto più chiara, colorata e impaginata per analizzare centinaia di voli contemporaneamente.

## ✨ Funzionalità

- **🛡️ 100% Client-Side:** Nessun server intermedio. Inserisci il tuo Token API di FlightRadar24 e le chiamate partono direttamente dal tuo browser (il token viene salvato in modo sicuro nel `localStorage` del tuo PC).
- **♾️ Bypass del Limite 14-Giorni:** L'API ufficiale vieta le ricerche storiche con differenze superiori a 14 giorni. Questa applicazione spezzetta in background il periodo da te scelto (anche di svariati mesi!) in blocchi sicuri, scarica i dati scaglionati, e riunisce i risultati in un'unica interfaccia.
- **🔍 Autocompletamento Intelligente:** Database precaricato per suggerire automaticamente nome, codici ICAO e IATA di tutte le compagnie aeree e gli aeroporti del mondo (ottimizzato e localizzato in italiano). Cerca "Milano" o "Roma" per trovare subito gli aeroporti giusti.
- **🎨 UI Moderna e Friendly:** Card colorate con "pillole" di stato per controllare con un solo colpo d'occhio: decollo, atterraggio, ritardi, dirottamenti, aereo utilizzato, distanza e durata del volo.
- **📊 Ordinamento & Impaginazione:** Supporto integrato per ordinare dinamicamente i risultati (Data, Volo, Compagnia) e impaginarli per rendere la navigazione fluida.

## 🚀 Come usarla

Puoi utilizzare la versione cloud gratuita dell'app direttamente qui:
👉 **[FlightRadar Search App](https://denkishi.github.io/flight-radar-search/)**

1. Vai su [FlightRadar24 API](https://fr24api.flightradar24.com/docs/getting-started) e ottieni il tuo Bearer Token (Chiave API).
2. Incolla il token nella web-app (verrà ricordato in automatico per le visite future).
3. Inserisci un range di date e almeno un aeroporto/compagnia.
4. Premi *Cerca Voli* e analizza i risultati!

## 🛠️ Stack Tecnologico

- **Vanilla JavaScript & HTML5:** Nessun framework pesante, un'unica Single-Page Application (SPA) fulminea.
- **Tailwind CSS:** Per uno styling moderno e 100% responsivo (adattabile per PC, Tablet e Smartphone).
- **Flatpickr:** Per un calendario in stile italiano elegante e robusto.
- **FontAwesome:** Per le icone vettoriali.

## 📥 Esecuzione in Locale

Se preferisci far girare l'app in locale sul tuo PC, senza passare dal web:

1. Clona il repository:
   ```bash
   git clone https://github.com/Denkishi/flight-radar-search.git
   ```
2. Clicca due volte sul file `index.html` per aprirlo nel tuo browser. Non è necessario alcun server web locale (Node.js, Apache, ecc)!

---
*Disclaimer: Progetto indipendente sviluppato per offrire un'interfaccia client-side e user-friendly alle API pubbliche di FlightRadar24.*
