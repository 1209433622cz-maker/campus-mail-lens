const DB_NAME = "campus-mail-lens"
const MAIL = "messages"
const OUTLOOK = "outlook-snapshots"
let opening

function database() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2)
      request.onupgradeneeded = event => {
        if (event.oldVersion < 1) request.result.createObjectStore(MAIL, { keyPath: "id" })
        if (event.oldVersion < 2) request.result.createObjectStore(OUTLOOK, { keyPath: "account" })
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          opening = null
        }
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("邮件资料库正在被其他版本使用"))
    }).catch(error => {
      opening = null
      throw error
    })
  }
  return opening
}

export async function readLocalMail() {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(MAIL).objectStore(MAIL).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function insertLocalMail(messages) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAIL, "readwrite")
    const store = tx.objectStore(MAIL)
    const inserted = []
    let duplicate = 0
    for (const message of new Map(messages.map(item => [item.id, item])).values()) {
      const check = store.get(message.id)
      check.onsuccess = () => {
        const existing = check.result
        if (existing?.bodyFormat === "preview" && message.bodyFormat === "full") {
          store.put(message)
          inserted.push(message)
          return
        }
        if (existing) {
          duplicate += 1
          return
        }
        store.add(message)
        inserted.push(message)
      }
    }
    tx.oncomplete = () => resolve({ inserted, duplicate: duplicate + messages.length - new Set(messages.map(item => item.id)).size })
    tx.onabort = () => reject(tx.error ?? new Error("邮件资料库写入失败"))
  })
}

export async function readOutlookSnapshot(account) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(OUTLOOK).objectStore(OUTLOOK).get(account)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

export async function saveOutlookSnapshot(account, snapshot, expectedRevision) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OUTLOOK, "readwrite")
    const store = transaction.objectStore(OUTLOOK)
    const lookup = store.get(account)
    let saved
    lookup.onsuccess = () => {
      const current = lookup.result
      if ((current?.revision ?? 0) !== expectedRevision) {
        saved = current
        return
      }
      saved = { ...snapshot, account, revision: expectedRevision + 1 }
      store.put(saved)
    }
    transaction.oncomplete = () => resolve(saved)
    transaction.onabort = () => reject(transaction.error ?? new Error("Outlook cache write failed"))
  })
}

const FLAGS_KEY = "campus-mail-lens:reading"

export function loadFlags() {
  try {
    const saved = JSON.parse(localStorage.getItem(FLAGS_KEY) || "{}")
    return saved && typeof saved === "object" ? saved : {}
  } catch {
    return {}
  }
}

export function saveFlags(flags) {
  try {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
    return true
  } catch {
    return false
  }
}

export function loadPreference(name, fallback) {
  try {
    return localStorage.getItem("campus-mail-lens:" + name) || fallback
  } catch {
    return fallback
  }
}

export function savePreference(name, value) {
  try {
    localStorage.setItem("campus-mail-lens:" + name, value)
  } catch {
    // The selected value is still used in the current tab.
  }
}
