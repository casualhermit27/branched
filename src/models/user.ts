import mongoose, { Schema, Document } from 'mongoose'

export interface IUser {
    name?: string
    email: string
    password?: string // Hashed
    image?: string
    emailVerified?: Date
    apiKeys?: {
        [provider: string]: {
            key: string
            iv: string // Initialization vector for encryption
        }
    }
    usage: {
        branchesCreated: number
        messagesSent: number
        isPremium: boolean
    }
    createdAt: Date
    updatedAt: Date
}

const UserSchema = new Schema<IUser>({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    image: { type: String },
    emailVerified: { type: Date },
    apiKeys: {
        type: Map,
        of: new Schema({
            key: String,
            iv: String
        }, { _id: false }),
        default: {}
    },
    usage: {
        branchesCreated: { type: Number, default: 0 },
        messagesSent: { type: Number, default: 0 },
        isPremium: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

// Update timestamps
UserSchema.pre('save', function (next) {
    this.updatedAt = new Date()
    next()
})

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
