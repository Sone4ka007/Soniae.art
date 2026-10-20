const journalMenuButton = document.querySelector('.menu-button');
const journalMenu = document.querySelector('.top nav');

if (journalMenuButton && journalMenu) {
  const closeJournalMenu = () => {
    journalMenu.classList.remove('open');
    journalMenuButton.setAttribute('aria-expanded', 'false');
  };

  journalMenuButton.addEventListener('click', () => {
    const open = journalMenu.classList.toggle('open');
    journalMenuButton.setAttribute('aria-expanded', String(open));
  });
  journalMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeJournalMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeJournalMenu();
  });
}
