// 메시지 상자: 재생 중이면 클릭으로 다음 메시지, 기술에 커서를 올리면 기술 정보
interface Props {
  text: string | null;
  detail?: string | null;
  busy: boolean;
  onNext: () => void;
  onSkip: () => void;
}

export function MessageBox({ text, detail, busy, onNext, onSkip }: Props) {
  return (
    <div className="relative h-full rounded-xl border-2 border-line bg-surface-2 px-7 py-5">
      <button
        type="button"
        onClick={onNext}
        disabled={!busy}
        className={`block h-full w-full cursor-default whitespace-pre-line text-left font-pixel enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${detail ? 'text-[18px] leading-[1.7] text-text-dim' : 'text-[24px] leading-[1.6]'}`}
        aria-live="polite"
      >
        {detail ?? text ?? ''}
      </button>
      {busy && (
        <>
          <span className="pointer-events-none absolute bottom-4 right-6 animate-bounce font-pixel text-accent motion-reduce:animate-none">▼</span>
          <button
            type="button"
            onClick={onSkip}
            className="absolute right-4 top-3 rounded px-2 py-0.5 font-pixel text-[13px] text-text-dim hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            건너뛰기 ≫
          </button>
        </>
      )}
    </div>
  );
}
