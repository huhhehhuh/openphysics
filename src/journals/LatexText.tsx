import katex from 'katex'
import 'katex/dist/katex.min.css'

type LatexTextProps = {
  text: string
  className?: string
}

const mathPattern = /(\\\[(?:.|\n)*?\\\]|\\\((?:.|\n)*?\\\)|\$\$(?:.|\n)*?\$\$|\$(?!\$)(?:\\.|[^$\n])+\$)/g

function mathMarkup(token: string) {
  const displayMode = token.startsWith('\\[') || token.startsWith('$$')
  const formula = token.startsWith('$') && !token.startsWith('$$') ? token.slice(1, -1) : token.slice(2, -2)

  try {
    return katex.renderToString(formula, { displayMode, throwOnError: true, strict: 'warn' })
  } catch {
    return null
  }
}

export default function LatexText({ text, className }: LatexTextProps) {
  const tokens = text.split(mathPattern)

  return <span className={className ?? 'latex-text'}>{tokens.map((token, index) => {
    if (!token) return null
    const markup = token.match(mathPattern) ? mathMarkup(token) : null
    return markup
      ? <span className="latex-math" dangerouslySetInnerHTML={{ __html: markup }} key={`${token}-${index}`} />
      : <span className="latex-plain" key={`${token}-${index}`}>{token}</span>
  })}</span>
}
