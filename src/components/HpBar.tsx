// HP 바: 남은 비율에 따라 초록 → 노랑 → 주황, 줄어들 때 부드럽게
interface Props {
  hp: number;
  max: number;
  className?: string;
}

export function hpColor(ratio: number) {
  if (ratio > 0.5) return '#5CC98B';
  if (ratio > 0.2) return '#F2C14E';
  return '#F2795A';
}

export function HpBar({ hp, max, className = '' }: Props) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ${className}`}
      role="meter"
      aria-label="HP"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hp}
    >
      <div
        className="h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${ratio * 100}%`, backgroundColor: hpColor(ratio) }}
      />
    </div>
  );
}
