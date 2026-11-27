"use client";

import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
import { container } from "@/lib/layout";

export default function DiscoverLoading() {
  const t = messages(String(useParams().locale));
  return (
    <main aria-busy="true" aria-label={t.loading}>
      <span className="sr-only" role="status">
        {t.loading}
      </span>
      <div className={container} aria-hidden="true">
        <div className="flex h-[62px] items-center gap-[26px] mobile:my-2 mobile:mb-5 mobile:h-[38px] mobile:gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-5 w-20 rounded bg-secondary mobile:flex-1"
            />
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex min-h-[480px] items-end bg-secondary mobile:mx-4 mobile:min-h-[410px] mobile:rounded-[13px]"
      >
        <div className={`${container} space-y-3 pb-12 mobile:p-6`}>
          <div className="h-10 w-3/5 max-w-md rounded bg-muted mobile:h-8" />
          <div className="h-4 w-4/5 max-w-xl rounded bg-muted" />
          <div className="h-4 w-3/5 max-w-sm rounded bg-muted" />
        </div>
      </div>
      <div className={container} aria-hidden="true">
        <div className="my-11 mobile:my-[29px]">
          <div className="mb-[18px] h-[30px] w-48 rounded bg-secondary" />
          <div className="flex gap-[18px] overflow-hidden mobile:gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="min-w-0 shrink-0 basis-[calc((100%-90px)/6)] mobile:basis-[145px]"
              >
                <div className="aspect-[2/3] rounded-[5px] bg-secondary" />
                <div className="mt-[11px] h-4 w-4/5 rounded bg-secondary" />
                <div className="mt-[5px] h-3 w-1/2 rounded bg-secondary" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
