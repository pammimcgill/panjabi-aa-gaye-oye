export function mountHistoryComics(root = document) {
  for (const book of root.querySelectorAll('[data-comic-book]')) {
    const pages = [...book.querySelectorAll('[data-comic-page]')];
    const previous = book.querySelector('[data-comic-prev]');
    const next = book.querySelector('[data-comic-next]');
    const dots = book.querySelector('[data-comic-dots]');
    const status = book.querySelector('[data-comic-status]');
    if (!pages.length || !previous || !next || !dots) continue;

    let index = Math.max(0, pages.findIndex(page => page.classList.contains('is-current')));
    let pointerStart = null;

    const buttons = pages.map((page, pageIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'comic-dot';
      button.setAttribute('aria-label', `Go to comic page ${pageIndex + 1}`);
      button.addEventListener('click', () => show(pageIndex));
      dots.append(button);
      return button;
    });

    function show(nextIndex, direction = nextIndex >= index ? 'next' : 'previous') {
      const bounded = Math.max(0, Math.min(pages.length - 1, nextIndex));
      index = bounded;
      pages.forEach((page, pageIndex) => {
        const current = pageIndex === index;
        page.classList.toggle('is-current', current);
        page.classList.remove('turn-next', 'turn-previous');
        page.setAttribute('aria-hidden', current ? 'false' : 'true');
        if (current) {
          void page.offsetWidth;
          page.classList.add(direction === 'previous' ? 'turn-previous' : 'turn-next');
        }
      });
      buttons.forEach((button, pageIndex) => {
        const current = pageIndex === index;
        button.classList.toggle('is-current', current);
        button.setAttribute('aria-current', current ? 'page' : 'false');
      });
      previous.disabled = index === 0;
      next.disabled = index === pages.length - 1;
      if (status) status.textContent = `Page ${index + 1} of ${pages.length}`;
    }

    previous.addEventListener('click', () => show(index - 1, 'previous'));
    next.addEventListener('click', () => show(index + 1, 'next'));
    book.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1, 'previous'); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1, 'next'); }
    });
    book.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
    book.addEventListener('pointerup', event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
      show(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'previous');
    });
    book.addEventListener('pointercancel', () => { pointerStart = null; });
    show(index);
  }
}
