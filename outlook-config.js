// The approved Entra SPA's public application ID belongs here.
export const outlookConfig = {
  clientId: "",
  tenantId: "e5898b7a-9c87-4a4b-b22a-2df3f355e01e",
  historyDays: 30
}

export const outlookEnabled = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(outlookConfig.clientId)
