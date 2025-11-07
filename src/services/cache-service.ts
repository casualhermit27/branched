// Cache Layer Service - SQLite for rapid branch restoration
// Falls back to in-memory cache if SQLite not available

interface CacheEntry {
  key: string
  value: any
  expiresAt: number
}

class CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map()
  private defaultTTL = 3600000 // 1 hour

  /**
   * Get cached value
   */
  async get(key: string): Promise<any | null> {
    const entry = this.memoryCache.get(key)
    
    if (!entry) return null
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * Set cached value
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    const expiresAt = Date.now() + ttl
    this.memoryCache.set(key, { key, value, expiresAt })
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
  }

  /**
   * Cache conversation for rapid restoration
   */
  async cacheConversation(conversationId: string, conversation: any): Promise<void> {
    await this.set(`conversation:${conversationId}`, conversation, 7200000) // 2 hours
  }

  /**
   * Get cached conversation
   */
  async getCachedConversation(conversationId: string): Promise<any | null> {
    return await this.get(`conversation:${conversationId}`)
  }

  /**
   * Cache branch
   */
  async cacheBranch(branchId: string, branch: any): Promise<void> {
    await this.set(`branch:${branchId}`, branch, 7200000)
  }

  /**
   * Get cached branch
   */
  async getCachedBranch(branchId: string): Promise<any | null> {
    return await this.get(`branch:${branchId}`)
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key)
      }
    }
  }
}

export const cacheService = new CacheService()

// Clean expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    cacheService.cleanExpired()
  }, 300000)
}

