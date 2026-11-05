import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";

type JoinCardProps = {
  title: string;
  text: string;
  signupLabel: string;
  loginLabel: string;
  className?: string;
};

/** Invitación a crear una cuenta para interactuar (comentar, dar me gusta, seguir y publicar). */
export function JoinCard({ title, text, signupLabel, loginLabel, className }: JoinCardProps) {
  return (
    <div className={`rounded-[28px] bg-nav-border p-px shadow-[0_0_30px_rgb(139_92_255/0.3)] ${className ?? ""}`}>
      <div className="flex h-full flex-col gap-4 rounded-[27px] bg-panel p-6 sm:p-8">
        <h3 className="font-display text-2xl leading-tight font-bold">{title}</h3>
        <p className="text-text-2">{text}</p>
        <div className="mt-auto flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signup">{signupLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">{loginLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
