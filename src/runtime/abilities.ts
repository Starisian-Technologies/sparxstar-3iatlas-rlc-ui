import { emitRuntimeEvent } from '@/runtime/events'

export type AbilityName =
  | 'eshu.translate'
  | 'eshu.pronunciation'
  | 'eshu.semanticHint'

export interface AbilityContext {
  language?: string
  mode?: string
  sourceText?: string
}

export interface AbilityResult {
  ability: AbilityName
  title: string
  summary: string
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ability payload: ${JSON.stringify(value)}`)
}

export async function invokeAbility(
  ability: AbilityName,
  context: AbilityContext = {},
): Promise<AbilityResult> {
  emitRuntimeEvent('ABILITY_INVOKED', {
    mode: context.mode ?? null,
    metadata: {
      ability,
      language: context.language ?? null,
      hasSourceText: Boolean(context.sourceText?.trim()),
    },
  })

  const sourceLabel = context.sourceText?.trim() ? `"${context.sourceText.trim()}"` : 'the active entry'
  const languageLabel = context.language ?? 'the current language'

  switch (ability) {
    case 'eshu.translate':
      return {
        ability,
        title: 'Translation boundary ready',
        summary: `When Eshu is wired, this action can suggest a gloss for ${sourceLabel} in ${languageLabel}.`,
      }
    case 'eshu.pronunciation':
      return {
        ability,
        title: 'Pronunciation boundary ready',
        summary: `This ability is reserved for calm pronunciation support for ${sourceLabel}, without live assistant theatrics.`,
      }
    case 'eshu.semanticHint':
      return {
        ability,
        title: 'Semantic hint boundary ready',
        summary: `This hook can surface semantic clustering and duplicate-awareness cues for ${sourceLabel}.`,
      }
  }

  return assertNever(ability)
}
