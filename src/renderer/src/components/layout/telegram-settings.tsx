import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useNotifications } from '@/hooks/use-notifications'

export function TelegramSettings(): React.JSX.Element {
  const [chatId, setChatId] = React.useState('')
  const [token, setToken] = React.useState('')
  const [isConfigured, setIsConfigured] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const { notify } = useNotifications()

  React.useEffect(() => {
    void window.api.telegramSettings
      .get()
      .then((settings) => {
        setIsConfigured(settings.configured)
        setChatId(settings.chatId ?? '')
      })
      .catch(() => notify({ type: 'error', title: 'Telegram settings could not be loaded.' }))
  }, [notify])

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const settings = await window.api.telegramSettings.save({ token, chatId })
      setIsConfigured(settings.configured)
      setChatId(settings.chatId ?? '')
      setToken('')
      notify({ type: 'success', title: 'Telegram settings saved.' })
    } catch {
      notify({
        type: 'error',
        title: 'Telegram settings could not be saved.',
        description: 'Check the bot token and chat ID, then try again.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="mt-6 max-w-xl" onSubmit={(event) => void save(event)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="telegram-chat-id">Telegram chat ID</FieldLabel>
          <Input
            id="telegram-chat-id"
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            inputMode="numeric"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="telegram-bot-token">Bot token</FieldLabel>
          <Input
            id="telegram-bot-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="new-password"
            required={!isConfigured}
          />
          <FieldDescription>
            {isConfigured
              ? 'Leave blank to keep the existing encrypted token.'
              : 'Stored encrypted on this device and never shown again.'}
          </FieldDescription>
        </Field>
        <div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Telegram settings'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
