import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'roles.investorCut': '📈 {{name}} earned {{amount}} investor cut on rent',
    'roles.pengusahaRentBonus': '💼 {{name}} earned a {{amount}} landlord bonus on rent',
    'roles.pengusahaPassiveBonus':
      '💼 {{name}} earned a {{amount}} landlord bonus on passive income',
    'roles.ojolTransportBonus': '🛵 {{name}} earned a {{amount}} driver bonus on transport rent',
    'roles.kontraktorCut': '🏗️ {{name}} earned a {{amount}} contractor cut on that build',
    'roles.pengacaraCut': '⚖️ {{name}} earned a {{amount}} lawyer cut on legal fees',
    'roles.rentenirCut': '🦈 {{name}} earned a {{amount}} loan-shark cut on interest',
    'roles.salesCut': '🤝 {{name}} earned a {{amount}} sales commission on that deal',
    'roles.freelancerHustle': '💪 {{name}} hustled double and earned an extra {{amount}}',
    'roles.pejabatNoJail': '🛡️ {{name}} is untouchable — the jail order was dismissed',
  },
  id: {
    'roles.investorCut': '📈 {{name}} mendapat {{amount}} komisi investor dari sewa',
    'roles.pengusahaRentBonus': '💼 {{name}} mendapat bonus juragan {{amount}} dari sewa',
    'roles.pengusahaPassiveBonus':
      '💼 {{name}} mendapat bonus juragan {{amount}} dari pendapatan pasif',
    'roles.ojolTransportBonus':
      '🛵 {{name}} mendapat bonus driver {{amount}} dari sewa transportasi',
    'roles.kontraktorCut': '🏗️ {{name}} mendapat komisi kontraktor {{amount}} dari pembangunan itu',
    'roles.pengacaraCut': '⚖️ {{name}} mendapat komisi pengacara {{amount}} dari biaya hukum',
    'roles.rentenirCut': '🦈 {{name}} mendapat komisi rentenir {{amount}} dari bunga pinjol',
    'roles.salesCut': '🤝 {{name}} mendapat komisi sales {{amount}} dari transaksi itu',
    'roles.freelancerHustle': '💪 {{name}} hustle dobel dan mendapat tambahan {{amount}}',
    'roles.pejabatNoJail': '🛡️ {{name}} tidak tersentuh — perintah penjara dibatalkan',
  },
}

export const error: MessageMap = {
  en: {
    'roles.cannotJailPejabat': 'A Pejabat cannot be jailed — their connections run too deep',
  },
  id: {
    'roles.cannotJailPejabat': 'Pejabat tidak bisa dipenjara — koneksinya terlalu kuat',
  },
}
