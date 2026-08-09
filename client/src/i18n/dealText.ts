import { type GameState, type NegotiationDeal } from '@tuan-tanah/shared'
import { type useTranslation } from 'react-i18next'
import { formatRupiah } from '@/store/gameStore.js'
import { tileName } from './gameData.js'

type TFunc = ReturnType<typeof useTranslation>['t']

export function playerName(state: GameState, id: string, t: TFunc): string {
  return state.players.find((p) => p.id === id)?.name ?? t('negotiation.someone')
}

/** Plain-language summary of a deal from the target (responder)'s point of view. */
export function describeDeal(state: GameState, deal: NegotiationDeal, t: TFunc): string {
  const from = playerName(state, deal.fromPlayerId, t)
  switch (deal.type) {
    case 'property_swap': {
      const base = t('negotiation.desc.property_swap', {
        from,
        offer: tileName(t, deal.offerTileId!),
        request: tileName(t, deal.requestTileId!),
      })
      if (!deal.cashAmount) return base
      const cash = formatRupiah(deal.cashAmount)
      // cashFrom = who pays. 'proposer' = they add cash; 'target' = you add cash.
      return `${base} ${
        deal.cashFrom === 'proposer'
          ? t('negotiation.desc.swap_cash_they', { from, cash })
          : t('negotiation.desc.swap_cash_you', { from, cash })
      }`
    }
    case 'cash_for_property':
      return t('negotiation.desc.cash_for_property', {
        from,
        cash: formatRupiah(deal.cashAmount ?? 0),
        request: tileName(t, deal.requestTileId!),
      })
    case 'sell_property':
      return t('negotiation.desc.sell_property', {
        from,
        cash: formatRupiah(deal.cashAmount ?? 0),
        offer: tileName(t, deal.offerTileId!),
      })
  }
}
