import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useSettingsStore = create()(persist((set) => ({
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
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        set({ theme });
    },
    setAutoApproveTools: (auto) => set({ autoApproveTools: auto }),
    setFontSize: (size) => set({ fontSize: size }),
}), {
    name: 'openclaude-settings',
}));
