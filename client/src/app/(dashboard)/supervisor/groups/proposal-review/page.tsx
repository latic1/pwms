'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProposalReviewRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/supervisor/groups')
  }, [router])
  return null
}
