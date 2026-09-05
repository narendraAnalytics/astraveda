// AstraVeda landing page — mobile nav + waitlist form (visual only, no backend yet).

const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const waitlistForm = document.getElementById('waitlist-form');
const waitlistNote = document.getElementById('waitlist-note');

if (waitlistForm && waitlistNote) {
  waitlistForm.addEventListener('submit', (event) => {
    event.preventDefault();
    // TODO: wire to the real waitlist/CRM endpoint once the backend exists.
    waitlistForm.hidden = true;
    waitlistNote.hidden = false;
  });
}
