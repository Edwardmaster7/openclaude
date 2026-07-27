import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Zustand helper type (module types unavailable at compile time)
type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void

export interface SettingsState {
  serverUrl: string
  authToken: string
  workingDirectory: string
  model: string
  theme: 'light' | 'dark'
  autoApproveTools: boolean
  fontSize: number

  setServerUrl: (url: string) => void
  setAuthToken: (token: string) => void
  setWorkingDirectory: (dir: string) => void
  setModel: (model: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  setAutoApproveTools: (auto: boolean) => void
  setFontSize: (size: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set: any): any => ({
      serverUrl: 'ws://localhost:50051',
      authToken: '',
      workingDirectory: '',
      model: '',
      theme: 'dark',
      autoApproveTools: false,
      fontSize: 14,

      setServerUrl: (url) => set({ serverUrl: url }),
      setAuthToken: (token) => set({ authToken: token }),
      setWorkingDirectory: (dir) => set({ workingDirectory: dir }),
      setModel: (model) => set({ model }),
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme
        document.documentElement.style.colorScheme = theme
        set({ theme })
      },
      setAutoApproveTools: (auto) => set({ autoApproveTools: auto }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'openclaude-settings',
    },
  ),
)
