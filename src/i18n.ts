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
