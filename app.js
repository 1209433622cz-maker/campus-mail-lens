import {
  analyzeMail, byOrder, DEMO_NOW, formatDate, formatDeadline, formatReference, normalText,
  PROFILES, prioritize, SOURCES, TOPICS
} from "./classify.js"
import { demoMessages } from "./demo.js"
import { copyForAudience, setPageLanguage, translate } from "./i18n.js"
import { collectMail, mailBodyFormat, mailDisplayText } from "./import-mail.js"
import { insertLocalMail, loadFlags, loadPreference, readLocalMail, saveFlags, savePreference } from "./storage.js"
import { createOutlookReader } from "./outlook-reader.js"

const PAGE_SIZE = 40
const englishCount = new Intl.NumberFormat("en-GB")
const englishSourceMarks = { admin: "A", school: "S", library: "L", college: "C", club: "G", journal: "J", other: "O" }
const $ = id => document.getElementById(id)
const demo = demoMessages.map(message => ({
  ...analyzeMail(message),
  english: analyzeMail({ ...message, ...message.english })
}))
const imported = new Map()
const rememberedProfile = loadPreference("profile", "graduate")
const state = {
  language: loadPreference("language", "zh") === "en" ? "en" : "zh",
  library: loadPreference("library", "demo") === "local" ? "local" : "demo",
  view: "inbox",
  source: "all",
  topic: "all",
  priority: "all",
  sort: "priority",
  profile: Object.hasOwn(PROFILES, rememberedProfile) ? rememberedProfile : "graduate",
  query: "",
  unreadOnly: false,
  flags: loadFlags(),
  selected: null,
  reading: false,
  limit: PAGE_SIZE,
  importing: false,
  loading: true,
  outlook: null
}
const outlookReader = createOutlookReader(outlookChanged)
let outlookMessages = []
let toastTimer
let visibleMessages = []
const t = (key, values) => translate(state.language, key, values)

function countText(count) {
  return state.language === "en" ? englishCount.format(count) : String(count)
}

function activeProfile() {
  return state.library === "outlook" ? state.outlook?.identity?.role ?? "all" : state.profile
}

function outlookChanged(next) {
  const previous = state.outlook
  state.outlook = next
  if (next.messages !== previous?.messages) outlookMessages = next.messages.map(analyzeMail)
  if (next.identity && next.identity.key !== previous?.identity?.key) {
    switchLibrary("outlook")
    return
  }
  if (!next.identity && state.library === "outlook") {
    switchLibrary(imported.size ? "local" : "demo")
    return
  }
  render()
}

function outlookControls() {
  const account = state.outlook?.identity
  const status = state.outlook ?? {}
  $("school-sign-in").hidden = Boolean(account)
  $("school-sign-in").disabled = status.phase === "checking"
  document.querySelector('[data-library="outlook"]').hidden = !account
  $("outlook-status").hidden = !account && !status.problem && status.phase !== "checking"
  $("outlook-refresh").hidden = !account
  $("outlook-refresh").disabled = Boolean(status.pending)
  $("outlook-sign-out").hidden = !account
  $("outlook-account-name").textContent = account ? account.name + " · " + t("profile." + account.role) : t("schoolSignIn")
  let label = status.problem ?? (status.pending ? "outlookSyncing" : status.phase === "checking" ? "outlookConnectPending" : "outlookReady")
  let time
  if (label === "outlookReady" && status.syncedAt) {
    label = "outlookLastSync"
    time = new Intl.DateTimeFormat(state.language === "en" ? "en-GB" : "zh-CN", {
      timeZone: "Asia/Hong_Kong", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(status.syncedAt)
  }
  $("outlook-state").textContent = t(label, { time })
}

function openSchoolSignIn() {
  const phase = state.outlook?.phase ?? "setup"
  if (phase === "setup") {
    $("outlook-redirect").textContent = new URL("./", import.meta.url).href
    $("outlook-dialog").showModal()
  } else if (phase === "error") {
    void outlookReader.start()
  } else {
    void outlookReader.signIn()
  }
}

function visibleCopy(item) {
  return state.language === "en" && item.english ? item.english : item
}

function subjectText(item) {
  const { subject } = visibleCopy(item)
  return subject === "（无主题）" ? t("noSubject") : subject
}

function element(tag, classes, text) {
  const node = document.createElement(tag)
  if (classes) node.className = classes
  if (text !== undefined) node.textContent = text
  return node
}

function icon(name) {
  const mark = element("span", "glyph i-" + name)
  mark.setAttribute("aria-hidden", "true")
  return mark
}

function badge(text, variant = "") {
  return element("span", ("tag " + variant).trim(), text)
}

function button(label, classes, action) {
  const node = element("button", classes, label)
  node.type = "button"
  node.addEventListener("click", action)
  return node
}

function iconButton(label, glyph, pressed, action) {
  const node = button(undefined, "icon-button", action)
  node.append(icon(glyph))
  node.title = label
  node.setAttribute("aria-label", label)
  if (pressed !== null) node.setAttribute("aria-pressed", String(pressed))
  return node
}

function announce(text) {
  clearTimeout(toastTimer)
  $("toast").textContent = text
  $("toast").hidden = false
  toastTimer = setTimeout(() => { $("toast").hidden = true }, 3300)
}

function flags(item) {
  const stored = state.flags[item.id] ?? {}
  return { read: stored.read ?? item.wasRead, saved: Boolean(stored.saved), done: Boolean(stored.done) }
}

function setFlags(item, changes) {
  state.flags[item.id] = { ...flags(item), ...changes }
  if (!saveFlags(state.flags)) announce(t("flagsError"))
}

function senderIcon(item) {
  const symbol = state.language === "en" ? englishSourceMarks[item.source] : SOURCES[item.source].glyph
  const mark = element("span", "sender-icon source-" + item.source, symbol)
  mark.setAttribute("aria-hidden", "true")
  return mark
}

function clearSelection() {
  state.selected = null
  state.reading = false
  state.limit = PAGE_SIZE
}

function updateFilters() {
  clearSelection()
  render()
}

function clearFilters() {
  Object.assign(state, { source: "all", topic: "all", priority: "all", query: "", unreadOnly: false })
  $("search").value = ""
  updateFilters()
}

function switchView(view) {
  state.view = view
  clearFilters()
}

function switchLibrary(library) {
  state.library = library
  savePreference("library", library)
  switchView("inbox")
}

function sourceMenu() {
  for (const key of Object.keys(SOURCES)) {
    const node = button(undefined, "nav-item source-" + key, () => {
      state.source = state.source === key ? "all" : key
      updateFilters()
    })
    node.dataset.source = key
    const dot = element("span", "source-dot")
    dot.setAttribute("aria-hidden", "true")
    const label = element("span", "", t("source." + key))
    label.dataset.copy = "source." + key
    node.append(dot, label, element("span", "nav-count", "0"))
    $("source-list").append(node)
    const option = new Option(t("source." + key), key)
    option.dataset.copy = "source." + key
    $("source-filter").add(option)
  }
}

function empty(title, description, action) {
  const block = element("div", "empty")
  const symbol = element("span", "metric-icon")
  symbol.append(icon("inbox"))
  block.append(symbol, element("h2", "", title))
  if (description) block.append(element("p", "", description))
  if (action) block.append(button(action.label, "button", action.run))
  return block
}

function rowFor(entry) {
  const { item, priority, status } = entry
  const row = element("button", "mail-row")
  row.type = "button"
  row.dataset.id = item.id
  row.dataset.unread = String(!status.read)
  row.setAttribute("aria-pressed", String(item.id === state.selected))
  const contents = element("span", "row-content")
  const metadata = element("span", "row-eyebrow")
  if (!status.read) {
    const unread = element("span", "unread-dot")
    unread.setAttribute("aria-label", t("unread"))
    metadata.append(unread)
  }
  metadata.append(
    element("span", "row-sender", visibleCopy(item).senderName),
    element("time", "row-date", formatDate(item.sentAt, "short", state.language))
  )
  const tags = element("span", "row-tags")
  tags.append(badge(t("priority." + priority.level), "priority-" + priority.level), badge(t("topic." + item.topic)))
  if (item.deadline.date && priority.level !== "unrelated") {
    tags.append(element("span", "row-due " + priority.level, formatDeadline(item.deadline, true, state.language)))
  }
  if (status.saved) {
    const pinned = icon("bookmark")
    pinned.classList.add("saved-indicator")
    tags.append(pinned)
  }
  contents.append(metadata, element("strong", "mail-subject", subjectText(item)), tags)
  row.append(senderIcon(item), contents)
  return row
}

function selectors(inbox, entries) {
  $("inbox-count").textContent = countText(inbox.length)
  $("saved-count").textContent = countText(entries.filter(entry => entry.status.saved).length)
  $("done-count").textContent = countText(entries.filter(entry => entry.status.done).length)
  for (const group of document.querySelectorAll("[data-library]")) group.setAttribute("aria-pressed", String(group.dataset.library === state.library))
  for (const toggle of document.querySelectorAll("[data-view]")) {
    if (toggle.dataset.view === state.view) toggle.setAttribute("aria-current", "page")
    else toggle.removeAttribute("aria-current")
  }
  for (const control of document.querySelectorAll("[data-source]")) {
    control.querySelector(".nav-count").textContent = countText(inbox.filter(entry => entry.item.source === control.dataset.source).length)
    control.setAttribute("aria-current", control.dataset.source === state.source ? "page" : "false")
  }
  for (const quick of document.querySelectorAll("[data-quick]")) {
    const level = quick.dataset.quick
    $(level + "-count").textContent = countText(inbox.filter(entry => entry.priority.level === level).length)
    quick.setAttribute("aria-pressed", String(state.priority === level && state.view === "inbox"))
  }
  $("profile").value = activeProfile()
  $("profile").disabled = state.library === "outlook"
  $("source-filter").value = state.source
  $("topic-filter").value = state.topic
  $("priority-filter").value = state.priority
  $("sort").value = state.sort
  $("unread-only").checked = state.unreadOnly
  $("page-title").textContent = t("view." + state.view)
  $("breadcrumb-current").textContent = t("view." + state.view)
  $("page-description").textContent = t("viewDescription." + state.view)
  outlookControls()
}

function matchesSearch(item, words) {
  if (!words.length) return true
  const labels = [t("source." + item.source), t("topic." + item.topic), copyForAudience(state.language, item.audience)]
    .join(" ").toLowerCase()
  return words.every(word => item.search.includes(word) || item.english?.search.includes(word) || labels.includes(word))
}

function render() {
  const now = state.library === "demo" ? DEMO_NOW : Date.now()
  const data = state.library === "demo" ? demo : state.library === "outlook" ? outlookMessages : imported.values()
  const profile = activeProfile()
  const entries = Array.from(data, item => ({ item, status: flags(item), priority: prioritize(item, profile, now) }))
  const inbox = entries.filter(entry => !entry.status.done)
  const scoped = state.view === "inbox" ? inbox : entries.filter(entry => entry.status[state.view])
  const words = normalText(state.query).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filterActive = Boolean(words.length || state.unreadOnly || [state.source, state.topic, state.priority].some(value => value !== "all"))
  $("reference-date").textContent = t(state.library === "demo" ? "demoDate" : "campusTime")
    + " · " + formatReference(now, state.language)
  selectors(inbox, entries)
  visibleMessages = scoped.filter(({ item, status, priority }) =>
    (state.source === "all" || item.source === state.source)
    && (state.topic === "all" || item.topic === state.topic)
    && (state.priority === "all" || priority.level === state.priority)
    && (!state.unreadOnly || !status.read)
    && matchesSearch(item, words)
  ).sort((a, b) => byOrder(state.sort, a, b))
  const current = scoped.find(entry => entry.item.id === state.selected)
  const selection = current ?? visibleMessages[0]
  if (!current) state.reading = false
  state.selected = selection?.item.id ?? null
  $("result-count").textContent = t(visibleMessages.length === 1 ? "results.one" : "results.other", { count: countText(visibleMessages.length) })
  $("reset-filters").hidden = !filterActive
  $("show-more").hidden = visibleMessages.length <= state.limit
  if (visibleMessages.length) {
    $("mail-list").replaceChildren(...visibleMessages.slice(0, state.limit).map(rowFor))
  } else if (state.library === "local" && !entries.length) {
    $("mail-list").replaceChildren(state.loading
      ? empty(t("loadingLocal"))
      : empty(t("noLocalTitle"), t("noLocalDescription"), { label: t("importFirst"), run: openImport }))
  } else if (state.library === "outlook" && !entries.length) {
    const status = state.outlook
    $("mail-list").replaceChildren(status.pending
      ? empty(t("outlookSyncing"))
      : empty(t("outlookEmpty"), t(status.problem ?? "outlookNoRelevant")))
  } else {
    const title = filterActive ? "noMatches" : state.view === "saved" ? "noSaved" : state.view === "done" ? "noDone" : "noInbox"
    $("mail-list").replaceChildren(empty(t(title), undefined, filterActive ? { label: t("clearFilters"), run: clearFilters } : null))
  }
  $("workspace").classList.toggle("is-reading", Boolean(state.reading && selection))
  drawDetail(selection)
}

function detailFact(term, value, urgent = false) {
  const row = element("div")
  row.append(element("dt", "", term), element("dd", urgent ? "is-urgent" : "", value))
  return row
}

function backToList() {
  state.reading = false
  render()
  const row = Array.from($("mail-list").children).find(node => node.dataset.id === state.selected)
  if (row) row.focus()
  else $("search").focus()
}

function drawDetail(entry) {
  const pane = $("detail")
  if (!entry) {
    pane.replaceChildren(empty(t("selectMail")))
    return
  }
  const { item, priority, status } = entry
  const shown = visibleCopy(item)
  const preview = mailBodyFormat(item) === "preview"
  const { text: bodyText, hasInlineImages } = mailDisplayText(shown)
  const outer = element("div", "detail-inner")
  const bar = element("div", "detail-toolbar")
  const actions = element("div", "detail-actions")
  actions.append(
    iconButton(t(status.read ? "markUnread" : "markRead"), "mail", null, () => {
      setFlags(item, { read: !status.read })
      render()
      announce(t(status.read ? "markedUnread" : "markedRead"))
    }),
    iconButton(t(status.saved ? "unsaveMail" : "saveMail"), "bookmark", status.saved, () => {
      setFlags(item, { saved: !status.saved })
      render()
      announce(t(status.saved ? "unsavedMail" : "savedMail"))
    }),
    iconButton(t(status.done ? "restoreMail" : "processMail"), "check", status.done, () => {
      setFlags(item, { done: !status.done })
      render()
      announce(t(status.done ? "restoredMail" : "processedMail"))
    })
  )
  bar.append(element("span", "", t("detail")), button(t("backToList"), "button back-to-list", backToList), actions)

  const sender = element("div", "detail-sender")
  const senderMeta = element("div")
  const senderContext = [formatDate(item.sentAt, "full", state.language), state.library === "demo" ? t("sample") : item.senderEmail].filter(Boolean).join(" · ")
  senderMeta.append(element("strong", "", shown.senderName), element("p", "", senderContext))
  sender.append(senderIcon(item), senderMeta)

  const tags = element("div", "detail-tags")
  tags.append(badge(t("priority." + priority.level), "priority-" + priority.level), badge(t("source." + item.source)), badge(t("topic." + item.topic)))
  if (state.library !== "demo" && item.campusDomain) tags.append(badge(t("campusSender")))
  const facts = element("dl", "facts")
  const audience = copyForAudience(state.language, item.audience)
  facts.append(
    detailFact(t("audience"), audience),
    detailFact(t("deadline"), formatDeadline(item.deadline, false, state.language), priority.level === "soon")
  )
  if (preview) facts.append(detailFact(t("bodyCoverage"), t("previewCoverage")))
  if (hasInlineImages) facts.append(detailFact(t("bodyImages"), t("bodyImagesCoverage")))

  const reason = element("div", "reason")
  const reasonKey = preview && priority.level === "info" ? "reason.preview" : priority.reasonKey
  reason.append(element("h3", "", t("reason")), element("p", "", t(reasonKey, { audience, profile: t("profile." + activeProfile()) })))
  const quote = shown === item || !priority.quote ? priority.quote
    : prioritize(shown, state.profile, DEMO_NOW).quote
  if (quote) reason.append(element("p", "source-line", t("quote", { text: quote.slice(0, 230) })))

  const content = element("details", "mail-body")
  content.open = true
  content.append(
    element("summary", "", t(preview ? "preview" : "original")),
    element("p", "", bodyText || t("bodyEmpty"))
  )
  outer.append(bar, element("h2", "detail-subject", subjectText(item)), sender, tags, facts, reason)
  if (item.originalUrl) {
    const original = element("a", "original-link", t("outlook"))
    original.href = item.originalUrl
    original.target = "_blank"
    original.rel = "noopener noreferrer"
    outer.append(original)
  }
  outer.append(content)
  pane.replaceChildren(outer)
}

function openImport() {
  $("import-progress").textContent = state.importing ? t("readingFiles") : ""
  $("import-progress").classList.remove("error")
  $("import-dialog").showModal()
}

async function importFiles(input) {
  const files = Array.from(input)
  if (!files.length || state.importing) return
  state.importing = true
  $("import-files").disabled = true
  const progress = $("import-progress")
  progress.classList.remove("error")
  try {
    const parsed = await collectMail(files, (current, total, count) => {
      progress.textContent = t("importProgress", { current, total, count: countText(count) })
    })
    if (!parsed.messages.length) {
      progress.textContent = t("importInvalid")
      progress.classList.add("error")
      return
    }
    const result = await insertLocalMail(parsed.messages)
    for (const mail of result.inserted) imported.set(mail.id, analyzeMail(mail))
    if (result.duplicate) {
      for (const mail of await readLocalMail()) if (!imported.has(mail.id)) imported.set(mail.id, analyzeMail(mail))
    }
    if ($("import-dialog").open) $("import-dialog").close()
    switchLibrary("local")
    announce(t("imported", { count: countText(result.inserted.length) })
      + (result.duplicate ? t("duplicate", { count: countText(result.duplicate) }) : "")
      + (parsed.skipped ? t("skipped", { count: countText(parsed.skipped) }) : ""))
  } catch {
    progress.textContent = t("storageError")
    progress.classList.add("error")
    if (!$("import-dialog").open) announce(progress.textContent)
  } finally {
    state.importing = false
    $("import-files").disabled = false
    $("import-files").value = ""
  }
}

function connectControls() {
  sourceMenu()
  for (const key of Object.keys(TOPICS)) {
    const option = new Option(t("topic." + key), key)
    option.dataset.copy = "topic." + key
    $("topic-filter").add(option)
  }
  $("language-toggle").addEventListener("click", () => {
    state.language = state.language === "en" ? "zh" : "en"
    savePreference("language", state.language)
    setPageLanguage(state.language)
    $("toast").hidden = true
    render()
  })
  for (const control of document.querySelectorAll("[data-library]")) {
    control.addEventListener("click", () => switchLibrary(control.dataset.library))
  }
  for (const control of document.querySelectorAll("[data-view]")) {
    control.addEventListener("click", () => switchView(control.dataset.view))
  }
  for (const control of document.querySelectorAll("[data-quick]")) {
    control.addEventListener("click", () => {
      state.priority = state.view === "inbox" && state.priority === control.dataset.quick ? "all" : control.dataset.quick
      state.view = "inbox"
      updateFilters()
    })
  }
  for (const [field, property] of [["topic-filter", "topic"], ["priority-filter", "priority"], ["source-filter", "source"], ["sort", "sort"]]) {
    $(field).addEventListener("change", event => {
      state[property] = event.target.value
      updateFilters()
    })
  }
  $("profile").addEventListener("change", event => {
    state.profile = event.target.value
    savePreference("profile", state.profile)
    updateFilters()
  })
  $("search").addEventListener("input", event => {
    state.query = event.target.value
    updateFilters()
  })
  $("unread-only").addEventListener("change", event => {
    state.unreadOnly = event.target.checked
    updateFilters()
  })
  $("reset-filters").addEventListener("click", clearFilters)
  $("show-more").addEventListener("click", () => {
    state.limit += PAGE_SIZE
    render()
  })
  $("mail-list").addEventListener("click", event => {
    const row = event.target.closest("button[data-id]")
    const entry = visibleMessages.find(mail => mail.item.id === row?.dataset.id)
    if (!entry) return
    state.selected = entry.item.id
    state.reading = true
    if (!entry.status.read) setFlags(entry.item, { read: true })
    render()
    if (matchMedia("(max-width: 955px)").matches) {
      $("detail").querySelector(".back-to-list")?.focus({ preventScroll: true })
      $("workspace").scrollIntoView({ block: "start" })
    }
  })
  $("about-button").addEventListener("click", () => $("about-dialog").showModal())
  $("import-button").addEventListener("click", openImport)
  $("school-sign-in").addEventListener("click", openSchoolSignIn)
  $("outlook-refresh").addEventListener("click", () => { void outlookReader.refresh({ manual: true }) })
  $("outlook-sign-out").addEventListener("click", () => { void outlookReader.signOut() })
  for (const control of document.querySelectorAll("[data-close]")) {
    control.addEventListener("click", () => $(control.dataset.close).close())
  }
  $("import-files").addEventListener("change", event => { void importFiles(event.target.files) })
  $("drop-zone").addEventListener("dragover", event => {
    event.preventDefault()
    $("drop-zone").classList.add("is-over")
  })
  $("drop-zone").addEventListener("dragleave", () => $("drop-zone").classList.remove("is-over"))
  $("drop-zone").addEventListener("drop", event => {
    event.preventDefault()
    $("drop-zone").classList.remove("is-over")
    void importFiles(event.dataTransfer.files)
  })
  window.addEventListener("storage", event => {
    if (event.key === "campus-mail-lens:reading") {
      state.flags = loadFlags()
      render()
    }
  })
}

connectControls()
setPageLanguage(state.language)
render()
void outlookReader.start()
try {
  for (const mail of await readLocalMail()) imported.set(mail.id, analyzeMail(mail))
} catch {
  if (state.library === "local") announce(t("localError"))
} finally {
  state.loading = false
  if (state.library === "local") render()
}
