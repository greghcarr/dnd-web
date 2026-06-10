// Shared collapse behavior for the right-column log panels. Clicking a
// panel's header toggle hides its scroll body, shrinking the panel to just
// its header so the sibling panel expands to fill the freed space. Either
// (or both) of the battle log and event log can be minimized this way.

const COLLAPSED_CLASS = 'collapsed';
const CHEVRON_EXPANDED = '▾'; // down triangle
const CHEVRON_COLLAPSED = '▸'; // right triangle

// Markup for the header's clickable toggle (chevron + title). Callers drop
// this inside their `.panel-header`, then pass the panel and its toggle to
// makeCollapsible.
export const collapseToggleHtml = (title: string): string =>
  `<button type="button" class="panel-collapse" aria-expanded="true">` +
  `<span class="collapse-chevron">${CHEVRON_EXPANDED}</span>` +
  `<span class="panel-title">${title}</span></button>`;

export const makeCollapsible = (panel: HTMLElement, toggle: HTMLButtonElement): void => {
  const chevron = toggle.querySelector<HTMLElement>('.collapse-chevron');
  // Toggle on click (tap-release), not pointerdown: collapsing reflows the
  // layout, and doing that mid-tap let the tap's click phase land on whatever
  // shifted under the finger (e.g. the command bar's Move button on phones).
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle(COLLAPSED_CLASS);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    if (chevron) chevron.textContent = collapsed ? CHEVRON_COLLAPSED : CHEVRON_EXPANDED;
  });
};
