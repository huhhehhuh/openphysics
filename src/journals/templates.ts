export type JournalTemplateType = 'basic' | 'advanced' | 'cumulative'

export type JournalField = {
  key: string
  label: string
  hint?: string
}

export type JournalSection = {
  title: string
  description?: string
  fields: JournalField[]
}

export type JournalTemplate = {
  type: JournalTemplateType
  name: string
  subtitle: string
  description: string
  sections: JournalSection[]
}

const basicSections: JournalSection[] = [
  { title: '기본 정보', fields: [{ key: 'topic', label: '탐구 주제' }, { key: 'stage', label: '오늘의 단계', hint: '예비 실험, 본 실험, 재실험, 데이터 정리, 결과 발표 등' }, { key: 'members', label: '팀원과 역할' }] },
  { title: '오늘의 연구 질문과 가설', fields: [{ key: 'researchQuestion', label: '오늘의 연구 질문' }, { key: 'hypothesis', label: '가설' }, { key: 'predictionReason', label: '예상 이유' }] },
  { title: '오늘 활용하는 물리 개념', fields: [{ key: 'coreConcept', label: '핵심 개념' }, { key: 'relatedFormula', label: '관련 식' }, { key: 'expectedRelation', label: '예상 그래프 / 관계' }] },
  { title: '변인과 측정 계획', fields: [{ key: 'independentVariable', label: '독립 변인' }, { key: 'dependentVariable', label: '종속 변인' }, { key: 'controlVariables', label: '통제 변인' }, { key: 'equipmentAndUnits', label: '측정 장비 / 단위' }, { key: 'errorFactors', label: '주의할 오차 요인' }] },
  { title: '실험 과정과 원자료', fields: [{ key: 'equipmentCheck', label: '장비 점검 및 오늘 수정한 점' }, { key: 'procedure', label: '실험 과정 메모' }, { key: 'rawData', label: '원자료(Raw Data)', hint: '회차 · 조건 · 측정값 · 단위 · 관찰 메모를 줄마다 기록해 주세요.' }] },
  { title: '빠른 분석과 다음 계획', fields: [{ key: 'trend', label: '보이는 경향' }, { key: 'outliers', label: '이상치 / 오차 추정' }, { key: 'conclusion', label: '오늘의 한 줄 결론' }, { key: 'nextPlan', label: '다음 회차에서 바꿀 점 / 추가 질문' }] },
]

const advancedSections: JournalSection[] = [
  { title: '기본 정보', fields: [{ key: 'topic', label: '탐구 주제' }, { key: 'stage', label: '오늘의 단계', hint: '문헌 검토, 실험 설계, 예비 실험, 본 실험, 데이터 분석, 재설계 등' }, { key: 'members', label: '팀원과 역할' }] },
  { title: '연구 질문과 탐구의 의미', fields: [{ key: 'researchQuestion', label: '핵심 연구 질문' }, { key: 'importance', label: '왜 중요한가' }, { key: 'subQuestion', label: '오늘 검증할 세부 질문' }] },
  { title: '물리 이론 및 선행 조사', fields: [{ key: 'coreConcept', label: '핵심 개념' }, { key: 'relatedFormula', label: '관련 법칙 / 식' }, { key: 'sources', label: '참고 자료 / 출처' }, { key: 'designReflection', label: '실험 설계에 반영한 점' }] },
  { title: '이론 모델과 정량적 예측', fields: [{ key: 'hypothesis', label: '가설' }, { key: 'expectedFormula', label: '예상 관계식' }, { key: 'graphShape', label: '예상 그래프 형태 / 범위 / 기울기' }, { key: 'failureConditions', label: '가설이 어긋날 조건' }] },
  { title: '변인과 실험 설계', fields: [{ key: 'independentVariable', label: '독립 변인' }, { key: 'dependentVariable', label: '종속 변인' }, { key: 'controlVariables', label: '통제 변인' }, { key: 'operationalDefinition', label: '조작적 정의' }, { key: 'confounders', label: '교란 가능 요인' }] },
  { title: '실험과 데이터 분석', fields: [{ key: 'equipmentPlan', label: '측정 실험준비물 계획' }, { key: 'protocol', label: '장치 점검 및 프로토콜 수정 로그' }, { key: 'rawData', label: '원자료(Raw Data)', hint: '회차 · 조건 · 측정 1~3 · 관찰 메모를 줄마다 기록해 주세요.' }, { key: 'analysis', label: '정제 데이터와 그래프 분석' }, { key: 'errorAnalysis', label: '이상치, 계통오차, 우연오차 분석' }] },
  { title: '결론과 재설계', fields: [{ key: 'conclusion', label: '물리적 해석과 오늘의 결론' }, { key: 'nextPlan', label: '정확도를 높이기 위해 바꿀 점 / 다음 회차 목표' }, { key: 'peerReview', label: '팀원의 질문과 반영 계획' }] },
]

const cumulativeSections: JournalSection[] = [
  { title: '기본 정보', fields: [{ key: 'topic', label: '탐구 주제' }, { key: 'stage', label: '오늘의 실험 단계' }, { key: 'role', label: '오늘의 역할' }, { key: 'members', label: '팀원과 역할 분담' }] },
  { title: '연구 질문과 사전 조사', fields: [{ key: 'researchQuestion', label: '핵심 연구 질문' }, { key: 'researchBackground', label: '연구 질문의 배경' }, { key: 'priorKnowledge', label: '선행 지식 / 문헌' }, { key: 'todayFocus', label: '오늘 실험의 초점' }, { key: 'sources', label: '자료 출처와 실험 설계에 반영한 점' }] },
  { title: '가설 및 변인 설계', fields: [{ key: 'hypothesis', label: '가설' }, { key: 'quantitativePrediction', label: '정량적 예측' }, { key: 'predictionLimits', label: '예상과 다를 가능성' }, { key: 'independentVariable', label: '독립 변인' }, { key: 'dependentVariable', label: '종속 변인' }, { key: 'controlVariables', label: '통제 변인 / 교란 가능 요인' }, { key: 'operationalDefinition', label: '조작적 정의' }] },
  { title: '실험 준비와 실제 절차', fields: [{ key: 'equipment', label: '사용 장비 / 재료와 사전 점검' }, { key: 'safety', label: '안전 점검과 오늘의 개선 사항' }, { key: 'procedure', label: '실제 수행 절차 / 수정 사항 / 유의점' }] },
  { title: '원자료와 해석', fields: [{ key: 'rawData', label: '원자료(Raw Data)', hint: '회차 · 조건 · 측정값 1~3 · 관찰 메모를 줄마다 기록해 주세요.' }, { key: 'observations', label: '실험 중 관찰한 현상' }, { key: 'analysis', label: '데이터 정리 및 1차 해석' }, { key: 'errorAnalysis', label: '이상치 및 오차 분석' }] },
  { title: '다음 연구를 위한 기록', fields: [{ key: 'nextPlan', label: '재설계 및 다음 실험 계획' }, { key: 'peerReview', label: '동료 검토와 반영 계획' }, { key: 'reflection', label: '연구자 성찰' }, { key: 'teacherGuidance', label: '교사 확인 및 다음 회차 지도 포인트' }] },
]

export const JOURNAL_TEMPLATES: Record<JournalTemplateType, JournalTemplate> = {
  basic: { type: 'basic', name: '기본형', subtitle: '1회용', description: '한 회차 실험의 질문, 측정, 빠른 분석과 다음 계획을 기록해요.', sections: basicSections },
  advanced: { type: 'advanced', name: '심화연구형', subtitle: '1회용', description: '모델·정량 예측·오차 분석까지 연구자처럼 깊게 기록해요.', sections: advancedSections },
  cumulative: { type: 'cumulative', name: '누적형', subtitle: '학생용', description: '문헌 검토부터 성찰까지 장기 탐구의 전 과정을 쌓아가요.', sections: cumulativeSections },
}

export const templateTypes = Object.keys(JOURNAL_TEMPLATES) as JournalTemplateType[]
