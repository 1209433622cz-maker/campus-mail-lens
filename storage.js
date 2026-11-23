const DB_NAME = "campus-mail-lens"
const MAIL = "messages"
let opening

function database() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(MAIL, { keyPath: "id" })
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
