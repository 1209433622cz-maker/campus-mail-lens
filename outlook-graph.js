import { normalizeMail, plainHtml } from "./import-mail.js"

const graphOrigin = "https://graph.microsoft.com"
const inboxDelta = "/v1.0/me/mailFolders/inbox/messages/delta"
const fields = "id,subject,sender,from,receivedDateTime,sentDateTime,body,bodyPreview,isRead,webLink"
const day = 24 * 60 * 60 * 1000
const roleClaims = new Map([
  ["campus.undergraduate", "undergraduate"],
  ["campus.postgraduate", "graduate"],
  ["campus.faculty", "faculty"],
  ["campus.staff", "staff"]
])

export class GraphError extends Error {
  constructor(status, code, retryAfter = 0) {
    super("Microsoft Graph returned an error.")
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

function emailDomain(address) {
  return String(address ?? "").trim().toLowerCase().split("@")[1] ?? ""
}

function isCampusSender(address) {
  return /^(?:[a-z0-9-]+\.)*cuhk\.edu\.cn$/i.test(emailDomain(address))
}

export function campusIdentity(account, profile, tenantId) {
  const claims = account?.idTokenClaims ?? {}
  const tenant = (account?.tenantId || claims.tid || "").toLowerCase()
  const userId = (claims.oid || account?.localAccountId || "").toLowerCase()
  if (tenant !== tenantId.toLowerCase() || (claims.tid && claims.tid.toLowerCase() !== tenant)
      || !userId || userId !== profile?.id?.toLowerCase()) {
    throw new Error("schoolAccountMismatch")
  }
  const address = [profile.userPrincipalName, profile.mail, account.username]
    .find(value => ["cuhk.edu.cn", "link.cuhk.edu.cn"].includes(emailDomain(value)))
  if (!address) throw new Error("schoolAccountMismatch")

  const assigned = Array.isArray(claims.roles) ? claims.roles : []
  const roles = [...new Set(assigned.map(role => roleClaims.get(String(role).toLowerCase())).filter(Boolean))]
  const student = emailDomain(address) === "link.cuhk.edu.cn"
  const title = profile.jobTitle ?? ""
  let role = student ? "student" : "employee"
  if (roles.length === 1) role = roles[0]
  else if (roles.length > 1) {
    const enrolled = roles.some(value => value === "graduate" || value === "undergraduate")
    const employed = roles.some(value => value === "faculty" || value === "staff")
    role = enrolled && employed ? "all" : enrolled ? "student" : "employee"
  } else if (student) {
    if (/本科生|\bundergraduate\b/i.test(title)) role = "undergraduate"
    else if (/研究生|硕士生|博士生|\bpostgraduate\b|\bgraduate student\b|\bdoctoral student\b/i.test(title)) role = "graduate"
  } else {
    if (/教授|讲师|\bprofessor\b|\blecturer\b|\bfaculty\b/i.test(title)) role = "faculty"
    else if (/^行政(?:员工|人员|专员)?$|\badministrative (?:staff|officer|assistant)\b/i.test(title)) role = "staff"
  }
  return { key: tenant + ":" + userId, name: profile.displayName || address, role }
}

export function graphLink(value) {
  const url = new URL(value, graphOrigin)
  const allowedPath = /^\/v1\.0\/me(?:\/mailfolders(?:\/inbox|\('inbox'\))\/messages\/delta)?$/i
  if (url.origin !== graphOrigin || url.username || url.password || !allowedPath.test(decodeURIComponent(url.pathname))) {
    throw new Error("invalidGraphLink")
  }
  return url.href
}

function deltaLink(value) {
  const url = graphLink(value)
  if (!new URL(url).pathname.toLowerCase().endsWith("/delta")) throw new Error("invalidGraphLink")
  return url
}

export function graphGet(accessToken, signal, fetcher = fetch) {
  return async path => {
    const timeout = AbortSignal.timeout(30000)
    const response = await fetcher(graphLink(path), {
      method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
      headers: {
        Authorization: "Bearer " + accessToken,
        Accept: "application/json",
        Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"'
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      const header = response.headers.get("Retry-After")
      const delay = header ? Number(header) : 0
      const retryAfter = Number.isFinite(delay) ? delay * 1000 : Math.max(0, Date.parse(header) - Date.now())
      throw new GraphError(response.status, detail?.error?.code, retryAfter)
    }
    return response.json()
  }
}

function initialDelta(now, historyDays) {
  const url = new URL(inboxDelta, graphOrigin)
  url.searchParams.set("$select", fields)
  url.searchParams.set("$top", "50")
  url.searchParams.set("$filter", "receivedDateTime ge " + new Date(now - historyDays * day).toISOString())
  return url.href
}

async function convertMessage(row, identityKey, previous) {
  const from = row.sender?.emailAddress ?? row.from?.emailAddress
  const address = from?.address ?? previous?.senderEmail ?? ""
  if (!isCampusSender(address)) return null

  const rawText = row.body?.content || ""
  const body = row.body?.contentType?.toLowerCase() === "html" ? plainHtml(rawText) : rawText
  const message = await normalizeMail({
    messageId: identityKey + ":" + row.id,
    subject: row.subject ?? previous?.subject ?? "（无主题）",
    senderName: from?.name ?? previous?.senderName,
    senderEmail: address,
    sentAt: row.sentDateTime || row.receivedDateTime || previous?.sentAt,
    body: body || row.bodyPreview || previous?.body,
    bodyFormat: body ? "full" : row.bodyPreview ? "preview" : previous?.bodyFormat,
    originalUrl: row.webLink ?? previous?.originalUrl,
    wasRead: row.isRead ?? previous?.wasRead
  })
  return { ...message, providerId: row.id }
}

async function readPages(request, identity, snapshot, now, historyDays) {
  const messages = new Map((snapshot?.messages ?? []).map(row => [row.providerId, row]))
  let next = deltaLink(snapshot?.deltaLink || initialDelta(now, historyDays))
  const visited = new Set()

  while (next) {
    if (visited.has(next)) throw new Error("invalidGraphLink")
    visited.add(next)
    const page = await request(next)
    if (!Array.isArray(page.value)) throw new Error("invalidGraphResponse")
    for (const row of page.value) {
      if (!row.id) continue
      if (row["@removed"]) {
        messages.delete(row.id)
      } else {
        const rowMessage = await convertMessage(row, identity.key, messages.get(row.id))
        if (rowMessage) messages.set(row.id, rowMessage)
        else messages.delete(row.id)
      }
    }
    if (page["@odata.nextLink"]) next = deltaLink(page["@odata.nextLink"])
    else {
      const finalLink = deltaLink(page["@odata.deltaLink"])
      return { messages: [...messages.values()], deltaLink: finalLink, syncedAt: now }
    }
  }
  throw new Error("invalidGraphResponse")
}

export async function syncInbox({ request, identity, snapshot = null, now = Date.now(), historyDays = 30 }) {
  try {
    return await readPages(request, identity, snapshot, now, historyDays)
  } catch (error) {
    if (snapshot?.deltaLink && (error.status === 410 || error.code === "SyncStateNotFound")) {
      return readPages(request, identity, null, now, historyDays)
    }
    throw error
  }
}
