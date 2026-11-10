(function () {
  const $ = (id) => document.getElementById(id);
  const state = { races: [], archive: [], elites: [], checked: "" };

  const STATUS_LABEL = {
    open: "报名中",
    late_open: "补录",
    closed: "报名已截止",
    upcoming_unknown: "尚未开放 / 日期未定",
  };

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function daysUntil(dateStr, from) {
    if (!dateStr) return null;
    const a = Date.parse(from + "T00:00:00");
    const b = Date.parse(dateStr + "T00:00:00");
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function isChina(race) {
    return typeof race.country === "string" && race.country.startsWith("中国");
  }

  function maxKm(race) {
    const nums = (race.categories || [])
      .map((c) => c.distance_km)
      .filter((n) => typeof n === "number");
    return nums.length ? Math.max(...nums) : null;
  }

  function textOf(race) {
    const cats = (race.categories || []).map((c) => c.name).join(" ");
    return [race.name_zh, race.name_en, race.country, race.region, race.organizer, cats]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function fmt(value) {
    if (value === null || value === undefined || value === "") return "未公布";
    return String(value);
  }

  function fmtFee(fee) {
    if (!fee) return "未公布";
    const notes = fee.notes ? `（${fee.notes}）` : "";
    return `${fee.amount} ${fee.currency}${notes}`;
  }

  function fmtNum(n, unit) {
    if (typeof n !== "number") return "未公布";
    return `${n}${unit}`;
  }

  function link(url, label) {
    if (!url) return "未公布";
    const safe = String(url).replace(/"/g, "%22");
    return `<a href="${safe}" rel="noopener noreferrer">${label}</a>`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function lateText(late) {
    if (!late || !late.enabled) return "无";
    const window = late.window ? `窗口 ${typeof late.window === "string" ? late.window : JSON.stringify(late.window)}。` : "";
    return `有。${window}${late.notes || ""}`.trim();
  }

  function badges(race, from) {
    const bits = [`<span class="badge">${esc(STATUS_LABEL[race.status] || race.status)}</span>`];
    if (race.status === "late_open") bits.push('<span class="badge late">补录</span>');
    const left = daysUntil(race.registration_close, from);
    if ((race.status === "open" || race.status === "late_open") && left !== null && left >= 0 && left <= 14) {
      const word = left === 0 ? "今天截止" : `${left} 天内截止`;
      bits.push(`<span class="badge warn">${word}</span>`);
    }
    return bits.join("");
  }

  function categoryTable(race) {
    const rows = race.categories || [];
    if (!rows.length) return "<p>组别未公布。</p>";
    const body = rows
      .map((c) => {
        const itra = c.itra_points === null || c.itra_points === undefined ? "未公布" : esc(c.itra_points);
        const quota = c.quota_or_entrants === null || c.quota_or_entrants === undefined ? "未公布" : esc(c.quota_or_entrants);
        const note = c.notes ? `<div>${esc(c.notes)}</div>` : "";
        return `<tr>
          <td>${esc(c.name)}${note}</td>
          <td>${fmtNum(c.distance_km, " 公里")}</td>
          <td>${fmtNum(c.elevation_gain_m, " 米")}</td>
          <td>${fmtNum(c.cutoff_hours, " 小时")}</td>
          <td>${quota}</td>
          <td>${esc(fmtFee(c.fee))}</td>
          <td>${itra}</td>
        </tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="cats">
      <thead><tr><th>组别</th><th>距离</th><th>爬升</th><th>关门</th><th>名额</th><th>费用</th><th>ITRA / 资格</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function sources(race) {
    return (race.sources || [])
      .map((url) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(url)}</a>`)
      .join("<br>");
  }

  function gear(value) {
    if (value === null || value === undefined || value === "") return "未公布";
    if (Array.isArray(value)) return value.map(esc).join("、");
    return esc(value);
  }

  function sponsors(value) {
    if (!value) return "未公布";
    if (Array.isArray(value)) return value.map(esc).join("、");
    return esc(value);
  }

  function card(race, from, eliteRows) {
    const urgent =
      (race.status === "open" || race.status === "late_open") &&
      daysUntil(race.registration_close, from) !== null &&
      daysUntil(race.registration_close, from) >= 0 &&
      daysUntil(race.registration_close, from) <= 14;
    const eliteHtml = eliteBlock(race, eliteRows);
    return `<article class="card${urgent ? " soon" : ""}">
      <div class="card-head">
        <div>
          <h2>${esc(race.name_zh)}</h2>
          ${race.name_en ? `<p class="en">${esc(race.name_en)}</p>` : ""}
        </div>
        <div class="badges">${badges(race, from)}</div>
      </div>
      <p class="where">${esc(race.country)} · ${esc(fmt(race.region))}</p>
      <dl class="facts">
        <dt>比赛日期</dt><dd>${esc(fmt(race.date_start))}${race.date_end && race.date_end !== race.date_start ? " 至 " + esc(race.date_end) : ""}</dd>
        <dt>报名开放</dt><dd>${esc(fmt(race.registration_open))}</dd>
        <dt>报名截止</dt><dd>${esc(fmt(race.registration_close))}</dd>
        <dt>补录</dt><dd>${esc(lateText(race.late_registration))}</dd>
        <dt>规模</dt><dd>${race.scale_total === null || race.scale_total === undefined ? "未公布" : esc(race.scale_total) + " 人"}</dd>
        <dt>交通</dt><dd>${esc(fmt(race.transport))}</dd>
        <dt>参赛要求</dt><dd>${esc(fmt(race.entry_requirements))}</dd>
        <dt>强制装备</dt><dd>${gear(race.mandatory_gear)}</dd>
        <dt>赞助</dt><dd>${sponsors(race.sponsors)}</dd>
        <dt>主办</dt><dd>${esc(fmt(race.organizer))}</dd>
        <dt>核对日</dt><dd>${esc(fmt(race.last_checked))}</dd>
      </dl>
      ${categoryTable(race)}
      <div class="links">
        ${link(race.official_url, "官网")}
        ${race.registration_url ? link(race.registration_url, "报名入口") : ""}
      </div>
      <p class="src">数据来源：<br>${sources(race)}</p>
      ${eliteHtml}
    </article>`;
  }

  function elitesFor(raceId) {
    return state.elites.filter((row) => row.race_id === raceId);
  }

  function eliteBlock(race, rows) {
    if (!rows || !rows.length) {
      return `<div class="elite"><h3>精英选手</h3><p>暂无已核实的官方或可靠媒体名单。</p></div>`;
    }
    const blocks = rows
      .map((row) => {
        const people = (row.athletes || [])
          .map((a) => `<li><strong>${esc(a.name)}</strong>${a.nationality ? " · " + esc(a.nationality) : ""}${a.notes ? " · " + esc(a.notes) : ""}</li>`)
          .join("");
        const list = people || "<li>名单为空。</li>";
        return `<p><strong>${esc(row.category)}</strong> · 核对 ${esc(row.last_checked || "")}</p>
          <ul>${list}</ul>
          <p class="src">来源：<a href="${esc(row.source_url)}" rel="noopener noreferrer">${esc(row.source_url)}</a>${row.notes ? "<br>" + esc(row.notes) : ""}</p>`;
      })
      .join("");
    return `<div class="elite"><h3>精英选手</h3>${blocks}</div>`;
  }

  function openRaces() {
    const from = todayISO();
    const scope = $("scope").value;
    const country = $("country").value;
    const minKm = Number($("distance").value);
    const q = $("q").value.trim().toLowerCase();
    const sort = $("sort").value;
    let rows = state.races.filter((r) => r.status === "open" || r.status === "late_open");
    if (scope === "china") rows = rows.filter(isChina);
    if (scope === "world") rows = rows.filter((r) => !isChina(r));
    if (country) rows = rows.filter((r) => r.country === country);
    if (minKm > 0) rows = rows.filter((r) => (maxKm(r) || 0) >= minKm);
    if (q) rows = rows.filter((r) => textOf(r).includes(q));
    rows.sort((a, b) => {
      if (sort === "distance") return (maxKm(b) || -1) - (maxKm(a) || -1);
      if (sort === "date") return (a.date_start || "9999").localeCompare(b.date_start || "9999");
      const ac = a.registration_close || "9999-99-99";
      const bc = b.registration_close || "9999-99-99";
      return ac.localeCompare(bc) || (a.date_start || "").localeCompare(b.date_start || "");
    });
    $("open-count").textContent = `显示 ${rows.length} 场。截止日在 14 天内的场次用暖色标出（按你的本地日期 ${from} 计算）。`;
    $("open-list").innerHTML = rows.length
      ? rows.map((r) => card(r, from, elitesFor(r.id))).join("")
      : '<p class="empty">这一组筛选下没有报名中的比赛。</p>';
  }

  function upcomingPool() {
    const from = todayISO();
    return state.races.concat(state.archive).filter((r) => {
      if (!r.date_start && !r.date_end) return true;
      const end = r.date_end || r.date_start;
      return end >= from;
    });
  }

  function renderSoon() {
    const from = todayISO();
    const windowDays = $("soon-window").value;
    const q = $("soon-q").value.trim().toLowerCase();
    let rows = upcomingPool();
    if (windowDays === "90") {
      rows = rows.filter((r) => {
        if (!r.date_start) return false;
        const left = daysUntil(r.date_start, from);
        return left !== null && left <= 90;
      });
    }
    if (q) {
      rows = rows.filter((r) => {
        const names = elitesFor(r.id)
          .flatMap((row) => row.athletes || [])
          .map((a) => a.name)
          .join(" ");
        return (textOf(r) + " " + names).toLowerCase().includes(q);
      });
    }
    rows.sort((a, b) => (a.date_start || "9999").localeCompare(b.date_start || "9999"));
    $("soon-count").textContent = `显示 ${rows.length} 场。报名已截止的比赛仍列在这里，直到开赛，但不会回到报名板。`;
    $("soon-list").innerHTML = rows.length
      ? rows.map((r) => card(r, from, elitesFor(r.id))).join("")
      : '<p class="empty">这个窗口里没有比赛。</p>';
  }

  function fillCountries() {
    const countries = [...new Set(state.races.filter((r) => r.status === "open" || r.status === "late_open").map((r) => r.country))].sort();
    $("country").innerHTML = '<option value="">全部</option>' + countries.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  }

  function setTab(which) {
    const open = which === "open";
    $("tab-open").classList.toggle("is-on", open);
    $("tab-soon").classList.toggle("is-on", !open);
    $("tab-open").setAttribute("aria-selected", String(open));
    $("tab-soon").setAttribute("aria-selected", String(!open));
    $("panel-open").hidden = !open;
    $("panel-soon").hidden = open;
    if (open) openRaces();
    else renderSoon();
  }

  async function load() {
    const [races, archive, elites] = await Promise.all([
      fetch("data/races.json").then((r) => r.json()),
      fetch("data/archive.json").then((r) => r.json()),
      fetch("data/elites.json").then((r) => r.json()),
    ]);
    state.races = races;
    state.archive = archive;
    state.elites = elites;
    const dates = races.concat(archive).map((r) => r.last_checked).filter(Boolean).sort();
    state.checked = dates[dates.length - 1] || "";
    const chinaOpen = races.filter((r) => (r.status === "open" || r.status === "late_open") && isChina(r)).length;
    const worldOpen = races.filter((r) => (r.status === "open" || r.status === "late_open") && !isChina(r)).length;
    const athleteCount = elites.reduce((n, row) => n + (row.athletes ? row.athletes.length : 0), 0);
    $("meta-line").innerHTML = `数据核对日 ${esc(state.checked)}。报名中 ${chinaOpen} 场中国（含港澳台）、${worldOpen} 场国外；档案 ${archive.length} 场；已核实精英 ${athleteCount} 人。原始数据：<a href="data/races.json">races.json</a> · <a href="data/archive.json">archive.json</a> · <a href="data/elites.json">elites.json</a>`;
    fillCountries();
    setTab(location.hash === "#soon" ? "soon" : "open");
  }

  ["scope", "country", "distance", "sort"].forEach((id) => $(id).addEventListener("change", openRaces));
  $("q").addEventListener("input", openRaces);
  $("soon-window").addEventListener("change", renderSoon);
  $("soon-q").addEventListener("input", renderSoon);
  $("tab-open").addEventListener("click", () => {
    history.replaceState(null, "", "#open");
    setTab("open");
  });
  $("tab-soon").addEventListener("click", () => {
    history.replaceState(null, "", "#soon");
    setTab("soon");
  });
  $("filters").addEventListener("submit", (e) => e.preventDefault());

  load().catch((err) => {
    $("load-error").hidden = false;
    $("load-error").textContent = "数据没有加载成功：" + err.message;
  });
})();
