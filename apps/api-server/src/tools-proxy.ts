/**
 * tools-proxy.ts
 * Agi-Suite proxy to Agent-OS tool registry
 */
import { Router, Request, Response } from 'express'

const AGENT_OS_URL = process.env.AGENT_OS_URL || 'http://localhost:5001'

export function setupToolsProxy(router: Router) {
  async function fetchAgentOS<T>(path: string): Promise<T> {
    const res = await fetch(`${AGENT_OS_URL}/api${path}`)
    if (!res.ok) throw new Error(`Agent-OS error: ${res.statusText}`)
    return res.json()
  }

  // GET /api/tools — proxy to Agent-OS
  router.get('/tools', async (_req: Request, res: Response) => {
    try {
      const data = await fetchAgentOS('/tools')
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // GET /api/tools/:id — get specific tool
  router.get('/tools/:id', async (req: Request, res: Response) => {
    try {
      const data = await fetchAgentOS(`/tools/${req.params.id}`)
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })
}
