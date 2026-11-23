import { campusIdentity, graphGet } from "./outlook-graph.js"
import { outlookConfig } from "./outlook-config.js"

const scopes = ["User.Read", "Mail.Read"]
const currentUser = "/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle"

function loadMsal() {
  return new Promise((resolve, reject) => {
    if (globalThis.msal?.PublicClientApplication) {
      resolve(globalThis.msal)
      return
    }
    const script = document.createElement("script")
    script.src = new URL("./vendor/msal-browser/msal-browser.min.js", import.meta.url).href
    script.onload = () => {
      if (globalThis.msal?.PublicClientApplication) resolve(globalThis.msal)
      else reject(new Error("msalLoadError"))
    }
    script.onerror = () => reject(new Error("msalLoadError"))
    document.head.append(script)
  })
}

export async function createSchoolAuth() {
  const msal = await loadMsal()
  const redirectUri = new URL("./", import.meta.url).href
  const client = new msal.PublicClientApplication({
    auth: {
      clientId: outlookConfig.clientId,
      authority: "https://login.microsoftonline.com/" + outlookConfig.tenantId,
      redirectUri,
      navigateToLoginRequestUrl: false
    },
    cache: { cacheLocation: "sessionStorage" }
  })
  await client.initialize()
  const result = await client.handleRedirectPromise()
  if (result?.account) client.setActiveAccount(result.account)

  return {
    async signIn() {
      await client.loginRedirect({ scopes, prompt: "select_account" })
    },
    async signOut() {
      const account = client.getActiveAccount()
      client.setActiveAccount(null)
      if (account) await client.clearCache({ account })
    },
    async connect(signal) {
      const account = client.getActiveAccount()
      if (!account) return null
      const token = await client.acquireTokenSilent({ scopes, account })
      const profile = await graphGet(token.accessToken, signal)(currentUser)
      const identity = campusIdentity(account, profile, outlookConfig.tenantId)
      return {
        identity,
        async request(signal) {
          const token = await client.acquireTokenSilent({ scopes, account })
          return graphGet(token.accessToken, signal)
        }
      }
    }
  }
}
