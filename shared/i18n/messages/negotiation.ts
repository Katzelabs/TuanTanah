import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'negotiation.proposed': '{{name}} proposed a {{deal}} to {{to}}',
    'negotiation.accepted': "{{name}} accepted {{proposer}}'s {{deal}}",
    'negotiation.rejected': "{{name}} rejected {{proposer}}'s {{deal}}",
    'negotiation.swap': '{{name}} and {{other}} swapped {{tile1}} ↔ {{tile2}}',
    'negotiation.swapWithCash':
      '{{name}} and {{other}} swapped {{tile1}} ↔ {{tile2}} with {{amount}} from {{payer}}',
    'negotiation.bought': '{{name}} bought {{tile}} from {{from}} for {{amount}}',
    'negotiation.sold': '{{name}} sold {{tile}} to {{to}} for {{amount}}',
  },
  id: {
    'negotiation.proposed': '{{name}} mengajukan {{deal}} kepada {{to}}',
    'negotiation.accepted': '{{name}} menerima {{deal}} dari {{proposer}}',
    'negotiation.rejected': '{{name}} menolak {{deal}} dari {{proposer}}',
    'negotiation.swap': '{{name}} dan {{other}} menukar {{tile1}} ↔ {{tile2}}',
    'negotiation.swapWithCash':
      '{{name}} dan {{other}} menukar {{tile1}} ↔ {{tile2}} dengan {{amount}} dari {{payer}}',
    'negotiation.bought': '{{name}} membeli {{tile}} dari {{from}} seharga {{amount}}',
    'negotiation.sold': '{{name}} menjual {{tile}} kepada {{to}} seharga {{amount}}',
  },
}

export const error: MessageMap = {
  en: {
    'negotiation.dealGone': 'That deal is no longer available',
    'negotiation.notTarget': 'Only the target can respond to this deal',
    'negotiation.playerGone': 'A player in this deal is no longer available',
    // validateDeal failures
    'negotiation.proposerNotInGame': 'Proposer is not in the game',
    'negotiation.targetNotFound': 'Target player not found',
    'negotiation.dealWithSelf': 'You cannot make a deal with yourself',
    'negotiation.bothMustBeActive': 'Both players must be active',
    'negotiation.selectTileEachSide': 'Select a tile from each side',
    'negotiation.pickTwoDifferent': 'Pick two different tiles',
    'negotiation.noLongerOwnOffered': 'You no longer own the offered tile',
    'negotiation.targetNoLongerOwnsRequested': '{{name}} no longer owns the requested tile',
    'negotiation.cashTopupNegative': 'Cash top-up cannot be negative',
    'negotiation.chooseTopupPayer': 'Choose who pays the cash top-up',
    'negotiation.payerCannotAffordTopup': '{{name}} cannot afford the cash top-up',
    'negotiation.selectTileToBuy': 'Select a tile to buy',
    'negotiation.enterPrice': 'Enter a price',
    'negotiation.targetNoLongerOwnsThat': '{{name}} no longer owns that tile',
    'negotiation.cannotAffordOffer': 'You cannot afford this offer',
    'negotiation.selectTileToSell': 'Select a tile to sell',
    'negotiation.namedCannotAffordOffer': '{{name}} cannot afford this offer',
    'negotiation.unknownDealType': 'Unknown deal type',
  },
  id: {
    'negotiation.dealGone': 'Penawaran tersebut sudah tidak tersedia',
    'negotiation.notTarget': 'Hanya target yang dapat merespons penawaran ini',
    'negotiation.playerGone': 'Salah satu pemain dalam kesepakatan ini sudah tidak tersedia',
    // validateDeal failures
    'negotiation.proposerNotInGame': 'Pengusul tidak ada dalam permainan',
    'negotiation.targetNotFound': 'Pemain target tidak ditemukan',
    'negotiation.dealWithSelf': 'Kamu tidak bisa membuat kesepakatan dengan diri sendiri',
    'negotiation.bothMustBeActive': 'Kedua pemain harus aktif',
    'negotiation.selectTileEachSide': 'Pilih satu petak dari masing-masing pihak',
    'negotiation.pickTwoDifferent': 'Pilih dua petak yang berbeda',
    'negotiation.noLongerOwnOffered': 'Kamu tidak lagi memiliki petak yang ditawarkan',
    'negotiation.targetNoLongerOwnsRequested': '{{name}} tidak lagi memiliki petak yang diminta',
    'negotiation.cashTopupNegative': 'Tambahan uang tidak boleh negatif',
    'negotiation.chooseTopupPayer': 'Pilih siapa yang membayar tambahan uang',
    'negotiation.payerCannotAffordTopup': '{{name}} tidak mampu membayar tambahan uang',
    'negotiation.selectTileToBuy': 'Pilih petak untuk dibeli',
    'negotiation.enterPrice': 'Masukkan harga',
    'negotiation.targetNoLongerOwnsThat': '{{name}} tidak lagi memiliki petak itu',
    'negotiation.cannotAffordOffer': 'Kamu tidak mampu membayar penawaran ini',
    'negotiation.selectTileToSell': 'Pilih petak untuk dijual',
    'negotiation.namedCannotAffordOffer': '{{name}} tidak mampu membayar penawaran ini',
    'negotiation.unknownDealType': 'Jenis kesepakatan tidak dikenal',
  },
}
