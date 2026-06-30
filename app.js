const app = document.querySelector("#app");
const scheduleDialog = document.querySelector("#scheduleDialog");
const dialog = document.querySelector("#previewDialog");
const previewImage = document.querySelector("#previewImage");
const previewCaption = document.querySelector("#previewCaption");
const sourceEditorDialog = document.querySelector("#sourceEditorDialog");
const sourceEditorRows = document.querySelector("#sourceEditorRows");
const sourceEditorPassword = document.querySelector("#sourceEditorPassword");
const sourceEditorStatus = document.querySelector("#sourceEditorStatus");
const sourceEditorSaveButton = document.querySelector("[data-source-editor-save]");
const defaultSourceUrl = "https://hurcteams-my.sharepoint.com/:f:/g/personal/10712_hurc_tw/IgCRck4ye14qQY0wL_aCH9GwAYG4lAtxarTEeXqhER7RuQ4?e=lu8RfD";
const sourceLinksEnabled = false;
const sourceLinksKey = "hurc-source-links-v4";
const sourceMetaKey = "hurc-source-meta-v6";
const structureLinkId = "SITE-STRUCTURE";
const sourceEditorPasswordValue = "10712";

const icons = {
  home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5v8h13v-8"/><path d="M9.5 18.5v-5h5v5"/></svg>`,
  scales: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16"/><path d="M5 7h14"/><path d="M7 7l-3 6h6L7 7Z"/><path d="M17 7l-3 6h6l-3-6Z"/><path d="M8 20h8"/></svg>`,
  news: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>`,
};

let data;
const routeLabelMap = {};
let currentRoute = routeFromHash();
let sourceEditorUnlocked = false;
let scheduleDialogDismissed = false;
let pendingScheduleDialog = false;
let pendingScheduleDialogForce = false;

function showFatalError(message) {
  if (app) {
    app.innerHTML = `<pre style="white-space:pre-wrap;padding:20px;color:#900;background:#fff;border:1px solid #900;">${escapeHtml(message)}</pre>`;
  }
  console.error(message);
}

async function initialize() {
  try {
    const response = await fetch(`data/home.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`Failed to load data/home.json (${response.status} ${response.statusText})`);
    data = await response.json();
  } catch (error) {
    showFatalError(`Data load error: ${error?.message || error}`);
    return;
  }

  collectRouteLabels();
  carouselPhotos = buildCarouselMap();
  if (currentRoute !== "home" && !data.pages?.[currentRoute]) currentRoute = "home";
  queueScheduleDialog();
  render();
  setupInteractions();
}

function text(value) {
  return value || "";
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleText(item, side = "en") {
  if (!item) return "";
  if (typeof item === "string") return item;
  return text(item[side]) || text(item.en) || text(item.zh);
}

function routeFromHash() {
  const route = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return route || "home";
}

function addRouteLabel(id, en, zh) {
  if (!id) return;
  routeLabelMap[id] = [en || id, zh || en || id];
}

function collectRouteLabels() {
  Object.entries(data.pages || {}).forEach(([id, page]) => addRouteLabel(id, page.title?.en, page.title?.zh));
  data.nav.forEach((group) => {
    group.children.forEach((child) => {
      addRouteLabel(child.targetId, child.en, child.zh);
      (child.children || []).forEach((grand) => addRouteLabel(grand.targetId, grand.en, grand.zh));
    });
  });
}


function loadSourceLinks() {
  const defaults = Object.fromEntries(
    Object.entries(data.sourceMeta || {})
      .map(([id, meta]) => [id, meta.url || ""])
      .filter(([, url]) => url),
  );
  try {
    const saved = JSON.parse(localStorage.getItem(sourceLinksKey)) || {};
    const savedLinks = Object.fromEntries(Object.entries(saved).filter(([, url]) => url));
    return { ...defaults, ...savedLinks };
  } catch {
    return defaults;
  }
}

function saveSourceLinks(links) {
  localStorage.setItem(sourceLinksKey, JSON.stringify(links));
}

function loadSourceMeta() {
  const defaults = data.sourceMeta || {};
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(sourceMetaKey)) || {}) };
  } catch {
    return defaults;
  }
}

function saveSourceMeta(meta) {
  localStorage.setItem(sourceMetaKey, JSON.stringify(meta));
}

function valueFromMeta(saved, key, fallback = "") {
  return Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : fallback;
}

function unitChips(unit) {
  return text(unit)
    .split(/[、,，;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
    .join("");
}

function firstPhoto(section) {
  return section.photos?.[0]?.url || "";
}

function allSourceItems() {
  const homeItems = [
    { id: structureLinkId, label: "內容＆參考出處檔案", row: { unit: "", note: "" } },
    { id: data.sections.hero.id, row: data.sections.hero.row },
    { id: data.sections.intro.id, row: data.sections.intro.picture },
    { id: data.sections.social.id, row: data.sections.social.picture },
    { id: data.sections.urban.id, row: data.sections.urban.picture },
  ];
  const pageItems = Object.values(data.pages || {}).flatMap((page) =>
    page.sections.map((section) => ({
      id: section.id,
      row: { unit: section.unit, note: "" },
    })),
  );
  const unique = new Map();
  [...homeItems, ...pageItems].forEach((item) => {
    if (!unique.has(item.id)) unique.set(item.id, item);
  });
  return [...unique.values()];
}

function renderSourceEditorRows() {
  const links = loadSourceLinks();
  const meta = loadSourceMeta();
  const locked = sourceEditorUnlocked ? "" : "disabled";
  sourceEditorRows.innerHTML = allSourceItems()
    .map((item) => {
      const saved = meta[item.id] || {};
      const label = saved.label || item.label || item.id;
      const unit = valueFromMeta(saved, "unit", item.row?.unit || "");
      const note = valueFromMeta(saved, "note", "");
      const value = links[item.id] || "";
      return `
        <tr data-source-row="${item.id}">
          <td>${escapeHtml(label)}</td>
          <td><input type="text" value="${escapeHtml(unit)}" data-source-unit ${locked}></td>
          <td><input type="url" value="${escapeHtml(value)}" data-source-url placeholder="https://..." ${locked}></td>
          <td><textarea data-source-note rows="2" ${locked}>${escapeHtml(note)}</textarea></td>
        </tr>
      `;
    })
    .join("");
}

function openSourceEditor() {
  sourceEditorUnlocked = false;
  sourceEditorRows.innerHTML = "";
  if (sourceEditorPassword) sourceEditorPassword.value = "";
  sourceEditorDialog.classList.remove("is-unlocked");
  updateSourceEditorLock("請先輸入密碼");
  sourceEditorDialog.showModal();
  sourceEditorPassword?.focus();
}

function closeSourceEditor() {
  sourceEditorUnlocked = false;
  sourceEditorRows.innerHTML = "";
  sourceEditorDialog.classList.remove("is-unlocked");
  if (sourceEditorPassword) sourceEditorPassword.value = "";
  sourceEditorDialog.close();
}

function updateSourceEditorLock(message = "") {
  sourceEditorDialog.classList.toggle("is-unlocked", sourceEditorUnlocked);
  sourceEditorRows.querySelectorAll("input, textarea").forEach((field) => {
    field.disabled = !sourceEditorUnlocked;
  });
  if (sourceEditorSaveButton) sourceEditorSaveButton.disabled = !sourceEditorUnlocked;
  if (sourceEditorStatus) {
    sourceEditorStatus.textContent = message || (sourceEditorUnlocked ? "已解鎖，可編修欄位" : "目前為唯讀模式");
  }
}

function unlockSourceEditor() {
  if (sourceEditorPassword?.value === sourceEditorPasswordValue) {
    sourceEditorUnlocked = true;
    renderSourceEditorRows();
    updateSourceEditorLock("已解鎖，可編修欄位");
    return;
  }
  updateSourceEditorLock("密碼錯誤，請重新輸入");
}

function openStructureLink() {
  const sourceUrl = loadSourceLinks()[structureLinkId] || defaultSourceUrl;
  if (sourceUrl) {
    window.open(sourceUrl, "_blank", "noreferrer");
    return;
  }
  openSourceEditor();
}

function buildCarouselMap() {
  const map = {
    social: data.sections.social.photos || [],
    urban: data.sections.urban.photos || [],
  };
  Object.values(data.pages || {}).forEach((page) => {
    page.sections.forEach((section) => {
      if (section.photos?.length) map[section.id] = section.photos;
    });
  });
  return map;
}

let carouselPhotos;

const majorAffairsTargets = {
  "E-B-1-1": "E-B-2",
  "E-B-1-2": "E-B-4",
  "E-B-1-3": "E-B-3",
};

const businessDutyTargets = {
  "Social Housing Development and Construction Department": "E-B-2",
  "Assets Management Department": "E-B-3",
  "Urban Regeneration Department": "E-B-4",
  "社會住宅部": "E-B-2",
  "資產管理部": "E-B-3",
  "都更業務部": "E-B-4",
};

const fixedExternalLinks = {
  "E-D-2-1": [
    {
      en: "Ministry of the Interior",
      zh: "內政部",
      url: "https://www.moi.gov.tw/english/",
    },
    {
      en: "National Land Management Agency",
      zh: "國土管理署",
      url: "https://www.nlma.gov.tw/en",
    },
  ],
};

const titlelessSectionIds = new Set(["E-D-2-1", "E-B-2-1", "E-B-3-1", "E-B-4-1", "E-A-2-2"]);
const principalOfficerPageIds = new Set(["E-A-2-2"]);
const officerProfileSectionIds = new Set([
  "E-A-2-2-1-1",
  "E-A-2-2-2-1",
  "E-A-2-2-3-1",
  "E-A-2-2-3-2",
]);
const addressBoldLines = {
  en: ["Office Location", "Transportation Guide", "Office Hours"],
  zh: ["辦公地點", "交通指南", "辦公時間"],
};
const contactBoldLines = {
  en: ["Facebook", "YouTube", "Youtube", "Instgram"],
  zh: ["Facebook", "YouTube", "Youtube", "Instgram"],
};
const caseStudyBoldLines = {
  "E-A-2-2-1-1": {
    en: ["Education:", "Professional Experience:"],
    zh: ["學歷", "經歷"],
  },
  "E-A-2-2-2-1": {
    en: ["Education:", "Certifications:", "Professional Experience:"],
    zh: ["學歷", "證照", "經歷"],
  },
  "E-A-2-2-3-1": {
    en: ["Education:", "Professional Experience:"],
    zh: ["學歷", "經歷"],
  },
  "E-A-2-2-3-2": {
    en: ["Education:", "Professional Experience:"],
    zh: ["學歷", "經歷"],
  },
  "E-B-3-2": {
    en: [
      "Property Management Team: Ensuring a stable and well-managed living environment",
      "24-Hour Security Monitoring：Disaster Prevention and Relief Ready",
      "Community Building and Resident Engagement：Creating welcoming and inclusive living",
    ],
    zh: [
      "物管團隊：社區生活穩定、有秩序",
      "24H監控：防災救護備妥，守護安全",
      "社區營造與居民參與：打造友善包容生活",
    ],
  },
  "E-B-4-2": {
    en: [
      "Site Background and Challenges",
      "Memory Preserved, Community Empowered",
      "Post-Pandemic Design and Mixed-Use Community Spaces",
    ],
    zh: [
      "背景及挑戰",
      "記憶得以保存，社區得以培力",
      "後疫情時代設計與多功能社區空間",
    ],
  },
  "E-B-4-3": {
    en: [
      "Site Background and Challenges",
      "Continuity of Essential Services",
      "An Age-Inclusive Urban Ecosystem",
    ],
    zh: [
      "專案背景及挑戰",
      "保障服務連續性",
      "一個包容所有年齡層的都市生態系統",
    ],
  },
};

function sourceCard({ id, row, screen, photos = [], showReferenceSources = true }) {
  const saved = loadSourceMeta()[id] || {};
  const unit = valueFromMeta(saved, "unit", row?.unit || "");
  const note = valueFromMeta(saved, "note", "");
  const notes = [];
  if (note) notes.push(note);
  const referenceActions = showReferenceSources ? referenceSourceButtons(id) : "";
  const screenAction = screen
    ? `<button type="button" data-preview="${screen.url}" data-caption="${id} ${screen.cell}">畫面預覽</button>`
    : "";
  const actions = referenceActions || screenAction
    ? `<div class="source-actions">${referenceActions}${screenAction}</div>`
    : "";
  return `
    <aside class="source-card" aria-label="${id} source">
      <strong>${id}</strong>
      ${unitChips(unit)}
      ${actions}
      ${notes.length ? `<small class="source-note">${escapeHtml(notes.join("\n"))}</small>` : ""}
    </aside>
  `;
}

function referenceSourceButtons(id) {
  const references = data.referenceSources?.[id] || [];
  if (!references.length) {
    return `<span class="source-action-empty" aria-disabled="true">參考出處</span>`;
  }
  return references
    .map((reference, index) => {
      const count = references.length;
      const label = count > 1 ? `參考出處-${index + 1}` : "參考出處";
      const caption = reference.caption || reference.name || `${id} ${label}`;
      return `<button type="button" data-preview="${escapeHtml(reference.url)}" data-caption="${escapeHtml(caption)}">${label}</button>`;
    })
    .join("");
}

function navMarkup(side) {
  const overviewLabel = side === "en" ? "Overview" : "頁面總覽";
  return data.nav
    .map((group) => {
      const label = side === "en" ? group.en : group.zh;
      if (group.direct && group.directTargetId) {
        return `
          <div class="nav-group nav-group-direct">
            <button class="nav-button" type="button" data-route="${group.directTargetId}">${escapeHtml(label)}</button>
          </div>
        `;
      }
      const children = group.children
        .filter((child) => child.targetId || child.children?.length)
        .map((child) => {
          const childLabel = side === "en" ? child.en : child.zh;
          const grandChildren = child.children || [];
          const triggerId = child.targetId || child.slug || child.id || child.en;
          const showOverview = child.targetId && child.showOverview !== false;
          const nested = grandChildren.length
            ? `
              <div class="nav-submenu">
                ${showOverview ? `<button class="nav-overview" type="button" data-route="${child.targetId}">${overviewLabel}</button>` : ""}
                ${grandChildren
              .map((grand) => {
                const grandLabel = side === "en" ? grand.en : grand.zh;
                return `<button type="button" data-route="${grand.targetId}">${escapeHtml(grandLabel)}</button>`;
              })
              .join("")}
              </div>
            `
            : "";
          return `
            <div class="nav-subgroup">
              <button
                type="button"
                ${grandChildren.length ? `data-submenu-trigger="${escapeHtml(triggerId)}" aria-expanded="false"` : `data-route="${child.targetId}"`}
                aria-haspopup="${grandChildren.length ? "true" : "false"}"
              >
                <span>${escapeHtml(childLabel)}</span>
              </button>
              ${nested}
            </div>
          `;
        })
        .join("");
      return `
        <div class="nav-group">
          <button class="nav-button" type="button" aria-expanded="false">${escapeHtml(label)}</button>
          <div class="nav-menu">${children}</div>
        </div>
      `;
    })
    .join("");
}

function headerMarkup() {
  const logo = data.meta.logo || "assets/logo.png";
  return `
    <header class="site-header">
      <div class="header-side en-side">
        <button class="brand-mark brand-button" type="button" data-route="home" data-logo-home>
          <img class="brand-logo" src="${logo}" alt="National Housing and Urban Regeneration Center">
        </button>
        <nav class="nav-pane en" aria-label="English navigation">${navMarkup("en")}</nav>
      </div>
      <div class="rail-head">
        <div class="rail-head-buttons">
          <button class="source-editor-trigger" type="button" data-structure-link>參考出處檔案</button>
          <button class="source-editor-trigger" type="button" data-vocab-link>語料庫</button>
        </div>
        <span class="rail-caption">英文網站翻譯對照</span>
      </div>
      <div class="header-side zh-side">
        <button class="brand-mark zh-brand brand-button" type="button" data-route="home" data-logo-home>
          <img class="brand-logo" src="${logo}" alt="國家住宅及都市更新中心">
        </button>
        <nav class="nav-pane zh" aria-label="Chinese navigation">${navMarkup("zh")}</nav>
      </div>
    </header>
  `;
}

function routeButton(target, side, labelOverride = "") {
  const labels = routeLabelMap[target] || [target, target];
  const label = labelOverride || labels[side === "en" ? 0 : 1] || labels[0] || target;
  return `<button class="route-button" type="button" data-route="${target}">${escapeHtml(label)}</button>`;
}

function carousel(section, sectionKey, side) {
  const photos = section.photos || [];
  const startIndex = sectionKey === "social" && photos.length > 1 ? 1 : 0;
  const first = photos[startIndex] || photos[0] || {};
  const caption = first.name || "";
  const logoLike = /logo/i.test(caption);
  return `
    <div class="carousel ${logoLike ? "logo-like" : ""}" data-carousel="${sectionKey}-${side}" data-carousel-group="${sectionKey}" data-index="${startIndex}">
      <img src="${first.url || ""}" alt="">
      <div class="carousel-caption">${escapeHtml(caption)}</div>
      ${photos.length > 1
      ? `<div class="carousel-controls" aria-label="${sectionKey} carousel controls">
              <button type="button" data-carousel-prev="${sectionKey}" aria-label="Previous image">‹</button>
              <button type="button" data-carousel-next="${sectionKey}" aria-label="Next image">›</button>
            </div>`
      : ""
    }
    </div>
  `;
}

function heroPane(side) {
  const hero = data.sections.hero;
  const isEn = side === "en";
  return `
    <section class="hero-card">
      <img src="${firstPhoto(hero)}" alt="">
      <div class="hero-overlay">
        <div class="hero-title hero-search-only">
          <div class="search-bar" aria-hidden="true">
            <span>${isEn ? "Search" : "搜尋"}</span>
            <button type="button">⌕</button>
          </div>
        </div>
        <div class="hero-dots" aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function quickPane(side) {
  const isEn = side === "en";
  return `
    <div class="quick-wrap">
      <div class="quick-grid">
        ${data.quickLinks
      .map((item) => {
        const title = isEn ? item.en : item.zh;
        return `
              <button class="quick-card" type="button" data-route="${item.target}">
                <span class="quick-icon">${icons[item.icon]}</span>
                <span><strong>${escapeHtml(title)}</strong></span>
              </button>
            `;
      })
      .join("")}
      </div>
    </div>
  `;
}

function introPane(side) {
  const section = data.sections.intro;
  const isEn = side === "en";
  return `
    <section class="intro-content" id="intro-${side}">
      <div class="image-panel">
        <img src="${firstPhoto(section)}" alt="">
      </div>
      <div class="floating-copy">
        <h2>${escapeHtml(isEn ? section.title.en : section.title.zh)}</h2>
        ${paragraphs(isEn ? section.text.en : section.text.zh)}
        <div class="section-tools">${routeButton("E-A-1", side, "More")}</div>
      </div>
    </section>
  `;
}

function socialPane(side) {
  const section = data.sections.social;
  const isEn = side === "en";
  return `
    <section class="social-layout" id="social-${side}">
      ${carousel(section, "social", side)}
      <div>
        <h2>${escapeHtml(isEn ? section.title.en : section.title.zh)}</h2>
        ${paragraphs(isEn ? section.text.en : section.text.zh)}
        <div class="section-tools">${routeButton("E-B-1", side, "More")}</div>
      </div>
      <div>
        <h2>${escapeHtml(isEn ? section.modeTitle.en : section.modeTitle.zh)}</h2>
        <div class="method-grid">
          ${section.methods
      .map(
        (method, index) => {
          const routeTarget = method.target || (index === 0 ? "E-B-2" : index === 1 ? "E-B-3" : "");
          return `
                  <article class="method-card ${routeTarget ? "" : "method-card-wide"}">
                    <h3>${escapeHtml(isEn ? method.title.en : method.title.zh)}</h3>
                    ${paragraphs(isEn ? method.text.en : method.text.zh)}
                    ${routeTarget ? routeButton(routeTarget, side, "More") : ""}
                  </article>
                `;
        },
      )
      .join("")}
        </div>
      </div>
    </section>
  `;
}

function urbanPane(side) {
  const section = data.sections.urban;
  const isEn = side === "en";
  return `
    <section class="urban-layout" id="urban-${side}">
      ${carousel(section, "urban", side)}
      <div>
        <h2>${escapeHtml(isEn ? section.title.en : section.title.zh)}</h2>
        ${paragraphs(isEn ? section.text.en : section.text.zh)}
        ${routeButton("E-B-4", side, "More")}
      </div>
      <div>
        <h2>${escapeHtml(isEn ? section.facetsIntro.en : section.facetsIntro.zh)}</h2>
        <div class="facet-grid">
          ${section.facets
      .map(
        (facet) => `
              <article class="facet-card">
                <h3>${escapeHtml(isEn ? facet.title.en : facet.title.zh)}</h3>
                ${paragraphs(isEn ? facet.text.en : facet.text.zh)}
              </article>
            `,
      )
      .join("")}
        </div>
      </div>
    </section>
  `;
}

function paragraphs(value, boldLines = []) {
  const boldSet = new Set(boldLines);
  return text(value)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const formatted = part
        .split("\n")
        .map((line) => {
          let escaped = escapeHtml(line);
          if (boldSet.has(line.trim())) {
            escaped = `<strong>${escaped}</strong>`;
          }
          escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          return escaped;
        })
        .join("<br>");
      return `<p class="body-text">${formatted}</p>`;
    })
    .join("");
}

function glossaryTable(side) {
  const headers = side === "en" ? ["English", "Traditional Chinese"] : ["英文", "中文"];
  return `
    <div class="glossary-table-wrap">
      <table class="glossary-table">
        <thead>
          <tr>
            <th>${headers[0]}</th>
            <th>${headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          ${(data.glossary || [])
      .map(
        (item) => `
                <tr>
                  <td>${escapeHtml(item.en)}</td>
                  <td>${escapeHtml(item.zh)}</td>
                </tr>
              `,
      )
      .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function templateNotice(section, side) {
  const notes = {
    "E-D-1-1": {
      en: "Built from the bilingual comparison template provided by the vendor.",
      zh: "根據廠商提供中英文對照模板",
    },
  };
  const note = notes[section.id]?.[side] || section.sourceNote || section.summary || "";
  return `<div class="template-note"><p>${escapeHtml(note)}</p></div>`;
}

function newsList(section, side) {
  const newsItems = [
    {
      id: "E-C-1-2",
      date: "2026-06-10",
      title: {
        zh: "臺日營建技術實質對接！　日本大成建設來台參訪「全預鑄」社宅及水泥製品廠",
        en: "Taiwan–Japan Construction Technology Exchange: Taisei Corporation Visits Taiwan’s First Fully Prefabricated Social Housing Project and Precast Plants"
      },
      summary: {
        zh: "國家住都中心推動營建產業升級的步伐持續加速！繼年初與日本營建龍頭「大成建設」（Taisei Corporation）合作，近日大成建設專家團隊更親自走訪國內多間水泥製品廠並探訪全國首座採用「全預鑄」工法、由潤弘精密工程興建的埔心安居A，進行深度的實地查察。",
        en: "The National Housing and Urban Regeneration Center (HURC) continues to accelerate efforts to upgrade Taiwan’s construction industry. Following the launch of a professional training program on precast construction methods earlier this year in collaboration with Japan’s leading contractor, Taisei Corporation, a delegation of Taisei experts recently visited several domestic precast concrete plants. The delegation also conducted an in-depth site visit to Puxin HURC Social Housing A, the nation’s first social housing project constructed using a fully prefabricated approach, developed by Ruentex Engineering & Construction."
      },
      photo: "assets/photos/photo_E-C-1-2-01.jpg"
    }
  ];

  return `
    <div class="news-list-container">
      ${newsItems
        .map((item) => {
          const title = side === "en" ? item.title.en : item.title.zh;
          const summary = side === "en" ? item.summary.en : item.summary.zh;
          const dateLabel = side === "en" ? "Date: " : "發布日期：";
          return `
            <article class="news-list-card">
              <div class="news-card-image">
                <img src="${item.photo}" alt="${escapeHtml(title)}" loading="lazy">
              </div>
              <div class="news-card-content">
                <div>
                  <div class="news-card-date">${dateLabel}${item.date}</div>
                  <h3 class="news-card-title">
                    <a href="#${item.id}" class="news-title-link" data-route="${item.id}">${escapeHtml(title)}</a>
                  </h3>
                  <p class="news-card-excerpt">${escapeHtml(summary)}</p>
                </div>
                <div class="news-card-action">
                  <button class="route-button" type="button" data-route="${item.id}">
                    ${side === "en" ? "Read More" : "閱讀更多"}
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}


function linkList(section, side) {
  const fixedRows = fixedExternalLinks[section.id];
  if (fixedRows) {
    return `
      <div class="link-list">
        ${fixedRows
        .map(
          (item) => `
              <div class="link-list-row">
                <div>
                  <strong>${escapeHtml(side === "en" ? item.en : item.zh)}</strong>
                </div>
                <a class="route-button" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${side === "en" ? "Link" : "連結"}</a>
              </div>
            `,
        )
        .join("")}
      </div>
    `;
  }

  const titles = section.titleRows || [];
  const rows = titles.length
    ? titles.map((title, index) => ({
      title: titleText(title, side),
      note: section.links?.[index] ? titleText(section.links[index], side) : "",
    }))
    : (section.links || []).map((link) => ({ title: titleText(link, side), note: "" }));
  return `
    <div class="link-list">
      ${rows
      .map(
        (item) => `
            <div class="link-list-row">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
              </div>
              <button class="route-button" type="button">${side === "en" ? "Link" : "連結"}</button>
            </div>
          `,
      )
      .join("")}
    </div>
  `;
}

function screenPreview(section) {
  if (!section.screen?.url) return "";
  const caption = `${section.id} ${section.screen.cell || ""}`.trim();
  return `
    <button class="screen-preview" type="button" data-preview="${section.screen.url}" data-caption="${escapeHtml(caption)}">
      <img src="${section.screen.url}" alt="${escapeHtml(caption)}">
    </button>
  `;
}

function splitDuties(textValue, side) {
  const source = text(textValue).trim();
  if (!source) return [];
  const headings = side === "en"
    ? [
      "Social Housing Development and Construction Department",
      "Assets Management Department",
      "Urban Regeneration Department",
      "Executive Office",
      "Administration Department",
      "Southern Branch",
      "Audit Office",
    ]
    : ["社會住宅部", "資產管理部", "都更業務部", "總管理室", "行政管理部", "南部辦公室", "稽核室"];
  const matches = headings
    .map((heading) => ({ heading, index: source.indexOf(heading) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  return matches.map((item, index) => {
    const start = item.index + item.heading.length;
    const end = matches[index + 1]?.index ?? source.length;
    const body = source.slice(start, end).trim();
    const items = side === "en"
      ? body.split(/\n+/).map((part) => part.trim()).filter(Boolean)
      : body
        .replace(/([。；])(?=[(（][一二三四五六七八九十]+[)）])/g, "$1\n")
        .split(/\n|(?=[(（][一二三四五六七八九十]+[)）])/)
        .map((part) => part.trim())
        .filter(Boolean);
    return { heading: item.heading, items };
  });
}

function businessDuties(section, side) {
  const raw = section.texts?.map((item) => side === "en" ? item.en : item.zh).filter(Boolean).join("\n\n") || "";
  const duties = splitDuties(raw, side);
  if (!duties.length) return paragraphs(raw);
  return `
    <div class="business-duty-grid">
      ${duties
      .map(
        (duty) => {
          const target = businessDutyTargets[duty.heading] || "";
          return `
            <article class="business-duty-card">
              <h3>${escapeHtml(duty.heading)}</h3>
              <ul>
                ${duty.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
              ${target ? `<div class="section-tools">${routeButton(target, side, "More")}</div>` : ""}
            </article>
          `;
        },
      )
      .join("")}
    </div>
  `;
}

function rowMarkup(className, left, source, right) {
  return `
    <div class="compare-row ${className}">
      <main class="lane en">${left}</main>
      <div class="source-rail">${source}</div>
      <main class="lane zh">${right}</main>
    </div>
  `;
}

function homeMarkup() {
  const hero = data.sections.hero;
  const intro = data.sections.intro;
  const social = data.sections.social;
  const urban = data.sections.urban;
  return `
    ${rowMarkup("hero-row", heroPane("en"), sourceCard({ id: hero.id, row: hero.row, photos: hero.photos }), heroPane("zh"))}
    ${rowMarkup("intro-row", introPane("en"), sourceCard({ id: intro.id, row: intro.picture, screen: intro.screen, photos: intro.photos }), introPane("zh"))}
    ${rowMarkup("social-row", socialPane("en"), sourceCard({ id: social.id, row: social.picture, screen: social.screen, photos: social.photos }), socialPane("zh"))}
    ${rowMarkup("urban-row", urbanPane("en"), sourceCard({ id: urban.id, row: urban.picture, screen: urban.screen, photos: urban.photos }), urbanPane("zh"))}
  `;
}

function pageIntroPane(page, side) {
  const title = titleText(page.title, side);
  const subtitle = titleText(page.subtitle, side);
  const backRoute = page.id.startsWith("E-C-1-") ? "E-C-1" : "home";
  const backText = page.id.startsWith("E-C-1-")
    ? (side === "en" ? "Back to News" : "回最新消息")
    : (side === "en" ? "Home" : "回首頁");
  return `
    <section class="subpage-hero-panel">
      <button class="route-button back-button" type="button" data-route="${backRoute}">${backText}</button>
      ${subtitle ? `<p class="subpage-kicker">${escapeHtml(subtitle)}</p>` : ""}
      <h1>${escapeHtml(title)}</h1>
    </section>
  `;
}

function pageSectionPane(section, side) {
  const title = titleText(section.title, side);
  const hideSectionHeading = titlelessSectionIds.has(section.id);
  const sectionHeading = sectionHeadingMarkup(section, side, title);
  const boldLines = section.id === "E-A-4-1"
    ? contactBoldLines[side]
    : section.id === "E-A-4-2"
      ? addressBoldLines[side]
      : caseStudyBoldLines[section.id]?.[side] || [];
  const textBlocks = section.texts
    .map((item) => paragraphs(side === "en" ? item.en : item.zh, boldLines))
    .filter(Boolean)
    .join("");
  const specialContent = section.id === "E-D-1-1"
    ? glossaryTable(side)
    : section.id === "E-C-1-1"
      ? newsList(section, side)
      : section.id.startsWith("E-D-2")
        ? linkList(section, side)
        : section.id === "E-A-2-3"
          ? businessDuties(section, side)
          : "";
  const media = section.photos?.length
    ? carousel(section, section.id, side)
    : section.id === "E-A-2-2" && section.screen?.url
      ? screenPreview(section)
      : section.mediaRows?.length
        ? `<div class="media-placeholder">${side === "en" ? "Image or chart placeholder" : "圖表或圖片待補"}</div>`
        : "";
  const moreTarget = majorAffairsTargets[section.id] || "";
  const links = moreTarget
    ? `<div class="section-tools link-tools">${routeButton(moreTarget, side, "More")}</div>`
    : section.links?.length && section.id !== "E-A-2-2" && !section.id.startsWith("E-D-2")
      ? `<div class="section-tools link-tools">
        ${section.links
        .map((link) => {
          const label = side === "en" ? link.en : link.zh || link.en;
          if (link.url) {
            return `<a class="route-button" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
          }
          return `<button class="route-button" type="button">${escapeHtml(label)}</button>`;
        })
        .join("")}
      </div>`
      : "";
  return `
    <section class="subpage-section">
      ${media}
      ${hideSectionHeading ? "" : sectionHeading}
      ${specialContent}
      ${specialContent ? "" : textBlocks}
      ${textBlocks || specialContent || section.id === "E-A-2-2" ? "" : `<p class="body-text muted-text">${side === "en" ? "Content source is reserved in the spreadsheet." : "內容來源已於試算表保留。"}</p>`}
      ${links}
    </section>
  `;
}

function sectionHeadingMarkup(section, side, title) {
  if (officerProfileSectionIds.has(section.id)) return officerHeading(section.id, title);
  const subtitle = titleText(section.subtitle, side);
  if (!subtitle) return `<h2>${escapeHtml(title)}</h2>`;
  return `
    <h2 class="case-study-heading">
      <small>${escapeHtml(subtitle)}</small>
      <span>${escapeHtml(title)}</span>
    </h2>
  `;
}

function officerHeading(sectionId, title) {
  if (!officerProfileSectionIds.has(sectionId)) return `<h2>${escapeHtml(title)}</h2>`;
  const [name, ...roleParts] = title.split("\n").map((part) => part.trim()).filter(Boolean);
  const role = roleParts.join(" ");
  return `
    <h2 class="officer-heading">
      <span>${escapeHtml(name || title)}</span>
      ${role ? `<small>${escapeHtml(role)}</small>` : ""}
    </h2>
  `;
}

function pageMarkup(routeId) {
  const page = data.pages?.[routeId];
  if (!page) return missingPageMarkup(routeId);
  const pageHasMatchingSection = page.sections.some((section) => section.id === page.id);
  const pageSource = sourceCard({
    id: page.id,
    row: { unit: page.unit, note: `${page.sections.length} sections` },
    showReferenceSources: !pageHasMatchingSection,
  });
  const showPageIntro = !principalOfficerPageIds.has(routeId);
  return `
    ${showPageIntro ? rowMarkup("subpage-title-row", pageIntroPane(page, "en"), pageSource, pageIntroPane(page, "zh")) : ""}
    ${page.sections
      .map((section) =>
        rowMarkup(
          "subpage-row",
          pageSectionPane(section, "en"),
          sourceCard({
            id: section.id,
            row: { unit: section.unit, note: section.sourceNote || section.summary },
            screen: section.screen,
            photos: section.photos,
          }),
          pageSectionPane(section, "zh"),
        ),
      )
      .join("")}
  `;
}

function missingPageMarkup(routeId) {
  const label = routeLabelMap[routeId] || [routeId, routeId];
  const pane = (side) => `
    <section class="subpage-hero-panel">
      <button class="route-button back-button" type="button" data-route="home">${side === "en" ? "Home" : "回首頁"}</button>
      <h1>${escapeHtml(label[side === "en" ? 0 : 1] || routeId)}</h1>
      <p class="body-text">${side === "en" ? "This page is reserved for the next build batch." : "這個頁面保留到下一批製作。"}</p>
    </section>
  `;
  return rowMarkup("subpage-title-row", pane("en"), sourceCard({ id: routeId, row: { note: "頁面待製作" } }), pane("zh"));
}

function render() {
  app.innerHTML = `${headerMarkup()}${currentRoute === "home" ? homeMarkup() : pageMarkup(currentRoute)}`;
  document.querySelectorAll(".nav-group").forEach((group) => group.classList.remove("open"));
  showPendingScheduleDialog();
}

function queueScheduleDialog(force = false) {
  pendingScheduleDialog = true;
  pendingScheduleDialogForce = force;
}

function showPendingScheduleDialog() {
  if (!pendingScheduleDialog) return;
  const force = pendingScheduleDialogForce;
  pendingScheduleDialog = false;
  pendingScheduleDialogForce = false;
  showScheduleDialog(force);
}

function showScheduleDialog(force = false) {
  if (!scheduleDialog || currentRoute !== "home" || scheduleDialog.open) return;
  if (force) scheduleDialogDismissed = false;
  if (scheduleDialogDismissed) return;
  setTimeout(() => {
    if ((force || !scheduleDialogDismissed) && currentRoute === "home" && !scheduleDialog.open) {
      if (typeof scheduleDialog.showModal === "function") {
        scheduleDialog.showModal();
      } else {
        scheduleDialog.setAttribute("open", "");
      }
    }
  }, 120);
}

function closeScheduleDialog() {
  if (!scheduleDialog) return;
  scheduleDialogDismissed = true;
  scheduleDialog.close();
}

function showNotice(message) {
  document.querySelector(".notice")?.remove();
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = message;
  document.body.append(notice);
  setTimeout(() => notice.remove(), 2600);
}

function navigate(routeId, options = {}) {
  if (!routeId) return;
  currentRoute = routeId;
  const hash = routeId === "home" ? "" : `#${encodeURIComponent(routeId)}`;
  if (location.hash !== hash) history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
  if (routeId === "home" && options.showScheduleDialog) queueScheduleDialog(true);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}

function setupInteractions() {
  document.addEventListener("click", (event) => {
    const submenuTrigger = event.target.closest("[data-submenu-trigger]");
    if (submenuTrigger) {
      event.preventDefault();
      const subgroup = submenuTrigger.closest(".nav-subgroup");
      const open = subgroup.classList.toggle("open");
      submenuTrigger.setAttribute("aria-expanded", String(open));
      document.querySelectorAll(".nav-subgroup").forEach((other) => {
        if (other !== subgroup) {
          other.classList.remove("open");
          other.querySelector("[data-submenu-trigger]")?.setAttribute("aria-expanded", "false");
        }
      });
      return;
    }

    const logoHome = event.target.closest("[data-logo-home]");
    if (logoHome) {
      event.preventDefault();
      navigate("home", { showScheduleDialog: true });
      return;
    }

    const route = event.target.closest("[data-route]");
    if (route) {
      event.preventDefault();
      navigate(route.dataset.route);
      return;
    }

    const navButton = event.target.closest(".nav-button");
    if (navButton) {
      const group = navButton.closest(".nav-group");
      const open = group.classList.toggle("open");
      navButton.setAttribute("aria-expanded", String(open));
      document.querySelectorAll(".nav-group").forEach((other) => {
        if (other !== group) {
          other.classList.remove("open");
          other.querySelector(".nav-button")?.setAttribute("aria-expanded", "false");
        }
      });
      return;
    }

    if (event.target.closest("[data-structure-link]")) {
      openStructureLink();
      return;
    }

    if (event.target.closest("[data-vocab-link]")) {
      window.open("https://hurcteams-my.sharepoint.com/:x:/g/personal/10712_hurc_tw/IQCBEZ2tsfP3R5E7IQSNibMHASXddoj6VAvlfPQXgNpzAWI?e=6rbLbc", "_blank", "noreferrer");
      return;
    }

    if (event.target.closest("[data-source-editor]")) {
      openSourceEditor();
      return;
    }

    if (event.target.closest("[data-source-editor-cancel]")) {
      closeSourceEditor();
      return;
    }

    if (event.target.closest("[data-source-editor-unlock]")) {
      unlockSourceEditor();
      return;
    }

    if (event.target.closest("[data-source-editor-save]")) {
      if (!sourceEditorUnlocked) {
        updateSourceEditorLock("請先輸入密碼解鎖");
        return;
      }
      const links = {};
      const meta = {};
      sourceEditorRows.querySelectorAll("[data-source-row]").forEach((row) => {
        const id = row.dataset.sourceRow;
        const value = row.querySelector("[data-source-url]")?.value.trim();
        if (value) links[id] = value;
        meta[id] = {
          unit: row.querySelector("[data-source-unit]")?.value.trim() || "",
          note: row.querySelector("[data-source-note]")?.value.trim() || "",
        };
      });
      saveSourceLinks(links);
      saveSourceMeta(meta);
      closeSourceEditor();
      render();
      showNotice("參考出處資料已儲存在此瀏覽器");
      return;
    }

    const preview = event.target.closest("[data-preview]");
    if (preview) {
      previewImage.src = preview.dataset.preview;
      previewImage.alt = preview.dataset.caption || "";
      previewCaption.textContent = preview.dataset.caption || "";
      dialog.showModal();
      return;
    }

    const carouselNext = event.target.closest("[data-carousel-next]");
    const carouselPrev = event.target.closest("[data-carousel-prev]");
    if (carouselNext || carouselPrev) {
      const group = carouselNext?.dataset.carouselNext || carouselPrev?.dataset.carouselPrev;
      const photos = carouselPhotos[group] || [];
      if (photos.length < 2) return;
      const panes = [...document.querySelectorAll(`[data-carousel-group="${group}"]`)];
      const current = Number(panes[0]?.dataset.index || 0);
      const direction = carouselNext ? 1 : -1;
      const next = (current + direction + photos.length) % photos.length;
      panes.forEach((pane) => {
        pane.dataset.index = String(next);
        pane.classList.toggle("logo-like", /logo/i.test(photos[next].name || ""));
        pane.querySelector("img").src = photos[next].url;
        pane.querySelector(".carousel-caption").textContent = photos[next].name;
      });
      return;
    }

    if (event.target.closest("[data-source-link]")) {
      event.preventDefault();
      openSourceEditor();
    }

    if (event.target.closest("[data-schedule-dialog-close]")) {
      closeScheduleDialog();
    }
  });

  dialog?.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
  document.querySelector(".source-editor-close").addEventListener("click", () => closeSourceEditor());
  scheduleDialog?.addEventListener("close", () => {
    scheduleDialogDismissed = true;
  });
  sourceEditorPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockSourceEditor();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  sourceEditorDialog.addEventListener("click", (event) => {
    if (event.target === sourceEditorDialog) closeSourceEditor();
  });
  scheduleDialog?.addEventListener("click", (event) => {
    if (event.target === scheduleDialog) closeScheduleDialog();
  });
  window.addEventListener("hashchange", () => {
    currentRoute = routeFromHash();
    render();
  });
}

initialize();
