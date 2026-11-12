"use client";

import { MaximizeIcon, MinimizeIcon, PlayIcon, RotateCcwIcon, Volume2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GameCover } from "@/components/games/game-cover";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { classifyDevice } from "@/lib/games/device";
import type { GameDetail } from "@/lib/games/types";
import { loadBrowserClient } from "@/lib/supabase/load-client";

const HEARTBEAT_MS = 30_000;
const FRAME_SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock allow-modals";
const FRAME_PERMISSIONS = "fullscreen; autoplay; gamepad; accelerometer; gyroscope";

/** Sends a Supabase call and ignores the outcome (statistics must never get in the way of playing). Calls are lazy: nothing is sent until the builder is awaited. */
function fireAndForget(call: PromiseLike<unknown>): void {
  void Promise.resolve(call).then(
    () => undefined,
    () => undefined,
  );
}

type Props = {
  game: Pick<GameDetail, "id" | "public_id" | "title" | "genre_id" | "cover_path">;
  /** Where the game is served from, or null if it cannot be played (no games domain configured, or the game needs isolation). */
  frameUrl: string | null;
  needsIsolation: boolean;
  signedIn: boolean;
};

/**
 * The player: the game's cover with a play button and, once started, the game inside an isolated frame. The frame points to
 * the games domain (a different site from Trafal) and is sandboxed without top navigation, popups, forms or downloads, so
 * a game cannot touch the visitor's session or leave the frame. Counts the play and keeps a heartbeat while the tab is visible.
 */
export function GamePlayer({ game, frameUrl, needsIsolation, signedIn }: Props) {
  const t = useTranslations("gamePlayer");
  const frameBox = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const sessionId = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const immersive = fullscreen || overlay;

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || !sessionId.current) return;
      const session = sessionId.current;
      fireAndForget(loadBrowserClient().then((supabase) => supabase.rpc("play_heartbeat", { p_public_id: game.public_id, p_session_id: session })));
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [playing, game.public_id]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlay(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  function start() {
    sessionId.current = crypto.randomUUID();
    setLoaded(false);
    setPlaying(true);
    const device = classifyDevice({ innerWidth: window.innerWidth, coarsePointer: window.matchMedia("(pointer: coarse)").matches });
    const session = sessionId.current;
    fireAndForget(loadBrowserClient().then((supabase) => supabase.rpc("start_play", { p_public_id: game.public_id, p_session_id: session, p_device: device })));
  }

  function restart() {
    setLoaded(false);
    setAttempt((current) => current + 1);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (overlay) {
      setOverlay(false);
      return;
    }
    const box = frameBox.current;
    if (document.fullscreenEnabled && box) {
      try {
        await box.requestFullscreen();
        return;
      } catch {
        setOverlay(true);
        return;
      }
    }
    setOverlay(true);
  }

  const playable = frameUrl !== null && !needsIsolation;

  return (
    <div className="grid gap-3">
      <div
        ref={frameBox}
        className={
          overlay
            ? "fixed inset-0 z-50 bg-black"
            : "relative mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-[0_0_40px_rgb(139_92_255/0.2)]"
        }
        style={overlay || fullscreen ? undefined : { aspectRatio: "16 / 9", width: "min(100%, calc(72vh * 16 / 9))" }}
      >
        {playing && playable ? (
          <>
            <iframe
              key={attempt}
              ref={frame}
              src={frameUrl}
              title={t("frameTitle", { title: game.title })}
              sandbox={FRAME_SANDBOX}
              allow={FRAME_PERMISSIONS}
              referrerPolicy="no-referrer"
              onLoad={() => {
                setLoaded(true);
                frame.current?.focus();
              }}
              className={immersive ? "size-full border-0 bg-black" : "absolute inset-0 size-full border-0 bg-black"}
            />
            {!loaded ? (
              <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-black/70 text-white">
                {t("loading")}
              </p>
            ) : null}
            {immersive ? (
              <Button type="button" variant="secondary" className="absolute top-3 right-3 opacity-80 hover:opacity-100" onClick={toggleFullscreen}>
                <XIcon aria-hidden="true" />
                {t("exitFullscreen")}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <GameCover game={game} className="absolute inset-0" />
            <div className="absolute inset-0 grid place-items-center bg-black/55 p-5 text-center">
              <div className="grid max-w-[420px] justify-items-center gap-3">
                {playable ? (
                  <>
                    <Button type="button" variant="play" size="xl" onClick={start}>
                      <PlayIcon aria-hidden="true" />
                      {t("play")}
                    </Button>
                    <p className="flex items-center gap-2 text-sm text-white/85">
                      <Volume2Icon aria-hidden="true" className="size-4 shrink-0" />
                      {t("soundNotice")}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{t(needsIsolation ? "isolationTitle" : "unavailableTitle")}</h2>
                    <p className="text-sm text-white/85 sm:text-base">{t(needsIsolation ? "isolationText" : "unavailableText")}</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2">
        {playing && playable ? (
          <>
            <Button type="button" variant="outline" onClick={toggleFullscreen} aria-pressed={immersive}>
              {immersive ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
              {immersive ? t("exitFullscreen") : t("fullscreen")}
            </Button>
            <Button type="button" variant="outline" onClick={restart}>
              <RotateCcwIcon aria-hidden="true" />
              {t("restart")}
            </Button>
          </>
        ) : null}
        <ReportDialog targetType="game" targetId={game.id} signedIn={signedIn} loginHref={`/login?next=${encodeURIComponent(`/games/${game.public_id}`)}`} />
      </div>
    </div>
  );
}
