import {
  ALL_ROLES,
  MIN_PLAYERS,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TIME_LIMIT_OPTIONS,
  type Role,
  type RoomSettings as Settings,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Tabs } from '@/components/ui/index.js'
import { roleName } from '@/i18n/gameData.js'
import { formatRupiah } from '@/store/gameStore.js'
import { LobbyPanel, PanelSubheading } from './LobbyPanel.js'
import {
  ChoiceGroup,
  HostOnlyNote,
  ReadOnlyValue,
  SettingSlider,
  ToggleRow,
} from './SettingsControls.js'

const SETTINGS_TABS = ['general', 'roles', 'rules'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

const STARTING_CASH_STEP = 1_000_000

/**
 * Room setup, three tabs deep. Every change round-trips through
 * `update_settings` → server → broadcast; nothing here is predicted locally.
 *
 * Non-masters get a read-only rendering rather than disabled controls: a dead
 * checkbox tells you neither the value nor why you can't touch it.
 */
export function RoomSettings({
  settings,
  isMaster,
  onChange,
  className = '',
}: {
  settings: Settings
  isMaster: boolean
  onChange: (partial: Partial<Settings>) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<SettingsTab>('general')

  const toggleRole = (role: Role, on: boolean) =>
    onChange({
      enabledRoles: on
        ? [...settings.enabledRoles, role]
        : settings.enabledRoles.filter((r) => r !== role),
    })

  return (
    <LobbyPanel
      title={t('lobby.settings')}
      aside={
        // Below MIN_PLAYERS enabled roles the room can never start, since a
        // role belongs to at most one player.
        tab === 'roles' ? (
          <Badge tone={settings.enabledRoles.length < MIN_PLAYERS ? 'danger' : 'neutral'}>
            {t('lobby.enabledRolesCount', {
              count: settings.enabledRoles.length,
              total: ALL_ROLES.length,
            })}
          </Badge>
        ) : undefined
      }
      className={className}
    >
      <Tabs
        tabs={SETTINGS_TABS.map((id) => ({ id, label: t(`lobby.tabs.${id}`) }))}
        active={tab}
        onChange={(id) => setTab(id as SettingsTab)}
        className="bg-surface"
      />

      {!isMaster && <HostOnlyNote />}

      {tab === 'general' && (
        <div className="space-y-4">
          <section className="space-y-1.5">
            <PanelSubheading>{t('lobby.startingCash')}</PanelSubheading>
            {isMaster ? (
              <SettingSlider
                value={settings.startingCash}
                min={STARTING_CASH_MIN}
                max={STARTING_CASH_MAX}
                step={STARTING_CASH_STEP}
                format={formatRupiah}
                onCommit={(startingCash) => onChange({ startingCash })}
              />
            ) : (
              <ReadOnlyValue>{formatRupiah(settings.startingCash)}</ReadOnlyValue>
            )}
            <p className="text-2xs leading-snug text-ink-faint">{t('lobby.startingCashHint')}</p>
          </section>

          <section className="space-y-1.5">
            <PanelSubheading>{t('lobby.timeLimit')}</PanelSubheading>
            {isMaster ? (
              <ChoiceGroup
                options={TIME_LIMIT_OPTIONS}
                value={settings.timeLimitMinutes}
                onChange={(timeLimitMinutes) => onChange({ timeLimitMinutes })}
                label={(min) => t('lobby.timeLimitValue', { count: min })}
              />
            ) : (
              <ReadOnlyValue>
                {t('lobby.timeLimitValue', { count: settings.timeLimitMinutes })}
              </ReadOnlyValue>
            )}
            <p className="text-2xs leading-snug text-ink-faint">{t('lobby.timeLimitHint')}</p>
          </section>
        </div>
      )}

      {tab === 'roles' && (
        <section className="space-y-1.5">
          <PanelSubheading>{t('lobby.enabledRoles')}</PanelSubheading>
          {isMaster ? (
            <div className="grid gap-1.5 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-1">
              {ALL_ROLES.map((role) => (
                <ToggleRow
                  key={role}
                  checked={settings.enabledRoles.includes(role)}
                  onChange={(on) => toggleRole(role, on)}
                  label={roleName(t, role)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ALL_ROLES.map((role) => {
                const on = settings.enabledRoles.includes(role)
                return (
                  <Badge
                    key={role}
                    tone="neutral"
                    className={on ? '' : 'text-ink-faint line-through'}
                  >
                    {roleName(t, role)}
                  </Badge>
                )
              })}
            </div>
          )}
          <p className="text-2xs leading-snug text-ink-faint">{t('lobby.enabledRolesHint')}</p>
        </section>
      )}

      {tab === 'rules' && (
        <section className="space-y-1.5">
          <PanelSubheading>{t('lobby.buildRules')}</PanelSubheading>
          {isMaster ? (
            <ToggleRow
              checked={settings.requireFullRegionToBuild}
              onChange={(requireFullRegionToBuild) => onChange({ requireFullRegionToBuild })}
              label={t('lobby.requireFullRegion')}
              hint={t('lobby.requireFullRegionHint')}
            />
          ) : (
            <>
              <ReadOnlyValue>
                {t('lobby.requireFullRegion')} ·{' '}
                {settings.requireFullRegionToBuild ? t('lobby.on') : t('lobby.off')}
              </ReadOnlyValue>
              <p className="text-2xs leading-snug text-ink-faint">
                {t('lobby.requireFullRegionHint')}
              </p>
            </>
          )}
        </section>
      )}
    </LobbyPanel>
  )
}
