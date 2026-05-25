interface StatCardProps {
  label: string;
  value: number | string;
  accent?: "default" | "score" | "danger" | "success";
}

const accentStyles = {
  default: "text-slate-900",
  score: "text-teal-700",
  danger: "text-red-700",
  success: "text-blue-700",
};

/** Stat tile for in-game HUD — large labels for readability. */
export function StatCard({ label, value, accent = "default" }: StatCardProps) {
  return (
    <div className="surface-stat min-h-[4.6rem] text-center">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${accentStyles[accent]}`}
      >
        {value}
      </p>
    </div>
  );
}
