import { MongoClient, type Db, type ObjectId } from "mongodb"
import type { MatchStatus, Modality, TeamIndex } from "@/lib/types"

export type PlayerDoc = {
  _id: ObjectId
  name: string
  nameKey: string
  createdAt: Date
}

export type MatchDoc = {
  _id: ObjectId
  status: MatchStatus
  modality: Modality
  teams: [
    { playerIds: ObjectId[]; score: number },
    { playerIds: ObjectId[]; score: number },
  ]
  bench: ObjectId[]
  winnerTeam: TeamIndex | null
  createdAt: Date
  finishedAt: Date | null
}

type MongoGlobal = {
  client?: Promise<MongoClient>
  indexes?: Promise<void>
}

const globalForMongo = globalThis as typeof globalThis & {
  __trucoMongo?: MongoGlobal
}

function cache(): MongoGlobal {
  if (!globalForMongo.__trucoMongo) {
    globalForMongo.__trucoMongo = {}
  }
  return globalForMongo.__trucoMongo
}

export function getMongoConfig(): { uri: string; dbName: string } | null {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB
  if (!uri || !dbName) return null
  return { uri, dbName }
}

export function mongoConfigured(): boolean {
  return getMongoConfig() !== null
}

export async function getDb(): Promise<Db> {
  const config = getMongoConfig()
  if (!config) {
    throw new Error("MongoDB no está configurado")
  }

  const slot = cache()
  if (!slot.client) {
    const client = new MongoClient(config.uri, {
      serverSelectionTimeoutMS: 8000,
    })
    slot.client = client.connect().catch((error: unknown) => {
      slot.client = undefined
      throw error
    })
  }

  const client = await slot.client
  const db = client.db(config.dbName)

  if (!slot.indexes) {
    slot.indexes = db
      .collection<PlayerDoc>("players")
      .createIndex({ nameKey: 1 }, { unique: true })
      .then(() => undefined)
      .catch((error: unknown) => {
        slot.indexes = undefined
        throw error
      })
  }

  await slot.indexes
  return db
}
