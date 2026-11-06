(() => {
  const header = document.querySelector("[data-header]");
  const menuBtn = document.querySelector("[data-menu]");
  const mobileNav = document.querySelector("[data-mobile-nav]");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("is-open");
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => mobileNav.classList.remove("is-open"));
    });
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
  }

  document.querySelectorAll("[data-faq]").forEach((item) => {
    const btn = item.querySelector(".faq-q");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      item.parentElement
        ?.querySelectorAll("[data-faq]")
        .forEach((other) => other.classList.remove("is-open"));
      if (!open) item.classList.add("is-open");
    });
  });

  const form = document.querySelector("[data-contact-form]");
  const status = document.querySelector("[data-form-status]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const topic = String(data.get("topic") || "").trim();
      const message = String(data.get("message") || "").trim();
      const subject = `[Future Self Alarm] ${topic}`;
      const body = `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`;
      const mailto = `mailto:dyniza@uxdyniza.com?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      if (status) status.classList.add("is-visible");
    });
  }
})();
