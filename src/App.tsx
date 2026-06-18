import React, { Component } from "react"
import { createContext, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthState } from './hooks/useAuth'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/ui/Toast'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui/Spinner'
import type { Profile } from './types'

const LoginPage    = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MesasPage    = lazy(() => import('./pages/MesasPage'))
const ComandaPage  = lazy(() => import('./pages/ComandaPage'))
const PedidosPage  = lazy(() => import('./pages/PedidosPage'))
const ProdutosPage = lazy(() => import('./pages/ProdutosPage'))
const EstoquePage  = lazy(() => import('./pages/EstoquePage'))
const ClientesPage = lazy(() => import('./pages/ClientesPage'))
const ConfigPage   = lazy(() => import('./pages/ConfigPage'))
const CaixaPage    = lazy(() => import('./pages/CaixaPage'))
const QRMenuPage   = lazy(() => import('./pages/qr/QRMenuPage'))
const GuidePage     = lazy(() => import('./pages/GuidePage'))
const ProducaoPage  = lazy(() => import('./pages/ProducaoPage'))

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  componentDidCatch(e: Error, info: React.ErrorInfo) { console.error('ErrorBoundary:', e, info) }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: 12, padding: 24 }}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>Erro inesperado</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
          {(this.state.error as Error).message}
        </p>
        <button onClick={() => { this.setState({ error: null }); window.location.reload() }}
          style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          Recarregar
        </button>
      </div>
    )
    return this.props.children
  }
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={36} />
    </div>
  )
}

function PrivateRoute({ children, roles }: { children: React.ReactElement; roles?: Profile['role'][] }) {
  const { session, profile, loading } = useAuthState()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const authState = useAuthState()

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
      <AuthContext.Provider value={authState}>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/m/:mesaNumber" element={<QRMenuPage />} />
              <Route path="/login" element={
                authState.session ? <Navigate to="/" replace /> : <LoginPage />
              } />
              <Route path="/*" element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/"         element={<DashboardPage />} />
                      <Route path="/mesas"    element={<MesasPage />} />
                      <Route path="/comanda/:id" element={<ComandaPage />} />
                      <Route path="/pedidos"  element={<PedidosPage />} />
                      <Route path="/produtos" element={<ProdutosPage />} />
                      <Route path="/estoque"  element={<EstoquePage />} />
                      <Route path="/clientes" element={<ClientesPage />} />
                      <Route path="/caixa"    element={<CaixaPage />} />
                      <Route path="/config"   element={<ConfigPage />} />
                      <Route path="/guia"      element={<GuidePage />} />
                      <Route path="/producao"  element={<ProducaoPage />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthContext.Provider>
      </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}
