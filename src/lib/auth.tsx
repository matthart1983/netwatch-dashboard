'use client'

import { createContext, useContext, useEffect, useReducer, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { SOURCE_KIND } from './source'

interface AuthContextType {
  token: string | null
  accountId: string | null
  isLoading: boolean
  login: (token: string, accountId: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  accountId: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
})

interface AuthState {
  token: string | null
  accountId: string | null
  isLoading: boolean
}

type AuthAction =
  | { type: 'hydrate'; token: string | null; accountId: string | null }
  | { type: 'login'; token: string; accountId: string }
  | { type: 'logout' }

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'hydrate':
      return {
        token: action.token,
        accountId: action.accountId,
        isLoading: false,
      }
    case 'login':
      return {
        token: action.token,
        accountId: action.accountId,
        isLoading: false,
      }
    case 'logout':
      return {
        token: null,
        accountId: null,
        isLoading: false,
      }
    default:
      return state
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    token: null,
    accountId: null,
    isLoading: true,
  })
  const router = useRouter()

  useEffect(() => {
    if (SOURCE_KIND === 'local') {
      dispatch({
        type: 'hydrate',
        token: window.__NETWATCH_TOKEN__ ?? null,
        accountId: 'local',
      })
      return
    }

    // DEV ONLY: when the bypass flag is set, skip the login flow entirely.
    // The backend (netwatch-cloud) must also have DEV_BYPASS_AUTH=1 — it won't
    // validate the token, but having *a* token prevents client-side redirects
    // to /login on auth-gated pages.
    const bypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === '1'
    if (bypass) {
      dispatch({
        type: 'hydrate',
        token: 'dev-bypass',
        accountId: localStorage.getItem('accountId') ?? 'dev-bypass',
      })
      return
    }

    dispatch({
      type: 'hydrate',
      token: localStorage.getItem('token'),
      accountId: localStorage.getItem('accountId'),
    })
  }, [])

  const loginFn = (newToken: string, newAccountId: string) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('accountId', newAccountId)
    dispatch({ type: 'login', token: newToken, accountId: newAccountId })
  }

  const logout = () => {
    if (SOURCE_KIND === 'local') return
    localStorage.removeItem('token')
    localStorage.removeItem('accountId')
    dispatch({ type: 'logout' })
    router.push('/login')
  }

  return (
    <AuthContext
      value={{
        token: state.token,
        accountId: state.accountId,
        isLoading: state.isLoading,
        login: loginFn,
        logout,
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
