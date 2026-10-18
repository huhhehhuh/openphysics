import type { JournalTemplateType } from './templates'
import { JOURNAL_TEMPLATES } from './templates'
import LatexText from './LatexText'

type JournalData = Record<string, string>

type JournalDocumentProps = {
  templateType: JournalTemplateType
  data: JournalData
  readOnly?: boolean
  onChange?: (key: string, value: string) => void
  title?: string
}

export default function JournalDocument({ templateType, data, readOnly = false, onChange, title }: JournalDocumentProps) {
  const template = JOURNAL_TEMPLATES[templateType]

  return <article className={`journal-document ${readOnly ? 'readonly' : ''}`}>
    <header className="journal-document-header">
      <p>OPEN PHYSICS · EXPERIMENT JOURNAL</p>
      <h2>{title ?? '물리실험일지'}</h2>
      <span>{template.name} · {template.subtitle}</span>
    </header>
    {!readOnly && <p className="latex-guide"><strong>수식 작성 안내</strong><br />LaTeX 표준을 사용해 주세요. 문장 속 수식은 <code>$ F = ma $</code> 또는 <code>\( F = ma \)</code>, 줄 전체 수식은 <code>$$ E = mc^2 $$</code> 또는 <code>\[ E = mc^2 \]</code>처럼 입력하면 아래 미리보기와 PDF에 실제 수식으로 표시됩니다.</p>}
    {template.sections.map((section, index) => <section className="journal-section" key={section.title}>
      <div className="journal-section-heading"><span>{index + 1}</span><div><h3>{section.title}</h3>{section.description && <p>{section.description}</p>}</div></div>
      <div className="journal-fields">{section.fields.map((field) => <label className="journal-field" key={field.key}>
        <span>{field.label}</span>
        {readOnly ? <p><LatexText text={data[field.key]?.trim() || '작성된 내용이 없어요.'} /></p> : <><textarea value={data[field.key] ?? ''} onChange={(event) => onChange?.(field.key, event.target.value)} placeholder={field.hint ?? `${field.label}을 작성해 주세요.`} rows={field.key === 'rawData' ? 6 : 3} /><div className="latex-preview"><span>미리보기</span><LatexText text={data[field.key] ?? ''} /></div></>}
      </label>)}</div>
    </section>)}
  </article>
}
