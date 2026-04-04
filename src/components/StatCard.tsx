"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    iconBg: "bg-indigo-100",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-700",
    iconBg: "bg-green-100",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    iconBg: "bg-red-100",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    iconBg: "bg-purple-100",
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: StatCardProps) {
  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className={`rounded-xl ${colors.bg} p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-3xl font-bold ${colors.text}`}>{value}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg ${colors.iconBg} p-2.5 ${colors.text}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
