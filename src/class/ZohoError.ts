export class ZohoError extends Error {
  constructor (message: any) {
    super(message)
    this.name = 'ZohoCRM-Import'
    Error.captureStackTrace(this, ZohoError)
  }
}
