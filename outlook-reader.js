import { createSchoolAuth } from "./outlook-auth.js"
import { outlookConfig, outlookEnabled } from "./outlook-config.js"
import { syncInbox } from "./outlook-graph.js"
import { readOutlookSnapshot, saveOutlookSnapshot } from "./storage.js"

const syncInterval = 120000
const emptyMessages = []

export function createOutlookReader(onChange) {
  let state = {
    identity: null, messages: emptyMessages, syncedAt: null, pending: false,
    phase: outlookEnabled ? "checking" : "setup", problem: null
  }
  let auth
  let session
  let running
  let notBefore = 0
  let lastRequest = 0

  function update(change) {
    state = { ...state, ...change }
    onChange(state)
  }

  function problemFrom(error) {
    if (error.message === "schoolAccountMismatch") return "outlookWrongAccount"
    if (error.status === 403) return "outlookPermission"
    if (error.status === 429) return "outlookRateLimit"
    if (error.status === 401 || /login_required|interaction_required|consent_required|no_tokens_found|no_account_error|AADSTS/i.test(error.errorCode ?? "")) {
      return "outlookReconnect"
    }
    return "outlookError"
  }

  async function refresh({ manual = false } = {}) {
    const now = Date.now()
    if (!session || running || now < notBefore
        || (!manual && (document.hidden || state.problem === "outlookPermission" || now - lastRequest < syncInterval))) return
    const selected = session
    const request = new AbortController()
    running = request
    lastRequest = now
    update({ pending: true, problem: null })
    try {
      const key = selected.identity.key
      const saved = await readOutlookSnapshot(key)
      const get = await selected.request(request.signal)
      const next = await syncInbox({ request: get, identity: selected.identity, snapshot: saved, historyDays: outlookConfig.historyDays, now })
      if (session !== selected || request.signal.aborted) return
      const current = await saveOutlookSnapshot(key, next, saved?.revision ?? 0)
      if (session === selected) {
        update({ messages: current.messages, syncedAt: current.syncedAt, pending: false })
      }
    } catch (error) {
      if (session === selected) {
        const problem = problemFrom(error)
        notBefore = now + (error.retryAfter || (error.status === 429 ? syncInterval : 0))
        if (problem === "outlookReconnect") {
          session = null
          update({ identity: null, messages: emptyMessages, syncedAt: null, pending: false, problem })
        } else {
          update({ pending: false, problem })
        }
      }
    } finally {
      if (running === request) running = null
    }
  }

  async function start() {
    if (!outlookEnabled || !window.isSecureContext) {
      update({ phase: "setup" })
      return
    }
    try {
      update({ phase: "checking", problem: null })
      auth = await createSchoolAuth()
      session = await auth.connect()
      if (!session) {
        update({ phase: "ready" })
        return
      }
      const { identity } = session
      const saved = await readOutlookSnapshot(identity.key)
      update({
        phase: "ready", identity, messages: saved?.messages ?? emptyMessages,
        syncedAt: saved?.syncedAt ?? null
      })
      void refresh({ manual: true })
    } catch (error) {
      update({ phase: auth ? "ready" : "error", problem: problemFrom(error) })
    }
  }

  async function signIn() {
    if (!auth) return
    update({ phase: "checking", problem: null })
    try {
      await auth.signIn()
    } catch (error) {
      update({ phase: "ready", problem: problemFrom(error) })
    }
  }

  async function signOut() {
    session = null
    running?.abort()
    running = null
    notBefore = 0
    lastRequest = 0
    update({ identity: null, messages: emptyMessages, syncedAt: null, pending: false, phase: "ready", problem: null })
    try {
      await auth?.signOut()
    } catch (error) {
      update({ problem: problemFrom(error) })
    }
  }

  if (outlookEnabled) {
    window.setInterval(() => { void refresh() }, syncInterval)
    document.addEventListener("visibilitychange", () => { void refresh() })
  }
  return { start, signIn, signOut, refresh }
}
