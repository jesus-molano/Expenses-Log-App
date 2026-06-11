import type { TimelineSection } from "../../lib/timeline";
import { timelineDotToneClass } from "../../lib/expense-visual-state";

type TimelineSectionRailProps = {
  tone: TimelineSection["tone"];
  activeToday: boolean;
};

export function TimelineSectionRail({ tone, activeToday }: TimelineSectionRailProps) {
  const dotToneClass = timelineDotToneClass(tone);

  return (
    <>
      <span
        className={`app-timeline-dot absolute left-0 top-1.5 size-2 rounded-full shadow-[0_0_14px_currentColor] ring-2 ${dotToneClass}`}
      />
      <span className="absolute bottom-[-1.25rem] left-[3px] top-5 w-px bg-white/12" />
      {activeToday ? (
        <div className="app-today-line absolute -left-2 -top-2 bottom-[-1.25rem] w-[3px] rounded-full" />
      ) : null}
    </>
  );
}
