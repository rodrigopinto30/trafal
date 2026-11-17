"use client";

import { MaximizeIcon, MinimizeIcon, PlayIcon, RotateCcwIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameCover } from "@/components/games/game-cover";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { classifyDevice } from "@/lib/games/device";
import { PLAYER_WIDTH } from "@/lib/games/player-size";
import { helloMessage, isBridgeReady, lockGameKeys, muteMessage, readMutedPreference, saveMutedPreference, unlockGameKeys } from "@/lib/games/frame-bridge";
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
  /** The owner looking at their own draft: it cannot be played until it is published. */
  draft?: boolean;
};

function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The player: the game's cover with a play button and, once started, the game inside an isolated frame with the platform's own
 * control bar under it (restart, sound, fullscreen), the same for every game. The frame points to the games domain (a different site
 * from Trafal) and is sandboxed without top navigation, popups, forms or downloads, so a game cannot touch the visitor's session or
 * leave the frame. Sound is muted through the bridge the gateway adds to the game's page (see apps/gateway/src/bridge.ts); in
 * fullscreen the game also gets the keys the browser would keep for itself, Escape included: fullscreen (or the maximized view
 * used where there is none) is left with the same button that entered it. Counts the play and keeps a heartbeat while the tab is visible.
 */
export function GamePlayer({ game, frameUrl, needsIsolation, signedIn, draft = false }: Props) {
  const t = useTranslations("gamePlayer");
  const frameBox = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const sessionId = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [muted, setMuted] = useState(() => readMutedPreference());
  const [bridgeReady, setBridgeReady] = useState(false);
  const immersive = fullscreen || overlay;
  const frameOrigin = originOf(frameUrl);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  /** Gives the keyboard back to the game after a click on the player's own buttons (otherwise the keys would go nowhere until the next click inside the game). */
  const focusGame = useCallback(() => {
    const element = frame.current;
    if (!element) return;
    element.focus();
    try {
      element.contentWindow?.focus();
    } catch {
      // A frame that is being replaced may refuse; the next click inside it focuses it anyway.
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const element = document.fullscreenElement;
      setFullscreen(Boolean(element));
      if (element && element === frameBox.current) {
        void lockGameKeys();
        focusGame();
      } else {
        unlockGameKeys();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      unlockGameKeys();
    };
  }, [focusGame]);

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
    if (!playing || !frameOrigin) return;
    const onMessage = (event: MessageEvent) => {
      const target = frame.current?.contentWindow;
      if (event.origin !== frameOrigin || !target || event.source !== target || !isBridgeReady(event.data)) return;
      setBridgeReady(true);
      target.postMessage(muteMessage(mutedRef.current), frameOrigin);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing, frameOrigin]);

  function start() {
    sessionId.current = crypto.randomUUID();
    setLoaded(false);
    setBridgeReady(false);
    setPlaying(true);
    const device = classifyDevice({ innerWidth: window.innerWidth, coarsePointer: window.matchMedia("(pointer: coarse)").matches });
    const session = sessionId.current;
    fireAndForget(loadBrowserClient().then((supabase) => supabase.rpc("start_play", { p_public_id: game.public_id, p_session_id: session, p_device: device })));
    requestAnimationFrame(() => frameBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function restart() {
    setLoaded(false);
    setBridgeReady(false);
    setAttempt((current) => current + 1);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    saveMutedPreference(next);
    if (frameOrigin) frame.current?.contentWindow?.postMessage(muteMessage(next), frameOrigin);
    focusGame();
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      focusGame();
      return;
    }
    if (overlay) {
      setOverlay(false);
      focusGame();
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
  const shellClass = overlay
    ? "fixed inset-0 z-50 flex flex-col bg-black"
    : fullscreen
      ? "flex size-full flex-col bg-black"
      : "relative mx-auto overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_0_40px_rgb(139_92_255/0.2)]";

  return (
    <div className="grid gap-3">
      <div ref={frameBox} className={shellClass} style={immersive ? undefined : { width: PLAYER_WIDTH }}>
        <div className={immersive ? "relative min-h-0 flex-1" : "relative aspect-video"}>
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
                  if (frameOrigin) frame.current?.contentWindow?.postMessage(helloMessage(), frameOrigin);
                  focusGame();
                }}
                className="absolute inset-0 size-full border-0 bg-black"
              />
              {!loaded ? (
                <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-black/70 text-white">
                  {t("loading")}
                </p>
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
                  ) : draft ? (
                    <>
                      <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{t("draftTitle")}</h2>
                      <p className="text-sm text-white/85 sm:text-base">{t("draftText")}</p>
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

        {playing && playable ? (
          <div role="toolbar" aria-label={t("controls")} className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-black/70 px-2 py-1.5">
            <Button type="button" variant="ghost" aria-label={t("restart")} onClick={restart}>
              <RotateCcwIcon aria-hidden="true" />
              <span className="hidden sm:inline">{t("restart")}</span>
            </Button>
            <div className="flex items-center gap-1">
              {bridgeReady ? (
                <Button type="button" variant="ghost" size="icon" aria-label={muted ? t("unmute") : t("mute")} title={muted ? t("unmute") : t("mute")} onClick={toggleMute}>
                  {muted ? <VolumeXIcon aria-hidden="true" /> : <Volume2Icon aria-hidden="true" />}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={immersive}
                aria-label={immersive ? t("exitFullscreen") : t("fullscreen")}
                title={immersive ? t("exitFullscreen") : t("fullscreen")}
                onClick={toggleFullscreen}
              >
                {immersive ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {draft ? null : (
        <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2">
          <ReportDialog targetType="game" targetId={game.id} signedIn={signedIn} loginHref={`/login?next=${encodeURIComponent(`/games/${game.public_id}`)}`} />
        </div>
      )}
    </div>
  );
}
