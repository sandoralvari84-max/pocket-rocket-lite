// Pocket Rocket Lite — lightweight, fully-offline localization.
// One translator L("English") keyed by the English source string: no key
// management, and any untranslated string gracefully falls back to English.
// Components call useLang() once so they re-render when the language changes.
import { useEffect, useState } from "react";
import { getSettings, subscribe, type AppLang } from "./settings";

export type { AppLang };

export const LANGS: { key: AppLang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "de", label: "Deutsch" },
  { key: "es", label: "Español" },
];

export function lang(): AppLang {
  return getSettings().language ?? "en";
}

// Translation table keyed by the English source string.
type Pair = { de: string; es: string };
const TR: Record<string, Pair> = {
  // ---- nav / shell ----
  "Chat": { de: "Chat", es: "Chat" },
  "Games": { de: "Spiele", es: "Juegos" },
  "Tools": { de: "Werkzeuge", es: "Herramientas" },
  "Settings": { de: "Einstellungen", es: "Ajustes" },
  "ARCADE": { de: "ARCADE", es: "ARCADE" },
  "TURN-BASED": { de: "RUNDEN", es: "POR TURNOS" },
  "Select a cabinet": { de: "Automat wählen", es: "Elige una máquina" },

  // ---- shared game overlays (cover all games) ----
  "PAUSED": { de: "PAUSE", es: "PAUSA" },
  "GAME OVER": { de: "SPIEL AUS", es: "FIN DEL JUEGO" },
  "Play again": { de: "Nochmal", es: "Jugar otra vez" },
  "Exit to menu": { de: "Zum Menü", es: "Salir al menú" },
  "Resume": { de: "Weiter", es: "Continuar" },
  "Start": { de: "Start", es: "Empezar" },
  "Launch": { de: "Start", es: "Lanzar" },
  "Next level": { de: "Nächstes Level", es: "Siguiente nivel" },
  "Save score": { de: "Punktzahl speichern", es: "Guardar puntuación" },
  "NEW HIGH SCORE — TAG IT": { de: "NEUER REKORD — SIGNIEREN", es: "NUEVO RÉCORD — FÍRMALO" },
  "NAME": { de: "NAME", es: "NOMBRE" },
  "SCORE": { de: "PUNKTE", es: "PUNTOS" },
  "No scores yet — be the first.": { de: "Noch keine Punkte — sei der Erste.", es: "Sin puntuaciones todavía — sé el primero." },

  // ---- Tools ----
  "TOOLS": { de: "WERKZEUGE", es: "HERRAMIENTAS" },
  "Shortcuts into your on-device buddy. Each opens Chat with a head start — your text never leaves the phone.":
    { de: "Direktzugänge zu deinem Gerät-Buddy. Jeder öffnet den Chat mit Vorlauf — dein Text verlässt nie das Telefon.",
      es: "Accesos directos a tu colega local. Cada uno abre el chat con ventaja — tu texto nunca sale del teléfono." },
  "Dictaphone & Notes": { de: "Diktiergerät & Notizen", es: "Dictáfono y notas" },
  "Record voice notes (transcribed) or jot text — saved on-device":
    { de: "Sprachnotizen (transkribiert) oder Text — lokal gespeichert",
      es: "Graba notas de voz (transcritas) o escribe texto — guardado en el dispositivo" },

  // ---- Disclaimer + model copy (de-jargoned) ----
  "A small AI that lives on your phone — great for everyday help, not a source of truth. It resists most bad info but not all, and it can be wrong about facts, maths, or anything recent. Verify anything that matters.":
    { de: "Eine kleine KI, die auf deinem Telefon lebt — super für den Alltag, aber keine Quelle der Wahrheit. Sie wehrt die meisten Falschinfos ab, aber nicht alle, und kann sich bei Fakten, Mathe oder Aktuellem irren. Prüfe alles, was wichtig ist.",
      es: "Una IA pequeña que vive en tu teléfono — ideal para el día a día, no una fuente de verdad. Resiste la mayoría de la información falsa, pero no toda, y puede equivocarse con datos, matemáticas o cosas recientes. Verifica lo que importe." },
  "A small AI that runs entirely on your phone. Optional — add it once, then it works offline forever.":
    { de: "Eine kleine KI, die komplett auf deinem Telefon läuft. Optional — einmal hinzufügen, dann für immer offline nutzbar.",
      es: "Una IA pequeña que funciona por completo en tu teléfono. Opcional — añádela una vez y funciona sin conexión para siempre." },

  // ---- Notification reader (Tier-2) ----
  "READER": { de: "VORLESER", es: "LECTOR" },
  "Reader": { de: "Vorleser", es: "Lector" },
  "Let it read your notifications": { de: "Lass es deine Benachrichtigungen vorlesen", es: "Deja que lea tus notificaciones" },
  "Grant notification access, then Pocket Rocket can read incoming messages & alerts aloud — entirely on your phone, nothing leaves the device.":
    { de: "Gewähre Benachrichtigungszugriff, dann liest Pocket Rocket eingehende Nachrichten & Hinweise laut vor — komplett auf deinem Telefon, nichts verlässt das Gerät.",
      es: "Concede acceso a las notificaciones y Pocket Rocket podrá leer en voz alta los mensajes y avisos entrantes — todo en tu teléfono, nada sale del dispositivo." },
  "Grant notification access": { de: "Benachrichtigungszugriff gewähren", es: "Conceder acceso a notificaciones" },
  "I've granted it — check again": { de: "Erteilt — erneut prüfen", es: "Concedido — comprobar de nuevo" },
  "Read new aloud": { de: "Neue vorlesen", es: "Leer nuevas en voz alta" },
  "Listening — new notifications will be spoken": { de: "Hört zu — neue Benachrichtigungen werden vorgelesen", es: "Escuchando — se leerán las nuevas notificaciones" },
  "Off — tap to have arrivals read to you": { de: "Aus — tippen, um Eingänge vorlesen zu lassen", es: "Apagado — toca para que te lean las que lleguen" },
  "Read latest": { de: "Letzte vorlesen", es: "Leer la última" },
  "Stop": { de: "Stopp", es: "Parar" },
  "RECENT": { de: "LETZTE", es: "RECIENTES" },
  "Nothing captured yet. New notifications will appear here.": { de: "Noch nichts erfasst. Neue Benachrichtigungen erscheinen hier.", es: "Nada capturado aún. Las nuevas notificaciones aparecerán aquí." },
  "Clear captured": { de: "Erfasste löschen", es: "Borrar capturadas" },

  // ---- Experts (RAG over knowledge packs) ----
  "EXPERTS": { de: "EXPERTEN", es: "EXPERTOS" },
  "Experts": { de: "Experten", es: "Expertos" },
  "Ask across 13 curated knowledge packs — answers cite their source":
    { de: "Frage über 13 kuratierte Wissenspakete — Antworten nennen die Quelle", es: "Pregunta en 13 paquetes de conocimiento — las respuestas citan su fuente" },
  "Ask across curated knowledge packs. Answers come from the packs, not made up — sources are shown.":
    { de: "Frage über kuratierte Wissenspakete. Antworten stammen aus den Paketen, nicht erfunden — Quellen werden gezeigt.", es: "Pregunta en paquetes de conocimiento curados. Las respuestas vienen de los paquetes, no inventadas — se muestran las fuentes." },
  "All": { de: "Alle", es: "Todos" },
  "Ask a question…": { de: "Stelle eine Frage…", es: "Haz una pregunta…" },
  "Ask": { de: "Fragen", es: "Preguntar" },
  "Searching the packs…": { de: "Pakete durchsuchen…", es: "Buscando en los paquetes…" },
  "ANSWER": { de: "ANTWORT", es: "RESPUESTA" },
  "SOURCES": { de: "QUELLEN", es: "FUENTES" },
  "PASSAGES": { de: "AUSZÜGE", es: "PASAJES" },
  "No model installed — here are the matching passages from the packs:":
    { de: "Kein Modell installiert — hier die passenden Auszüge aus den Paketen:", es: "No hay modelo instalado — aquí están los pasajes que coinciden:" },
  "Pick a pack or search all. Examples: “how to judge a health claim”, “what is a marketing funnel”.":
    { de: "Wähle ein Paket oder suche in allen. Beispiele: „Gesundheitsaussage bewerten“, „Was ist ein Marketing-Funnel“.", es: "Elige un paquete o busca en todos. Ejemplos: «cómo evaluar una afirmación de salud», «qué es un embudo de marketing»." },
  "Business": { de: "Wirtschaft", es: "Negocios" },
  "Coding": { de: "Programmierung", es: "Programación" },
  "Cybersecurity": { de: "Cybersicherheit", es: "Ciberseguridad" },
  "Datascience": { de: "Data Science", es: "Ciencia de datos" },
  "Design": { de: "Design", es: "Diseño" },
  "Finance": { de: "Finanzen", es: "Finanzas" },
  "Health": { de: "Gesundheit", es: "Salud" },
  "Legal": { de: "Recht", es: "Legal" },
  "Marketing": { de: "Marketing", es: "Marketing" },
  "Philosophy": { de: "Philosophie", es: "Filosofía" },
  "Product": { de: "Produkt", es: "Producto" },
  "Software": { de: "Software", es: "Software" },
  "Webdesign": { de: "Webdesign", es: "Diseño web" },

  // ---- Tools screen grouping ----
  "Your on-device toolkit — everything here runs offline, nothing leaves the phone.":
    { de: "Dein lokaler Werkzeugkasten — alles läuft offline, nichts verlässt das Telefon.", es: "Tu kit de herramientas en el dispositivo — todo funciona sin conexión, nada sale del teléfono." },
  "Assistant": { de: "Assistent", es: "Asistente" },
  "Health & body": { de: "Gesundheit & Körper", es: "Salud y cuerpo" },
  "Money & home": { de: "Geld & Haushalt", es: "Dinero y hogar" },
  "Utilities": { de: "Werkzeuge", es: "Utilidades" },
  "Quick chat": { de: "Schnell-Chat", es: "Chat rápido" },
  "Fact-check": { de: "Faktencheck", es: "Verificar" },

  // ---- Calendar / Meal planner / Recipes ----
  "CALENDAR": { de: "KALENDER", es: "CALENDARIO" },
  "Calendar": { de: "Kalender", es: "Calendario" },
  "Agenda of upcoming events (reminders coming later)": { de: "Agenda anstehender Termine (Erinnerungen folgen)", es: "Agenda de próximos eventos (recordatorios más adelante)" },
  "Event…": { de: "Termin…", es: "Evento…" },
  "time": { de: "Zeit", es: "hora" },
  "+1 week": { de: "+1 Woche", es: "+1 semana" },
  "Tomorrow": { de: "Morgen", es: "Mañana" },
  "This week": { de: "Diese Woche", es: "Esta semana" },
  "Later": { de: "Später", es: "Más tarde" },
  "No upcoming events.": { de: "Keine anstehenden Termine.", es: "No hay próximos eventos." },
  "Reminders (notifications) are coming in a later update.": { de: "Erinnerungen (Benachrichtigungen) folgen in einem späteren Update.", es: "Los recordatorios (notificaciones) llegarán en una actualización posterior." },
  "MEALS": { de: "MAHLZEITEN", es: "COMIDAS" },
  "Meal planner": { de: "Essensplaner", es: "Planificador" },
  "Plan breakfast, lunch & dinner across the week": { de: "Frühstück, Mittag- & Abendessen für die Woche planen", es: "Planifica desayuno, comida y cena de la semana" },
  "Breakfast": { de: "Frühstück", es: "Desayuno" },
  "Lunch": { de: "Mittagessen", es: "Comida" },
  "Dinner": { de: "Abendessen", es: "Cena" },
  "Plan a meal…": { de: "Mahlzeit planen…", es: "Planifica una comida…" },
  "RECIPES": { de: "REZEPTE", es: "RECETAS" },
  "Recipes": { de: "Rezepte", es: "Recetas" },
  "RECIPE": { de: "REZEPT", es: "RECETA" },
  "NEW RECIPE": { de: "NEUES REZEPT", es: "NUEVA RECETA" },
  "Save recipes; push ingredients to your grocery list": { de: "Rezepte speichern; Zutaten zur Einkaufsliste schicken", es: "Guarda recetas; envía ingredientes a tu lista de compra" },
  "Title": { de: "Titel", es: "Título" },
  "Recipe name…": { de: "Rezeptname…", es: "Nombre de la receta…" },
  "Ingredients": { de: "Zutaten", es: "Ingredientes" },
  "(one per line)": { de: "(eine pro Zeile)", es: "(una por línea)" },
  "Add ingredients to Grocery": { de: "Zutaten zum Einkauf hinzufügen", es: "Añadir ingredientes a la compra" },
  "added to Grocery": { de: "zum Einkauf hinzugefügt", es: "añadidos a la compra" },
  "Steps": { de: "Schritte", es: "Pasos" },
  "Method…": { de: "Zubereitung…", es: "Preparación…" },
  "Save": { de: "Speichern", es: "Guardar" },
  "Delete": { de: "Löschen", es: "Eliminar" },
  "No recipes yet. Tap ＋ to add one.": { de: "Noch keine Rezepte. Tippe ＋ zum Hinzufügen.", es: "Aún no hay recetas. Toca ＋ para añadir una." },

  // ---- Water / Sleep / Measurements / Timer / Converter ----
  "WATER": { de: "WASSER", es: "AGUA" },
  "Water": { de: "Wasser", es: "Agua" },
  "Track cups vs your daily hydration goal": { de: "Becher gegen dein tägliches Trinkziel", es: "Vasos frente a tu meta diaria de hidratación" },
  "cups today": { de: "Becher heute", es: "vasos hoy" },
  "daily goal": { de: "Tagesziel", es: "meta diaria" },
  "cups": { de: "Becher", es: "vasos" },
  "SLEEP": { de: "SCHLAF", es: "SUEÑO" },
  "Sleep": { de: "Schlaf", es: "Sueño" },
  "Log nightly hours, see your 7-night average": { de: "Nächtliche Stunden erfassen, 7-Nächte-Schnitt sehen", es: "Registra horas por noche, ve tu media de 7 noches" },
  "avg": { de: "Ø", es: "prom" },
  "over the last": { de: "über die letzten", es: "en las últimas" },
  "nights": { de: "Nächte", es: "noches" },
  "Hours slept": { de: "Geschlafene Stunden", es: "Horas dormidas" },
  "Last night": { de: "Letzte Nacht", es: "Anoche" },
  "Night before": { de: "Nacht davor", es: "Noche anterior" },
  "RECENT NIGHTS": { de: "LETZTE NÄCHTE", es: "NOCHES RECIENTES" },
  "No nights logged yet.": { de: "Noch keine Nächte erfasst.", es: "Aún no hay noches registradas." },
  "Today": { de: "Heute", es: "Hoy" },
  "Yesterday": { de: "Gestern", es: "Ayer" },
  "MEASURE": { de: "MESSEN", es: "MEDIDAS" },
  "Measurements": { de: "Messungen", es: "Medidas" },
  "Weight & body metrics with change over time": { de: "Gewicht & Körperwerte mit Verlauf", es: "Peso y métricas corporales con su evolución" },
  "Weight": { de: "Gewicht", es: "Peso" },
  "Waist": { de: "Taille", es: "Cintura" },
  "Body fat": { de: "Körperfett", es: "Grasa corporal" },
  "vs previous": { de: "ggü. vorher", es: "vs anterior" },
  "No readings yet.": { de: "Noch keine Werte.", es: "Aún no hay lecturas." },
  "HISTORY": { de: "VERLAUF", es: "HISTORIAL" },
  "Nothing logged for this metric yet.": { de: "Für diesen Wert noch nichts erfasst.", es: "Nada registrado para esta métrica." },
  "TIMER": { de: "TIMER", es: "TEMPORIZADOR" },
  "Timer": { de: "Timer", es: "Temporizador" },
  "Countdown with presets — buzzes when done": { de: "Countdown mit Vorgaben — vibriert am Ende", es: "Cuenta atrás con ajustes — vibra al terminar" },
  "DONE": { de: "FERTIG", es: "LISTO" },
  "running": { de: "läuft", es: "en marcha" },
  "ready": { de: "bereit", es: "listo" },
  "Pause": { de: "Pause", es: "Pausa" },
  "Reset": { de: "Zurücksetzen", es: "Reiniciar" },
  "CONVERT": { de: "UMRECHNEN", es: "CONVERTIR" },
  "Converter": { de: "Umrechner", es: "Conversor" },
  "Length, weight, volume & temperature — exact, offline": { de: "Länge, Gewicht, Volumen & Temperatur — exakt, offline", es: "Longitud, peso, volumen y temperatura — exacto, sin conexión" },
  "Length": { de: "Länge", es: "Longitud" },
  "Volume": { de: "Volumen", es: "Volumen" },
  "Temp": { de: "Temp", es: "Temp" },
  "From": { de: "Von", es: "De" },
  "To": { de: "Nach", es: "A" },
  "Exact unit math, offline. Live currency rates are a later add.":
    { de: "Exakte Einheiten-Umrechnung, offline. Live-Wechselkurse folgen später.", es: "Conversión de unidades exacta, sin conexión. Tipos de cambio en vivo más adelante." },

  // ---- Habits ----
  "HABITS": { de: "GEWOHNHEITEN", es: "HÁBITOS" },
  "Habits": { de: "Gewohnheiten", es: "Hábitos" },
  "Build streaks — check in daily, keep the chain going":
    { de: "Serien aufbauen — täglich eintragen, die Kette halten", es: "Crea rachas — regístrate a diario y mantén la cadena" },
  "New habit…": { de: "Neue Gewohnheit…", es: "Nuevo hábito…" },
  "Add a habit to start a streak.": { de: "Füge eine Gewohnheit hinzu, um eine Serie zu starten.", es: "Añade un hábito para empezar una racha." },
  "day streak": { de: "Tage-Serie", es: "días seguidos" },
  "not started": { de: "nicht begonnen", es: "sin empezar" },

  // ---- Budget ----
  "BUDGET": { de: "BUDGET", es: "PRESUPUESTO" },
  "Budget": { de: "Budget", es: "Presupuesto" },
  "Track income & expenses, monthly balance by category":
    { de: "Einnahmen & Ausgaben, Monatssaldo nach Kategorie", es: "Ingresos y gastos, saldo mensual por categoría" },
  "THIS MONTH": { de: "DIESER MONAT", es: "ESTE MES" },
  "in": { de: "ein", es: "entra" },
  "out": { de: "aus", es: "sale" },
  "Expense": { de: "Ausgabe", es: "Gasto" },
  "Income": { de: "Einnahme", es: "Ingreso" },
  "SPENDING BY CATEGORY": { de: "AUSGABEN NACH KATEGORIE", es: "GASTO POR CATEGORÍA" },
  "TRANSACTIONS": { de: "TRANSAKTIONEN", es: "TRANSACCIONES" },
  "No transactions this month yet.": { de: "Diesen Monat noch keine Transaktionen.", es: "Aún no hay transacciones este mes." },
  "Food": { de: "Essen", es: "Comida" },
  "Transport": { de: "Transport", es: "Transporte" },
  "Bills": { de: "Rechnungen", es: "Facturas" },
  "Shopping": { de: "Einkaufen", es: "Compras" },
  "Fun": { de: "Freizeit", es: "Ocio" },
  "Salary": { de: "Gehalt", es: "Salario" },
  "Gift": { de: "Geschenk", es: "Regalo" },

  // ---- Tools niches: Grocery / Diet / Fitness ----
  "GROCERY": { de: "EINKAUF", es: "COMPRA" },
  "DIET": { de: "ERNÄHRUNG", es: "DIETA" },
  "FITNESS": { de: "FITNESS", es: "FITNESS" },
  "Grocery": { de: "Einkauf", es: "Compra" },
  "Diet": { de: "Ernährung", es: "Dieta" },
  "Fitness": { de: "Fitness", es: "Fitness" },
  "Shopping list by category — check it off as you shop":
    { de: "Einkaufsliste nach Kategorie — beim Einkaufen abhaken", es: "Lista de compra por categoría — márcala al comprar" },
  "Log food, track calories & macros vs a daily goal":
    { de: "Essen erfassen, Kalorien & Makros gegen ein Tagesziel verfolgen", es: "Registra comida, sigue calorías y macros frente a una meta diaria" },
  "Log workouts, track training volume & progress":
    { de: "Workouts erfassen, Trainingsvolumen & Fortschritt verfolgen", es: "Registra entrenamientos, sigue el volumen y el progreso" },
  "Add an item…": { de: "Artikel hinzufügen…", es: "Añadir artículo…" },
  "Add to list": { de: "Zur Liste", es: "Añadir a la lista" },
  "Your list is empty. Add what you need to buy.": { de: "Deine Liste ist leer. Füge hinzu, was du kaufen willst.", es: "Tu lista está vacía. Añade lo que necesitas comprar." },
  "to buy": { de: "zu kaufen", es: "por comprar" },
  "in cart": { de: "im Wagen", es: "en el carro" },
  "total": { de: "gesamt", es: "total" },
  "Clear items in cart": { de: "Artikel im Wagen löschen", es: "Borrar artículos del carro" },
  "Search a food…": { de: "Lebensmittel suchen…", es: "Buscar un alimento…" },
  "goal": { de: "Ziel", es: "meta" },
  "Protein": { de: "Protein", es: "Proteína" },
  "Carbs": { de: "Kohlenhydrate", es: "Carbohidratos" },
  "Fat": { de: "Fett", es: "Grasa" },
  "kcal/100g": { de: "kcal/100g", es: "kcal/100g" },
  "Log it": { de: "Erfassen", es: "Registrar" },
  "Cancel": { de: "Abbrechen", es: "Cancelar" },
  "TODAY": { de: "HEUTE", es: "HOY" },
  "Nothing logged yet today.": { de: "Heute noch nichts erfasst.", es: "Nada registrado hoy todavía." },
  "Search an exercise…": { de: "Übung suchen…", es: "Buscar un ejercicio…" },
  "kg · today's volume": { de: "kg · Volumen heute", es: "kg · volumen de hoy" },
  "sets logged": { de: "Sätze erfasst", es: "series registradas" },
  "best": { de: "Best", es: "mejor" },
  "sets": { de: "Sätze", es: "series" },
  "reps": { de: "Wdh.", es: "reps" },
  "kg": { de: "kg", es: "kg" },
  "Log set": { de: "Satz erfassen", es: "Registrar serie" },
  "No sets logged yet today.": { de: "Heute noch keine Sätze erfasst.", es: "No hay series registradas hoy." },

  // ---- Memory (owner profile + facts) ----
  "MEMORY": { de: "SPEICHER", es: "MEMORIA" },
  "Memory": { de: "Speicher", es: "Memoria" },
  "What your buddy remembers about you — on-device, you control it":
    { de: "Was sich dein Buddy über dich merkt — lokal, von dir gesteuert",
      es: "Lo que tu colega recuerda sobre ti — en el dispositivo, tú lo controlas" },
  "What your buddy remembers about you. Stored only on this phone, sent to the on-device model as context. Edit or clear it anytime.":
    { de: "Was sich dein Buddy über dich merkt. Nur auf diesem Telefon gespeichert und als Kontext an das lokale Modell übergeben. Jederzeit änderbar oder löschbar.",
      es: "Lo que tu colega recuerda sobre ti. Se guarda solo en este teléfono y se envía al modelo local como contexto. Edítalo o bórralo cuando quieras." },
  "Name": { de: "Name", es: "Nombre" },
  "What should it call you?": { de: "Wie soll es dich nennen?", es: "¿Cómo debería llamarte?" },
  "Pronouns": { de: "Pronomen", es: "Pronombres" },
  "e.g. they/them": { de: "z. B. sie/ihr", es: "p. ej. elle" },
  "About you": { de: "Über dich", es: "Sobre ti" },
  "A sentence or two of context": { de: "Ein, zwei Sätze zum Kontext", es: "Una o dos frases de contexto" },
  "Reply preferences": { de: "Antwort-Vorlieben", es: "Preferencias de respuesta" },
  "Tone, length, language notes…": { de: "Ton, Länge, Sprachhinweise…", es: "Tono, longitud, notas de idioma…" },
  "Remembered facts": { de: "Gemerkte Fakten", es: "Datos recordados" },
  "Something to remember…": { de: "Etwas zum Merken…", es: "Algo para recordar…" },
  "Add": { de: "Hinzufügen", es: "Añadir" },
  "No remembered facts yet.": { de: "Noch keine gemerkten Fakten.", es: "Aún no hay datos recordados." },
  "Forget": { de: "Vergessen", es: "Olvidar" },
  "Clear all memory": { de: "Gesamten Speicher löschen", es: "Borrar toda la memoria" },
  "Paste & Ask": { de: "Einfügen & Fragen", es: "Pegar y preguntar" },
  "Drop in text and ask about it": { de: "Text einfügen und dazu fragen", es: "Pega texto y pregunta sobre él" },
  "Fact-check a claim": { de: "Behauptung prüfen", es: "Verificar una afirmación" },
  "Reason through whether it holds up": { de: "Durchdenken, ob sie stimmt", es: "Razonar si se sostiene" },
  "Summarise": { de: "Zusammenfassen", es: "Resumir" },
  "Shorten a note or message": { de: "Notiz oder Nachricht kürzen", es: "Acortar una nota o mensaje" },
  "Explain simply": { de: "Einfach erklären", es: "Explicar simple" },
  "Plain-language explanation": { de: "Erklärung in einfacher Sprache", es: "Explicación en lenguaje sencillo" },
  "Rephrase / draft": { de: "Umformulieren / Entwurf", es: "Reformular / redactar" },
  "Reword or draft some text": { de: "Text umformulieren oder entwerfen", es: "Reformular o redactar texto" },
  "Brainstorm": { de: "Ideen sammeln", es: "Lluvia de ideas" },
  "A few quick ideas": { de: "Ein paar schnelle Ideen", es: "Unas ideas rápidas" },
  "More tools (reminders, recipes, training) are on the roadmap — these are the ones that genuinely work today.":
    { de: "Weitere Werkzeuge (Erinnerungen, Rezepte, Training) sind geplant — diese hier funktionieren schon heute.",
      es: "Más herramientas (recordatorios, recetas, entrenamiento) están en camino — estas ya funcionan hoy." },

  // ---- Dictaphone / Notes ----
  "DICTAPHONE": { de: "DIKTIERGERÄT", es: "DICTÁFONO" },
  "Type a note…": { de: "Notiz tippen…", es: "Escribe una nota…" },
  "Add note": { de: "Notiz hinzufügen", es: "Añadir nota" },
  "No notes yet. Type one above, or tap ● to record a voice note — it's saved and transcribed on your device.":
    { de: "Noch keine Notizen. Tippe oben eine, oder tippe ●, um eine Sprachnotiz aufzunehmen — lokal gespeichert und transkribiert.",
      es: "Aún no hay notas. Escribe una arriba, o toca ● para grabar una nota de voz — se guarda y transcribe en tu dispositivo." },
  "Saving…": { de: "Speichern…", es: "Guardando…" },
  "Transcribing…": { de: "Transkribieren…", es: "Transcribiendo…" },
  "Microphone permission denied.": { de: "Mikrofonzugriff verweigert.", es: "Permiso de micrófono denegado." },
  "No audio captured.": { de: "Kein Ton aufgenommen.", es: "No se captó audio." },
  "(voice note — not transcribed)": { de: "(Sprachnotiz — nicht transkribiert)", es: "(nota de voz — sin transcribir)" },

  // ---- Chat ----
  "Ask me anything": { de: "Frag mich etwas", es: "Pregúntame lo que sea" },
  "Type below or tap the mic. Everything runs on your device — nothing leaves the phone.":
    { de: "Unten tippen oder aufs Mikro. Alles läuft auf deinem Gerät — nichts verlässt das Telefon.",
      es: "Escribe abajo o toca el micro. Todo funciona en tu dispositivo — nada sale del teléfono." },

  // ---- Settings ----
  "Voice": { de: "Stimme", es: "Voz" },
  "Speech rate": { de: "Sprechtempo", es: "Velocidad de voz" },
  "Reduced motion": { de: "Weniger Bewegung", es: "Menos movimiento" },
  "Game sound": { de: "Spielton", es: "Sonido del juego" },
  "Language": { de: "Sprache", es: "Idioma" },
  "On-device model": { de: "Modell auf dem Gerät", es: "Modelo en el dispositivo" },
  "Set up local AI": { de: "Lokale KI einrichten", es: "Configurar IA local" },
  "About": { de: "Über", es: "Acerca de" },
  "SETTINGS": { de: "EINSTELLUNGEN", es: "AJUSTES" },
  "LANGUAGE": { de: "SPRACHE", es: "IDIOMA" },
  "VOICE": { de: "STIMME", es: "VOZ" },
  "GAME & MOTION": { de: "SPIEL & BEWEGUNG", es: "JUEGO Y MOVIMIENTO" },
  "PRIVACY & OFFLINE": { de: "PRIVAT & OFFLINE", es: "PRIVACIDAD Y OFFLINE" },
  "MODEL": { de: "MODELL", es: "MODELO" },
  "App language": { de: "App-Sprache", es: "Idioma de la app" },
  "Assistant persona": { de: "Assistent-Charakter", es: "Personalidad del asistente" },
  "Optional": { de: "Optional", es: "Opcional" },
  "How fast replies are spoken.": { de: "Wie schnell Antworten gesprochen werden.", es: "Qué tan rápido se leen las respuestas." },
  "Calms animations and screen shake across the app.": { de: "Beruhigt Animationen und Bildschirmzittern in der ganzen App.", es: "Calma las animaciones y el temblor de pantalla en toda la app." },
  "Blips and effects during arcade games.": { de: "Töne und Effekte in den Arcade-Spielen.", es: "Pitidos y efectos en los juegos arcade." },

  // ---- Chat (composer / status / starters / header) ----
  "On-device assistant · offline": { de: "Assistent auf dem Gerät · offline", es: "Asistente en el dispositivo · sin conexión" },
  "Listening…": { de: "Höre zu…", es: "Escuchando…" },
  "Thinking…": { de: "Denke nach…", es: "Pensando…" },
  "Working…": { de: "Arbeite…", es: "Trabajando…" },
  "Speaking…": { de: "Spreche…", es: "Hablando…" },
  "Ready": { de: "Bereit", es: "Listo" },
  "Ask or tap the mic…": { de: "Fragen oder aufs Mikro tippen…", es: "Pregunta o toca el micro…" },
  "Send": { de: "Senden", es: "Enviar" },
  "What can you do?": { de: "Was kannst du?", es: "¿Qué sabes hacer?" },
  "Sanity-check a note": { de: "Notiz gegenprüfen", es: "Revisar una nota" },
  "Double-check a claim": { de: "Behauptung prüfen", es: "Comprobar una afirmación" },
  "The local AI model is not installed yet. Open Settings and choose Set up local AI to import or download it. The games are still available.":
    { de: "Das lokale KI-Modell ist noch nicht installiert. Öffne die Einstellungen und wähle „Lokale KI einrichten“, um es zu importieren oder zu laden. Die Spiele sind trotzdem verfügbar.",
      es: "El modelo de IA local aún no está instalado. Abre Ajustes y elige «Configurar IA local» para importarlo o descargarlo. Los juegos siguen disponibles." },

  // ---- Onboarding / setup ----
  "A pocket AI buddy that runs entirely on your phone.":
    { de: "Ein KI-Kumpel für die Tasche, der komplett auf deinem Telefon läuft.", es: "Un colega de IA de bolsillo que funciona enteramente en tu teléfono." },
  "Works fully offline": { de: "Komplett offline", es: "Funciona sin conexión" },
  "No account, no internet needed at runtime. The model lives on your device.":
    { de: "Kein Konto, kein Internet im Betrieb. Das Modell liegt auf deinem Gerät.", es: "Sin cuenta ni internet en uso. El modelo vive en tu dispositivo." },
  "Chat, tools & arcade": { de: "Chat, Werkzeuge & Arcade", es: "Chat, herramientas y arcade" },
  "Ask it things, fact-check a note, or play the built-in retro games.":
    { de: "Stell Fragen, prüfe eine Notiz oder spiele die Retro-Spiele.", es: "Pregúntale cosas, verifica una nota o juega a los retro." },
  "It pushes back on bad info": { de: "Es widerspricht falschen Infos", es: "Cuestiona la info falsa" },
  "On a specific false-fact test it followed a planted lie far less often — down from 97% to 23% (and it held when the lie was reworded). That's one test, not a general accuracy promise.":
    { de: "In einem bestimmten Falschfakten-Test folgte es einer untergeschobenen Lüge viel seltener — von 97 % auf 23 % (und es hielt, als die Lüge umformuliert wurde). Das ist ein Test, kein allgemeines Genauigkeitsversprechen.",
      es: "En una prueba concreta de hechos falsos siguió una mentira plantada mucho menos — del 97 % al 23 % (y se mantuvo al reformular la mentira). Es una prueba, no una promesa general de exactitud." },
  "I understand — continue": { de: "Verstanden — weiter", es: "Entendido — continuar" },
  "CHOOSE A START": { de: "WÄHLE EINEN START", es: "ELIGE UN INICIO" },
  "Add the on-device AI once (~1 GB) — or jump straight into the games and add it later.":
    { de: "Füge die KI einmal hinzu (~1 GB) — oder spring direkt in die Spiele und hol sie später.", es: "Añade la IA una vez (~1 GB) — o entra directo a los juegos y añádela luego." },
  "Import model file": { de: "Modelldatei importieren", es: "Importar archivo del modelo" },
  "Pick the qwen…q4_k_m.gguf shared to your phone.": { de: "Wähle die geteilte qwen…q4_k_m.gguf auf deinem Telefon.", es: "Elige el qwen…q4_k_m.gguf compartido en tu teléfono." },
  "Download over Wi-Fi": { de: "Über WLAN laden", es: "Descargar por Wi-Fi" },
  "About 1 GB, once — then fully offline forever.": { de: "Etwa 1 GB, einmal — danach für immer offline.", es: "Unos 1 GB, una vez — luego siempre sin conexión." },
  "Continue without AI": { de: "Ohne KI fortfahren", es: "Continuar sin IA" },
  "Play games & tools now; add the AI later in Settings.": { de: "Spiele & Werkzeuge jetzt; KI später in den Einstellungen.", es: "Juegos y herramientas ya; añade la IA luego en Ajustes." },
  "Getting ready": { de: "Wird vorbereitet", es: "Preparando" },
  "Downloading the on-device model…": { de: "Modell wird heruntergeladen…", es: "Descargando el modelo…" },
  "Over Wi-Fi, once. Keep the app open.": { de: "Über WLAN, einmal. App geöffnet lassen.", es: "Por Wi-Fi, una vez. Mantén la app abierta." },
  "Loading model…": { de: "Modell wird geladen…", es: "Cargando el modelo…" },
  "Something went wrong": { de: "Etwas ist schiefgelaufen", es: "Algo salió mal" },
  "Retry": { de: "Erneut versuchen", es: "Reintentar" },

  // ---- home hero ----
  "Ready when you are.": { de: "Bereit, wenn du es bist.", es: "Listo cuando quieras." },
  "On-device · private · fully offline": { de: "Auf dem Gerät · privat · komplett offline", es: "En el dispositivo · privado · sin conexión" },
  "NOTES": { de: "NOTIZEN", es: "NOTAS" },
  "I am online and ready.": { de: "Ich bin online und bereit.", es: "Estoy en línea y listo." },
};

// Translate an English source string to the current language (English fallback).
export function L(s: string): string {
  const l = lang();
  if (l === "en") return s;
  const e = TR[s];
  return e ? e[l] ?? s : s;
}

// Hook: subscribe to language changes so the component re-renders on swap.
export function useLang(): AppLang {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  return lang();
}
