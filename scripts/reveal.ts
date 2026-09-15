const root = document.documentElement;

const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

const revealElements = Array.from(
  document.querySelectorAll<HTMLElement>("[data-reveal]"),
);

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const revealStorageKey = `orhea:reveal-seen:${pathname}`;

let hasSeenPage = false;

try {
  hasSeenPage = window.sessionStorage.getItem(revealStorageKey) === "true";

  if (!hasSeenPage) {
    window.sessionStorage.setItem(revealStorageKey, "true");
  }
} catch {
  // Jeśli storage jest niedostępny, reveal nadal działa bez blokowania treści.
}

const revealAll = () => {
  revealElements.forEach((element) => {
    element.classList.add("is-revealed");
  });
};

const canAnimate =
  revealElements.length > 0 &&
  !hasSeenPage &&
  !reducedMotionQuery.matches &&
  "IntersectionObserver" in window;

if (!canAnimate) {
  revealAll();
} else {
  root.classList.add("has-reveal-js");

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const element = entry.target;

        if (!(element instanceof HTMLElement)) {
          return;
        }

        element.classList.add("is-revealed");
        currentObserver.unobserve(element);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  // waiting 2 frames
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        revealElements.forEach((element) => {
          observer.observe(element);
        });
      }, 100);
    });
  });
}
