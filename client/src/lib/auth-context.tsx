'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import type { User, Role } from '@/types'
import { API_BASE } from './api'

interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Dev-only: switch role without real auth */
  setRole?: (role: Role) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const IS_DEV = process.env.NODE_ENV === 'development'

// Dev mock users matching seed data
const DEV_USERS: Record<Role, User> = {
  student: {
    id: 'u1',
    name: 'Alice Johnson',
    email: 'alice@university.edu',
    role: 'student',
    indexNumber: 'UG/2021/001',
    department: 'Computer Science',
    program: 'BSc Computer Science',
    createdAt: new Date().toISOString(),
  },
  supervisor: {
    id: 'u4',
    name: 'Dr. Smith',
    email: 'smith@university.edu',
    role: 'supervisor',
    createdAt: new Date().toISOString(),
  },
  admin: {
    id: 'u6',
    name: 'Admin User',
    email: 'admin@university.edu',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  examiner: {
    id: 'u7',
    name: 'Dr. Jones',
    email: 'jones@university.edu',
    role: 'examiner',
    createdAt: new Date().toISOString(),
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const { data } = await axios.get<User>(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setUser(data)
      } catch {
        // Token expired or invalid — clear storage
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post<LoginResponse>(`${API_BASE}/auth/login`, {
      email,
      password,
    })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser(data.user)
    router.push('/')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    router.push('/login')
  }, [router])

  // Dev-only role switcher (bypasses real auth)
  const setRole = IS_DEV
    ? (role: Role) => {
        setUser(DEV_USERS[role])
      }
    : undefined

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
