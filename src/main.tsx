import { StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '@/styles/global.scss'
import App from './App'
import { AppProviders } from '@/providers/AppProviders'

const MOCK_START_TIMEOUT_MS = 10_000

type StartupState =
  | { status: 'starting' }
  | { status: 'error'; message: string }

function StartupScreen({ state, onRetry }: { state: StartupState; onRetry: () => void }) {
  const [hover, setHover] = useState(false)
  if (state.status === 'error') {
    return (
      <main style={startupStyles.container} role="alert">
        <section style={startupStyles.card}>
          <h1 style={startupStyles.title}>应用初始化失败</h1>
          <p style={startupStyles.message}>{state.message}</p>
          <button
            type="button"
            style={{
              ...startupStyles.button,
              background: hover ? '#0aa18e' : '#0d9b8a',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onRetry}
          >
            继续启动 / 重试
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={startupStyles.container} role="status" aria-live="polite">
      <section style={startupStyles.card}>
        <h1 style={startupStyles.title}>应用初始化中</h1>
        <p style={startupStyles.message}>正在准备请求服务，请稍候。</p>
      </section>
    </main>
  )
}

const startupStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#0b1424',
    color: '#f3f4f6',
  },
  card: {
    width: 'min(100%, 480px)',
    padding: 32,
    border: '1px solid #2a3548',
    borderRadius: 12,
    background: '#111c2e',
    textAlign: 'center' as const,
  },
  title: { margin: '0 0 12px', fontSize: 22 },
  message: { margin: '0 0 20px', color: '#9aa3b5' },
  button: {
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    background: '#0d9b8a',
    color: '#fff',
    cursor: 'pointer',
  },
}

function renderApp(root: Root): void {
  root.render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Mock 服务启动超时，请检查 mockServiceWorker.js。')), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

async function startMockWorker(): Promise<void> {
  const { worker } = await import('@/mocks/browser')
  await withTimeout(
    worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    }),
    MOCK_START_TIMEOUT_MS,
  )
}

function startupErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Mock 服务无法启动，请检查浏览器控制台或重试。'
}

function bootstrap(root: Root): void {
  const useMock = String(import.meta.env.VITE_USE_MOCK ?? '').trim() === 'true'
  if (!useMock) {
    renderApp(root)
    return
  }

  let startupState: StartupState = { status: 'starting' }

  const renderStartup = () => root.render(<StartupScreen state={startupState} onRetry={() => void initialize()} />)
  const initialize = async (): Promise<void> => {
    startupState = { status: 'starting' }
    renderStartup()

    try {
      await startMockWorker()
    } catch (error: unknown) {
      startupState = { status: 'error', message: startupErrorMessage(error) }
      renderStartup()
      return
    }

    renderApp(root)
  }

  void initialize()
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found')

const root = createRoot(rootElement)
bootstrap(root)
