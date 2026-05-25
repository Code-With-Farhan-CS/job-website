(function () {
  const { jobs, companies } = window.HIREFLOW_DATA;
  const page = document.body.dataset.page;
  const storageKeys = {
    saved: "hireflow:saved-jobs",
    theme: "hireflow:theme"
  };

  let visibleCount = 9;
  let currentJobId = null;
  const filters = {
    query: "",
    type: "",
    level: "",
    salary: "",
    location: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function init() {
    initTheme();
    initMobileMenu();
    initModalClose();
    initApplyForm();

    if (page === "home") initHome();
    if (page === "saved") renderSavedJobs();
    if (page === "companies") renderCompanies();
    if (page === "detail") renderDetailPage();
  }

  function getSavedJobs() {
    return JSON.parse(localStorage.getItem(storageKeys.saved) || "[]");
  }

  function setSavedJobs(ids) {
    localStorage.setItem(storageKeys.saved, JSON.stringify(ids));
  }

  function isSaved(jobId) {
    return getSavedJobs().includes(jobId);
  }

  function toggleSaved(jobId) {
    const saved = getSavedJobs();
    const exists = saved.includes(jobId);
    const updated = exists ? saved.filter((id) => id !== jobId) : [...saved, jobId];
    setSavedJobs(updated);
    toast(exists ? "Job removed from saved roles." : "Job saved to your shortlist.");

    if (page === "home") renderJobs(false);
    if (page === "saved") renderSavedJobs();
    if (page === "detail") renderDetailPage();
    if ($("#jobModal")?.classList.contains("show")) openJobModal(jobId);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(storageKeys.theme);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

    $$(".theme-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem(storageKeys.theme, next);
        applyTheme(next);
      });
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $$(".theme-toggle").forEach((button) => {
      $(".theme-icon", button).textContent = theme === "dark" ? "☀" : "☾";
      $(".theme-label", button).textContent = theme === "dark" ? "Light" : "Dark";
    });
  }

  function initMobileMenu() {
    const toggle = $(".menu-toggle");
    const menu = $("#navMenu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("show");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function initHome() {
    renderSkeletons();
    setTimeout(() => renderJobs(true), 550);

    $("#jobSearchForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      filters.query = $("#searchInput").value.trim().toLowerCase();
      visibleCount = 9;
      renderJobs(false);
    });

    $("#searchInput")?.addEventListener("input", (event) => {
      filters.query = event.target.value.trim().toLowerCase();
      visibleCount = 9;
      renderJobs(false);
    });

    $$("[data-filter]").forEach((control) => {
      control.addEventListener("change", () => {
        filters[control.dataset.filter] = control.value;
        visibleCount = 9;
        renderJobs(false);
      });
    });

    $("#clearFilters")?.addEventListener("click", clearFilters);
    $("#loadMore")?.addEventListener("click", () => {
      visibleCount += 6;
      renderJobs(false);
    });

    $(".filter-open")?.addEventListener("click", () => $("#filterPanel").classList.add("show"));
    $(".filter-close")?.addEventListener("click", () => $("#filterPanel").classList.remove("show"));
  }

  function renderSkeletons() {
    const skeletonGrid = $("#skeletonGrid");
    if (!skeletonGrid) return;
    skeletonGrid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join("");
  }

  function filterJobs() {
    return jobs.filter((job) => {
      const haystack = [job.title, job.company, job.location, job.type, job.level, ...job.skills].join(" ").toLowerCase();
      const matchesQuery = !filters.query || haystack.includes(filters.query);
      const matchesType = !filters.type || job.type === filters.type;
      const matchesLevel = !filters.level || job.level === filters.level;
      const matchesLocation = !filters.location || job.location.includes(filters.location);
      const matchesSalary = !filters.salary || salaryMatches(job, filters.salary);
      return matchesQuery && matchesType && matchesLevel && matchesLocation && matchesSalary;
    });
  }

  function salaryMatches(job, range) {
    const [min, max] = range.split("-").map(Number);
    return job.salaryMax >= min && job.salaryMin <= max;
  }

  function renderJobs(hideSkeleton) {
    const grid = $("#jobGrid");
    if (!grid) return;

    const skeletonGrid = $("#skeletonGrid");
    if (hideSkeleton) skeletonGrid?.classList.add("hidden");

    const filtered = filterJobs();
    const shown = filtered.slice(0, visibleCount);
    $("#jobCount").textContent = filtered.length;
    grid.innerHTML = shown.map(jobCardTemplate).join("");
    bindJobCards(grid);
    renderActiveFilters();

    $("#emptyState")?.classList.toggle("hidden", filtered.length > 0);
    $("#loadMore")?.classList.toggle("hidden", visibleCount >= filtered.length);
  }

  function jobCardTemplate(job, options = {}) {
    const saved = isSaved(job.id);
    const primaryAction = options.removeMode
      ? `<button class="btn btn-secondary" type="button" data-remove-saved="${job.id}">Remove</button>`
      : `<button class="btn btn-secondary" type="button" data-open-job="${job.id}">Details</button>`;
    return `
      <article class="job-card" data-job-id="${job.id}">
        <div class="card-top">
          <img class="logo" src="${job.logo}" alt="${job.company} logo">
          <button class="icon-btn bookmark ${saved ? "saved" : ""}" type="button" data-save="${job.id}" aria-label="${saved ? "Unsave" : "Save"} ${job.title}">
            ${saved ? "★" : "☆"}
          </button>
        </div>
        <h3>${job.title}</h3>
        <div class="company-name">${job.company}</div>
        <div class="job-meta">
          <span class="pill">${job.location}</span>
          <span class="pill">${job.type}</span>
          <span class="pill">${job.level}</span>
        </div>
        <div class="salary">$${job.salaryMin}k - $${job.salaryMax}k</div>
        <div class="posted">${job.posted}</div>
        <div class="tags">${job.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}</div>
        <div class="card-actions">
          ${primaryAction}
          <a class="btn btn-primary" href="job-detail.html?id=${job.id}">View Page</a>
        </div>
      </article>
    `;
  }

  function bindJobCards(root) {
    $$("[data-save]", root).forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSaved(button.dataset.save);
      });
    });

    $$("[data-open-job]", root).forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openJobModal(button.dataset.openJob);
      });
    });

    $$("[data-remove-saved]", root).forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSaved(button.dataset.removeSaved);
      });
    });

    $$(".job-card", root).forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        openJobModal(card.dataset.jobId);
      });
    });
  }

  function renderActiveFilters() {
    const target = $("#activeFilters");
    if (!target) return;

    const entries = Object.entries(filters).filter(([, value]) => value);
    target.innerHTML = entries.map(([key, value]) => `
      <span class="filter-chip">
        ${key === "query" ? "Search" : labelFor(key)}: ${value}
        <button type="button" data-remove-filter="${key}" aria-label="Remove ${key} filter">×</button>
      </span>
    `).join("");

    $$("[data-remove-filter]", target).forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.removeFilter;
        filters[key] = "";
        if (key === "query") $("#searchInput").value = "";
        const control = $(`[data-filter="${key}"]`);
        if (control) control.value = "";
        renderJobs(false);
      });
    });
  }

  function labelFor(key) {
    return {
      type: "Type",
      level: "Level",
      salary: "Salary",
      location: "Location"
    }[key] || key;
  }

  function clearFilters() {
    Object.keys(filters).forEach((key) => filters[key] = "");
    $("#searchInput").value = "";
    $$("[data-filter]").forEach((control) => control.value = "");
    visibleCount = 9;
    renderJobs(false);
  }

  function openJobModal(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    const modal = $("#jobModal");
    const content = $("#jobModalContent");
    if (!job || !modal || !content) return;

    currentJobId = jobId;
    content.innerHTML = jobDetailTemplate(job, false);
    bindDetailActions(content, job);
    openModal(modal);
  }

  function jobDetailTemplate(job, fullPage) {
    const saved = isSaved(job.id);
    return `
      <div class="${fullPage ? "detail-hero" : "modal-hero"}">
        <img class="logo" src="${job.logo}" alt="${job.company} logo">
        <div>
          <span class="section-kicker">${job.company}</span>
          <h${fullPage ? "1" : "2"} id="modalTitle">${job.title}</h${fullPage ? "1" : "2"}>
          <div class="meta">${job.location} · ${job.type} · ${job.level}</div>
        </div>
      </div>
      <div class="modal-stats">
        <span class="pill salary">$${job.salaryMin}k - $${job.salaryMax}k</span>
        <span class="pill">${job.posted}</span>
        ${job.skills.map((skill) => `<span class="pill">${skill}</span>`).join("")}
      </div>
      <div class="${fullPage ? "detail-content" : ""}">
        <div>
          <section class="modal-section">
            <h3>Description</h3>
            <p>${job.description}</p>
          </section>
          <section class="modal-section">
            <h3>Requirements</h3>
            <ul>${job.requirements.map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
          <section class="modal-section">
            <h3>Responsibilities</h3>
            <ul>${job.responsibilities.map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
        </div>
        <aside class="${fullPage ? "detail-sidebar" : ""}">
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" data-apply="${job.id}">Apply Now</button>
            <button class="btn btn-secondary" type="button" data-save="${job.id}">${saved ? "Saved" : "Save Job"}</button>
          </div>
        </aside>
      </div>
    `;
  }

  function bindDetailActions(root, job) {
    $("[data-apply]", root)?.addEventListener("click", () => openApplyModal(job));
    $("[data-save]", root)?.addEventListener("click", () => toggleSaved(job.id));
  }

  function renderSavedJobs() {
    const grid = $("#savedGrid");
    if (!grid) return;
    const savedJobs = jobs.filter((job) => isSaved(job.id));
    grid.innerHTML = savedJobs.map((job) => jobCardTemplate(job, { removeMode: true })).join("");
    bindJobCards(grid);
    $("#savedEmpty")?.classList.toggle("hidden", savedJobs.length > 0);
  }

  function renderCompanies() {
    const grid = $("#companyGrid");
    if (!grid) return;
    grid.innerHTML = companies.map((company) => `
      <article class="company-card" data-company-id="${company.id}">
        <div class="company-top">
          <img class="logo" src="${company.logo}" alt="${company.name} logo">
          <span class="pill">${company.openRoles} open roles</span>
        </div>
        <h3>${company.name}</h3>
        <div class="company-name">${company.industry}</div>
        <p>${company.description}</p>
        <div class="company-facts">
          <span><strong>Location</strong>${company.location}</span>
          <span><strong>Size</strong>${company.size}</span>
        </div>
      </article>
    `).join("");

    $$(".company-card", grid).forEach((card) => {
      card.addEventListener("click", () => openCompanyModal(card.dataset.companyId));
    });
  }

  function openCompanyModal(companyId) {
    const company = companies.find((item) => item.id === companyId);
    const content = $("#companyModalContent");
    const modal = $("#companyModal");
    if (!company || !content || !modal) return;
    const openJobs = jobs.filter((job) => job.companyId === company.id);

    content.innerHTML = `
      <div class="modal-hero">
        <img class="logo" src="${company.logo}" alt="${company.name} logo">
        <div>
          <span class="section-kicker">${company.industry}</span>
          <h2 id="companyModalTitle">${company.name}</h2>
          <div class="meta">${company.location} · ${company.size}</div>
        </div>
      </div>
      <section class="modal-section">
        <h3>About</h3>
        <p>${company.description}</p>
      </section>
      <section class="modal-section">
        <h3>Open roles</h3>
        <div class="tags">${openJobs.map((job) => `<a class="tag" href="job-detail.html?id=${job.id}">${job.title}</a>`).join("")}</div>
      </section>
    `;
    openModal(modal);
  }

  function renderDetailPage() {
    const detail = $("#detailPage");
    if (!detail) return;
    const params = new URLSearchParams(window.location.search);
    const job = jobs.find((item) => item.id === params.get("id")) || jobs[0];
    currentJobId = job.id;
    document.title = `${job.title} - HireFlow`;
    detail.innerHTML = jobDetailTemplate(job, true);
    bindDetailActions(detail, job);
  }

  function openApplyModal(job) {
    currentJobId = job.id;
    const title = $("#applyTitle");
    const subtitle = $("#applySubtitle");
    if (title) title.textContent = `Apply for ${job.title}`;
    if (subtitle) subtitle.textContent = `${job.company} will receive your profile and cover letter.`;
    $("#applyForm")?.classList.remove("hidden");
    $("#applySuccess")?.classList.add("hidden");
    $("#applyForm")?.reset();
    openModal($("#applyModal"));
  }

  function initApplyForm() {
    $("#applyForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      $("#applyForm").classList.add("hidden");
      $("#applySuccess").classList.remove("hidden");
      $("#applySuccess").style.display = "grid";
      launchConfetti();
      const job = jobs.find((item) => item.id === currentJobId);
      toast(`Application sent${job ? ` to ${job.company}` : ""}.`);
    });
  }

  function initModalClose() {
    $$(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(backdrop);
      });
      $(".modal-close", backdrop)?.addEventListener("click", () => closeModal(backdrop));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        $$(".modal-backdrop.show").forEach(closeModal);
      }
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    if (!$$(".modal-backdrop.show").length) document.body.classList.remove("modal-open");
  }

  function launchConfetti() {
    const colors = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"];
    for (let i = 0; i < 34; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 180}ms`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1300);
    }
  }

  function toast(message) {
    const toastEl = $("#toast");
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastEl.timer);
    toastEl.timer = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
