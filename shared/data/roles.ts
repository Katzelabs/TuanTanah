// Roles — the ten playable archetypes, their GO salaries, and passive tuning.
// Passive design (v3): every role taxes a different stream of the economy; all
// "bonus money" passives are paid by the bank and capped per lap (the cap
// resets when the player passes GO, like the meta-action allowance).
import type { Role, RupiahAmount } from '../types/game.js'
import { jt, rb } from './units.js'

export interface RoleDef {
  id: Role
  name: string
  salary: RupiahAmount // collected at GO
  ability: string
}
export const ROLES: Record<Role, RoleDef> = {
  pengusaha: {
    id: 'pengusaha',
    name: 'Pengusaha',
    salary: jt(3),
    ability: 'Earns +50% on own rent & passive income (max Rp 2jt per lap)',
  },
  pengacara: {
    id: 'pengacara',
    name: 'Pengacara',
    salary: jt(4.5),
    ability: "Law office 50% cheaper + earns 50% of others' legal fees (max Rp 2jt per lap)",
  },
  freelancer: {
    id: 'freelancer',
    name: 'Freelancer',
    salary: jt(4.5),
    ability: 'High GO salary + hustle winnings ×2',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    salary: jt(3),
    ability: 'Earns 15% of rent paid between other players (max Rp 2jt per lap)',
  },
  kontraktor: {
    id: 'kontraktor',
    name: 'Kontraktor',
    salary: jt(3),
    ability: "Builds 50% cheaper + earns 30% of others' build spending (max Rp 2jt per lap)",
  },
  ojol_driver: {
    id: 'ojol_driver',
    name: 'Ojol Driver',
    salary: jt(3),
    ability: 'Pays 50% less tax + earns +50% on own transport rent (max Rp 2jt per lap)',
  },
  influencer: {
    id: 'influencer',
    name: 'Influencer',
    salary: jt(3),
    ability: 'GO salary grows Rp 500rb every round, up to Rp 7jt',
  },
  pejabat: {
    id: 'pejabat',
    name: 'Pejabat',
    salary: jt(5),
    ability: 'Highest salary and can never be jailed',
  },
  rentenir: {
    id: 'rentenir',
    name: 'Rentenir',
    salary: jt(4),
    ability: "Lends pinjol for interest + earns 50% of others' loan interest (max Rp 2jt per lap)",
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    salary: jt(3),
    ability: "Buys property 20% cheaper + earns 50% of others' tile deals (max Rp 1.5jt per lap)",
  },
}

export const ALL_ROLES: Role[] = Object.keys(ROLES) as Role[]

// Token colors assigned to players in join order.
export const PLAYER_COLORS = [
  '#EF4444', // red
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#A855F7', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
]

// ---- Role passives (v3: capped per-lap economy-stream bonuses) ----
export const ROLE_BONUS_CAP: RupiahAmount = jt(2) // default per-lap cap on role bonus money
export const SALES_BONUS_CAP: RupiahAmount = jt(1.5) // Sales' lower per-lap cap
export const PENGUSAHA_INCOME_BONUS_RATE = 0.5 // +50% on own rent & passive income
export const PENGACARA_LAW_DISCOUNT_MULTIPLIER = 0.5 // law-office fees 50% off
export const PENGACARA_LAW_CUT_RATE = 0.5 // 50% of others' law-office spending
export const FREELANCER_HUSTLE_WIN_MULTIPLIER = 2 // hustle winnings doubled
export const INVESTOR_RENT_CUT_RATE = 0.15 // 15% of rent paid between other players
export const KONTRAKTOR_BUILD_DISCOUNT_MULTIPLIER = 0.5 // builds 50% cheaper
export const KONTRAKTOR_BUILD_CUT_RATE = 0.3 // 30% of others' build spending
export const OJOL_TRANSPORT_BONUS_RATE = 0.5 // +50% on own transport-tile rent
export const INFLUENCER_SALARY_STEP: RupiahAmount = rb(500) // salary growth per round
export const INFLUENCER_SALARY_CAP: RupiahAmount = jt(7) // hard salary plateau
export const RENTENIR_INTEREST_CUT_RATE = 0.5 // 50% of others' pinjol interest payments
export const SALES_TRANSACTION_BONUS_RATE = 0.5 // 50% of others' tile buys/sells
export const SALES_BUY_DISCOUNT_MULTIPLIER = 0.8 // buys property 20% cheaper

// ---- Role active abilities (unchanged in the passive-v3 pass) ----
export const INFLUENCER_BOOST_MULTIPLIER = 3 // viral boost passive multiplier
export const INFLUENCER_BOOST_ROUNDS = 3 // viral boost duration
