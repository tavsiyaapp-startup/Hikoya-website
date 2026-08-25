import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getBoardRequests, getRequestById, getRequestResponses } from "@/lib/queries/requests";
import { getAuthorStories } from "@/lib/queries/stories";
import { requestStatusTone, requestStatusLabel } from "@/lib/requestStatus";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CloseRequestButton } from "@/components/board/CloseRequestButton";
import { createRequest, respondToRequest } from "@/lib/actions/requests";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; selected?: string; new?: string }>;
}) {
  const { status, selected, new: showNew } = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const [requests, selectedRequest] = await Promise.all([
    getBoardRequests(status),
    selected ? getRequestById(selected) : Promise.resolve(null),
  ]);
  const responses = selectedRequest ? await getRequestResponses(selectedRequest.id) : [];
  const myStories = selectedRequest && user ? await getAuthorStories(user.id, true) : [];

  return (
    <div>
      <div className="mb-6.5 flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
        <div className="flex-1">
          <h1 className="mb-2 text-[26px] font-extrabold tracking-tight sm:text-[32px]">{t.board.title}</h1>
          <p className="max-w-160 text-[15px] leading-relaxed text-muted">{t.board.body}</p>
        </div>
        <Link href={user ? "?new=1" : ROUTES.onboarding} className="w-full shrink-0 sm:w-auto">
          <Button size="lg" className="w-full justify-center sm:w-auto">{t.board.leaveRequest}</Button>
        </Link>
      </div>

      <div className="mb-6 flex gap-2.5 overflow-x-auto">
        {[
          [undefined, t.common.all],
          ["open", requestStatusLabel(t, "open")],
          ["in_progress", requestStatusLabel(t, "in_progress")],
          ["closed", requestStatusLabel(t, "closed")],
        ].map(([value, label]) => (
          <Link key={label} href={value ? `?status=${value}` : "?"} className="shrink-0">
            <Chip active={status === value || (!status && !value)}>{label}</Chip>
          </Link>
        ))}
      </div>

      {showNew && user && (
        <form action={createRequest} className="mb-6.5 rounded-3xl border border-border bg-card p-4.5 sm:p-6.5">
          <Input name="title" placeholder={t.board.newRequestTitlePlaceholder} required className="mb-3.5" />
          <Textarea name="text" placeholder={t.board.newRequestTextPlaceholder} rows={3} required className="mb-3.5" />
          <Button type="submit">{t.board.leaveRequest}</Button>
        </form>
      )}

      <div className="flex flex-col items-start gap-5.5 lg:flex-row">
        <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-4">
          {requests.length > 0 ? (
            requests.map((r) => {
              const from = r.from_user as unknown as { display_name: string } | null;
              const responseCount = (r.responses as unknown as unknown[] | null)?.length ?? 0;
              return (
                <Link
                  key={r.id}
                  href={`?selected=${r.id}${status ? `&status=${status}` : ""}`}
                  className={`rounded-[20px] border bg-card p-5.5 ${
                    selected === r.id ? "border-primary-400" : "border-border hover:border-primary-200"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <Avatar name={from?.display_name ?? "?"} size={32} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold">{from?.display_name}</div>
                      <div className="text-[12.5px] text-muted-3">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </div>
                    </div>
                    <Badge tone={requestStatusTone(r.status)} className="ml-auto">
                      {requestStatusLabel(t, r.status)}
                    </Badge>
                  </div>
                  <h3 className="mb-2 text-[17px] font-extrabold leading-snug">{r.title}</h3>
                  <p className="mb-3.5 line-clamp-2 text-[14.5px] leading-relaxed text-ink-soft">{r.text}</p>
                  <span className="text-[13px] text-muted-2">{responseCount} {t.board.responsesCountSuffix}</span>
                </Link>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
              {t.board.noRequestsYet}
            </div>
          )}
        </div>

        {selectedRequest && (
          <div className="w-full shrink-0 overflow-hidden rounded-[22px] border border-border bg-card lg:sticky lg:top-26 lg:w-100">
            <div className="border-b border-border-soft px-6 py-5.5">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-muted-2">
                  {t.board.requestLabel}
                </span>
                <Badge tone={requestStatusTone(selectedRequest.status)}>
                  {requestStatusLabel(t, selectedRequest.status)}
                </Badge>
                {user?.id === selectedRequest.from_user_id && selectedRequest.status !== "closed" && (
                  <CloseRequestButton requestId={selectedRequest.id} />
                )}
              </div>
              <h3 className="mb-1.5 text-[18px] font-extrabold leading-snug">{selectedRequest.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-soft">{selectedRequest.text}</p>
            </div>

            <div className="px-6 py-5.5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-muted-2">
                  {t.board.responsesTitle}
                </span>
                <span className="ml-auto text-[12.5px] text-muted-2">{responses.length}</span>
              </div>

              {selectedRequest.status === "closed" ? (
                <p className="mb-5 text-[13.5px] text-muted-2">{t.board.requestClosedNotice}</p>
              ) : user ? (
                <form
                  action={respondToRequest.bind(null, selectedRequest.id)}
                  className="mb-5 flex flex-col gap-2.5"
                >
                  <Textarea name="text" placeholder={t.board.responseTextPlaceholder} rows={3} required />
                  {myStories.length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-bold text-muted-2">
                        {t.board.attachStoryLabel}
                      </label>
                      <select
                        name="storyId"
                        defaultValue=""
                        className="h-10 w-full rounded-[10px] border border-border bg-white px-2.5 text-[13.5px] outline-none"
                      >
                        <option value="">{t.board.attachStoryNone}</option>
                        {myStories.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Button type="submit" size="sm">
                    {t.board.respond}
                  </Button>
                </form>
              ) : (
                <Link href={ROUTES.onboarding} className="mb-5 block">
                  <Button size="sm" className="w-full justify-center">
                    {t.common.login}
                  </Button>
                </Link>
              )}

              <div className="flex flex-col gap-4">
                {responses.map((r) => {
                  const author = r.author as unknown as { display_name: string } | null;
                  const linkedStory = r.story as unknown as { slug: string; title: string } | null;
                  return (
                    <div key={r.id}>
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <Avatar name={author?.display_name ?? "?"} size={30} />
                        <span className="text-[13.5px] font-bold">{author?.display_name}</span>
                      </div>
                      <p className="text-[13.5px] leading-relaxed text-ink-soft">{r.text}</p>
                      {linkedStory && (
                        <Link
                          href={ROUTES.story(linkedStory.slug)}
                          className="mt-1.5 inline-block text-[12.5px] font-bold text-primary-800"
                        >
                          {t.board.viewLinkedStory}: {linkedStory.title}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
