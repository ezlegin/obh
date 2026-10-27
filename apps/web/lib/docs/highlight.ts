export type TokenType =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "type"
  | "property"
  | "literal"
  | "operator"
  | "punctuation"

export type Token = {
  type: TokenType
  value: string
}

const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "of",
  "readonly",
  "return",
  "satisfies",
  "static",
  "switch",
  "throw",
  "try",
  "type",
  "typeof",
  "var",
  "void",
  "while",
  "yield",
])

const LITERALS = new Set(["true", "false", "null", "undefined", "NaN"])

const BASH_KEYWORDS = new Set(["cd", "echo", "export", "mkdir", "sudo"])

type Language = "script" | "json" | "bash" | "http" | "text"

function normalizeLanguage(language: string): Language {
  const value = language.toLowerCase()

  if (value === "json" || value === "jsonc") {
    return "json"
  }

  if (
    value === "bash" ||
    value === "sh" ||
    value === "shell" ||
    value === "zsh"
  ) {
    return "bash"
  }

  if (value === "http") {
    return "http"
  }

  if (value === "text" || value === "txt" || value === "plain") {
    return "text"
  }

  return "script"
}

function isIdentifierStart(character: string) {
  return /[A-Za-z_$]/.test(character)
}

function isIdentifierPart(character: string) {
  return /[A-Za-z0-9_$]/.test(character)
}

export function highlight(code: string, language = "ts"): Token[] {
  const lang = normalizeLanguage(language)
  const tokens: Token[] = []

  if (lang === "text") {
    return [{ type: "plain", value: code }]
  }

  const push = (type: TokenType, value: string) => {
    if (!value) {
      return
    }

    const previous = tokens.at(-1)

    if (previous && previous.type === type) {
      previous.value += value
      return
    }

    tokens.push({ type, value })
  }

  let index = 0

  while (index < code.length) {
    const character = code[index] ?? ""
    const next = code[index + 1] ?? ""

    // Whitespace ---------------------------------------------------------
    if (/\s/.test(character)) {
      let end = index + 1

      while (end < code.length && /\s/.test(code[end] ?? "")) {
        end += 1
      }

      push("plain", code.slice(index, end))
      index = end
      continue
    }

    // Comments -----------------------------------------------------------
    if (lang === "script" && character === "/" && next === "/") {
      const previous = code[index - 1]

      // Do not treat the `//` in a URL as a comment.
      if (previous !== ":") {
        let end = code.indexOf("\n", index)

        if (end === -1) {
          end = code.length
        }

        push("comment", code.slice(index, end))
        index = end
        continue
      }
    }

    if (lang === "script" && character === "/" && next === "*") {
      const close = code.indexOf("*/", index + 2)
      const end = close === -1 ? code.length : close + 2
      push("comment", code.slice(index, end))
      index = end
      continue
    }

    if (lang === "bash" && character === "#") {
      let end = code.indexOf("\n", index)

      if (end === -1) {
        end = code.length
      }

      push("comment", code.slice(index, end))
      index = end
      continue
    }

    // Strings ------------------------------------------------------------
    if (character === '"' || character === "'" || character === "`") {
      let end = index + 1

      while (end < code.length) {
        const current = code[end] ?? ""

        if (current === "\\") {
          end += 2
          continue
        }

        if (current === character) {
          end += 1
          break
        }

        // A single-quoted string cannot span lines.
        if (character === "'" && current === "\n") {
          break
        }

        end += 1
      }

      const value = code.slice(index, end)
      const after = code.slice(end, end + 8)
      const isJsonKey = lang === "json" && /^\s*:/.test(after)

      push(isJsonKey ? "property" : "string", value)
      index = end
      continue
    }

    // Numbers ------------------------------------------------------------
    if (/[0-9]/.test(character)) {
      let end = index + 1

      while (end < code.length && /[0-9._]/.test(code[end] ?? "")) {
        end += 1
      }

      if ((code[end] ?? "") === "x" || (code[end] ?? "") === "X") {
        end += 1

        while (end < code.length && /[0-9a-fA-F_]/.test(code[end] ?? "")) {
          end += 1
        }
      }

      if (/[eE]/.test(code[end] ?? "")) {
        end += 1

        if (/[+-]/.test(code[end] ?? "")) {
          end += 1
        }

        while (end < code.length && /[0-9]/.test(code[end] ?? "")) {
          end += 1
        }
      }

      push("number", code.slice(index, end))
      index = end
      continue
    }

    // Identifiers --------------------------------------------------------
    if (isIdentifierStart(character)) {
      let end = index + 1

      while (end < code.length && isIdentifierPart(code[end] ?? "")) {
        end += 1
      }

      const word = code.slice(index, end)
      let lookahead = end

      while (lookahead < code.length && /[ \t]/.test(code[lookahead] ?? "")) {
        lookahead += 1
      }

      const followedByCall = (code[lookahead] ?? "") === "("

      if (lang === "http") {
        push("keyword", word)
      } else if (LITERALS.has(word)) {
        push("literal", word)
      } else if (KEYWORDS.has(word)) {
        push("keyword", word)
      } else if (lang === "bash" && BASH_KEYWORDS.has(word)) {
        push("keyword", word)
      } else if (followedByCall) {
        push("function", word)
      } else if (/^[A-Z]/.test(word)) {
        push("type", word)
      } else {
        push("plain", word)
      }

      index = end
      continue
    }

    // Operators and punctuation -----------------------------------------
    const twoCharacters = code.slice(index, index + 2)
    const threeCharacters = code.slice(index, index + 3)

    if (["===", "!==", "..."].includes(threeCharacters)) {
      push("operator", threeCharacters)
      index += 3
      continue
    }

    if (
      [
        "=>",
        "==",
        "!=",
        "??",
        "?.",
        "&&",
        "||",
        "++",
        "--",
        ">=",
        "<=",
        "+=",
        "-=",
        "**",
      ].includes(twoCharacters)
    ) {
      push("operator", twoCharacters)
      index += 2
      continue
    }

    if (/[=<>!&|+*/%-]/.test(character)) {
      push("operator", character)
      index += 1
      continue
    }

    push("punctuation", character)
    index += 1
  }

  return tokens
}

export function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]]

  for (const token of tokens) {
    const parts = token.value.split("\n")

    parts.forEach((part, partIndex) => {
      if (partIndex > 0) {
        lines.push([])
      }

      if (part.length > 0) {
        lines.at(-1)?.push({ type: token.type, value: part })
      }
    })
  }

  return lines
}
