import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const api = axios.create({ baseURL: API_BASE })

// ─── Attach access token ───────────────────────────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken')
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// ─── Refresh on 401 ───────────────────────────────────────────────────────────

let isRefreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(token: string | null, error: unknown = null) {
  queue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((token) => {
        original.headers['Authorization'] = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      processQueue(null, error)
      isRefreshing = false
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${API_BASE}/auth/refresh`,
        { refreshToken }
      )
      const newToken = data.accessToken
      localStorage.setItem('accessToken', newToken)
      processQueue(newToken)
      original.headers['Authorization'] = `Bearer ${newToken}`
      return api(original)
    } catch (err) {
      processQueue(null, err)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
