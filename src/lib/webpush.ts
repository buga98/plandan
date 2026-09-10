import webpush from 'web-push'

let configured = false

export function getWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!publicKey || !privateKey) throw new Error('VAPID keys are not configured')
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
  return webpush
}
