import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/index.js'
import { FeedbackButton } from './FeedbackButton.js'
import { useFeedback } from './feedbackStore.js'

beforeEach(async () => {
  await i18n.changeLanguage('en')
  useFeedback.setState({ enabled: false, open: false, sent: false, error: null })
})

describe('FeedbackButton', () => {
  it('renders nothing when the server has nowhere to send reports', () => {
    // A deployment with no sink configured is supported. Showing a button that
    // can only ever fail is worse than showing none.
    const { container } = render(<FeedbackButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the form once the server confirms a sink', async () => {
    useFeedback.setState({ enabled: true })
    const user = userEvent.setup()
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report a problem/i }))
    expect(useFeedback.getState().open).toBe(true)
  })
})
