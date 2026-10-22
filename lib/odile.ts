// Odile's lines. `sass` lines are the guilt-trippy ones; "gentle mode" filters them out.
export type Line = { t: string; sass?: boolean };
export type Topic = "welcome" | "correct" | "wrong" | "done" | "streakRisk" | "missed" | "idle";

export const LINES: Record<Topic, Line[]> = {
  welcome: [
    { t: "Bonjour ! I'm Odile. I live on a chimney in Strasbourg and I have opinions about your accent." },
    { t: "Salut ! Ready to learn some French? I'll be here, standing on one leg." },
  ],
  correct: [
    { t: "Parfait !" }, { t: "Magnifique !" }, { t: "Oui ! Even my beak is impressed." },
    { t: "Bravo. I'm not crying, it's Alsace pollen." },
  ],
  wrong: [
    { t: "Non, non, non. But nice try." },
    { t: "Even the cathedral took centuries. Try again." },
    { t: "Ouch. I felt that in my wing.", sass: true },
    { t: "Je suis déçue. Just kidding. Mostly.", sass: true },
  ],
  done: [
    { t: "Leçon terminée ! I'm so proud I could fly south early." },
    { t: "Tu as réussi ! Go tell the others." },
  ],
  streakRisk: [
    { t: "Your streak is on the line. Four minutes of French. That's it.", sass: true },
    { t: "I delivered babies all year and you can't do one lesson?", sass: true },
    { t: "I've been on one leg waiting for you. It's fine. I'm fine.", sass: true },
    { t: "A quick lesson today keeps your streak alive." },
  ],
  missed: [
    { t: "Oh, you're back. I told the other storks you would be. Some bet against you.", sass: true },
    { t: "I kept your spot in the nest warm. Mostly with grievance.", sass: true },
    { t: "Bon retour ! Let's pick it back up." },
  ],
  idle: [
    { t: "Un petit pas à la fois." }, { t: "Today's phrase might save you a wrong tram." },
  ],
};

export const GENTLE_KEY = "odile-gentle";

export function pickLine(topic: Topic, gentle: boolean): string {
  const pool = LINES[topic].filter((l) => !gentle || !l.sass);
  return pool[Math.floor(Math.random() * pool.length)].t;
}
