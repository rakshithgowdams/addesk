import { randomInt } from "crypto"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#"

export function generatePassword(length = 20): string {
  let password = ""
  for (let index = 0; index < length; index += 1) {
    password += ALPHABET[randomInt(ALPHABET.length)]
  }
  return password
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 72
}
