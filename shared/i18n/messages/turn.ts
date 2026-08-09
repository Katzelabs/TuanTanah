import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'turn.passiveIncome': '{{name}} collected {{amount}} passive income',
    'turn.turnSkipped': "{{name}}'s turn was skipped",
    'turn.turnStart': "{{name}}'s turn",
  },
  id: {
    'turn.passiveIncome': '{{name}} mendapat {{amount}} pendapatan pasif',
    'turn.turnSkipped': 'Giliran {{name}} dilewati',
    'turn.turnStart': 'Giliran {{name}}',
  },
}

export const error: MessageMap = { en: {}, id: {} }
