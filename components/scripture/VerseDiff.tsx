export default function VerseDiff({ marks }: { marks: { word: string; ok: boolean }[] }) {
  return (
    <p className="verse-text">
      {marks.map((m, i) => (
        <span key={i} className={m.ok ? "" : "rounded bg-tint px-0.5 font-bold text-primary underline decoration-wavy"}>{m.word} </span>
      ))}
    </p>
  );
}
