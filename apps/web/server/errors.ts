export class DomainError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "DomainError"
    this.code = code
  }
}
