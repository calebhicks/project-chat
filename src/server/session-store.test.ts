import { describe, it, expect } from 'vitest'
import { MemorySessionStore } from './session-store.js'

describe('MemorySessionStore', () => {
  it('stores and retrieves sessions', async () => {
    const store = new MemorySessionStore()
    const data = { createdAt: Date.now(), lastActiveAt: Date.now(), messageCount: 1 }

    await store.set('test-1', data)
    const result = await store.get('test-1')
    expect(result).toEqual(data)
  })

  it('returns null for missing sessions', async () => {
    const store = new MemorySessionStore()
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('deletes sessions', async () => {
    const store = new MemorySessionStore()
    await store.set('test-1', { createdAt: Date.now(), lastActiveAt: Date.now(), messageCount: 1 })
    await store.delete('test-1')
    expect(await store.get('test-1')).toBeNull()
  })

  it('expires sessions after maxAge', async () => {
    const store = new MemorySessionStore({ maxAgeMs: 1 }) // 1ms
    await store.set('test-1', {
      createdAt: Date.now() - 100,
      lastActiveAt: Date.now() - 100,
      messageCount: 1,
    })

    // Wait a tick for expiry
    await new Promise(r => setTimeout(r, 5))
    expect(await store.get('test-1')).toBeNull()
  })
})
