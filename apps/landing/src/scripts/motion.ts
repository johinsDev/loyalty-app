import { inView } from "motion";
import { animate } from "motion/mini";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The visible end state lives in CSS (`.is-visible`), so a finished WAAPI
 * animation can never snap the element back to its hidden starting style. */
function revealOnScroll() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const siblings = Array.from(el.parentElement?.querySelectorAll(":scope > [data-reveal]") ?? []);
    el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) * 0.07}s`;

    const stop = inView(
      el,
      () => {
        el.classList.add("is-visible");
        stop();
      },
      { amount: 0.15 },
    );
  }
}

function floatPearls() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-pearl]")) {
    const delay = Number(el.dataset.delay ?? 0);
    el.style.transitionDelay = `${delay}s`;
    el.classList.add("is-visible");
    animate(
      el,
      { transform: ["translateY(0px)", "translateY(-20px)", "translateY(0px)"] },
      { duration: 7 + delay * 2, delay, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
    );
  }
}

function fillStampCard() {
  const stamps = [...document.querySelectorAll<HTMLElement>("[data-stamp]")];
  const wrapper = stamps[0]?.parentElement;
  if (!wrapper) return;

  const bar = document.querySelector<HTMLElement>("[data-progress]");
  const label = document.querySelector<HTMLElement>("[data-progress-label]");
  const reward = document.querySelector<HTMLElement>("[data-reward]");
  const rewardLabel = document.querySelector<HTMLElement>("[data-reward-label]");
  const goal = stamps.length;

  const markStamp = (stamp: HTMLElement) => {
    stamp.classList.remove("border-dashed", "border-ink/15", "text-ink/20");
    stamp.classList.add("border-brand", "bg-brand", "text-white");
  };

  const setProgress = (filled: number) => {
    if (bar) bar.style.width = `${(filled / goal) * 100}%`;
    if (!label) return;
    const left = goal - filled;
    label.textContent =
      left === 0 ? "¡Tarjeta completa!" : `Te falta${left > 1 ? "n" : ""} ${left} sello${left > 1 ? "s" : ""}`;
  };

  const unlockReward = () => {
    reward?.classList.remove("opacity-40");
    if (rewardLabel) rewardLabel.textContent = "Listo para reclamar";
  };

  if (prefersReducedMotion) {
    for (const stamp of stamps) markStamp(stamp);
    setProgress(goal);
    unlockReward();
    return;
  }

  const stop = inView(
    wrapper,
    () => {
      stop();
      stamps.forEach((stamp, i) => {
        setTimeout(() => {
          markStamp(stamp);
          animate(
            stamp,
            { transform: ["scale(1)", "scale(1.25)", "scale(1)"] },
            { duration: 0.45, ease: EASE_OUT },
          );
          setProgress(i + 1);
          if (i === goal - 1) setTimeout(unlockReward, 350);
        }, 500 + i * 340);
      });
    },
    { amount: 0.5 },
  );
}

if (prefersReducedMotion) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-reveal], [data-pearl]")) {
    el.classList.add("is-visible");
  }
} else {
  revealOnScroll();
  floatPearls();
}
fillStampCard();
