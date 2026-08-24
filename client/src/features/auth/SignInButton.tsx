import { useTranslation } from 'react-i18next'
import { Button, type ButtonProps } from '@/components/ui/Button.js'
import { useAuth } from './authStore.js'

/** Google's mark, inline so no external asset (and no CSP allowance) is needed. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.2C12.3 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.9 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.9c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.3-10.2 7.3-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.2-8.3 2.2-6.3 0-11.7-4.1-13.6-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}

/** "Sign in with Google" — the only way into an account (no passwords exist). */
export function SignInButton(props: Omit<ButtonProps, 'onClick' | 'children'>) {
  const { t } = useTranslation()
  const signIn = useAuth((s) => s.signIn)

  return (
    <Button variant="secondary" onClick={signIn} {...props}>
      <GoogleMark />
      {t('auth.signIn')}
    </Button>
  )
}
