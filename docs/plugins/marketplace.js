// Plugin marketplace — cards are prerendered statically at build time.
// When Supabase is configured (see supabase-config.js), the grid is refreshed
// live from the public.plugins table; any failure silently keeps the static
// cards, so the marketplace also works fully offline.
const grid = document.querySelector('#plugin-grid');
const search = document.querySelector('#plugin-search');
const count = document.querySelector('#plugin-count');
let category = 'all';
let searchTimer;

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function track(event, props = {}) {
  if (window.plausible) window.plausible(event, { props });
}

function cards() {
  return [...document.querySelectorAll('[data-plugin-card]')];
}

function update() {
  const query = (search?.value || '').trim().toLowerCase();
  let visible = 0;
  for (const card of cards()) {
    const show = (category === 'all' || card.dataset.category === category) && (!query || card.dataset.search.includes(query));
    card.hidden = !show;
    if (show) visible++;
  }
  if (count) count.textContent = String(visible);
  return visible;
}

function badge(plugin) {
  if (plugin.is_default) return '<span class="badge badge-default">Default</span>';
  if (plugin.status === 'available') return '<span class="badge badge-live">Available</span>';
  return '<span class="badge badge-scaffold">Scaffold</span>';
}

function cardHtml(plugin) {
  const tags = Array.isArray(plugin.tags) ? plugin.tags : [];
  const capabilities = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
  const haystack = [plugin.name, plugin.provider_name, plugin.category, ...tags, ...capabilities].join(' ').toLowerCase();
  const installText = plugin.is_default ? 'Included by default' : `npx lazy plugin install ${plugin.id}`;
  return `<article class="market-card" data-plugin-card data-category="${esc(plugin.category)}" data-search="${esc(haystack)}">
  <a class="card-link" href="${esc(plugin.id)}/" data-plugin-open="${esc(plugin.id)}">
    <div class="card-top"><div class="plugin-mark">${esc(plugin.name.slice(0, 2).toUpperCase())}</div><div class="badges">${badge(plugin)}</div></div>
    <div class="card-provider">${esc(plugin.provider_name)} · ${esc(plugin.category)}</div>
    <h2>${esc(plugin.name)}</h2>
    <p>${esc(plugin.description)}</p>
    <div class="tag-row">${tags.slice(0, 4).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
  </a>
  <div class="card-install"><code id="install-${esc(plugin.id)}">${esc(installText)}</code>${plugin.is_default ? '' : `<button class="copy" data-copy="install-${esc(plugin.id)}" data-plugin="${esc(plugin.id)}">Copy</button>`}</div>
</article>`;
}

async function loadFromSupabase() {
  const config = window.LAZY_SUPABASE;
  if (!grid || !config?.url || !config?.publishableKey) return;
  try {
    const query = 'select=id,name,version,description,category,status,is_default,featured,provider_name,tags,capabilities&order=featured.desc,id.asc';
    const response = await fetch(`${config.url}/rest/v1/plugins?${query}`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}` },
    });
    if (!response.ok) throw new Error(`Supabase registry: HTTP ${response.status}`);
    const plugins = await response.json();
    if (!Array.isArray(plugins) || plugins.length === 0) return;
    grid.innerHTML = plugins.map(cardHtml).join('\n');
    grid.dataset.source = 'supabase';
    const eyebrow = document.querySelector('.market-hero .eyebrow');
    if (eyebrow) eyebrow.textContent = `Plugin marketplace · ${plugins.length} reviewed manifests · live from Supabase`;
    update();
    track('Plugin Registry Source', { source: 'supabase', plugins: plugins.length });
  } catch {
    // Static fallback: the prerendered cards remain untouched.
    if (grid) grid.dataset.source = 'static';
  }
}

search?.addEventListener('input', () => {
  const visible = update();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track('Plugin Search', { category, results: visible }), 500);
});
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  category = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  const visible = update();
  track('Plugin Filter', { category, results: visible });
}));

document.addEventListener('click', async (event) => {
  const openLink = event.target.closest('[data-plugin-open]');
  if (openLink) track('Plugin Open', { plugin: openLink.dataset.pluginOpen });
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const target = document.getElementById(button.dataset.copy);
  if (!target) return;
  await navigator.clipboard.writeText(target.textContent.replace('Included by default · run to approve: ', ''));
  button.textContent = 'Copied';
  track('Plugin Install Copy', { plugin: button.dataset.plugin || 'unknown' });
});

loadFromSupabase();
