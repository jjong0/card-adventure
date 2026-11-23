// 타이틀 (spec §8 화면 1): 세이브 슬롯 3개, 새 게임, 세이브 파일 불러오기·내보내기
import { useRef, useState } from 'react';
import { LOAD_ERROR_TEXT, summarize } from '../../core/save';
import type { SaveData } from '../../core/types';
import { deleteSlot, downloadSave, listSlots, readSaveFile, writeSlot, type SlotState } from '../../store/saveRepository';

const DIFF_COLOR: Record<string, string> = { 쉬움: '#5CC98B', 보통: '#4FA3F7', 어려움: '#F2795A', 익스트림: '#B27CF2' };

interface Props {
  onContinue: (slot: number, save: SaveData) => void;
  onNewGame: (slot: number) => void;
}

export function TitleScreen({ onContinue, onNewGame }: Props) {
  const [, refresh] = useState(0);
  const slots = listSlots();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [imported, setImported] = useState<SaveData | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reload = () => refresh((n) => n + 1);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const r = await readSaveFile(file);
    if (typeof r === 'string') return setNotice(LOAD_ERROR_TEXT[r]);
    setImported(r);
    setNotice('불러온 세이브를 넣을 슬롯을 고르세요.');
  };

  const placeImport = (s: SlotState) => {
    if (!imported) return;
    if (s.kind !== 'empty' && confirmOverwrite !== s.slot) return setConfirmOverwrite(s.slot);
    setNotice(writeSlot(s.slot, imported) ? `슬롯 ${s.slot}에 불러왔다.` : '저장하지 못했다. 브라우저 저장소가 막혀 있거나 가득 찼다.');
    setImported(null);
    setConfirmOverwrite(null);
    reload();
  };

  const btn = 'rounded-lg px-3 py-1.5 font-pixel text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-10">
      <div className="text-center">
        <h1 className="font-title text-[72px] leading-none text-accent">카드 어드벤처</h1>
        <p className="mt-2 font-pixel text-[15px] text-text-dim">카드팩으로 포켓몬을 모아 성도와 관동의 관장 22명에게 도전한다</p>
      </div>

      <ul className="grid w-full max-w-[1080px] grid-cols-3 gap-4">
        {slots.map((s) => {
          const sum = s.kind === 'save' ? summarize(s.save) : null;
          const target = imported !== null;
          return (
            <li key={s.slot} className={`flex h-[230px] flex-col rounded-2xl border bg-surface p-4 font-pixel ${target ? 'border-accent' : 'border-line'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-dim">슬롯 {s.slot}</span>
                {sum && (
                  <span className="rounded px-2 py-0.5 text-[12px] font-bold text-bg" style={{ backgroundColor: DIFF_COLOR[sum.difficulty] }}>
                    {sum.difficulty}
                  </span>
                )}
              </div>

              {s.kind === 'save' && sum && (
                <>
                  <p className="mt-2 font-title text-[28px] leading-tight">{sum.chapter}장</p>
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
                    <dt className="text-text-dim">배지</dt><dd>{sum.badges}개</dd>
                    <dt className="text-text-dim">보관함</dt><dd>{sum.lines}계열</dd>
                    <dt className="text-text-dim">플레이</dt><dd>{sum.playTime}</dd>
                  </dl>
                  <p className="mt-1 truncate text-[11px] text-text-dim">
                    {sum.challenges.length ? `${sum.challenges.join(' · ')} · ` : ''}
                    {new Date(sum.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 저장
                  </p>
                </>
              )}
              {s.kind === 'empty' && <p className="mt-auto pb-8 text-center text-[14px] text-text-dim">비어 있다</p>}
              {s.kind === 'error' && <p className="mt-auto pb-6 text-center text-[13px] text-[#F2795A]">{LOAD_ERROR_TEXT[s.error]}</p>}

              <div className="mt-auto flex gap-1.5 pt-2">
                {target ? (
                  <button type="button" onClick={() => placeImport(s)} className={`${btn} flex-1 bg-accent font-bold text-bg`}>
                    {confirmOverwrite === s.slot ? '덮어쓴다' : s.kind === 'empty' ? '여기에 넣기' : '덮어쓰기'}
                  </button>
                ) : s.kind === 'save' ? (
                  <>
                    <button type="button" onClick={() => onContinue(s.slot, s.save)} className={`${btn} flex-1 bg-accent font-bold text-bg`}>이어하기</button>
                    <button type="button" onClick={() => downloadSave(s.slot, s.save)} className={`${btn} bg-surface-2 ring-1 ring-line hover:ring-accent`} title="세이브 파일로 내려받기">내보내기</button>
                  </>
                ) : (
                  <button type="button" onClick={() => onNewGame(s.slot)} className={`${btn} flex-1 bg-accent font-bold text-bg`}>새 게임</button>
                )}
                {!target && s.kind !== 'empty' && (
                  confirmDelete === s.slot ? (
                    <button type="button" onClick={() => { deleteSlot(s.slot); setConfirmDelete(null); reload(); }} className={`${btn} bg-[#F2795A] font-bold text-bg`}>정말 지운다</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(s.slot)} className={`${btn} text-text-dim ring-1 ring-line hover:text-text`}>지우기</button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 font-pixel">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        {imported ? (
          <button type="button" onClick={() => { setImported(null); setConfirmOverwrite(null); setNotice(null); }} className={`${btn} text-text-dim ring-1 ring-line hover:text-text`}>불러오기 취소</button>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} bg-surface ring-1 ring-line hover:ring-accent`}>세이브 파일 불러오기</button>
        )}
        <p className="min-h-5 text-[13px] text-accent" role="status">{notice ?? ''}</p>
      </div>

      <p className="max-w-[760px] text-center font-pixel text-[12px] leading-5 text-text-dim">
        세이브는 이 브라우저에만 저장된다. 브라우저 데이터를 지우거나 오래 방문하지 않으면(Safari) 사라질 수 있으니 가끔 내보내 두자.
      </p>
    </div>
  );
}
