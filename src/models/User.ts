import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name?: string
  email: string
  password?: string
  image?: string
  tier: 'free' | 'pro'
  credits: number
  subscriptionStatus?: 'active' | 'inactive' | 'canceled' | 'past_due'
  dailyFreeUsage: number
  lastDailyReset: Date
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  image: { type: String },
  tier: { type: String, enum: ['free', 'pro'], default: 'free' },
  credits: { type: Number, default: 0 },
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'canceled', 'past_due'], default: 'inactive' },
  dailyFreeUsage: { type: Number, default: 0 },
  lastDailyReset: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
