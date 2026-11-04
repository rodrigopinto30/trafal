import { BackgroundFx } from "./background-fx";

/**
 * Fondo de la app: aurora suave (3 manchas con degradé radial). Es 100 % CSS y entra en el caparazón
 * estático. Las manchas se quedan quietas en celulares y con prefers-reduced-motion (ver globals.css).
 * Los píxeles flotantes y el halo del mouse son JS y solo se cargan en escritorio (BackgroundFx).
 */
export function Background() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <span className="aurora-blob absolute -top-[20vh] -left-[15vw] size-[60vw] animate-aurora-a rounded-full bg-[radial-gradient(circle,rgb(139_92_255/0.3),transparent_62%)] blur-[20px]" />
        <span className="aurora-blob absolute top-[10vh] -right-[18vw] size-[55vw] animate-aurora-b rounded-full bg-[radial-gradient(circle,rgb(46_230_255/0.18),transparent_62%)] blur-[20px]" />
        <span className="aurora-blob absolute -bottom-[30vh] left-[25vw] size-[50vw] animate-aurora-c rounded-full bg-[radial-gradient(circle,rgb(255_92_122/0.14),transparent_62%)] blur-[30px]" />
      </div>
      <BackgroundFx />
    </>
  );
}
