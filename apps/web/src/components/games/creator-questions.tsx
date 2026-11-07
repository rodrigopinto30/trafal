import { CommentForm } from "@/components/games/comment-form";
import { CommentList, type CommentViewer } from "@/components/games/comment-list";
import { getTranslations } from "@/i18n/server";
import type { CommentThread } from "@/lib/games/comments";
import type { QuestionSummary } from "@/lib/games/types";

type Props = {
  questions: QuestionSummary[];
  answers: CommentThread[];
  creatorName: string;
  now: Date;
  viewer: CommentViewer;
};

/**
 * The questions the creator wants people to answer, each with its answers (and the replies to them) and, for everyone but the
 * creator, a form to answer it once. Answers are comments on the game, so they can be edited, deleted, replied to and marked
 * «Me sirvió» like any other.
 */
export async function CreatorQuestions({ questions, answers, creatorName, now, viewer }: Props) {
  const t = await getTranslations("games");
  if (questions.length === 0) return null;

  return (
    <section aria-labelledby="creator-questions">
      <h2 id="creator-questions" className="font-display text-2xl font-bold">
        {t("questionsTitle")}
      </h2>
      <p className="mt-2 text-text-2">{viewer.isTargetOwner ? t("ownQuestions") : t("questionsHint", { name: creatorName })}</p>
      <ol className="mt-4 grid gap-6">
        {questions.map((question) => {
          const threads = answers.filter((thread) => thread.comment.question_id === question.id);
          const iAnswered = viewer.userId !== undefined && threads.some((thread) => thread.comment.author_id === viewer.userId);
          return (
            <li key={question.id} className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
              <h3 className="font-display text-lg font-bold">{question.question}</h3>
              <p className="mt-1 text-sm text-text-3">{t("answersCount", { count: threads.length })}</p>
              <div className="mt-4 grid gap-4">
                {threads.length > 0 ? <CommentList threads={threads} now={now} viewer={viewer} /> : null}
                {viewer.isTargetOwner ? null : iAnswered ? (
                  <p className="text-sm text-text-2">{t("alreadyAnswered")}</p>
                ) : (
                  <CommentForm target="game" id={viewer.targetId} questionId={question.id} signedIn={viewer.signedIn} loginHref={viewer.loginHref} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
