import { translate } from "./i18n.js"

export const DEMO_NOW = Date.parse("2026-11-23T17:00:00+08:00")
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const CAMPUS_OFFSET = 8 * HOUR

export const PROFILES = {
  graduate: "研究生",
  undergraduate: "本科生",
  student: "学生",
  faculty: "教师",
  staff: "行政员工",
  employee: "教职员工",
  all: "全部师生"
}
const profileGroups = {
  student: ["graduate", "undergraduate"],
  employee: ["faculty", "staff"]
}

export const SOURCES = {
  admin: { label: "行政部门", glyph: "行" },
  school: { label: "学院与学术单位", glyph: "院" },
  library: { label: "图书馆与信息服务", glyph: "图" },
  college: { label: "书院", glyph: "书" },
  club: { label: "社团与学生组织", glyph: "社" },
  journal: { label: "学术期刊", glyph: "刊" },
  other: { label: "其他来源", glyph: "其" }
}

export const TOPICS = {
  academic: "课程与教务",
  research: "科研与讲座",
  opportunity: "竞赛与征集",
  career: "实习与就业",
  activity: "校园活动",
  service: "校园服务",
  general: "综合通知"
}

export const PRIORITIES = {
  soon: "即将截止",
  action: "需要行动",
  info: "一般通知",
  unrelated: "其他人群",
  expired: "已经截止"
}

const priorityOrder = Object.keys(PRIORITIES)
const sourceMatchers = [
  ["library", /图书馆|资讯科技服务处|信息技术(?:服务)?|信息办|library|\bitso\b|information technology services/i],
  ["club", /社团|学生会|学生组织|学生社团|(?:student|students') (?:union|society|association|club)|\bclub\b/i],
  ["college", /书院|(?:harmonia|diligentia|muse|shaw|ling|minerva|duan family|tiancheng) college/i],
  ["school", /学院|学科部|研究院|实验室|论坛|school of|department of|faculty of|graduate program|postgraduate program|research institute|(?:science|academic) forum/i],
  ["admin", /教务|注册|行政|服务中心|招生|大学艺术中心|事务|规划|发展处|人力资源|财务|就业|国际交流|office|registry|counselling|counseling|admissions?|campus services|administration|student affairs/i]
]
const journalDomains = [
  "springernature.com", "springer.com", "springeropen.com", "nature.com", "biomedcentral.com",
  "elsevier.com", "sciencedirect.com", "cell.com", "thelancet.com", "wiley.com", "wiley-vch.de",
  "taylorandfrancis.com", "tandfonline.com", "tandf.co.uk",
  "editorialmanager.com", "manuscriptcentral.com", "scholarone.com", "ejpress.com",
  "mdpi.com", "frontiersin.org", "plos.org", "sagepub.com", "oup.com", "ieee.org"
]
const manuscriptNotices = [
  /\b(?:manuscript|submission|article|paper)\s+(?:id|number|no\.?|reference)[\s:#-]+[\w./-]*\d/i,
  /\b(?:submission (?:confirmation|received|status update)|status of your (?:manuscript|submission|article)|manuscript (?:received|submitted|under review)|editorial decision|decision (?:on|for) (?:your |the )?(?:manuscript|submission|paper)|(?:major|minor) revision|revision (?:request(?:ed)?|deadline|due)|(?:page|galley) proofs?|proofs? (?:ready|available|for (?:your |the )?article)|article publishing agreement)\b/i,
  /\b(?:thank you for submitting (?:your |the )?(?:manuscript|article|paper)|please submit (?:your |a )?revised manuscript)\b/i,
  /\byour (?:revised )?(?:manuscript|submission|article|paper)\b[^.!?\n]{0,90}\b(?:been (?:received|submitted|assigned|sent|accepted|declined|rejected|published|returned|withdrawn)|(?:is|now) (?:with (?:the |an )?editor|under (?:peer )?review|accepted|published)|publishing agreement|license agreement)\b/i,
  /稿件\s*(?:编号|号码|ID)|投稿\s*(?:确认|成功|已收到|进展|状态)|(?:稿件|论文|投稿).{0,12}(?:已收到|已提交|已送审|外审中|评审中|审稿中|已录用|已拒稿|已发表|已退回)|(?:返修|修回|修订)(?:通知|要求|截止)|录用通知|拒稿通知|(?:论文|稿件)校样|校样(?:通知|已可查看|确认|截止)/i
]
const topicMatchers = [
  ["career", /校招|招聘|就业|宣讲|实习|职业|career|internship|recruitment|job fair/i],
  ["opportunity", /大赛|竞赛|挑战赛|征稿|征集|招募|申报|哈克松|hackathon|competition|call for (?:papers|submissions|proposals|applications)/i],
  ["academic", /选课|补退选|教务|学籍|学费|注册|考试|成绩|课程|教学|交换申请|course\b|add.drop|registration (?:check|period)|exam\b|academic record/i],
  ["research", /研究|科研|学术|课题|讲座|研讨|论坛|seminar|research|colloquium|symposium/i],
  ["activity", /活动|工作坊|展览|艺术节|沙龙|志愿|迎新|讲演|concert|workshop|welcome|exhibition|volunteer/i],
  ["service", /图书馆|开放|维护|门禁|停机|食堂|校园卡|服务|网络|library|service|maintenance|opening hours/i]
]

const degreeRoles = {
  graduate: /研究生|硕士|博士|postgraduate|\bgraduate students?\b|\bphd\b|\bdoctoral students?\b/i,
  undergraduate: /本科生|本科|undergraduate|\bug students?\b|\bfreshmen\b/i,
  faculty: /教师|教授|老师|\bfaculty\b|\bteachers?\b/i,
  staff: /(?:行政)?员工|行政人员|职员|职工|\b(?:administrative )?staff\b/i
}

const audiencePrefix = /适用对象|报名对象|招生对象|参与对象|活动对象|目标人群|适用人群|面向|仅对|仅限|参加资格|目标读者|eligibility|open to|target audience|for (?:all |current )?(?:undergraduates?|postgraduates?|graduate students?|the faculty|staff)|^\s*(?:dear|各位|致)\s*/i
const allPeople = /全校师生|全体师生|老师[、和及与，,\s]+同学|教职员工和学生|all (?:members of the university|students and staff|faculty,?\s*staff and students|faculty and students)|all students, faculty and staff/i
const students = /(?:全校|全体)(?:在读)?(?:学生|同学)|各位同学|^Dear (?:all )?students\b|(?:all|current) students\b/i
const departments = /医学院|人文社科学院|数据科学学院|人工智能学院|理工学院|经管学院|音乐学院|公共政策学院|School of (?:Medicine|Humanities and Social Science|Data Science|Artificial Intelligence|Science and Engineering|Management and Economics|Music|Public Policy)/i
const deadlineCue = /截止(?:时间|日期)?|截至|最迟|限于|延期至|延至|请在.+?前|请于.+?前|(?:报名|提交|申请|缴费|登记|确认|反馈|截止|回执)\s*(?:延长)?至|(?:报名|申请|提交)(?:时间|窗口)[：:].*?[至~～–—]|deadline|\bno later than\b|\b(?:register|submit|apply|rsvp|reply|respond)(?:\s+\w+){0,3}\s+(?:by|before)\b|\bdue (?:date|by|on)\b/i
const earlyDateCue = /开始|开放|签到|开幕|活动时间|会议时间|讲座时间|session starts|event date|registration opens/i
const actionCue = /请(?:务必|尽快|按时|先行|提前|在线|大家)?\s*(?:完成|填写|提交|登记|确认|办理|回复|报名|登录|预约|缴费|选择|核对|更新|回执)|请(?:于|在)[^。；\n]{1,72}(?:前|内)\s*(?:提交|确认|报名|完成|回复)|必须|务必|需要完成|开放报名|即日起报名|开始报名|需要(?:注册|提交|确认|缴费)|required|mandatory|action required|please\s+(?:submit|register|complete|confirm|respond|apply|fill|check|reply)|\brsvp\b/i
const optionalAction = /(?:无[须需]|不必|不用|不需要)(?:另行|提前|再次|再)?(?:报名|回复|登记|注册|确认|提交|办理|缴费)|\bno (?:further )?(?:action|registration|response|reply) (?:is )?required\b|\b(?:registration|a response|a reply) (?:is )?not required\b/gi
const otherTimeZone = /\b(?:PST|PDT|EST|EDT|MST|MDT|BST|CET|CEST|JST|KST|ET|PT)\b|(?:UTC|GMT)\s*(?:-|[+]\s*(?!0?8\b)\d)/i
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const monthWord = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"
const dateFormatters = Object.fromEntries([["zh", "zh-CN"], ["en", "en-GB"]].map(([language, locale]) => [
  language, {
    full: new Intl.DateTimeFormat(locale, { timeZone: "Asia/Hong_Kong", year: "numeric", month: "long", day: "numeric" }),
    short: new Intl.DateTimeFormat(locale, { timeZone: "Asia/Hong_Kong", month: "short", day: "numeric" }),
    reference: new Intl.DateTimeFormat(locale, { timeZone: "Asia/Hong_Kong", month: "long", day: "numeric", weekday: "long" })
  }
]))
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
})

export function normalText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\r\n?/g, "\n")
}

export function emailDomain(address) {
  const matched = String(address ?? "").trim().match(/^[^\s@<>]+@((?:[a-z0-9-]+\.)+[a-z0-9-]+)$/i)
  return matched?.[1].toLowerCase() ?? ""
}

export function isCampusSender(address) {
  return /^(?:[a-z0-9-]+\.)*cuhk\.edu\.cn$/.test(emailDomain(address))
}

export function isJournalSender(address) {
  const domain = emailDomain(address)
  return journalDomains.some(host => domain === host || domain.endsWith("." + host))
}

export function isJournalMail(mail) {
  if (!isJournalSender(mail.senderEmail)) return false
  const subject = normalText(mail.subject).trim()
  if (/^(?:under (?:peer )?review|with (?:the )?editor|reviews? completed|decision (?:in process|pending))\b/i.test(subject)) return true
  const text = subject + "\n" + normalText(mail.body)
  return manuscriptNotices.some(pattern => pattern.test(text))
}

function nonemptyLines(text) {
  return normalText(text).split(/[\n。；;]/).map(line => line.trim()).filter(Boolean)
}

function campusDate(value) {
  return new Date(+value + CAMPUS_OFFSET)
}

function timestamp(year, month, day, hour, minute) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return +date + hour * HOUR + minute * 60000 - CAMPUS_OFFSET
}

function nearSendYear(month, day, sent) {
  if (!Number.isFinite(sent)) return null
  const year = campusDate(sent).getUTCFullYear()
  const guessed = timestamp(year, month, day, 12, 0)
  if (guessed === null) return year
  if (sent - guessed > 180 * DAY) return year + 1
  if (guessed - sent > 185 * DAY) return year - 1
  return year
}

function readTime(text) {
  const cleaned = text.replace(/^\s*[(（][^）)\n]{0,14}[)）]/, "")
  const match = cleaned.match(/^[\s,T，]*(?:(上午|下午|晚上|中午)\s*)?(\d{1,2})(?:(?:[:：](\d{2}))|(?:\s*(?:点|时)(\s*\d{1,2}\s*分?)?))\s*(am|pm)?/i)
    ?? cleaned.match(/^[\s,T，]*(\d{1,2})\s*(am|pm)\b/i)
  if (!match) return null
  let hour = Number(match.length === 3 ? match[1] : match[2])
  const minute = match.length === 3 ? 0 : Number((match[3] ?? match[4] ?? "0").replace(/\D/g, ""))
  const meridiem = match.length === 3 ? match[2] : (match[5] ?? match[1] ?? "")
  if (/pm|下午|晚上/i.test(meridiem) && hour < 12) hour += 12
  if (/am|上午/i.test(meridiem) && hour === 12) hour = 0
  return hour < 24 && minute < 60 ? [hour, minute] : null
}

function dateCandidates(line, sent) {
  const dates = []
  const add = (match, year, month, day) => {
    const y = year ? Number(year) : nearSendYear(month, day, sent)
    if (!y) return
    const time = readTime(line.slice(match.index + match[0].length, match.index + match[0].length + 34))
    const at = timestamp(y, Number(month), Number(day), ...(time ?? [23, 59]))
    if (at === null) return
    dates.push({ at: time ? at : at + 59999, hasTime: Boolean(time), index: match.index, end: match.index + match[0].length })
  }
  for (const m of line.matchAll(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g)) add(m, m[1], m[2], m[3])
  for (const m of line.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g)) add(m, m[1], m[2], m[3])
  for (const m of line.matchAll(new RegExp("\\b(" + monthWord + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b", "gi"))) {
    add(m, m[3], months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, m[2])
  }
  for (const m of line.matchAll(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + monthWord + ")\\.?(?:,?\\s+(20\\d{2}))?\\b", "gi"))) {
    add(m, m[3], months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, m[1])
  }
  if (!dates.length && Number.isFinite(sent)) {
    const relative = line.match(/今天|今日|明天|明日|次日|后天|\b(?:today|tomorrow)\b/i)
    if (relative) {
      const delta = /后天/.test(relative[0]) ? 2 : /明天|明日|次日|tomorrow/i.test(relative[0]) ? 1 : 0
      const localDay = campusDate(sent + delta * DAY)
      add(relative, localDay.getUTCFullYear(), localDay.getUTCMonth() + 1, localDay.getUTCDate())
    }
  }
  return dates.sort((a, b) => a.index - b.index)
}

function pickContextDate(line, sent) {
  if (otherTimeZone.test(line)) return null
  const dates = dateCandidates(line, sent)
  if (dates.length < 2) return dates[0] ?? null
  const cue = line.match(deadlineCue)
  const markers = [...line.matchAll(/截止|截至|最迟|deadline|\b(?:before|by)\b/gi)]
  if (/(?:时间|窗口)[：:].*?[至~～–—]/i.test(line) && !markers.length) return dates.at(-1)
  const position = markers[0]?.index ?? cue?.index ?? 0
  const score = date => {
    const gap = Math.min(Math.abs(position - date.end), Math.abs(position - date.index))
    const before = line.slice(Math.max(0, date.index - 15), date.index)
    const after = line.slice(date.end, date.end + 22)
    return gap + (earlyDateCue.test(before) ? 50 : 0) - (/^[^，,。]{0,15}(?:之前|前截止)/.test(after) ? 25 : 0)
  }
  return dates.reduce((best, date) => score(date) < score(best) ? date : best)
}

export function findDeadline(mail) {
  const sent = Date.parse(mail.sentAt ?? "")
  const subject = normalText(mail.subject)
  const lines = [subject, ...nonemptyLines(mail.body)].map(line => line.replace(/\*\*/g, "").trim())
  const dated = []
  let hint = null
  lines.forEach((line, index) => {
    if (!deadlineCue.test(line) || /^(?:原(?:定)?截止|original deadline|previous deadline)/i.test(line)) return
    const next = index > 0 ? lines[index + 1] : null
    const continued = line.length < 40 && /(?:截止(?:时间|日期)?|deadline)\s*[:：]?\s*$/i.test(line) && next
    const relevant = continued ? line + " " + next : line
    const parsed = pickContextDate(relevant, sent)
    hint ??= relevant
    if (parsed) dated.push({ at: parsed.at, hasTime: parsed.hasTime, evidence: relevant, extension: /延期|延长|extended/i.test(relevant) })
  })
  const current = dated.some(item => item.extension) ? dated.filter(item => item.extension) : dated
  return { date: current.sort((a, b) => a.at - b.at)[0] ?? null, hint }
}

export function inferAudience(mail) {
  const lines = [normalText(mail.subject), ...nonemptyLines(mail.body).slice(0, 120)]
  const targets = lines.filter(line => audiencePrefix.test(line) || allPeople.test(line) || students.test(line))
  const explicit = targets.filter(line => /适用对象|报名对象|参与对象|活动对象|适用人群|面向|仅限|参加资格|eligibility|open to|target audience/i.test(line))
  const meaningful = explicit.length ? explicit : targets
  const evidence = meaningful[0] ?? ""
  const text = meaningful.map(line => line.slice(0, 170)).join("\n")
  const unit = text.match(departments)?.[0] ?? ""
  if (allPeople.test(text)) return { label: [unit, "全校师生"].filter(Boolean).join(" · "), roles: [], evidence, unit }
  const roles = new Set(Object.keys(degreeRoles).filter(role => degreeRoles[role].test(text)))
  if (students.test(text)) {
    roles.add("graduate")
    roles.add("undergraduate")
  }
  const useful = [...roles]
  const roleLabel = useful.length === 2 && roles.has("graduate") && roles.has("undergraduate")
    ? "全体学生"
    : useful.map(role => PROFILES[role]).join("、")
  return { label: [unit, roleLabel].filter(Boolean).join(" · ") || "未注明", roles: useful, evidence, unit }
}

export function analyzeMail(mail) {
  const subject = normalText(mail.subject)
  const body = normalText(mail.body)
  const from = normalText(mail.senderName + " " + mail.senderEmail)
  const source = isJournalMail(mail) ? "journal" : sourceMatchers.find(([, pattern]) => pattern.test(from))?.[0] ?? "other"
  const careerSender = /职业规划|就业指导|career planning|career development|\bcpdo\b/i.test(from)
  const topic = source === "journal" ? "research"
    : careerSender ? "career" : topicMatchers.find(([, pattern]) => pattern.test(subject))?.[0] ?? "general"
  const audience = inferAudience(mail)
  const deadline = findDeadline(mail)
  const action = [subject, ...nonemptyLines(body)].find(line => actionCue.test(line.replace(optionalAction, ""))) ?? ""
  const search = normalText([subject, from, body, TOPICS[topic], SOURCES[source].label, audience.label].join(" ")).toLowerCase()
  const campusDomain = isCampusSender(mail.senderEmail)
  return { ...mail, source, topic, audience, deadline, action, search, campusDomain }
}

export function prioritize(item, profile, now) {
  const { date, hint } = item.deadline
  const selectedRoles = profileGroups[profile] ?? [profile]
  if (profile !== "all" && item.audience.roles.length && !selectedRoles.some(role => item.audience.roles.includes(role))) {
    return { level: "unrelated", reasonKey: "reason.unrelated", quote: item.audience.evidence }
  }
  if (date && date.at < now) {
    return { level: "expired", reasonKey: "reason.expired", quote: date.evidence }
  }
  if (date && date.at - now <= 72 * HOUR) {
    return { level: "soon", reasonKey: "reason.soon", quote: date.evidence }
  }
  if (date || hint || item.action) {
    return { level: "action", reasonKey: date ? "reason.datedAction" : "reason.action", quote: date?.evidence || hint || item.action }
  }
  return { level: "info", reasonKey: "reason.info", quote: "" }
}

export function byOrder(order, first, second) {
  const aDeadline = first.item.deadline.date?.at ?? Infinity
  const bDeadline = second.item.deadline.date?.at ?? Infinity
  const aSent = Date.parse(first.item.sentAt ?? "") || 0
  const bSent = Date.parse(second.item.sentAt ?? "") || 0
  if (order === "newest") return bSent - aSent
  if (order === "deadline") return aDeadline === bDeadline ? bSent - aSent : aDeadline - bDeadline
  return priorityOrder.indexOf(first.priority.level) - priorityOrder.indexOf(second.priority.level)
    || (first.priority.level === "soon" ? aDeadline - bDeadline : 0)
    || bSent - aSent
}

export function formatDate(value, style = "short", language = "zh") {
  const time = typeof value === "number" ? value : Date.parse(value ?? "")
  if (!Number.isFinite(time)) return translate(language, "dateUnknown")
  return dateFormatters[language][style === "full" ? "full" : "short"].format(time)
}

export function formatDeadline(deadline, short = false, language = "zh") {
  if (!deadline.date) return translate(language, deadline.hint ? "deadlineCheck" : "deadlineUnknown")
  const { at, hasTime } = deadline.date
  const date = formatDate(at, short ? "short" : "full", language)
  return date + (hasTime ? " " + timeFormatter.format(at) : short ? "" : translate(language, "timeUnknown"))
}

export function formatReference(now, language = "zh") {
  return dateFormatters[language].reference.format(now)
}
