const supportedEmailHosts = new Set([
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.cloud.microsoft",
  "outlook.live.com",
  "mail.cuhk.edu.cn"
])

const MAILBOX_LIMIT = 128 * 1024 * 1024
const EML_LIMIT = 25 * 1024 * 1024
const PACK_FORMAT = "campus-mail-lens/v1"
const exportTruncation = /(?:\.{3}|…)\s*\(truncated\)\s*$/i
const inlineImageLink = /!\[[^\]\r\n]*\]\(cid:[^)\r\n]+\)/gi
let parser

export function safeOriginalUrl(raw) {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && !url.username && !url.password && supportedEmailHosts.has(url.hostname) ? url.href : ""
  } catch {
    return ""
  }
}

export function plainHtml(html) {
  const template = document.createElement("template")
  template.innerHTML = html
  const fragment = template.content
  for (const node of fragment.querySelectorAll("script, style, head, template, iframe, noscript, object, svg")) node.remove()
  for (const node of fragment.querySelectorAll("br, p, div, li, tr, h1, h2, h3, h4, blockquote")) {
    if (node.tagName === "BR") node.replaceWith("\n")
    else node.after("\n")
  }
  for (const node of fragment.querySelectorAll("td, th")) node.after("  ")
  return fragment.textContent ?? ""
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim() : ""
}

export function mailBodyFormat(mail) {
  return mail.bodyFormat === "preview" || exportTruncation.test(mail.body) ? "preview" : "full"
}

export function mailDisplayText(mail) {
  let hasInlineImages = mail.hasInlineImages === true
  const text = clean(mail.body).replace(exportTruncation, "").replace(inlineImageLink, () => {
    hasInlineImages = true
    return ""
  }).replace(/\n{3,}/g, "\n\n").trim()
  return { text, hasInlineImages }
}

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}

export async function normalizeMail(row) {
  if (typeof row !== "object" || row === null) throw new Error("邮件格式无效")
  const subject = clean(row.subject)
  const senderEmail = clean(row.senderEmail)
  const senderName = clean(row.senderName)
  const body = clean(row.body).replace(/\n{4,}/g, "\n\n\n")
  const millis = Date.parse(clean(row.sentAt))
  const sentAt = Number.isFinite(millis) ? new Date(millis).toISOString() : null
  if (!(subject || body) || !(senderEmail || senderName)) throw new Error("缺少发件人或邮件内容")
  const messageId = clean(row.messageId).replace(/^<|>$/g, "")
  const identity = messageId
    ? "mid:" + messageId
    : [senderEmail.toLowerCase() || senderName, subject, sentAt, body.slice(0, 4096)].join("\n")
  return {
    id: "local-" + await digest(identity),
    subject: subject || "（无主题）",
    senderEmail,
    senderName: senderName || senderEmail,
    sentAt,
    body,
    bodyFormat: mailBodyFormat({ body, bodyFormat: row.bodyFormat }),
    hasInlineImages: row.hasInlineImages === true,
    originalUrl: safeOriginalUrl(row.originalUrl),
    wasRead: row.wasRead === true
  }
}

async function parseEml(bytes) {
  parser ??= import("./vendor/postal-mime/postal-mime.js").then(module => module.default)
  const PostalMime = await parser
  const mail = await PostalMime.parse(bytes, { maxNestingDepth: 30 })
  return normalizeMail({
    messageId: mail.messageId,
    subject: mail.subject,
    senderEmail: mail.from?.address,
    senderName: mail.from?.name,
    sentAt: mail.date,
    body: mail.text || plainHtml(mail.html || ""),
    bodyFormat: "full",
    hasInlineImages: mail.attachments.some(part => part.contentId && /^image\//i.test(part.mimeType))
  })
}

function *mboxParts(bytes) {
  const ascii = new TextDecoder("utf-8")
  const envelope = /^From \S+ (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i
  let start = -1
  let lineStart = 0
  for (let end = 0; end <= bytes.length; end += 1) {
    if (end !== bytes.length && bytes[end] !== 10) continue
    if (bytes[lineStart] === 70 && envelope.test(ascii.decode(bytes.subarray(lineStart, Math.min(lineStart + 100, end))))) {
      if (start >= 0 && start < lineStart) yield bytes.subarray(start, lineStart)
      start = end + 1
    }
    lineStart = end + 1
  }
  if (start >= 0 && start < bytes.length) yield bytes.subarray(start)
}

async function *readFile(file) {
  const name = file.name.toLowerCase()
  if (!/\.(eml|mbox|json)$/.test(name)) throw new Error("无法识别此文件格式")
  if (file.size > (name.endsWith(".eml") ? EML_LIMIT : MAILBOX_LIMIT)) throw new Error("文件超过可导入大小")
  if (name.endsWith(".eml")) {
    yield await parseEml(await file.arrayBuffer())
    return
  }
  if (name.endsWith(".json")) {
    const data = JSON.parse(await file.text())
    const messages = Array.isArray(data) ? data : data?.format === PACK_FORMAT ? data.messages : null
    if (!Array.isArray(messages)) throw new Error("未识别到校园邮件包")
    for (const row of messages) {
      try {
        yield await normalizeMail(row)
      } catch {
        yield null
      }
    }
    return
  }
  let count = 0
  for (const eml of mboxParts(new Uint8Array(await file.arrayBuffer()))) {
    count += 1
    try {
      yield eml.length > EML_LIMIT ? null : await parseEml(eml)
    } catch {
      yield null
    }
  }
  if (!count) throw new Error("未识别到 MBOX 邮件")
}

export async function collectMail(files, onProgress) {
  const messages = []
  let skipped = 0
  for (const [index, file] of files.entries()) {
    onProgress(index + 1, files.length, messages.length)
    try {
      for await (const mail of readFile(file)) {
        if (mail) messages.push(mail)
        else skipped += 1
        if ((messages.length + skipped) % 30 === 0) onProgress(index + 1, files.length, messages.length)
      }
    } catch {
      skipped += 1
    }
  }
  return { messages, skipped }
}
